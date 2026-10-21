import {
  CompetitionEngine,
  EventDayMatch,
  EventDayOfflineAction,
  EventDayOperatorRole,
  Fixture,
  LeaderboardMember,
  TournamentMatch,
  TournamentMatchResult,
} from '@/types';
import { DatabaseService, isSupabaseConfigured, supabase, mockDb } from '@/lib/db';
import { LeagueService } from '@/lib/league/service';
import { TournamentService } from '@/lib/tournament/service';
import { ResultAuditService } from '@/lib/competition/audit/service';
import { CompetitionNotificationService } from '@/lib/competition/notifications/service';

const OFFLINE_QUEUE_KEY = 'leaderboardos_event_day_offline_queue';
let memoryOfflineQueue: EventDayOfflineAction[] = [];

function getLocalOfflineQueue(): EventDayOfflineAction[] {
  try {
    const raw = typeof localStorage !== 'undefined'
      ? localStorage.getItem(OFFLINE_QUEUE_KEY)
      : typeof window !== 'undefined' && window.localStorage
      ? window.localStorage.getItem(OFFLINE_QUEUE_KEY)
      : null;
    if (!raw) return memoryOfflineQueue;
    return JSON.parse(raw) as EventDayOfflineAction[];
  } catch {
    return memoryOfflineQueue;
  }
}

function setLocalOfflineQueue(queue: EventDayOfflineAction[]): void {
  memoryOfflineQueue = queue;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    } else if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    }
  } catch (err) {
    console.error('Failed to save offline queue:', err);
  }
}

