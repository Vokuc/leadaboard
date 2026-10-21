import { DatabaseService, isSupabaseConfigured, supabase } from '@/lib/db';
import { ResultAuditService } from '@/lib/competition/audit/service';
import { 
  CompetitionOperationalStatus, 
  CompetitionConfig, 
  Tournament, 
} from '@/types';

export const ALLOWED_LIFECYCLE_TRANSITIONS: Record<CompetitionOperationalStatus, CompetitionOperationalStatus[]> = {
  draft: ['registration_open', 'scheduled', 'cancelled'],
  registration_open: ['scheduled', 'in_progress', 'draft', 'cancelled'],
  scheduled: ['in_progress', 'registration_open', 'cancelled'],
  in_progress: ['under_review', 'completed', 'cancelled'],
  under_review: ['in_progress', 'completed', 'cancelled'],
  completed: ['under_review'], // Authorized reopen by organizers for audited correction
  cancelled: [], // Terminal state
};

export interface UpdateOperationalStatusInput {
  leaderboardId: string;
  targetStatus: CompetitionOperationalStatus;
  reason?: string;
}

export const CompetitionLifecycleService = {
  /**
   * Returns list of allowed next operational states from a given status.
   */
  getAllowedTransitions(currentStatus: CompetitionOperationalStatus): CompetitionOperationalStatus[] {
    return ALLOWED_LIFECYCLE_TRANSITIONS[currentStatus] || [];
  },

  /**
   * Checks whether a direct transition between two states is valid.
   */
  canTransition(fromStatus: CompetitionOperationalStatus, toStatus: CompetitionOperationalStatus): boolean {
    const allowed = this.getAllowedTransitions(fromStatus);
    return allowed.includes(toStatus);
  },

  /**
   * Retrieves current operational status of a competition.
   * Checks competition_configs, tournaments, or falls back to sensible defaults.
   */
  async getOperationalStatus(leaderboardId: string): Promise<CompetitionOperationalStatus> {
    if (isSupabaseConfigured && supabase) {
      // 1. Check competition_configs table
      const { data: config } = await supabase
        .from('competition_configs')
        .select('operational_status, engine_type')
        .eq('leaderboard_id', leaderboardId)
        .maybeSingle();

      if (config?.operational_status) {
        return config.operational_status as CompetitionOperationalStatus;
      }

      // 2. Check tournaments table
      const { data: tourn } = await supabase
        .from('tournaments')
        .select('state')
        .eq('leaderboard_id', leaderboardId)
        .maybeSingle();

      if (tourn?.state) {
        return tourn.state as CompetitionOperationalStatus;
      }
    } else {
      // Local demo mode
      const rawConfigs = typeof window !== 'undefined' 
        ? JSON.parse(localStorage.getItem('leaderboardos_competition_configs') || '[]') as CompetitionConfig[]
        : [];
      const config = rawConfigs.find((c) => c.leaderboard_id === leaderboardId);
      if (config?.operational_status) {
        return config.operational_status;
      }

      const rawTournaments = typeof window !== 'undefined'
        ? JSON.parse(localStorage.getItem('leaderboardos_tournaments') || '[]') as Tournament[]
        : [];
      const tourn = rawTournaments.find((t) => t.leaderboard_id === leaderboardId);
      if (tourn?.state) {
        return tourn.state;
      }
    }

    return 'draft';
  },

  /**
   * Transitions a competition to a target operational state with full validation,
   * permission checking, archive guard, activity logging, and audit tracking.
   */
  async updateOperationalStatus(
    inputOrLeaderboardId: UpdateOperationalStatusInput | string,
    maybeTargetStatus?: CompetitionOperationalStatus,
    maybeReason?: string
  ): Promise<{ previousStatus: CompetitionOperationalStatus; newStatus: CompetitionOperationalStatus }> {
    const input: UpdateOperationalStatusInput =
      typeof inputOrLeaderboardId === 'string'
        ? {
            leaderboardId: inputOrLeaderboardId,
            targetStatus: maybeTargetStatus!,
            reason: maybeReason,
          }
        : inputOrLeaderboardId;

    // 1. Authorization check
    await DatabaseService.requireAdminPermission(input.leaderboardId);

    // 2. Fetch leaderboard and verify not archived
    const leaderboard = await DatabaseService.getLeaderboardById(input.leaderboardId);
    if (!leaderboard) {
      throw new Error('Competition not found.');
    }

    if (leaderboard.status === 'archived') {
      throw new Error(
        'Cannot modify operational lifecycle of an archived competition. Please unarchive it first.'
      );
    }

    // 3. Fetch current status
    const currentStatus = await this.getOperationalStatus(input.leaderboardId);
    if (currentStatus === input.targetStatus) {
      return { previousStatus: currentStatus, newStatus: input.targetStatus };
    }

    // 4. Validate state machine transition
    if (!this.canTransition(currentStatus, input.targetStatus)) {
      throw new Error(
        `Invalid lifecycle transition: Cannot transition competition from '${currentStatus}' to '${input.targetStatus}'.`
      );
    }

    const timestamp = new Date().toISOString();
    const profile = await DatabaseService.getCurrentProfile();
    const reason = (input.reason || '').trim();

    // 5. Engine-specific state updates
    if (isSupabaseConfigured && supabase) {
      // Upsert competition_configs with new operational_status
      const { data: existingConfig } = await supabase
        .from('competition_configs')
        .select('*')
        .eq('leaderboard_id', input.leaderboardId)
        .maybeSingle();

      if (existingConfig) {
        await supabase
          .from('competition_configs')
          .update({
            operational_status: input.targetStatus,
            updated_at: timestamp,
          })
          .eq('leaderboard_id', input.leaderboardId);
      } else {
        await supabase.from('competition_configs').insert([{
          leaderboard_id: input.leaderboardId,
          engine_type: 'simple_points',
          template_key: 'custom',
          entity_type: 'individual',
          operational_status: input.targetStatus,
          created_at: timestamp,
          updated_at: timestamp,
        }]);
      }

      // If tournament, synchronize tournaments.state
      await supabase
        .from('tournaments')
        .update({
          state: input.targetStatus,
          updated_at: timestamp,
        })
        .eq('leaderboard_id', input.leaderboardId);
    } else {
      // Local demo mode updates
      const configsKey = 'leaderboardos_competition_configs';
      const rawConfigs = typeof window !== 'undefined'
        ? JSON.parse(localStorage.getItem(configsKey) || '[]') as CompetitionConfig[]
        : [];
      const configIndex = rawConfigs.findIndex((c) => c.leaderboard_id === input.leaderboardId);
      if (configIndex >= 0) {
        rawConfigs[configIndex] = {
          ...rawConfigs[configIndex],
          operational_status: input.targetStatus,
          updated_at: timestamp,
        };
      } else {
        rawConfigs.push({
          leaderboard_id: input.leaderboardId,
          engine_type: 'simple_points',
          template_key: 'custom',
          entity_type: 'individual',
          operational_status: input.targetStatus,
          created_at: timestamp,
          updated_at: timestamp,
        });
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(configsKey, JSON.stringify(rawConfigs));
      }

      // Sync local tournaments state
      const tournsKey = 'leaderboardos_tournaments';
      const rawTournaments = typeof window !== 'undefined'
        ? JSON.parse(localStorage.getItem(tournsKey) || '[]') as Tournament[]
        : [];
      const tournIndex = rawTournaments.findIndex((t) => t.leaderboard_id === input.leaderboardId);
      if (tournIndex >= 0) {
        rawTournaments[tournIndex] = {
          ...rawTournaments[tournIndex],
          state: input.targetStatus,
          updated_at: timestamp,
        };
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(tournsKey, JSON.stringify(rawTournaments));
        }
      }
    }

    // 6. Record activity log
    const logMsg = `[Lifecycle] Competition operational state changed from '${currentStatus}' to '${input.targetStatus}'${
      reason ? `: ${reason}` : ''
    }`;
    try {
      await DatabaseService.addActivityLog(input.leaderboardId, logMsg);
    } catch (err) {
      console.warn('Failed to emit lifecycle activity log:', err);
    }

    // 7. Record immutable audit log event
    try {
      await ResultAuditService.logAuditEntry({
        leaderboard_id: input.leaderboardId,
        entity_type: 'score_event',
        entity_id: `lifecycle-${input.leaderboardId}`,
        previous_payload: { operational_status: currentStatus },
        proposed_payload: { operational_status: input.targetStatus },
        actor_id: profile?.id || null,
        actor_email: profile?.email || null,
        actor_name: profile?.full_name || 'Admin',
        actor_role: profile?.role === 'super_admin' ? 'owner' : 'admin',
        action: 'correct',
        status: 'approved',
        reason: reason || `Competition operational status transitioned to ${input.targetStatus}`,
        evidence_urls: [],
      });
    } catch (auditErr) {
      console.warn('Failed to record lifecycle audit log:', auditErr);
    }

    return { previousStatus: currentStatus, newStatus: input.targetStatus };
  },
};
