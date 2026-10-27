import {
  AiActionProposal,
  AiAssistantContext,
  AiGenerateOptions,
  AiGenerateResult,
  AiProvider,
  AiTaskType,
} from '../types';
import { validateProposalPayload } from '../proposals/schemas';

export class GroundedLocalProvider implements AiProvider {
  name = 'grounded_local';

  isAvailable(): boolean {
    return true; // Always available offline, in tests, and in local demo
  }

  async generateResponse(options: AiGenerateOptions): Promise<AiGenerateResult> {
    const { context, prompt, taskType, actorUserId } = options;
    const lowerPrompt = prompt.toLowerCase().trim();

    // 1. Task-based guided proposal request
    if (taskType) {
      const proposal = await this.generateProposal(context, taskType, prompt, actorUserId);
      return {
        content: `I've prepared a **${proposal.title}** proposal based on your competition data. Please review the details below and confirm or decline.`,
        proposal,
        dataSources: ['competition_config', 'rules_engine', 'scheduler'],
        provider: this.name,
        model: 'deterministic-grounded-v1',
        tokensUsed: { prompt: 150, completion: 200 },
      };
    }

    // 2. Read-only: Explain ranking / why a team is ranked
    if (
      lowerPrompt.includes('why') ||
      lowerPrompt.includes('rank') ||
      lowerPrompt.includes('position') ||
      lowerPrompt.includes('standings')
    ) {
      return this.handleExplainRanking(context, prompt);
    }

    // 3. Read-only: Summarize latest match results
    if (
      lowerPrompt.includes('result') ||
      lowerPrompt.includes('score') ||
      lowerPrompt.includes('latest match') ||
      lowerPrompt.includes('recent match')
    ) {
      return this.handleRecentResults(context);
    }

    // 4. Read-only: Identify outstanding fixtures
    if (
      lowerPrompt.includes('outstanding') ||
      lowerPrompt.includes('fixture') ||
      lowerPrompt.includes('upcoming') ||
      lowerPrompt.includes('remaining') ||
      lowerPrompt.includes('schedule')
    ) {
      return this.handleOutstandingFixtures(context);
    }

    // 5. Read-only: Registration / attendance
    if (
      lowerPrompt.includes('registration') ||
      lowerPrompt.includes('attendance') ||
      lowerPrompt.includes('capacity') ||
      lowerPrompt.includes('participant') ||
      lowerPrompt.includes('waitlist')
    ) {
      return this.handleRegistrationSummary(context);
    }

    // 6. Drafting: Rules or Matchday announcement
    if (
      lowerPrompt.includes('draft') ||
      lowerPrompt.includes('announcement') ||
      lowerPrompt.includes('message') ||
      lowerPrompt.includes('rule')
    ) {
      return this.handleDraftAnnouncementOrRules(context, prompt);
    }

    // 7. General competition overview
    return this.handleGeneralOverview(context);
  }

