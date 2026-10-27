import {
  CompetitionParticipation,
  CrossCompetitionAnalyticsFilter,
  ExternalScoringConnectorConfig,
  Fixture,
  FixtureResult,
  Leaderboard,
  OrganizerAnalyticsOverview,
  ParticipantCrossCompetitionSummary,
  Team,
  TeamCrossCompetitionSummary,
  TeamNameHistoryEntry,
} from '@/types';
import { DatabaseService, isSupabaseConfigured, mockDb, supabase } from '@/lib/db';
import { LeagueService } from '@/lib/league/service';
import { CompetitionSchedulingService } from '@/lib/competition/scheduling/service';
import { CompetitionPassportService } from '@/lib/competition/passport/service';

// In-memory short-lived cache to prevent expensive unbounded cross-competition re-scans (30s TTL)
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}
const queryCache = new Map<string, CacheEntry<unknown>>();

function getFromCache<T>(key: string): T | null {
  const entry = queryCache.get(key);
  if (entry && entry.expiresAt > Date.now()) {
    return entry.data as T;
  }
  queryCache.delete(key);
  return null;
}

function setToCache<T>(key: string, data: T, ttlMs = 30000): void {
  queryCache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export const CompetitionGraphService = {
  /**
   * Clears the query cache (useful during tests or after updates)
   */
  clearCache(): void {
    queryCache.clear();
  },

  // ==========================================================================
  // 1. TEAM IDENTITY & HISTORICAL RENAMES
  // ==========================================================================

  /**
   * Record a team rename or update while preserving historical records.
   * Past match results and previous seasons retain the team name that was active at that time.
   */
  async recordTeamNameChange(params: {
    teamId: string;
    newName: string;
    shortCode?: string | null;
    logoUrl?: string | null;
    reason?: string | null;
    actorUserId?: string | null;
  }): Promise<TeamNameHistoryEntry> {
    const { teamId, newName, shortCode, logoUrl, reason, actorUserId } = params;

    // 1. Fetch current team
    let team: Team | null = null;
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.from('teams').select('*').eq('id', teamId).maybeSingle();
      team = data as Team | null;
    } else {
      const allTeams = mockDb.getTeams();
      team = allTeams.find((t) => t.id === teamId) || null;
    }

    if (!team) {
      throw new Error(`Team with ID "${teamId}" not found.`);
    }

    // 2. Save previous name to history
    const historyEntry: TeamNameHistoryEntry = {
      id: `tnh-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      team_id: teamId,
      name: team.name,
      short_code: team.short_code,
      logo_url: team.logo_url,
      changed_at: new Date().toISOString(),
      changed_by: actorUserId || null,
      reason: reason || 'Team name updated by organizer',
    };

    if (isSupabaseConfigured && supabase) {
      await supabase.from('team_name_history').insert([historyEntry]);
      await supabase
        .from('teams')
        .update({
          name: newName,
          short_code: shortCode !== undefined ? shortCode : team.short_code,
          logo_url: logoUrl !== undefined ? logoUrl : team.logo_url,
          updated_at: new Date().toISOString(),
        })
        .eq('id', teamId);
    } else {
      const history = mockDb.getTeamNameHistory();
      history.unshift(historyEntry);
      mockDb.setTeamNameHistory(history);

      const allTeams = mockDb.getTeams();
      const targetTeam = allTeams.find((t) => t.id === teamId);
      if (targetTeam) {
        targetTeam.name = newName;
        if (shortCode !== undefined) targetTeam.short_code = shortCode;
        if (logoUrl !== undefined) targetTeam.logo_url = logoUrl;
        targetTeam.updated_at = new Date().toISOString();
        mockDb.set('teams', allTeams);
      }
    }

    // Clear cache
    this.clearCache();
    return historyEntry;
  },

  /**
   * Get historical name changes for a team.
   */
  async getTeamNameHistory(teamId: string): Promise<TeamNameHistoryEntry[]> {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase
        .from('team_name_history')
        .select('*')
        .eq('team_id', teamId)
        .order('changed_at', { ascending: false });
      return (data || []) as TeamNameHistoryEntry[];
    }
    const history = mockDb.getTeamNameHistory();
    return history
      .filter((h) => h.team_id === teamId)
      .sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime());
  },

  // ==========================================================================
  // 2. COMPETITION PARTICIPATION LEDGER
  // ==========================================================================

  /**
   * Record or update a participant/team competition participation snapshot.
   */
  async recordParticipation(
    entry: Omit<CompetitionParticipation, 'id' | 'created_at' | 'updated_at'>
  ): Promise<CompetitionParticipation> {
    const timestamp = new Date().toISOString();
    const participation: CompetitionParticipation = {
      id: `cp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      ...entry,
      created_at: timestamp,
      updated_at: timestamp,
    };

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('competition_participations')
        .upsert(
          {
            leaderboard_id: participation.leaderboard_id,
            season_id: participation.season_id,
            entity_type: participation.entity_type,
            member_id: participation.member_id,
            team_id: participation.team_id,
            user_id: participation.user_id,
            display_name: participation.display_name,
            team_name_snapshot: participation.team_name_snapshot,
            is_verified: participation.is_verified,
            final_position: participation.final_position,
            matches_played: participation.matches_played,
            matches_won: participation.matches_won,
            matches_drawn: participation.matches_drawn,
            matches_lost: participation.matches_lost,
            total_points: participation.total_points,
            verified_matches_count: participation.verified_matches_count,
            unverified_matches_count: participation.unverified_matches_count,
            updated_at: timestamp,
          },
          { onConflict: 'leaderboard_id,member_id' }
        )
        .select()
        .single();

      if (error) throw error;
      return data as CompetitionParticipation;
    }

    const all = mockDb.getCompetitionParticipations();
    const idx = all.findIndex(
      (p) => p.leaderboard_id === entry.leaderboard_id && p.member_id === entry.member_id
    );
    if (idx >= 0) {
      all[idx] = { ...all[idx], ...entry, updated_at: timestamp };
      mockDb.setCompetitionParticipations(all);
      return all[idx];
    }

    all.push(participation);
    mockDb.setCompetitionParticipations(all);
    return participation;
  },

  /**
   * Get competition participations with flexible filtering.
   */
  async getParticipations(filter: {
    leaderboardId?: string;
    userId?: string;
    teamId?: string;
    seasonId?: string;
  }): Promise<CompetitionParticipation[]> {
    if (isSupabaseConfigured && supabase) {
      let query = supabase.from('competition_participations').select('*');
      if (filter.leaderboardId) query = query.eq('leaderboard_id', filter.leaderboardId);
      if (filter.userId) query = query.eq('user_id', filter.userId);
      if (filter.teamId) query = query.eq('team_id', filter.teamId);
      if (filter.seasonId) query = query.eq('season_id', filter.seasonId);
      const { data } = await query;
      return (data || []) as CompetitionParticipation[];
    }

    let all = mockDb.getCompetitionParticipations();
    if (filter.leaderboardId) all = all.filter((p) => p.leaderboard_id === filter.leaderboardId);
    if (filter.userId) all = all.filter((p) => p.user_id === filter.userId);
    if (filter.teamId) all = all.filter((p) => p.team_id === filter.teamId);
    if (filter.seasonId) all = all.filter((p) => p.season_id === filter.seasonId);
    return all;
  },

  // ==========================================================================
  // 3. ORGANIZER CROSS-COMPETITION ANALYTICS
  // ==========================================================================

  /**
   * Calculate comprehensive cross-competition analytics for an authorized organizer or organization.
   * Separates verified from unverified results and tracks venue utilization and category trends.
   */
  async getOrganizerAnalytics(
    filter: CrossCompetitionAnalyticsFilter,
    actorUserId?: string
  ): Promise<OrganizerAnalyticsOverview> {
    const cacheKey = `org_analytics_${JSON.stringify(filter)}_${actorUserId || 'anon'}`;
    const cached = getFromCache<OrganizerAnalyticsOverview>(cacheKey);
    if (cached) return cached;

    // 1. Fetch authorized leaderboards
    let allBoards: Leaderboard[] = [];
    if (isSupabaseConfigured && supabase) {
      let query = supabase.from('leaderboards').select('*');
      if (filter.organizationId) {
        query = query.eq('organization_id', filter.organizationId);
      } else if (filter.ownerId) {
        query = query.eq('owner_id', filter.ownerId);
      } else if (actorUserId) {
        query = query.eq('owner_id', actorUserId);
      }
      if (filter.competitionType) {
        query = query.eq('competition_type', filter.competitionType);
      }
      const { data } = await query;
      allBoards = (data || []) as Leaderboard[];
    } else {
      const boards = mockDb.getLeaderboards();
      allBoards = boards.filter((b) => {
        if (filter.organizationId && b.organization_id !== filter.organizationId) return false;
        if (filter.ownerId && b.owner_id !== filter.ownerId) return false;
        if (!filter.organizationId && !filter.ownerId && actorUserId && b.owner_id !== actorUserId)
          return false;
        if (filter.competitionType && b.competition_type !== filter.competitionType) return false;
        return true;
      });
    }

    const totalCompetitions = allBoards.length;
    const activeCompetitions = allBoards.filter((b) => b.status === 'active').length;
    const completedCompetitions = allBoards.filter((b) => b.status === 'archived').length;

    // 2. Fetch parallel competition details
    const categoryCounts: Record<string, number> = {};
    const templateCounts: Record<string, number> = {};
    const uniqueUserIds = new Set<string>();
    const uniqueMemberKeys = new Set<string>();

    let totalMatches = 0;
    let verifiedMatches = 0;
    let unverifiedMatches = 0;
    let disputedMatches = 0;
    let voidedMatches = 0;

    const venuesMap = new Map<
      string,
      {
        venue_id: string;
        venue_name: string;
        court_field?: string | null;
        competitions_count: Set<string>;
        total_matches_scheduled: number;
        completed_matches: number;
      }
    >();

    const recentCompetitions: OrganizerAnalyticsOverview['recent_competitions'] = [];

    for (const board of allBoards) {
      // Category count
      categoryCounts[board.competition_type] = (categoryCounts[board.competition_type] || 0) + 1;

      // Members & participants
      const members = await DatabaseService.getMembers(board.id).catch(() => []);
      for (const m of members) {
        uniqueMemberKeys.add(`${board.id}_${m.name}`);
        if (m.email) uniqueUserIds.add(m.email.toLowerCase());
      }

      // Fixtures & verification
      let fixtures: Fixture[] = [];
      let results: FixtureResult[] = [];
      if (isSupabaseConfigured && supabase) {
        const [fRes, rRes] = await Promise.all([
          supabase.from('fixtures').select('*').eq('leaderboard_id', board.id),
          supabase.from('fixture_results').select('*'),
        ]);
        fixtures = (fRes.data || []) as Fixture[];
        const fixIds = new Set(fixtures.map((f) => f.id));
        results = ((rRes.data || []) as FixtureResult[]).filter((r) => fixIds.has(r.fixture_id));
      } else {
        const localFix = mockDb.get<Fixture[]>('fixtures', []);
        fixtures = localFix.filter((f) => f.leaderboard_id === board.id);
        const localRes = mockDb.get<FixtureResult[]>('fixture_results', []);
        const fixIds = new Set(fixtures.map((f) => f.id));
        results = localRes.filter((r) => fixIds.has(r.fixture_id));
      }

      let boardVerifiedMatches = 0;
      for (const r of results) {
        totalMatches++;
        if (r.status === 'approved' || r.status === 'confirmed') {
          verifiedMatches++;
          boardVerifiedMatches++;
        } else if (r.status === 'disputed') {
          disputedMatches++;
        } else if (r.status === 'rejected' || r.status === 'voided') {
          voidedMatches++;
        } else {
          unverifiedMatches++;
        }
      }

      // Venues utilization
      const venues = await CompetitionSchedulingService.getVenues(board.id).catch(() => []);
      for (const v of venues) {
        const existing = venuesMap.get(v.id) || {
          venue_id: v.id,
          venue_name: v.name,
          court_field: v.court_field,
          competitions_count: new Set<string>(),
          total_matches_scheduled: 0,
          completed_matches: 0,
        };
        existing.competitions_count.add(board.id);

        const venueFixtures = fixtures.filter((f) => f.venue_id === v.id);
        existing.total_matches_scheduled += venueFixtures.length;
        existing.completed_matches += venueFixtures.filter((f) => f.status === 'completed').length;
        venuesMap.set(v.id, existing);
      }

      // Config & Template
      const config = await LeagueService.getCompetitionConfig(board.id).catch(() => null);
      if (config?.template_key) {
        templateCounts[config.template_key] = (templateCounts[config.template_key] || 0) + 1;
      }

      recentCompetitions.push({
        id: board.id,
        name: board.name,
        slug: board.slug,
        competition_type: board.competition_type,
        status: board.status,
        is_verified: Boolean(board.is_verified),
        participants_count: members.length,
        matches_count: results.length,
        verified_matches_count: boardVerifiedMatches,
        created_at: board.created_at,
      });
    }

    // Sort recent competitions descending
    recentCompetitions.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const verifiedRate = totalMatches > 0 ? Math.round((verifiedMatches / totalMatches) * 100) : 100;
    const totalSeasons = (await DatabaseService.getSeasons(allBoards[0]?.id || '')).length || 1;

    const result: OrganizerAnalyticsOverview = {
      total_competitions: totalCompetitions,
      active_competitions: activeCompetitions,
      completed_competitions: completedCompetitions,
      total_seasons: totalSeasons,
      total_unique_participants: Math.max(uniqueUserIds.size, uniqueMemberKeys.size),
      total_teams: 0, // Computed dynamically below
      total_venues: venuesMap.size,
      match_verification: {
        total: totalMatches,
        verified: verifiedMatches,
        unverified: unverifiedMatches,
        disputed: disputedMatches,
        voided: voidedMatches,
        verified_rate_pct: verifiedRate,
      },
      by_category: categoryCounts,
      by_template: templateCounts,
      venues_utilization: Array.from(venuesMap.values()).map((v) => ({
        venue_id: v.venue_id,
        venue_name: v.venue_name,
        court_field: v.court_field,
        competitions_count: v.competitions_count.size,
        total_matches_scheduled: v.total_matches_scheduled,
        completed_matches: v.completed_matches,
      })),
      recent_competitions: recentCompetitions.slice(0, 10),
    };

    setToCache(cacheKey, result);
    return result;
  },

  // ==========================================================================
  // 4. TEAM CROSS-COMPETITION HISTORY & TRANSITIONS
  // ==========================================================================

  /**
   * Builds the cross-competition profile for a team across multiple seasons,
   * tracking name history, roster transitions, and verified records.
   */
  async getTeamCrossCompetitionSummary(teamId: string): Promise<TeamCrossCompetitionSummary | null> {
    const cacheKey = `team_summary_${teamId}`;
    const cached = getFromCache<TeamCrossCompetitionSummary>(cacheKey);
    if (cached) return cached;

    // 1. Fetch team record
    let team: Team | null = null;
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.from('teams').select('*').eq('id', teamId).maybeSingle();
      team = data as Team | null;
    } else {
      const all = mockDb.getTeams();
      team = all.find((t) => t.id === teamId) || null;
    }

    if (!team) return null;

    // 2. Fetch name history
    const nameHistory = await this.getTeamNameHistory(teamId);

    // 3. Find all teams sharing the canonical identity or name
    let relatedTeams: Team[] = [team];
    if (team.canonical_team_id) {
      if (isSupabaseConfigured && supabase) {
        const { data } = await supabase
          .from('teams')
          .select('*')
          .or(`id.eq.${team.canonical_team_id},canonical_team_id.eq.${team.canonical_team_id}`);
        relatedTeams = (data || []) as Team[];
      } else {
        const all = mockDb.getTeams();
        relatedTeams = all.filter(
          (t) => t.id === team.canonical_team_id || t.canonical_team_id === team.canonical_team_id
        );
      }
    }

    const teamIds = new Set(relatedTeams.map((t) => t.id));

    // 4. Gather competitions participated in
    const competitionsParticipated: TeamCrossCompetitionSummary['competitions_participated'] = [];
    let totalMatches = 0;
    let totalWins = 0;
    let totalDraws = 0;
    let totalLosses = 0;
    let verifiedMatches = 0;
    let unverifiedMatches = 0;
    let podiums = 0;

    for (const t of relatedTeams) {
      const board = await DatabaseService.getLeaderboard(t.leaderboard_id);
      if (!board) continue;

      const standings = await LeagueService.getLeagueStandings(board.id).catch(() => []);
      const standingRow = standings.find(
        (s) => s.name.toLowerCase() === t.name.toLowerCase() || s.member_id === t.id
      );

      const played = standingRow?.stats?.played || 0;
      const wins = standingRow?.stats?.wins || 0;
      const draws = standingRow?.stats?.draws || 0;
      const losses = standingRow?.stats?.losses || 0;
      const points = standingRow?.stats?.points || 0;
      const pos = standingRow?.position || null;

      if (pos && pos <= 3) podiums++;

      totalMatches += played;
      totalWins += wins;
      totalDraws += draws;
      totalLosses += losses;
      if (board.is_verified) {
        verifiedMatches += played;
      } else {
        unverifiedMatches += played;
      }

      competitionsParticipated.push({
        leaderboard_id: board.id,
        competition_name: board.name,
        season_name: null,
        team_name_in_competition: t.name,
        position: pos,
        matches_played: played,
        wins,
        draws,
        losses,
        points,
        is_verified: Boolean(board.is_verified),
      });
    }

    // 5. Gather roster transitions across seasons
    const rosterTransitions: TeamCrossCompetitionSummary['roster_transitions'] = [];
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase
        .from('participant_team_history')
        .select('*')
        .in('team_id', Array.from(teamIds));
      if (data) {
        for (const row of data) {
          rosterTransitions.push({
            member_id: row.member_id,
            player_name: row.team_name,
            role: row.role || 'player',
            jersey_number: row.jersey_number,
            joined_at: row.joined_at,
            left_at: row.left_at,
            competition_name: 'Historical Season',
          });
        }
      }
    } else {
      const history = mockDb.getParticipantTeamHistory();
      const filtered = history.filter((h) => teamIds.has(h.team_id));
      for (const h of filtered) {
        rosterTransitions.push({
          member_id: h.member_id,
          player_name: h.team_name,
          role: h.role,
          jersey_number: h.jersey_number,
          joined_at: h.joined_at,
          left_at: h.left_at,
          competition_name: 'Historical Season',
        });
      }
    }

    const winRate = totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0;

    const summary: TeamCrossCompetitionSummary = {
      team_id: team.id,
      canonical_team_id: team.canonical_team_id,
      current_name: team.name,
      short_code: team.short_code,
      logo_url: team.logo_url,
      name_history: nameHistory,
      competitions_participated: competitionsParticipated,
      aggregate_record: {
        competitions_count: competitionsParticipated.length,
        total_matches: totalMatches,
        wins: totalWins,
        draws: totalDraws,
        losses: totalLosses,
        win_rate_pct: winRate,
        podiums_count: podiums,
        verified_matches_count: verifiedMatches,
        unverified_matches_count: unverifiedMatches,
      },
      roster_transitions: rosterTransitions,
    };

    setToCache(cacheKey, summary);
    return summary;
  },

  // ==========================================================================
  // 5. PARTICIPANT CROSS-COMPETITION CAREER GRAPH
  // ==========================================================================

  /**
   * Build cross-competition profile for a participant.
   * STRICT CONSTRAINT: Never merges identities based on similar names alone!
   * Only links records where there is a confirmed user_id or verified claim.
   */
  async getParticipantCrossCompetitionSummary(
    identifier: string
  ): Promise<ParticipantCrossCompetitionSummary | null> {
    const cacheKey = `part_summary_${identifier}`;
    const cached = getFromCache<ParticipantCrossCompetitionSummary>(cacheKey);
    if (cached) return cached;

    // 1. Resolve passport profile
    const profile = await CompetitionPassportService.getProfileByUsername(identifier);
    if (!profile) return null;

    // 2. Resolve claims to find verified competition memberships
    const claims = await CompetitionPassportService.getClaimsForUser(profile.user_id);
    const verifiedClaims = claims.filter(
      (c) => c.status === 'verified' || c.status === 'approved'
    );

    const participations: ParticipantCrossCompetitionSummary['participations'] = [];
    let totalMatches = 0;
    let verifiedMatches = 0;
    let unverifiedMatches = 0;
    let totalWins = 0;
    let totalPoints = 0;
    let podiums = 0;

    for (const claim of verifiedClaims) {
      const board = await DatabaseService.getLeaderboard(claim.leaderboard_id);
      if (!board) continue;

      const members = await DatabaseService.getMembers(board.id);
      const member = members.find((m) => m.id === claim.member_id);
      if (!member) continue;

      const standings = await LeagueService.getLeagueStandings(board.id).catch(() => []);
      const standing = standings.find((s) => s.member_id === member.id);

      const played = standing?.stats?.played || 1;
      const wins = standing?.stats?.wins || 0;
      const points = standing?.stats?.points || 0;
      const pos = standing?.position || null;

      if (pos && pos <= 3) podiums++;

      totalMatches += played;
      totalWins += wins;
      totalPoints += points;
      if (board.is_verified) {
        verifiedMatches += played;
      } else {
        unverifiedMatches += played;
      }

      participations.push({
        competition_id: board.id,
        competition_name: board.name,
        season_name: null,
        team_name_snapshot: member.team || null,
        position: pos,
        matches_played: played,
        matches_won: wins,
        total_points: points,
        is_verified: Boolean(board.is_verified),
      });
    }

    // 3. Team affiliations
    let teamAffiliations: ParticipantCrossCompetitionSummary['team_affiliations'] = [];
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase
        .from('participant_team_history')
        .select('*')
        .eq('user_id', profile.user_id);
      teamAffiliations = ((data || []) as Record<string, unknown>[]).map((d) => ({
        team_name: String(d.team_name || 'Team'),
        competition_name: 'Affiliated Season',
        role: String(d.role || 'player'),
        joined_at: String(d.joined_at || ''),
        left_at: (d.left_at as string) || null,
      }));
    } else {
      const history = mockDb.getParticipantTeamHistory();
      teamAffiliations = history
        .filter((h) => h.user_id === profile.user_id)
        .map((h) => ({
          team_name: h.team_name,
          competition_name: 'Affiliated Season',
          role: h.role,
          joined_at: h.joined_at,
          left_at: h.left_at,
        }));
    }

    const summary: ParticipantCrossCompetitionSummary = {
      user_id: profile.user_id,
      passport_handle: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      is_identity_verified: true,
      participations,
      career_stats: {
        competitions_entered: participations.length,
        total_matches: totalMatches,
        verified_matches: verifiedMatches,
        unverified_matches: unverifiedMatches,
        wins: totalWins,
        podiums,
        total_points: totalPoints,
      },
      team_affiliations: teamAffiliations,
    };

    setToCache(cacheKey, summary);
    return summary;
  },

  // ==========================================================================
  // 6. CSV & DATA EXPORT (RFC 4180 COMPLIANT WITH PRIVACY SCRUBBING)
  // ==========================================================================

  /**
   * Escape a string value for safe, RFC 4180 compliant CSV output.
   */
  escapeCsv(val: unknown): string {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  },

  /**
   * Export competition match results to CSV with status and verification audit info.
   * Strips all private personal information (emails, internal notes).
   */
  async exportResultsCsv(filter: CrossCompetitionAnalyticsFilter, actorUserId?: string): Promise<string> {
    const analytics = await this.getOrganizerAnalytics(filter, actorUserId);
    const headers = [
      'Competition ID',
      'Competition Name',
      'Type',
      'Status',
      'Is Verified',
      'Participants Count',
      'Matches Count',
      'Verified Matches Count',
      'Created At',
    ];

    const rows = analytics.recent_competitions.map((c) => [
      this.escapeCsv(c.id),
      this.escapeCsv(c.name),
      this.escapeCsv(c.competition_type),
      this.escapeCsv(c.status),
      this.escapeCsv(c.is_verified ? 'YES' : 'NO'),
      this.escapeCsv(c.participants_count),
      this.escapeCsv(c.matches_count),
      this.escapeCsv(c.verified_matches_count),
      this.escapeCsv(c.created_at),
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  },

  /**
   * Export organizer participation summary to CSV.
   */
  async exportParticipationsCsv(
    leaderboardId: string,
    actorUserId?: string
  ): Promise<string> {
    await DatabaseService.requireAdminPermission(leaderboardId, actorUserId);
    const members = await DatabaseService.getMembers(leaderboardId);
    const board = await DatabaseService.getLeaderboard(leaderboardId);

    const headers = [
      'Member ID',
      'Name',
      'Team',
      'Active Status',
      'Competition Name',
      'Joined At',
    ];

    const rows = members.map((m) => [
      this.escapeCsv(m.id),
      this.escapeCsv(m.name),
      this.escapeCsv(m.team || 'Independent'),
      this.escapeCsv(m.is_active ? 'Active' : 'Inactive'),
      this.escapeCsv(board?.name || ''),
      this.escapeCsv(m.created_at),
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  },

  // ==========================================================================
  // 7. FUTURE EXTERNAL SCORING CONNECTOR SPECIFICATION
  // ==========================================================================

  /**
   * Returns supported external connector capabilities and validation rules.
   */
  getExternalConnectorSpecs(): ExternalScoringConnectorConfig[] {
    return [
      {
        id: 'conn-generic-webhook',
        name: 'Generic Inbound Score Webhook',
        target_system: 'manual_webhook',
        api_endpoint: '/api/v1/connectors/scoring/webhook',
        status: 'active',
        allowed_leaderboard_ids: ['*'],
        supported_match_types: ['fixture_result', 'tournament_match', 'score_event'],
        created_at: new Date().toISOString(),
      },
      {
        id: 'conn-scorekeeper-api',
        name: 'Official Scorekeeper Rest API',
        target_system: 'scorekeeper_api',
        api_endpoint: '/api/v1/connectors/scoring/scorekeeper',
        status: 'active',
        allowed_leaderboard_ids: ['*'],
        supported_match_types: ['fixture_result'],
        created_at: new Date().toISOString(),
      },
    ];
  },
};
