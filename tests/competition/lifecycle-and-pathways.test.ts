import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DatabaseService } from '@/lib/db';
import { LeagueService } from '@/lib/league/service';
import { TournamentService } from '@/lib/tournament/service';
import { CompetitionLifecycleService } from '@/lib/competition/lifecycle/service';
import { CompetitionPathwayService } from '@/lib/competition/pathway/service';

// Mock in-memory localStorage store for Node test environment
const store: Record<string, string> = {};
global.window = {
  location: { origin: 'http://localhost' },
} as unknown as Window & typeof globalThis;
global.localStorage = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => {
    store[key] = value;
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    for (const key in store) {
      delete store[key];
    }
  },
} as unknown as Storage;

describe('Competition Lifecycle & Multi-Stage Pathways', () => {
  const ownerId = 'creator-user-id';
  const unauthorizedUserId = 'regular-user-id';

  let sourceLeagueId: string;
  let destTournId: string;

  beforeEach(async () => {
    vi.restoreAllMocks();
    localStorage.clear();
    DatabaseService.initialize();

    // Default admin profile
    vi.spyOn(DatabaseService, 'getCurrentProfile').mockImplementation(async () => ({
      id: ownerId,
      email: 'creator@leaderboardos.com',
      full_name: 'Tournament Director',
      role: 'admin',
      avatar_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    // 1. Create source league
    const league = await LeagueService.createLeagueCompetition({
      name: 'Premier Qualifier League',
      description: 'Source stage for championship',
      visibility: 'public',
      competitionType: 'sports',
      coverImageUrl: null,
      slug: 'premier-qualifier-league',
      templateKey: 'football-league-table',
      entityType: 'team',
      seasonName: 'Regular Season',
      startDate: new Date().toISOString(),
      endDate: null,
      pointsForWin: 3,
      pointsForDraw: 1,
      pointsForLoss: 0,
      selectedStatisticKeys: ['wins', 'draws', 'losses', 'goals_for', 'goals_against', 'goal_difference', 'points'],
      standingsColumnKeys: ['played', 'wins', 'draws', 'losses', 'goal_difference', 'points'],
      rankingRules: [
        { criterion_type: 'points', statistic_key: 'points', label: 'Points', direction: 'desc' },
      ],
    });
    sourceLeagueId = league.id;

    // Add 4 teams to source league
    const teamArsenal = await DatabaseService.addMember(sourceLeagueId, {
      name: 'Arsenal FC',
      email: null,
      avatar_url: null,
      team: 'Arsenal',
      notes: null,
    });
    const teamChelsea = await DatabaseService.addMember(sourceLeagueId, {
      name: 'Chelsea FC',
      email: null,
      avatar_url: null,
      team: 'Chelsea',
      notes: null,
    });
    const teamLiverpool = await DatabaseService.addMember(sourceLeagueId, {
      name: 'Liverpool FC',
      email: null,
      avatar_url: null,
      team: 'Liverpool',
      notes: null,
    });
    const teamManCity = await DatabaseService.addMember(sourceLeagueId, {
      name: 'Manchester City',
      email: null,
      avatar_url: null,
      team: 'Man City',
      notes: null,
    });

    // Fixture 1: Arsenal 4 - 0 Man City (Arsenal 3 pts, +4 GD)
    const fix1 = await LeagueService.saveFixture({
      leaderboardId: sourceLeagueId,
      homeMemberId: teamArsenal.id,
      awayMemberId: teamManCity.id,
      roundName: 'Matchday 1',
      scheduledAt: null,
      status: 'scheduled',
    });
    await LeagueService.saveFixtureResult({
      fixtureId: fix1.id,
      homeScore: 4,
      awayScore: 0,
    });

    // Fixture 2: Chelsea 2 - 0 Liverpool (Chelsea 3 pts, +2 GD)
    const fix2 = await LeagueService.saveFixture({
      leaderboardId: sourceLeagueId,
      homeMemberId: teamChelsea.id,
      awayMemberId: teamLiverpool.id,
      roundName: 'Matchday 1',
      scheduledAt: null,
      status: 'scheduled',
    });
    await LeagueService.saveFixtureResult({
      fixtureId: fix2.id,
      homeScore: 2,
      awayScore: 0,
    });

    // Fixture 3: Liverpool 1 - 0 Man City (Liverpool 3 pts, -1 GD; Man City 0 pts)
    const fix3 = await LeagueService.saveFixture({
      leaderboardId: sourceLeagueId,
      homeMemberId: teamLiverpool.id,
      awayMemberId: teamManCity.id,
      roundName: 'Matchday 2',
      scheduledAt: null,
      status: 'scheduled',
    });
    await LeagueService.saveFixtureResult({
      fixtureId: fix3.id,
      homeScore: 1,
      awayScore: 0,
    });

    // 2. Create destination tournament
    const tourn = await TournamentService.createTournamentCompetition({
      name: 'Championship Knockout Cup',
      description: 'Destination knockout stage',
      visibility: 'public',
      competitionType: 'tournament',
      coverImageUrl: null,
      slug: 'championship-knockout-cup',
      templateKey: 'custom-single-elimination',
      seasonName: 'Playoffs 2026',
      startDate: new Date().toISOString(),
      endDate: null,
      bracketSize: 4,
      seedingMode: 'manual',
    });
    destTournId = tourn.id;
  });

  describe('1. Operational Lifecycle State Machine & Validation', () => {
    it('initializes operational status to draft by default', async () => {
      const status = await CompetitionLifecycleService.getOperationalStatus(sourceLeagueId);
      expect(status).toBe('draft');
    });

    it('follows valid lifecycle progression: draft -> registration_open -> scheduled -> in_progress -> under_review -> completed', async () => {
      // 1. draft -> registration_open
      let updated = await CompetitionLifecycleService.updateOperationalStatus(
        sourceLeagueId,
        'registration_open',
        'Opening registration for season'
      );
      expect(updated.newStatus).toBe('registration_open');

      // 2. registration_open -> scheduled
      updated = await CompetitionLifecycleService.updateOperationalStatus(
        sourceLeagueId,
        'scheduled',
        'Fixtures scheduled'
      );
      expect(updated.newStatus).toBe('scheduled');

      // 3. scheduled -> in_progress
      updated = await CompetitionLifecycleService.updateOperationalStatus(
        sourceLeagueId,
        'in_progress',
        'Games started'
      );
      expect(updated.newStatus).toBe('in_progress');

      // 4. in_progress -> under_review
      updated = await CompetitionLifecycleService.updateOperationalStatus(
        sourceLeagueId,
        'under_review',
        'Scores under review'
      );
      expect(updated.newStatus).toBe('under_review');

      // 5. under_review -> completed
      updated = await CompetitionLifecycleService.updateOperationalStatus(
        sourceLeagueId,
        'completed',
        'Season finalized'
      );
      expect(updated.newStatus).toBe('completed');
    });

    it('prevents invalid transitions such as draft directly to completed', async () => {
      await expect(
        CompetitionLifecycleService.updateOperationalStatus(
          sourceLeagueId,
          'completed',
          'Attempting jump'
        )
      ).rejects.toThrow(/Cannot transition competition from/);
    });

    it('supports cancellation from draft, scheduled, or in_progress, and prevents transitions out of cancelled', async () => {
      // Transition from draft -> cancelled
      const cancelled = await CompetitionLifecycleService.updateOperationalStatus(
        sourceLeagueId,
        'cancelled',
        'Event called off due to weather'
      );
      expect(cancelled.newStatus).toBe('cancelled');

      // Trying to transition out of cancelled must fail
      await expect(
        CompetitionLifecycleService.updateOperationalStatus(
          sourceLeagueId,
          'registration_open',
          'Reopening cancelled'
        )
      ).rejects.toThrow(/Cannot transition competition from 'cancelled'/);
    });

    it('preserves administrative status (active vs archived) separate from operational lifecycle', async () => {
      // Set operational status to in_progress
      await CompetitionLifecycleService.updateOperationalStatus(sourceLeagueId, 'registration_open');
      await CompetitionLifecycleService.updateOperationalStatus(sourceLeagueId, 'scheduled');
      const opStatus = await CompetitionLifecycleService.updateOperationalStatus(sourceLeagueId, 'in_progress');
      expect(opStatus.newStatus).toBe('in_progress');

      // Check administrative status on leaderboard entity
      const board = await DatabaseService.getLeaderboardById(sourceLeagueId);
      expect(board?.status).toBe('active');
    });

    it('strictly forbids operational lifecycle modifications on archived competitions', async () => {
      // Archive the leaderboard via DatabaseService
      await DatabaseService.updateLeaderboard(sourceLeagueId, { status: 'archived' });

      await expect(
        CompetitionLifecycleService.updateOperationalStatus(
          sourceLeagueId,
          'registration_open'
        )
      ).rejects.toThrow(/Cannot modify operational lifecycle of an archived competition/);
    });

    it('denies status transitions to unauthorized non-admin users', async () => {
      vi.spyOn(DatabaseService, 'getCurrentProfile').mockResolvedValueOnce({
        id: unauthorizedUserId,
        email: 'random@example.com',
        full_name: 'Random User',
        role: 'user',
        avatar_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      await expect(
        CompetitionLifecycleService.updateOperationalStatus(
          sourceLeagueId,
          'registration_open'
        )
      ).rejects.toThrow(/You do not have permission to manage this/);
    });
  });

  describe('2. Legacy Records & Engine Fallbacks', () => {
    it('returns draft fallback for unconfigured standalone simple-points leaderboards', async () => {
      const standalone = await DatabaseService.createLeaderboard({
        name: 'Simple Points Arcade',
        slug: 'simple-points-arcade',
        description: 'Standalone points competition',
        visibility: 'public',
        competition_type: 'gaming',
      });

      const status = await CompetitionLifecycleService.getOperationalStatus(standalone.id);
      expect(status).toBe('draft');
    });

    it('keeps tournament engine synchronized when operational status is updated', async () => {
      await CompetitionLifecycleService.updateOperationalStatus(destTournId, 'registration_open');
      await CompetitionLifecycleService.updateOperationalStatus(destTournId, 'scheduled');

      const tournament = await TournamentService.getTournament(destTournId);
      expect(tournament.state).toBe('scheduled');
    });
  });

  describe('3. Multi-Stage Qualification Preview & Tie Detection', () => {
    it('generates a deterministic preview of qualifiers and Round 1 bracket placements', async () => {
      // Create pathway: top 4 qualify into 4-team knockout
      const pathway = await CompetitionPathwayService.createOrUpdatePathway({
        source_leaderboard_id: sourceLeagueId,
        destination_leaderboard_id: destTournId,
        name: 'Top 4 Championship Qualifier',
        qualifier_count: 4,
        tie_handling: 'standard_rules',
        eligible_participant_ids: null,
        seeding_method: 'league_rank',
      });

      expect(pathway.id).toBeDefined();

      const preview = await CompetitionPathwayService.previewQualification(pathway.id);

      expect(preview.qualifiers.length).toBe(4);
      expect(preview.qualifiers[0].name).toBe('Arsenal FC');
      expect(preview.qualifiers[0].rank).toBe(1);
      expect(preview.qualifiers[0].isQualified).toBe(true);
      expect(preview.qualifiers[3].name).toBe('Manchester City');

      // Verify Round 1 standard bracket matchups (1 vs 4, 2 vs 3)
      expect(preview.bracketMatchups.length).toBe(2);
      expect(preview.bracketMatchups[0].homeSeed).toBe(1);
      expect(preview.bracketMatchups[0].homeParticipantName).toBe('Arsenal FC');
      expect(preview.bracketMatchups[0].awaySeed).toBe(4);
      expect(preview.bracketMatchups[0].awayParticipantName).toBe('Manchester City');

      expect(preview.bracketMatchups[1].homeSeed).toBe(2);
      expect(preview.bracketMatchups[1].homeParticipantName).toBe('Chelsea FC');
      expect(preview.bracketMatchups[1].awaySeed).toBe(3);
      expect(preview.bracketMatchups[1].awayParticipantName).toBe('Liverpool FC');

      expect(preview.canCommit).toBe(true);
    });

    it('detects boundary cutoff ties and halts commit under manual_approval policy', async () => {
      // Create a fresh league where teams at cutoff (rank 2 and 3) have identical points & stats
      const tiedLeague = await LeagueService.createLeagueCompetition({
        name: 'Tied Qualifier League',
        description: 'Testing cutoff ties',
        visibility: 'public',
        competitionType: 'sports',
        coverImageUrl: null,
        slug: 'tied-qualifier-league',
        templateKey: 'football-league-table',
        entityType: 'team',
        seasonName: 'Regular Season',
        startDate: new Date().toISOString(),
        endDate: null,
        pointsForWin: 3,
        pointsForDraw: 1,
        pointsForLoss: 0,
        selectedStatisticKeys: ['wins', 'draws', 'losses', 'goals_for', 'goals_against', 'goal_difference', 'points'],
        standingsColumnKeys: ['played', 'wins', 'draws', 'losses', 'goal_difference', 'points'],
        rankingRules: [
          { criterion_type: 'points', statistic_key: 'points', label: 'Points', direction: 'desc' },
        ],
      });

      const leader = await DatabaseService.addMember(tiedLeague.id, { name: 'Clear Leader', email: null, avatar_url: null, team: null, notes: null });
      const tiedTeamA = await DatabaseService.addMember(tiedLeague.id, { name: 'Tied Team A', email: null, avatar_url: null, team: null, notes: null });
      const tiedTeamB = await DatabaseService.addMember(tiedLeague.id, { name: 'Tied Team B', email: null, avatar_url: null, team: null, notes: null });
      const bottomTeam = await DatabaseService.addMember(tiedLeague.id, { name: 'Bottom Team', email: null, avatar_url: null, team: null, notes: null });

      // Match 1: Clear Leader 3 - 0 Bottom Team
      const m1 = await LeagueService.saveFixture({
        leaderboardId: tiedLeague.id,
        homeMemberId: leader.id,
        awayMemberId: bottomTeam.id,
        roundName: 'R1',
        scheduledAt: null,
        status: 'scheduled',
      });
      await LeagueService.saveFixtureResult({ fixtureId: m1.id, homeScore: 3, awayScore: 0 });

      // Match 2: Tied Team A 1 - 1 Tied Team B (both 1 pt, 0 GD)
      const m2 = await LeagueService.saveFixture({
        leaderboardId: tiedLeague.id,
        homeMemberId: tiedTeamA.id,
        awayMemberId: tiedTeamB.id,
        roundName: 'R1',
        scheduledAt: null,
        status: 'scheduled',
      });
      await LeagueService.saveFixtureResult({ fixtureId: m2.id, homeScore: 1, awayScore: 1 });

      // Destination tournament
      const tiedTourn = await TournamentService.createTournamentCompetition({
        name: 'Tied Destination Cup',
        description: '',
        visibility: 'public',
        competitionType: 'tournament',
        coverImageUrl: null,
        slug: 'tied-dest-cup',
        templateKey: 'custom-single-elimination',
        seasonName: 'Playoffs 2026',
        startDate: new Date().toISOString(),
        endDate: null,
        bracketSize: 4,
        seedingMode: 'manual',
      });

      // Pathway: Top 2 qualify, but rank 2 (Tied Team A) and rank 3 (Tied Team B) are tied!
      const pathway = await CompetitionPathwayService.createOrUpdatePathway({
        source_leaderboard_id: tiedLeague.id,
        destination_leaderboard_id: tiedTourn.id,
        name: 'Top 2 Qualifier with Cutoff Check',
        qualifier_count: 2,
        tie_handling: 'manual_approval', // manual approval blocks automatic commit on tie
        eligible_participant_ids: null,
        seeding_method: 'league_rank',
      });

      const preview = await CompetitionPathwayService.previewQualification(pathway.id);

      expect(preview.hasCutoffTie).toBe(true);
      expect(preview.canCommit).toBe(false);
      expect(preview.tieNotes).toContain('Cutoff tie detected at qualification boundary');
    });
  });

  describe('4. Idempotent Qualification Commit & Safe Repeatability', () => {
    it('commits qualifiers into destination tournament without duplicate members or matches on repeat runs', async () => {
      const pathway = await CompetitionPathwayService.createOrUpdatePathway({
        source_leaderboard_id: sourceLeagueId,
        destination_leaderboard_id: destTournId,
        name: 'Idempotent Championship Run',
        qualifier_count: 4,
        tie_handling: 'standard_rules',
        eligible_participant_ids: null,
        seeding_method: 'league_rank',
      });

      // First commit
      const result1 = await CompetitionPathwayService.commitQualification({
        pathway_id: pathway.id,
      });

      expect(result1.success).toBe(true);
      expect(result1.promotedParticipantsCount).toBe(4);

      // Verify destination members
      const destMembersAfterFirst = await DatabaseService.getMembers(destTournId);
      expect(destMembersAfterFirst.length).toBe(4);

      // Verify bracket rounds and matches created
      const bracket1 = await TournamentService.getBracketView(destTournId);
      expect(bracket1.rounds.length).toBe(2); // 4 teams -> 2 rounds (Semifinals & Finals)
      const matchesAfterFirst = bracket1.rounds.flatMap((r) => r.matches);
      expect(matchesAfterFirst.length).toBe(3); // 2 in R1, 1 in R2

      // Second commit (repeated run)
      const result2 = await CompetitionPathwayService.commitQualification({
        pathway_id: pathway.id,
      });

      expect(result2.success).toBe(true);

      // Verify no duplicate members created
      const destMembersAfterSecond = await DatabaseService.getMembers(destTournId);
      expect(destMembersAfterSecond.length).toBe(4);

      // Verify bracket matches not duplicated
      const bracket2 = await TournamentService.getBracketView(destTournId);
      const matchesAfterSecond = bracket2.rounds.flatMap((r) => r.matches);
      expect(matchesAfterSecond.length).toBe(3);
    });

    it('records activity logs on both source league and destination tournament', async () => {
      const pathway = await CompetitionPathwayService.createOrUpdatePathway({
        source_leaderboard_id: sourceLeagueId,
        destination_leaderboard_id: destTournId,
        name: 'Audit Log Verification Pathway',
        qualifier_count: 4,
        tie_handling: 'standard_rules',
        eligible_participant_ids: null,
        seeding_method: 'league_rank',
      });

      await CompetitionPathwayService.commitQualification({
        pathway_id: pathway.id,
      });

      // Verify activity logs in destination tournament
      const destLogs = await DatabaseService.getActivityLogs(destTournId);
      const stageAdvLog = destLogs.find((l) => l.message.includes('Multi-Stage Pathway'));
      expect(stageAdvLog).toBeDefined();
      expect(stageAdvLog?.message).toContain('Premier Qualifier League');

      // Verify activity logs in source league
      const sourceLogs = await DatabaseService.getActivityLogs(sourceLeagueId);
      const sourceStageLog = sourceLogs.find((l) => l.message.includes('Multi-Stage Pathway'));
      expect(sourceStageLog).toBeDefined();
      expect(sourceStageLog?.message).toContain('Championship Knockout Cup');
    });

    it('refuses to commit qualification if source or destination competition is cancelled', async () => {
      const pathway = await CompetitionPathwayService.createOrUpdatePathway({
        source_leaderboard_id: sourceLeagueId,
        destination_leaderboard_id: destTournId,
        name: 'Cancelled Check Pathway',
        qualifier_count: 4,
        tie_handling: 'standard_rules',
        eligible_participant_ids: null,
        seeding_method: 'league_rank',
      });

      // Cancel the source league
      await CompetitionLifecycleService.updateOperationalStatus(sourceLeagueId, 'cancelled');

      await expect(
        CompetitionPathwayService.commitQualification({
          pathway_id: pathway.id,
        })
      ).rejects.toThrow(/Cannot commit qualification: source or destination competition is cancelled/);
    });
  });
});