  async generateProposal(
    context: AiAssistantContext,
    taskType: AiTaskType,
    instructions?: string,
    actorUserId?: string
  ): Promise<AiActionProposal> {
    const proposalId = `prop_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    let title = '';
    let summary = '';
    let payload: Record<string, unknown> = {};

    switch (taskType) {
      case 'schedule_draft': {
        title = `Draft League Round-Robin Schedule`;
        summary = `Automated round-robin scheduling for ${context.members_count} entries starting tomorrow, utilizing available venues and standard time slots.`;
        const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
        payload = {
          start_date: tomorrow,
          end_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
          timezone: 'UTC',
          playable_days: [1, 2, 3, 4, 5, 6],
          daily_start_time: '10:00',
          daily_end_time: '18:00',
          match_duration_minutes: 60,
          buffer_minutes: 15,
          double_round_robin: false,
          auto_assign_venues: true,
        };
        break;
      }

      case 'points_rules_draft': {
        title = `Custom Scoring Rules Configuration`;
        summary = `Updated points configuration: 3 points for win, 1 for draw, 0 for loss, with standard goal difference and head-to-head tie-breakers.`;
        payload = {
          points_for_win: 3,
          points_for_draw: 1,
          points_for_loss: 0,
          ranking_order: 'desc',
          tie_breakers: [
            { type: 'points', label: 'Points', direction: 'desc' },
            { type: 'goal_difference', label: 'Goal Difference', direction: 'desc' },
            { type: 'head_to_head', label: 'Head-to-Head', direction: 'desc' },
            { type: 'alphabetical', label: 'Alphabetical', direction: 'asc' },
          ],
        };
        break;
      }

      case 'announcement_draft': {
        title = `Matchday Broadcast Announcement`;
        const nextRound = context.fixtures_summary?.upcoming?.[0]?.round_name || 'Upcoming Matchday';
        summary = `Official organizer broadcast notification informing all participants about ${nextRound}.`;
        payload = {
          title: `${context.leaderboard.name} — ${nextRound} Notice`,
          body: `Welcome competitors! Please be advised that ${nextRound} matches are scheduled to begin promptly. Please check your assigned court or venue on your player portal.`,
        };
        break;
      }

      case 'pathway_proposal': {
        title = `Championship Playoff Pathway`;
        summary = `Advance the top 4 ranked teams from "${context.leaderboard.name}" to the championship elimination bracket.`;
        payload = {
          name: `${context.leaderboard.name} Playoffs`,
          qualifier_count: 4,
          progression_criteria: 'top_ranked',
          seeding_strategy: 'standard_bracket',
        };
        break;
      }

      case 'venue_setup': {
        title = `New Competition Arena`;
        summary = `Configure a new playing venue for fixture allocation.`;
        payload = {
          name: 'Main Arena',
          court_field: 'Court 1',
          capacity: 250,
          location: 'Center Court',
        };
        break;
      }
    }

    const validation = validateProposalPayload(taskType, payload);

    return {
      id: proposalId,
      leaderboard_id: context.leaderboard.id,
      task_type: taskType,
      title,
      summary,
      payload,
      status: 'pending',
      validation_errors: validation.errors,
      created_by: actorUserId || null,
      expires_at: expiresAt,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };
  }

  // ─── Read-Only Grounded Handlers ──────────────────────────────────────────

  private handleExplainRanking(context: AiAssistantContext, prompt: string): AiGenerateResult {
    const standings = context.standings_snapshot;
    if (standings.length === 0) {
      return {
        content: `There are currently no standings or scores recorded for **${context.leaderboard.name}**. Once matches are completed and scores are entered, rankings will populate according to the rules engine.`,
        dataSources: ['standings_table'],
        provider: this.name,
        model: 'deterministic-grounded-v1',
        tokensUsed: { prompt: 100, completion: 80 },
      };
    }

    // Try finding specific member mentioned in prompt
    const mentionedMember = standings.find((s) =>
      prompt.toLowerCase().includes(s.name.toLowerCase())
    );

    const target = mentionedMember || standings[0];
    const rules = context.rules_summary;

    let response = `**${target.name}** is currently ranked **#${target.position}** in **${context.leaderboard.name}**.\n\n`;
    response += `### Official Performance Metrics:\n`;
    response += `- **Points**: ${target.points ?? 0}\n`;
    response += `- **Matches Played**: ${target.played ?? 0} (Wins: ${target.wins ?? 0}, Draws: ${target.draws ?? 0}, Losses: ${target.losses ?? 0})\n`;
    if (target.goal_difference !== undefined) {
      response += `- **Goal / Score Difference**: ${target.goal_difference > 0 ? '+' : ''}${target.goal_difference}\n`;
    }

    response += `\n### Rules & Tie-Breaker Logic:\n`;
    response += `Standings are ordered by **${rules?.ranking_order || 'descending'}** primary metric (**${rules?.engine || 'points'}**).`;
    if (rules?.tie_breakers && rules.tie_breakers.length > 0) {
      response += ` Tied positions are broken sequentially by: ${rules.tie_breakers.join(', ')}.`;
    }

    return {
      content: response,
      dataSources: ['standings_snapshot', 'competition_rules'],
      provider: this.name,
      model: 'deterministic-grounded-v1',
      tokensUsed: { prompt: 120, completion: 180 },
    };
  }

  private handleRecentResults(context: AiAssistantContext): AiGenerateResult {
    const recent = context.fixtures_summary?.recent_results || [];
    if (recent.length === 0) {
      return {
        content: `No match results have been completed or recorded yet for **${context.leaderboard.name}**. Completed scores will be listed here as soon as they are submitted.`,
        dataSources: ['recent_results'],
        provider: this.name,
        model: 'deterministic-grounded-v1',
        tokensUsed: { prompt: 80, completion: 60 },
      };
    }

    let response = `### Latest Match Results for ${context.leaderboard.name}:\n\n`;
    recent.slice(0, 5).forEach((r) => {
      const roundLabel = r.round_name ? ` (${r.round_name})` : '';
      response += `* **${r.home_name}** ${r.home_score} – ${r.away_score} **${r.away_name}**${roundLabel}\n`;
    });

    response += `\n*Total Completed Fixtures:* **${context.fixtures_summary?.completed || 0}** of **${context.fixtures_summary?.total || 0}**.`;

    return {
      content: response,
      dataSources: ['recent_results', 'fixtures_table'],
      provider: this.name,
      model: 'deterministic-grounded-v1',
      tokensUsed: { prompt: 100, completion: 140 },
    };
  }

  private handleOutstandingFixtures(context: AiAssistantContext): AiGenerateResult {
    const summary = context.fixtures_summary;
    const upcoming = summary?.upcoming || [];

    if (!summary || summary.outstanding === 0) {
      return {
        content: `All scheduled fixtures for **${context.leaderboard.name}** have been completed! Total fixtures: **${summary?.total || 0}**.`,
        dataSources: ['fixtures_table'],
        provider: this.name,
        model: 'deterministic-grounded-v1',
        tokensUsed: { prompt: 80, completion: 60 },
      };
    }

    let response = `### Outstanding Fixtures (${summary.outstanding} remaining):\n\n`;
    if (upcoming.length > 0) {
      upcoming.forEach((u) => {
        const round = u.round_name ? `[${u.round_name}] ` : '';
        const venue = u.venue_name ? ` @ ${u.venue_name}` : '';
        const date = u.scheduled_at ? ` on ${new Date(u.scheduled_at).toLocaleDateString()}` : '';
        response += `* ${round}**${u.home_name}** vs **${u.away_name}**${venue}${date}\n`;
      });
    } else {
      response += `There are ${summary.outstanding} unscheduled or pending fixtures waiting to be finalized.`;
    }

    return {
      content: response,
      dataSources: ['fixtures_table', 'venues_table'],
      provider: this.name,
      model: 'deterministic-grounded-v1',
      tokensUsed: { prompt: 100, completion: 150 },
    };
  }

