import { DatabaseService, isSupabaseConfigured, mockDb, supabase } from '@/lib/db';
import { buildAuthoritativeCompetitionContext } from './context';
import { ExternalAiProvider } from './providers/external';
import { executeApprovedProposal } from './proposals/executor';
import { checkAiRateLimits, logAiUsage } from './limits';
import {
  AiActionProposal,
  AiChatMessage,
  AiGenerateResult,
  AiTaskType,
  ProposalExecutionResult,
} from './types';

export class CompetitionAiService {
  private static provider = new ExternalAiProvider();

  /**
   * Main chat & assistance entry point.
   * Gathers authoritative data, enforces rate limits, queries provider, and manages proposals.
   */
  static async askAssistant(options: {
    leaderboardId: string;
    prompt: string;
    history?: AiChatMessage[];
    taskType?: AiTaskType;
    actorUserId?: string;
    userPlanTier?: 'free' | 'pro' | 'business' | 'enterprise';
  }): Promise<AiGenerateResult> {
    const {
      leaderboardId,
      prompt,
      history,
      taskType,
      actorUserId,
      userPlanTier = 'free',
    } = options;

    // 1. Authorize organizer access
    if (actorUserId) {
      await DatabaseService.requireAdminPermission(leaderboardId, actorUserId);
    }

    // 2. Enforce rate limits & cost-aware controls
    const rateCheck = await checkAiRateLimits(actorUserId || 'anonymous', leaderboardId, userPlanTier);
    if (!rateCheck.allowed) {
      throw new Error(rateCheck.error || 'Rate limit exceeded. Please try again later.');
    }

    // 3. Build authoritative, PII-scrubbed competition context
    const context = await buildAuthoritativeCompetitionContext(leaderboardId);

    // 4. Query provider
    const result = await this.provider.generateResponse({
      context,
      prompt,
      history,
      taskType,
      actorUserId,
    });

    // 5. If proposal was generated, persist in database/mockDb in 'pending' status
    if (result.proposal) {
      await this.saveProposal(result.proposal);
    }

    // 6. Log usage without retaining private conversation content
    await logAiUsage({
      user_id: actorUserId || null,
      leaderboard_id: leaderboardId,
      provider: result.provider,
      model: result.model,
      prompt_tokens: result.tokensUsed.prompt,
      completion_tokens: result.tokensUsed.completion,
      action_type: taskType ? `proposal_${taskType}` : 'query',
    });

    return result;
  }

  /**
   * Generates a structured proposal for an organizer task.
   */
  static async createProposal(options: {
    leaderboardId: string;
    taskType: AiTaskType;
    instructions?: string;
    actorUserId?: string;
  }): Promise<AiActionProposal> {
    const { leaderboardId, taskType, instructions, actorUserId } = options;

    if (actorUserId) {
      await DatabaseService.requireAdminPermission(leaderboardId, actorUserId);
    }

    const context = await buildAuthoritativeCompetitionContext(leaderboardId);
    const proposal = await this.provider.generateProposal(context, taskType, instructions, actorUserId);

    await this.saveProposal(proposal);
    return proposal;
  }

  /**
   * Retrieves a proposal by ID.
   */
  static async getProposal(proposalId: string): Promise<AiActionProposal | null> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('ai_action_proposals')
        .select('*')
        .eq('id', proposalId)
        .maybeSingle();

      if (error) throw error;
      return data as AiActionProposal | null;
    }

    const proposals = mockDb.getAiProposals();
    return proposals.find((p) => p.id === proposalId) || null;
  }

  /**
   * Confirms and applies an approved proposal.
   * Strictly requires organizer confirmation and validates permissions.
   */
  static async confirmProposal(
    proposalId: string,
    actorUserId?: string
  ): Promise<ProposalExecutionResult> {
    const proposal = await this.getProposal(proposalId);
    if (!proposal) {
      throw new Error(`Proposal "${proposalId}" not found.`);
    }

    // Require organizer permission
    if (actorUserId) {
      await DatabaseService.requireAdminPermission(proposal.leaderboard_id, actorUserId);
    }

    if (proposal.status !== 'pending') {
      throw new Error(`Cannot apply proposal: current status is "${proposal.status}".`);
    }

    if (new Date(proposal.expires_at).getTime() < Date.now()) {
      proposal.status = 'expired';
      await this.saveProposal(proposal);
      throw new Error('This proposal has expired. Please generate a new proposal.');
    }

    if (proposal.validation_errors && proposal.validation_errors.length > 0) {
      throw new Error(
        `Cannot execute invalid proposal: ${proposal.validation_errors.join('; ')}`
      );
    }

    // Execute via authoritative domain services
    const execution = await executeApprovedProposal(proposal, actorUserId);

    // Update status to approved
    proposal.status = 'approved';
    proposal.applied_at = new Date().toISOString();
    await this.saveProposal(proposal);

    return execution;
  }

  /**
   * Rejects a proposal.
   */
  static async rejectProposal(
    proposalId: string,
    actorUserId?: string
  ): Promise<AiActionProposal> {
    const proposal = await this.getProposal(proposalId);
    if (!proposal) {
      throw new Error(`Proposal "${proposalId}" not found.`);
    }

    if (actorUserId) {
      await DatabaseService.requireAdminPermission(proposal.leaderboard_id, actorUserId);
    }

    proposal.status = 'rejected';
    await this.saveProposal(proposal);
    return proposal;
  }

  /**
   * List all proposals for a competition.
   */
  static async getProposalsForCompetition(leaderboardId: string): Promise<AiActionProposal[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('ai_action_proposals')
        .select('*')
        .eq('leaderboard_id', leaderboardId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as AiActionProposal[];
    }

    const proposals = mockDb.getAiProposals();
    return proposals.filter((p) => p.leaderboard_id === leaderboardId);
  }

  private static async saveProposal(proposal: AiActionProposal): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('ai_action_proposals')
        .upsert(proposal, { onConflict: 'id' });

      if (error) {
        console.warn('Supabase upsert proposal warning:', error);
      }
    } else {
      const proposals = mockDb.getAiProposals();
      const idx = proposals.findIndex((p) => p.id === proposal.id);
      if (idx >= 0) {
        proposals[idx] = proposal;
      } else {
        proposals.unshift(proposal);
      }
      mockDb.setAiProposals(proposals);
    }
  }
}