export const EventDayService = {
  /**
   * Determine the operator role of a user for a specific leaderboard.
   * - 'organizer': Competition owner or admin
   * - 'referee': Designated referee
   * - 'viewer': Participant or read-only viewer
   */
  async getUserRole(leaderboardId: string, userId?: string | null): Promise<EventDayOperatorRole> {
    if (!userId) return 'viewer';

    const leaderboard = await DatabaseService.getLeaderboard(leaderboardId);
    if (!leaderboard) return 'viewer';

    if (leaderboard.owner_id === userId) {
      return 'organizer';
    }

    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase
        .from('leaderboard_admins')
        .select('role')
        .eq('leaderboard_id', leaderboardId)
        .eq('user_id', userId)
        .maybeSingle();

      if (data) {
        return data.role === 'referee' ? 'referee' : 'organizer';
      }
      return 'viewer';
    }

    // Demo/localStorage mode
    const admins = mockDb.get<Array<{ leaderboard_id: string; user_id: string; role?: string }>>('leaderboard_admins', []);
    const adminRecord = admins.find((a) => a.leaderboard_id === leaderboardId && a.user_id === userId);
    if (adminRecord) {
      return adminRecord.role === 'referee' ? 'referee' : 'organizer';
    }

    return 'viewer';
  },

  /**
   * Fetch scheduled and live matches for an event date.
   */
  async getTodayMatches(
    leaderboardId: string,
    options?: {
      date?: string; // YYYY-MM-DD or 'all'
      venueId?: string;
      status?: string; // 'all' | 'live' | 'scheduled' | 'completed'
    }
  ): Promise<EventDayMatch[]> {
    const config = await LeagueService.getCompetitionConfig(leaderboardId);
    const engine: CompetitionEngine = config?.engine_type || 'league_table';
    const targetDate = options?.date && options.date !== 'all' ? options.date : null;

    const [members, teams] = await Promise.all([
      DatabaseService.getMembers(leaderboardId),
      DatabaseService.getTeams(leaderboardId),
    ]);

    const memberMap = new Map<string, LeaderboardMember>(members.map((m) => [m.id, m]));
    const teamMap = new Map<string, (typeof teams)[number]>(teams.map((t) => [t.id, t]));

    const matches: EventDayMatch[] = [];

    if (engine === 'tournament') {
      const tournamentMatches = await TournamentService.getMatches(leaderboardId);
      const results = await TournamentService.getMatchResults(leaderboardId);
      const resultMap = new Map(results.map((r) => [r.match_id, r]));

      for (const tm of tournamentMatches) {
        if (!tm.home_member_id || !tm.away_member_id) continue;

        const homeMember = memberMap.get(tm.home_member_id);
        const awayMember = memberMap.get(tm.away_member_id);
        const homeTeam = homeMember?.team_id ? teamMap.get(homeMember.team_id) : null;
        const awayTeam = awayMember?.team_id ? teamMap.get(awayMember.team_id) : null;

        const matchResult = resultMap.get(tm.id);
        const matchDate = tm.scheduled_at ? tm.scheduled_at.slice(0, 10) : null;

        if (targetDate && matchDate && matchDate !== targetDate) continue;
        if (options?.venueId && tm.venue_id !== options.venueId) continue;
        if (options?.status && options.status !== 'all' && tm.state !== options.status) continue;

        const isLive = tm.state === 'live';
        const isCompleted = tm.state === 'completed';

        matches.push({
          id: tm.id,
          leaderboard_id: leaderboardId,
          engine: 'tournament',
          home_participant: {
            id: tm.home_member_id,
            name: homeTeam?.name || homeMember?.name || 'TBD',
            avatar_url: homeTeam?.logo_url || homeMember?.avatar_url || null,
            short_code: homeTeam?.short_code || null,
          },
          away_participant: {
            id: tm.away_member_id,
            name: awayTeam?.name || awayMember?.name || 'TBD',
            avatar_url: awayTeam?.logo_url || awayMember?.avatar_url || null,
            short_code: awayTeam?.short_code || null,
          },
          home_score: matchResult?.home_score ?? null,
          away_score: matchResult?.away_score ?? null,
          status: tm.state as EventDayMatch['status'],
          scheduled_at: tm.scheduled_at,
          scheduled_end_at: tm.scheduled_end_at || null,
          venue_name: tm.venue_name || null,
          court_field: tm.court_field || null,
          round_name: tm.round_name || `Round ${tm.round_index + 1}`,
          is_live: isLive,
          next_actions: isCompleted ? ['edit'] : isLive ? ['update_score', 'finalize'] : ['start'],
        });
      }
    } else {
      // League table fixtures
      const fixtures = await LeagueService.getFixtures(leaderboardId);
      const results = await LeagueService.getFixtureResults(leaderboardId);
      const resultMap = new Map(results.map((r) => [r.fixture_id, r]));

      for (const fix of fixtures) {
        const homeMember = memberMap.get(fix.home_member_id);
        const awayMember = memberMap.get(fix.away_member_id);
        const homeTeam = homeMember?.team_id ? teamMap.get(homeMember.team_id) : null;
        const awayTeam = awayMember?.team_id ? teamMap.get(awayMember.team_id) : null;

        const fixResult = resultMap.get(fix.id);
        const fixDate = fix.scheduled_at ? fix.scheduled_at.slice(0, 10) : null;

        if (targetDate && fixDate && fixDate !== targetDate) continue;
        if (options?.venueId && fix.venue_id !== options.venueId) continue;
        if (options?.status && options.status !== 'all' && fix.status !== options.status) continue;

        const isLive = fix.status === 'live';
        const isCompleted = fix.status === 'completed';

        matches.push({
          id: fix.id,
          leaderboard_id: leaderboardId,
          engine: 'league_table',
          home_participant: {
            id: fix.home_member_id,
            name: homeTeam?.name || homeMember?.name || 'Team A',
            avatar_url: homeTeam?.logo_url || homeMember?.avatar_url || null,
            short_code: homeTeam?.short_code || null,
          },
          away_participant: {
            id: fix.away_member_id,
            name: awayTeam?.name || awayMember?.name || 'Team B',
            avatar_url: awayTeam?.logo_url || awayMember?.avatar_url || null,
            short_code: awayTeam?.short_code || null,
          },
          home_score: fixResult?.home_score ?? null,
          away_score: fixResult?.away_score ?? null,
          status: fix.status as EventDayMatch['status'],
          scheduled_at: fix.scheduled_at,
          scheduled_end_at: fix.scheduled_end_at || null,
          venue_name: fix.venue_name || null,
          court_field: fix.court_field || null,
          round_name: fix.round_name || 'Regular Round',
          is_live: isLive,
          next_actions: isCompleted ? ['edit'] : isLive ? ['update_score', 'finalize'] : ['start'],
        });
      }
    }

    return matches.sort((a, b) => {
      // Live matches come first
      if (a.is_live && !b.is_live) return -1;
      if (!a.is_live && b.is_live) return 1;

      // Then scheduled by time
      const timeA = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0;
      const timeB = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0;
      return timeA - timeB;
    });
  },

  /**
   * Start a match on Event Day (transitions status to 'live').
   */
  async startMatch(
    leaderboardId: string,
    matchId: string,
    engine: CompetitionEngine,
    actorId?: string,
    options?: { skipPermissionCheck?: boolean }
  ): Promise<void> {
    if (!options?.skipPermissionCheck) {
      const role = await this.getUserRole(leaderboardId, actorId);
      if (role === 'viewer') {
        throw new Error('Permission denied: Only organizers or authorized referees can start matches.');
      }
    }

    const timestamp = new Date().toISOString();

    if (engine === 'tournament') {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase
          .from('tournament_matches')
          .update({ state: 'live', updated_at: timestamp })
          .eq('id', matchId);
        if (error) throw error;
      } else {
        const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('leaderboardos_tournament_matches') : null;
        const allMatches: TournamentMatch[] = raw ? JSON.parse(raw) : [];
        const match = allMatches.find((m) => m.id === matchId);
        if (match) {
          match.state = 'live';
          match.updated_at = timestamp;
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('leaderboardos_tournament_matches', JSON.stringify(allMatches));
          }
          mockDb.set('tournament_matches', allMatches);
        }
      }
    } else {
      // League fixture
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase
          .from('fixtures')
          .update({ status: 'live', updated_at: timestamp })
          .eq('id', matchId);
        if (error) throw error;
      } else {
        const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('leaderboardos_fixtures') : null;
        const fixtures: Fixture[] = raw ? JSON.parse(raw) : [];
        const fix = fixtures.find((f) => f.id === matchId);
        if (fix) {
          fix.status = 'live';
          fix.updated_at = timestamp;
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('leaderboardos_fixtures', JSON.stringify(fixtures));
          }
          mockDb.set('fixtures', fixtures);
        }
      }
    }

    // Activity log entry
    await DatabaseService.addActivityLog(leaderboardId, `Match #${matchId.slice(0, 8)} kicked off (Live).`);
  },

  /**
   * Update live score in real time without finalizing the match.
   */
  async updateLiveScore(
    leaderboardId: string,
    matchId: string,
    engine: CompetitionEngine,
    homeScore: number,
    awayScore: number,
    actorId?: string,
    options?: { skipPermissionCheck?: boolean }
  ): Promise<void> {
    if (!options?.skipPermissionCheck) {
      const role = await this.getUserRole(leaderboardId, actorId);
      if (role === 'viewer') {
        throw new Error('Permission denied: Only organizers or authorized referees can update scores.');
      }
    }

    if (homeScore < 0 || awayScore < 0) {
      throw new Error('Match scores cannot be negative.');
    }

    const timestamp = new Date().toISOString();

    if (engine === 'tournament') {
      if (isSupabaseConfigured && supabase) {
        await supabase.from('tournament_matches').update({ state: 'live', updated_at: timestamp }).eq('id', matchId);
        await supabase.from('tournament_match_results').upsert({
          match_id: matchId,
          home_score: homeScore,
          away_score: awayScore,
          updated_at: timestamp,
        });
      } else {
        // Update tournament match state to live
        const rawMatches = typeof localStorage !== 'undefined' ? localStorage.getItem('leaderboardos_tournament_matches') : null;
        const matches: TournamentMatch[] = rawMatches ? JSON.parse(rawMatches) : [];
        const match = matches.find((m) => m.id === matchId);
        if (match) {
          match.state = 'live';
          match.updated_at = timestamp;
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('leaderboardos_tournament_matches', JSON.stringify(matches));
          }
          mockDb.set('tournament_matches', matches);
        }

        // Update match results
        const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('leaderboardos_tournament_match_results') : null;
        const results: TournamentMatchResult[] = raw ? JSON.parse(raw) : [];
        const existing = results.find((r) => r.match_id === matchId);
        if (existing) {
          existing.home_score = homeScore;
          existing.away_score = awayScore;
          existing.updated_at = timestamp;
        } else {
          results.push({
            id: `tmr-${matchId}`,
            match_id: matchId,
            home_score: homeScore,
            away_score: awayScore,
            status: 'submitted',
            created_at: timestamp,
            updated_at: timestamp,
          } as TournamentMatchResult);
        }
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('leaderboardos_tournament_match_results', JSON.stringify(results));
        }
        mockDb.set('tournament_match_results', results);
      }
    } else {
      if (isSupabaseConfigured && supabase) {
        await supabase.from('fixtures').update({ status: 'live', updated_at: timestamp }).eq('id', matchId);
        await supabase.from('fixture_results').upsert({
          fixture_id: matchId,
          home_score: homeScore,
          away_score: awayScore,
          status: 'submitted',
          updated_at: timestamp,
        });
      } else {
        // Update fixture status to live
        const rawFixtures = typeof localStorage !== 'undefined' ? localStorage.getItem('leaderboardos_fixtures') : null;
        const fixtures: Fixture[] = rawFixtures ? JSON.parse(rawFixtures) : [];
        const fix = fixtures.find((f) => f.id === matchId);
        if (fix) {
          fix.status = 'live';
          fix.updated_at = timestamp;
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('leaderboardos_fixtures', JSON.stringify(fixtures));
          }
          mockDb.set('fixtures', fixtures);
        }

        // Update fixture results
        const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('leaderboardos_fixture_results') : null;
        const results: Array<{ fixture_id: string; home_score: number; away_score: number; created_at: string; updated_at: string }> = raw ? JSON.parse(raw) : [];
        const existing = results.find((r) => r.fixture_id === matchId);
        if (existing) {
          existing.home_score = homeScore;
          existing.away_score = awayScore;
          existing.updated_at = timestamp;
        } else {
          results.push({
            fixture_id: matchId,
            home_score: homeScore,
            away_score: awayScore,
            created_at: timestamp,
            updated_at: timestamp,
          });
        }
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('leaderboardos_fixture_results', JSON.stringify(results));
        }
        mockDb.set('fixture_results', results);
      }
    }
  },

  /**
   * Finalize consequential match result with full audit log and notification updates.
   */
  async finalizeMatchResult(
    leaderboardId: string,
    matchId: string,
    engine: CompetitionEngine,
    homeScore: number,
    awayScore: number,
    reason?: string,
    actorId?: string,
    options?: { skipPermissionCheck?: boolean }
  ): Promise<void> {
    let auditActorRole: 'admin' | 'referee' = 'admin';

    if (!options?.skipPermissionCheck) {
      const role = await this.getUserRole(leaderboardId, actorId);
      if (role === 'viewer') {
        throw new Error('Permission denied: You must be an organizer or referee to finalize match results.');
      }
      auditActorRole = role === 'referee' ? 'referee' : 'admin';
    }

    if (homeScore < 0 || awayScore < 0) {
      throw new Error('Final scores cannot be negative.');
    }

    if (engine === 'tournament') {
      await TournamentService.submitMatchScore({
        leaderboardId,
        matchId,
        homeScore,
        awayScore,
        reason: reason || 'Event-Day score finalization',
      }, { skipAdminCheck: true });
    } else {
      await LeagueService.saveFixtureResult({
        fixtureId: matchId,
        homeScore,
        awayScore,
        reason: reason || 'Event-Day score finalization',
      }, { skipAdminCheck: true });
    }

    // Log in result audit system
    await ResultAuditService.logAuditEntry({
      leaderboard_id: leaderboardId,
      entity_type: engine === 'tournament' ? 'tournament_match' : 'fixture_result',
      entity_id: matchId,
      previous_payload: null,
      proposed_payload: { home_score: homeScore, away_score: awayScore },
      actor_id: actorId || null,
      actor_email: null,
      actor_name: auditActorRole === 'referee' ? 'Event Referee' : 'Organizer',
      actor_role: auditActorRole,
      participant_id: null,
      participant_name: null,
      action: 'submit',
      status: 'confirmed',
      reason: reason || 'Event-Day official match finalization',
      evidence_urls: [],
    });

    // Notify participants
    const lb = await DatabaseService.getLeaderboard(leaderboardId);
    if (lb) {
      void CompetitionNotificationService.notifyResultPosted({
        leaderboard_id: leaderboardId,
        competitionName: lb.name,
        matchTitle: `Match #${matchId.slice(0, 8)}`,
        scoreSummary: `${homeScore} - ${awayScore}`,
        slug: lb.slug,
      }).catch((e) => console.warn('Notification dispatch error:', e));
    }
  },

  /**
   * Offline operations support.
   */
  queueOfflineAction(action: Omit<EventDayOfflineAction, 'id' | 'timestamp'>): EventDayOfflineAction {
    const fullAction: EventDayOfflineAction = {
      ...action,
      id: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
    };
    const queue = getLocalOfflineQueue();
    queue.push(fullAction);
    setLocalOfflineQueue(queue);
    return fullAction;
  },

  getOfflineQueue(): EventDayOfflineAction[] {
    return getLocalOfflineQueue();
  },

  clearOfflineQueue(): void {
    setLocalOfflineQueue([]);
  },

  /**
   * Flush any queued offline actions when network is restored.
   */
  async flushOfflineQueue(): Promise<{ processed: number; errors: string[] }> {
    const queue = getLocalOfflineQueue();
    if (queue.length === 0) return { processed: 0, errors: [] };

    let processed = 0;
    const errors: string[] = [];
    const remaining: EventDayOfflineAction[] = [];

    for (const action of queue) {
      try {
        if (action.actionType === 'start') {
          await this.startMatch(action.leaderboardId, action.matchId, action.engine, undefined, { skipPermissionCheck: true });
        } else if (action.actionType === 'score_update') {
          await this.updateLiveScore(
            action.leaderboardId,
            action.matchId,
            action.engine,
            action.homeScore ?? 0,
            action.awayScore ?? 0,
            undefined,
            { skipPermissionCheck: true }
          );
        } else if (action.actionType === 'finalize') {
          await this.finalizeMatchResult(
            action.leaderboardId,
            action.matchId,
            action.engine,
            action.homeScore ?? 0,
            action.awayScore ?? 0,
            action.reason,
            undefined,
            { skipPermissionCheck: true }
          );
        }
        processed++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown sync error';
        errors.push(`Action ${action.id} failed: ${msg}`);
        remaining.push(action);
      }
    }

    setLocalOfflineQueue(remaining);
    return { processed, errors };
  },
};