  private handleRegistrationSummary(context: AiAssistantContext): AiGenerateResult {
    const reg = context.registrations_summary;
    if (!reg || !reg.is_enabled) {
      return {
        content: `Public registration is currently **disabled** for **${context.leaderboard.name}**. There are currently **${context.members_count}** direct roster entries.`,
        dataSources: ['registration_config', 'members_table'],
        provider: this.name,
        model: 'deterministic-grounded-v1',
        tokensUsed: { prompt: 80, completion: 70 },
      };
    }

    const capacityLabel = reg.capacity !== null ? `${reg.capacity}` : 'Unlimited';

    let response = `### Registration & Attendance Breakdown for ${context.leaderboard.name}:\n\n`;
    response += `- **Status**: Active registration open\n`;
    response += `- **Capacity**: ${capacityLabel}\n`;
    response += `- **Approved Entries**: ${reg.approved_count}\n`;
    response += `- **Pending Review**: ${reg.pending_count}\n`;
    response += `- **Waitlisted**: ${reg.waitlisted_count}\n`;
    response += `- **Roster Total**: ${context.members_count} participants\n`;

    return {
      content: response,
      dataSources: ['registration_config', 'registrations_table'],
      provider: this.name,
      model: 'deterministic-grounded-v1',
      tokensUsed: { prompt: 90, completion: 120 },
    };
  }

  private handleDraftAnnouncementOrRules(
    context: AiAssistantContext,
    prompt: string
  ): AiGenerateResult {
    const isRules = prompt.toLowerCase().includes('rule');

    if (isRules) {
      const rules = context.rules_summary;
      const content = `### Official Competition Rules Draft for ${context.leaderboard.name}\n\n` +
        `1. **Format**: ${context.config?.template_key || 'Custom League'} (${context.config?.entity_type || 'individual'})\n` +
        `2. **Points Allocation**:\n` +
        `   - Win: **${rules?.points_for_win ?? 3} points**\n` +
        `   - Draw: **${rules?.points_for_draw ?? 1} point**\n` +
        `   - Loss: **${rules?.points_for_loss ?? 0} points**\n` +
        `3. **Tie-Break Hierarchy**: Points > Goal Difference > Head-to-Head > Total Goals Scored.\n` +
        `4. **Match Conduct**: Teams must be present at least 15 minutes before scheduled match start.\n\n` +
        `*Would you like me to draft an official proposal to update these scoring rules in the system?*`;

      return {
        content,
        dataSources: ['rules_engine', 'competition_config'],
        provider: this.name,
        model: 'deterministic-grounded-v1',
        tokensUsed: { prompt: 100, completion: 190 },
      };
    }

    const round = context.fixtures_summary?.upcoming?.[0]?.round_name || 'Upcoming Matchday';
    const content = `### Draft Matchday Announcement\n\n` +
      `📢 **Attention Competitors in ${context.leaderboard.name}**\n\n` +
      `Get ready for **${round}**! Fixtures are set and our match officials are prepared. ` +
      `Please ensure all participants check their assigned courts/venues and report match scores promptly to match control.\n\n` +
      `Good luck to all competitors!\n\n` +
      `*Would you like me to create an announcement proposal to broadcast this directly to your participants?*`;

    return {
      content,
      dataSources: ['fixtures_table', 'leaderboard_metadata'],
      provider: this.name,
      model: 'deterministic-grounded-v1',
      tokensUsed: { prompt: 100, completion: 160 },
    };
  }

  private handleGeneralOverview(context: AiAssistantContext): AiGenerateResult {
    const leader = context.standings_snapshot[0]?.name || 'None';
    const content = `I am your **LeaderboardOS Competition Manager**. I have real-time access to the official standings, rules, fixtures, and registration data for **${context.leaderboard.name}**.\n\n` +
      `- **Entries**: ${context.members_count} participants\n` +
      `- **Current Leader**: ${leader}\n` +
      `- **Fixtures**: ${context.fixtures_summary?.completed || 0} completed, ${context.fixtures_summary?.outstanding || 0} remaining\n\n` +
      `You can ask me to explain why a team is ranked in its current position, summarize latest match results, check outstanding fixtures, review registration numbers, or draft a schedule, scoring rules, or announcements.`;

    return {
      content,
      dataSources: ['leaderboard_metadata', 'standings_snapshot', 'fixtures_table'],
      provider: this.name,
      model: 'deterministic-grounded-v1',
      tokensUsed: { prompt: 80, completion: 140 },
    };
  }
}
