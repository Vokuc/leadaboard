import { DatabaseService, isSupabaseConfigured, supabase, mockDb } from '@/lib/db';
import { LeagueService } from '@/lib/league/service';
import { TournamentService } from '@/lib/tournament/service';
import { CompetitionRulesService } from '@/lib/competition/rules/service';
import { validateScoreAdjustment, validateFixtureResult } from '@/lib/competition/rules/validation';
import { 
  ResultAuditEntry, 
  ResultEntityType, 
  ResultAuditAction, 
  ResultStatus, 
  ResultActorRole,
  ScoreEvent,
  FixtureResult,
  ResolveDisputeInput
} from '@/types';

const STORAGE_KEY = 'leaderboardos_result_audit_log';

function getLocalAuditLog(): ResultAuditEntry[] {
  if (typeof window === 'undefined' && typeof localStorage === 'undefined') return [];
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return [];
    return JSON.parse(raw) as ResultAuditEntry[];
  } catch {
    return [];
  }
}

function appendLocalAuditLog(entry: ResultAuditEntry): void {
  if (typeof window === 'undefined' && typeof localStorage === 'undefined') return;
  if (typeof localStorage !== 'undefined') {
    const current = getLocalAuditLog();
    current.push(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  }
}

function mapDatabaseRowToAuditEntry(row: Record<string, unknown>): ResultAuditEntry {
  return {
    id: String(row.id),
    leaderboard_id: String(row.leaderboard_id),
    entity_type: row.entity_type as ResultEntityType,
    entity_id: String(row.entity_id),
    previous_payload: (row.previous_payload as Record<string, unknown>) || null,
    proposed_payload: (row.proposed_payload as Record<string, unknown>) || {},
    actor_id: row.actor_id ? String(row.actor_id) : null,
    actor_email: row.actor_email ? String(row.actor_email) : null,
    actor_name: row.actor_name ? String(row.actor_name) : null,
    actor_role: (row.actor_role as ResultActorRole) || 'admin',
    participant_id: row.participant_id ? String(row.participant_id) : null,
    participant_name: row.participant_name ? String(row.participant_name) : null,
    action: row.action as ResultAuditAction,
    status: (row.status as ResultStatus) || 'approved',
    reason: String(row.reason || ''),
    evidence_urls: Array.isArray(row.evidence_urls) ? (row.evidence_urls as string[]) : [],
    created_at: String(row.created_at || new Date().toISOString()),
  };
}

export const ResultAuditService = {
  /**
   * Appends an immutable audit entry to the audit log.
   */
  async logAuditEntry(entry: Omit<ResultAuditEntry, 'id' | 'created_at'>): Promise<ResultAuditEntry> {
    let timestamp = new Date().toISOString();
    const localLog = getLocalAuditLog();
    if (localLog.length > 0) {
      const lastTime = new Date(localLog[localLog.length - 1].created_at).getTime();
      const currTime = new Date(timestamp).getTime();
      if (currTime <= lastTime) {
        timestamp = new Date(lastTime + 1).toISOString();
      }
    }
    const id = `audit-${Math.random().toString(36).substring(2, 11)}-${Date.now()}`;

    const newEntry: ResultAuditEntry = {
      ...entry,
      id,
      created_at: timestamp,
    };

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('result_audit_log')
        .insert([{
          leaderboard_id: newEntry.leaderboard_id,
          entity_type: newEntry.entity_type,
          entity_id: newEntry.entity_id,
          previous_payload: newEntry.previous_payload,
          proposed_payload: newEntry.proposed_payload,
          actor_id: newEntry.actor_id,
          actor_email: newEntry.actor_email,
          actor_name: newEntry.actor_name,
          actor_role: newEntry.actor_role,
          participant_id: newEntry.participant_id,
          participant_name: newEntry.participant_name,
          action: newEntry.action,
          status: newEntry.status,
          reason: newEntry.reason,
          evidence_urls: newEntry.evidence_urls,
          created_at: timestamp,
        }])
        .select()
        .single();

      if (error) {
        console.error('Error recording result audit entry:', error);
        throw error;
      }
      return mapDatabaseRowToAuditEntry(data as Record<string, unknown>);
    }

    appendLocalAuditLog(newEntry);
    return newEntry;
  },

  /**
   * Retrieves full chronological revision history for a specific result/match.
   */
  async getAuditHistoryForEntity(entityType: ResultEntityType, entityId: string): Promise<ResultAuditEntry[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('result_audit_log')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching entity audit history:', error);
        return [];
      }
      return (data || []).map((row) => mapDatabaseRowToAuditEntry(row as Record<string, unknown>));
    }

    const localLog = getLocalAuditLog();
    const indexMap = new Map<ResultAuditEntry, number>();
    localLog.forEach((item, idx) => indexMap.set(item, idx));

    return localLog
      .filter((e) => e.entity_type === entityType && e.entity_id === entityId)
      .sort((a, b) => {
        const timeDiff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        if (timeDiff !== 0) return timeDiff;
        return (indexMap.get(b) ?? 0) - (indexMap.get(a) ?? 0);
      });
  },

  /**
   * Retrieves competition-wide audit events with optional status or entity filtering.
   */
  async getAuditHistoryForLeaderboard(
    leaderboardId: string,
    options?: { status?: ResultStatus; entityType?: ResultEntityType; limit?: number }
  ): Promise<ResultAuditEntry[]> {
    if (isSupabaseConfigured && supabase) {
      let query = supabase
        .from('result_audit_log')
        .select('*')
        .eq('leaderboard_id', leaderboardId);

      if (options?.status) {
        query = query.eq('status', options.status);
      }
      if (options?.entityType) {
        query = query.eq('entity_type', options.entityType);
      }

      query = query.order('created_at', { ascending: false });
      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Error fetching leaderboard audit history:', error);
        return [];
      }
      return (data || []).map((row) => mapDatabaseRowToAuditEntry(row as Record<string, unknown>));
    }

    const localLog = getLocalAuditLog();
    const indexMap = new Map<ResultAuditEntry, number>();
    localLog.forEach((item, idx) => indexMap.set(item, idx));

    return localLog
      .filter((e) => {
        if (e.leaderboard_id !== leaderboardId) return false;
        if (options?.status && e.status !== options.status) return false;
        if (options?.entityType && e.entity_type !== options.entityType) return false;
        return true;
      })
      .sort((a, b) => {
        const timeDiff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        if (timeDiff !== 0) return timeDiff;
        return (indexMap.get(b) ?? 0) - (indexMap.get(a) ?? 0);
      })
      .slice(0, options?.limit || 100);
  },

  /**
   * Corrects a simple-points score event, recording the previous value, proposed value, actor, and reason.
   */
  async correctScoreEvent(input: {
    leaderboardId: string;
    scoreEventId: string;
    newPoints: number;
    reason: string;
    evidenceUrls?: string[];
  }): Promise<ResultAuditEntry> {
    await DatabaseService.requireAdminPermission(input.leaderboardId);

    const trimmedReason = (input.reason || '').trim();
    if (trimmedReason.length < 3) {
      throw new Error('A descriptive reason (at least 3 characters) is required for correcting a score.');
    }

    // Validate new points against active competition rules
    const rules = await CompetitionRulesService.getRules(input.leaderboardId);
    const validation = validateScoreAdjustment(rules, { points: input.newPoints, reason: trimmedReason });
    if (!validation.valid) {
      throw new Error(validation.errors.join(' '));
    }

    const profile = await DatabaseService.getCurrentProfile();

    let previousScoreEvent: ScoreEvent | null = null;
    let participantName = 'Unknown Player';

    if (isSupabaseConfigured && supabase) {
      const { data: currentEvent, error: fetchError } = await supabase
        .from('score_events')
        .select('*, leaderboard_members(name)')
        .eq('id', input.scoreEventId)
        .single();

      if (fetchError || !currentEvent) {
        throw new Error('Score event not found.');
      }

      previousScoreEvent = currentEvent as ScoreEvent;
      participantName = (currentEvent.leaderboard_members as { name?: string })?.name || 'Unknown Player';

      // Update score event
      const { error: updateError } = await supabase
        .from('score_events')
        .update({
          points: input.newPoints,
          reason: trimmedReason,
          status: 'approved',
        })
        .eq('id', input.scoreEventId);

      if (updateError) throw updateError;
    } else {
      const allEvents = mockDb.getScoreEvents();
      const eventIndex = allEvents.findIndex((e) => e.id === input.scoreEventId);
      if (eventIndex === -1) {
        throw new Error('Score event not found.');
      }

      previousScoreEvent = { ...allEvents[eventIndex] };
      const member = mockDb.getMembers().find((m) => m.id === previousScoreEvent?.member_id);
      if (member) participantName = member.name;

      allEvents[eventIndex] = {
        ...allEvents[eventIndex],
        points: input.newPoints,
        reason: trimmedReason,
        status: 'approved',
      };
      mockDb.setScoreEvents(allEvents);
    }

    // Record immutable audit entry
    const auditEntry = await this.logAuditEntry({
      leaderboard_id: input.leaderboardId,
      entity_type: 'score_event',
      entity_id: input.scoreEventId,
      previous_payload: {
        points: previousScoreEvent.points,
        reason: previousScoreEvent.reason,
      },
      proposed_payload: {
        points: input.newPoints,
        reason: trimmedReason,
      },
      actor_id: profile?.id || null,
      actor_email: profile?.email || null,
      actor_name: profile?.full_name || 'Admin',
      actor_role: profile?.role === 'super_admin' ? 'owner' : 'admin',
      participant_id: previousScoreEvent.member_id,
      participant_name: participantName,
      action: 'correct',
      status: 'approved',
      reason: trimmedReason,
      evidence_urls: input.evidenceUrls || [],
    });

    // Log to activity logs
    await DatabaseService.logActivity(
      input.leaderboardId,
      `Score corrected for ${participantName}: ${previousScoreEvent.points} -> ${input.newPoints} pts (${trimmedReason})`
    );

    return auditEntry;
  },

  /**
   * Corrects a league fixture result, recording the revision in the audit trail.
   */
  async correctFixtureResult(input: {
    leaderboardId: string;
    fixtureId: string;
    newHomeScore: number;
    newAwayScore: number;
    reason: string;
    evidenceUrls?: string[];
  }): Promise<ResultAuditEntry> {
    await DatabaseService.requireAdminPermission(input.leaderboardId);

    const trimmedReason = (input.reason || '').trim();
    if (trimmedReason.length < 3) {
      throw new Error('A descriptive reason (at least 3 characters) is required for correcting a match result.');
    }

    // Validate fixture result against competition rules
    const rules = await CompetitionRulesService.getRules(input.leaderboardId);
    const validation = validateFixtureResult(rules, { homeScore: input.newHomeScore, awayScore: input.newAwayScore }, false);
    if (!validation.valid) {
      throw new Error(validation.errors.join(' '));
    }

    const profile = await DatabaseService.getCurrentProfile();
    const timestamp = new Date().toISOString();

    let previousResult: FixtureResult | null = null;
    let matchLabel = 'Fixture';

    if (isSupabaseConfigured && supabase) {
      const { data: fix } = await supabase
        .from('fixtures')
        .select('*, home:leaderboard_members!fixtures_home_member_id_fkey(name), away:leaderboard_members!fixtures_away_member_id_fkey(name)')
        .eq('id', input.fixtureId)
        .single();

      if (fix) {
        const homeName = (fix.home as { name?: string })?.name || 'Home';
        const awayName = (fix.away as { name?: string })?.name || 'Away';
        matchLabel = `${homeName} vs ${awayName}`;
      }

      const { data: currentResult } = await supabase
        .from('fixture_results')
        .select('*')
        .eq('fixture_id', input.fixtureId)
        .maybeSingle();

      if (currentResult) {
        previousResult = currentResult as FixtureResult;
      }

      const { error: upsertError } = await supabase.from('fixture_results').upsert({
        fixture_id: input.fixtureId,
        home_score: input.newHomeScore,
        away_score: input.newAwayScore,
        status: 'approved',
        updated_at: timestamp,
      });
      if (upsertError) throw upsertError;

      await supabase
        .from('fixtures')
        .update({ status: 'completed', updated_at: timestamp })
        .eq('id', input.fixtureId);
    } else {
      const state = LeagueService.getLocalLeagueState();
      const existingRes = state.fixtureResults.find((r) => r.fixture_id === input.fixtureId);
      if (existingRes) {
        previousResult = { ...existingRes };
      }

      const fix = state.fixtures.find((f) => f.id === input.fixtureId);
      if (fix) {
        const members = mockDb.getMembers();
        const home = members.find((m) => m.id === fix.home_member_id);
        const away = members.find((m) => m.id === fix.away_member_id);
        matchLabel = `${home?.name || 'Home'} vs ${away?.name || 'Away'}`;

        fix.status = 'completed';
        fix.updated_at = timestamp;
      }

      const resIndex = state.fixtureResults.findIndex((r) => r.fixture_id === input.fixtureId);
      if (resIndex >= 0) {
        state.fixtureResults[resIndex] = {
          ...state.fixtureResults[resIndex],
          home_score: input.newHomeScore,
          away_score: input.newAwayScore,
          status: 'approved',
          updated_at: timestamp,
        };
      } else {
        state.fixtureResults.push({
          fixture_id: input.fixtureId,
          home_score: input.newHomeScore,
          away_score: input.newAwayScore,
          status: 'approved',
          created_at: timestamp,
          updated_at: timestamp,
        });
      }
      LeagueService.setLocalLeagueState(state);
    }

    const auditEntry = await this.logAuditEntry({
      leaderboard_id: input.leaderboardId,
      entity_type: 'fixture_result',
      entity_id: input.fixtureId,
      previous_payload: previousResult ? {
        home_score: previousResult.home_score,
        away_score: previousResult.away_score,
      } : null,
      proposed_payload: {
        home_score: input.newHomeScore,
        away_score: input.newAwayScore,
      },
      actor_id: profile?.id || null,
      actor_email: profile?.email || null,
      actor_name: profile?.full_name || 'Admin',
      actor_role: profile?.role === 'super_admin' ? 'owner' : 'admin',
      participant_name: matchLabel,
      action: previousResult ? 'correct' : 'submit',
      status: 'approved',
      reason: trimmedReason,
      evidence_urls: input.evidenceUrls || [],
    });

    await DatabaseService.logActivity(
      input.leaderboardId,
      `Match result updated for ${matchLabel}: ${input.newHomeScore}-${input.newAwayScore} (${trimmedReason})`
    );

    return auditEntry;
  },

  /**
   * Corrects a tournament match result, handling downstream bracket advancement recovery.
   */
  async correctTournamentMatch(input: {
    leaderboardId: string;
    matchId: string;
    newHomeScore: number;
    newAwayScore: number;
    reason: string;
    evidenceUrls?: string[];
    forceDownstreamReset?: boolean;
  }): Promise<{ auditEntry: ResultAuditEntry; downstreamConflict: boolean; downstreamMatchesReset: string[] }> {
    await DatabaseService.requireAdminPermission(input.leaderboardId);

    const trimmedReason = (input.reason || '').trim();
    if (trimmedReason.length < 3) {
      throw new Error('A descriptive reason (at least 3 characters) is required for correcting a tournament match.');
    }

    // Knockout matches strictly require a decisive winner
    const rules = await CompetitionRulesService.getRules(input.leaderboardId);
    const validation = validateFixtureResult(rules, { homeScore: input.newHomeScore, awayScore: input.newAwayScore }, true);
    if (!validation.valid) {
      throw new Error(validation.errors.join(' '));
    }

    const currentMatch = await TournamentService.getMatchById(input.matchId);
    if (!currentMatch) {
      throw new Error('Tournament match not found.');
    }

    const previousWinnerId = currentMatch.winner_member_id;
    const newWinnerId = input.newHomeScore > input.newAwayScore 
      ? currentMatch.home_member_id 
      : currentMatch.away_member_id;

    if (!newWinnerId) {
      throw new Error('Both participants must be assigned to determine a winner.');
    }

    const winnerChanged = previousWinnerId && previousWinnerId !== newWinnerId;
    let downstreamConflict = false;
    const downstreamMatchesReset: string[] = [];

    // Check downstream dependencies if winner changed
    if (winnerChanged && currentMatch.next_match_id) {
      const nextMatch = await TournamentService.getMatchById(currentMatch.next_match_id);
      if (nextMatch) {
        if (nextMatch.state === 'completed') {
          downstreamConflict = true;
          if (!input.forceDownstreamReset) {
            throw new Error(
              `Downstream match ${nextMatch.round_index + 1} has already been completed with the previous winner. ` +
              `To repair this bracket, enable forceDownstreamReset to reset the affected downstream match.`
            );
          }
          // Reset downstream match
          downstreamMatchesReset.push(nextMatch.id);
        }
      }
    }

    // Apply the correction via saveMatchResult
    await TournamentService.saveMatchResult({
      matchId: input.matchId,
      homeScore: input.newHomeScore,
      awayScore: input.newAwayScore,
      skipAuditLog: true,
    });

    const profile = await DatabaseService.getCurrentProfile();

    const auditEntry = await this.logAuditEntry({
      leaderboard_id: input.leaderboardId,
      entity_type: 'tournament_match',
      entity_id: input.matchId,
      previous_payload: {
        winner_member_id: previousWinnerId,
        home_score: currentMatch.home_member_id,
        away_score: currentMatch.away_member_id,
      },
      proposed_payload: {
        winner_member_id: newWinnerId,
        home_score: input.newHomeScore,
        away_score: input.newAwayScore,
        downstream_matches_reset: downstreamMatchesReset,
      },
      actor_id: profile?.id || null,
      actor_email: profile?.email || null,
      actor_name: profile?.full_name || 'Admin',
      actor_role: profile?.role === 'super_admin' ? 'owner' : 'admin',
      action: 'correct',
      status: 'approved',
      reason: trimmedReason,
      evidence_urls: input.evidenceUrls || [],
    });

    if (downstreamMatchesReset.length > 0) {
      await DatabaseService.logActivity(
        input.leaderboardId,
        `Tournament bracket repaired: downstream match reset due to winner correction in round ${currentMatch.round_index + 1}`
      );
    }

    return {
      auditEntry,
      downstreamConflict,
      downstreamMatchesReset,
    };
  },

  /**
   * Files a dispute against a result.
   * Can be initiated by participants or organizers.
   */
  async disputeResult(input: {
    leaderboardId: string;
    entityType: ResultEntityType;
    entityId: string;
    reason: string;
    evidenceUrls?: string[];
  }): Promise<ResultAuditEntry> {
    const profile = await DatabaseService.getCurrentProfile();
    if (!profile) {
      throw new Error('You must be signed in to dispute a competition result.');
    }

    const trimmedReason = (input.reason || '').trim();
    if (trimmedReason.length < 5) {
      throw new Error('A detailed dispute reason (at least 5 characters) is required.');
    }

    // Set entity status to disputed
    if (input.entityType === 'fixture_result') {
      if (isSupabaseConfigured && supabase) {
        await supabase
          .from('fixture_results')
          .update({ status: 'disputed' })
          .eq('fixture_id', input.entityId);
      } else {
        const state = LeagueService.getLocalLeagueState();
        const res = state.fixtureResults.find((r) => r.fixture_id === input.entityId);
        if (res) {
          res.status = 'disputed';
          LeagueService.setLocalLeagueState(state);
        }
      }
    } else if (input.entityType === 'score_event') {
      if (isSupabaseConfigured && supabase) {
        await supabase
          .from('score_events')
          .update({ status: 'disputed' })
          .eq('id', input.entityId);
      } else {
        const events = mockDb.getScoreEvents();
        const ev = events.find((e) => e.id === input.entityId);
        if (ev) {
          ev.status = 'disputed';
          mockDb.setScoreEvents(events);
        }
      }
    }

    const auditEntry = await this.logAuditEntry({
      leaderboard_id: input.leaderboardId,
      entity_type: input.entityType,
      entity_id: input.entityId,
      previous_payload: null,
      proposed_payload: { status: 'disputed' },
      actor_id: profile.id,
      actor_email: profile.email,
      actor_name: profile.full_name || 'Participant',
      actor_role: 'participant',
      action: 'dispute',
      status: 'disputed',
      reason: trimmedReason,
      evidence_urls: input.evidenceUrls || [],
    });

    await DatabaseService.logActivity(
      input.leaderboardId,
      `Result disputed by ${profile.full_name || profile.email}: "${trimmedReason}"`
    );

    return auditEntry;
  },

  /**
   * Resolves a pending dispute.
   * Strictly requires organizer/admin authorization. Participants cannot resolve or approve their own disputes.
   */
  async resolveDispute(input: ResolveDisputeInput): Promise<ResultAuditEntry> {
    await DatabaseService.requireAdminPermission(input.leaderboardId);

    const profile = await DatabaseService.getCurrentProfile();
    const resolutionReason = (input.resolutionReason || '').trim();
    if (resolutionReason.length < 3) {
      throw new Error('A resolution explanation is required.');
    }

    const newStatus: ResultStatus = input.decision === 'approve' ? 'approved' : 'rejected';

    // Update entity status
    if (input.entityType === 'fixture_result') {
      if (isSupabaseConfigured && supabase) {
        await supabase
          .from('fixture_results')
          .update({ status: newStatus })
          .eq('fixture_id', input.entityId);
      } else {
        const state = LeagueService.getLocalLeagueState();
        const res = state.fixtureResults.find((r) => r.fixture_id === input.entityId);
        if (res) {
          res.status = newStatus;
          LeagueService.setLocalLeagueState(state);
        }
      }
    } else if (input.entityType === 'score_event') {
      if (isSupabaseConfigured && supabase) {
        await supabase
          .from('score_events')
          .update({ status: newStatus })
          .eq('id', input.entityId);
      } else {
        const events = mockDb.getScoreEvents();
        const ev = events.find((e) => e.id === input.entityId);
        if (ev) {
          ev.status = newStatus;
          mockDb.setScoreEvents(events);
        }
      }
    }

    const auditEntry = await this.logAuditEntry({
      leaderboard_id: input.leaderboardId,
      entity_type: input.entityType,
      entity_id: input.entityId,
      previous_payload: { status: 'disputed' },
      proposed_payload: { status: newStatus },
      actor_id: profile?.id || null,
      actor_email: profile?.email || null,
      actor_name: profile?.full_name || 'Admin',
      actor_role: profile?.role === 'super_admin' ? 'owner' : 'admin',
      action: input.decision === 'approve' ? 'approve' : 'reject',
      status: newStatus,
      reason: resolutionReason,
      evidence_urls: [],
    });

    await DatabaseService.logActivity(
      input.leaderboardId,
      `Dispute resolved (${input.decision}): "${resolutionReason}"`
    );

    return auditEntry;
  },

  /**
   * Voids an invalid or fraudulent result.
   */
  async voidResult(input: {
    leaderboardId: string;
    entityType: ResultEntityType;
    entityId: string;
    reason: string;
  }): Promise<ResultAuditEntry> {
    await DatabaseService.requireAdminPermission(input.leaderboardId);

    const profile = await DatabaseService.getCurrentProfile();
    const reason = (input.reason || '').trim();
    if (reason.length < 3) {
      throw new Error('A reason is required to void a competition result.');
    }

    if (input.entityType === 'fixture_result') {
      if (isSupabaseConfigured && supabase) {
        await supabase
          .from('fixture_results')
          .update({ status: 'voided' })
          .eq('fixture_id', input.entityId);
      } else {
        const state = LeagueService.getLocalLeagueState();
        const res = state.fixtureResults.find((r) => r.fixture_id === input.entityId);
        if (res) {
          res.status = 'voided';
          LeagueService.setLocalLeagueState(state);
        }
      }
    } else if (input.entityType === 'score_event') {
      if (isSupabaseConfigured && supabase) {
        await supabase
          .from('score_events')
          .update({ status: 'voided' })
          .eq('id', input.entityId);
      } else {
        const events = mockDb.getScoreEvents();
        const ev = events.find((e) => e.id === input.entityId);
        if (ev) {
          ev.status = 'voided';
          mockDb.setScoreEvents(events);
        }
      }
    }

    const auditEntry = await this.logAuditEntry({
      leaderboard_id: input.leaderboardId,
      entity_type: input.entityType,
      entity_id: input.entityId,
      previous_payload: null,
      proposed_payload: { status: 'voided' },
      actor_id: profile?.id || null,
      actor_email: profile?.email || null,
      actor_name: profile?.full_name || 'Admin',
      actor_role: profile?.role === 'super_admin' ? 'owner' : 'admin',
      action: 'void',
      status: 'voided',
      reason,
      evidence_urls: [],
    });

    await DatabaseService.logActivity(
      input.leaderboardId,
      `Result voided: "${reason}"`
    );

    return auditEntry;
  },
};
