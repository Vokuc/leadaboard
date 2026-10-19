import { describe, expect, it, vi, beforeEach } from 'vitest';
import { DatabaseService } from '@/lib/db';
import { LeagueService } from '@/lib/league/service';
import { TournamentService } from '@/lib/tournament/service';

// Mock localStorage and window in node test environment
const store: Record<string, string> = {};
global.window = {
  location: { origin: 'http://localhost' }
} as unknown as Window & typeof globalThis;
global.localStorage = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => {
    for (const key in store) {
      delete store[key];
    }
  }
} as unknown as Storage;

describe('Cross-Engine Match Activity Logging', () => {
  const adminUser = {
    id: 'creator-user-id',
    email: 'admin@leaderboardos.com',
    full_name: 'Admin User',
    role: 'admin' as const,
  };

  beforeEach(() => {
    localStorage.clear();
    DatabaseService.initialize();

    vi.spyOn(DatabaseService, 'getCurrentProfile').mockImplementation(async () => ({
      ...adminUser,
      avatar_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
  });

  it('logs completed league fixtures to activity_logs in demo mode', async () => {
    // Create league competition
    const league = await LeagueService.createLeagueCompetition({
      name: 'Premier Football League',
      description: 'Activity log test league',
      visibility: 'public',
      competitionType: 'sports',
      coverImageUrl: null,
      slug: 'activity-log-league',
      templateKey: 'football-league-table',
      entityType: 'team',
      seasonName: 'Season 2026',
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

    // Add 2 clubs
    const clubA = await DatabaseService.addMember(league.id, {
      name: 'Arsenal FC',
      email: null,
      avatar_url: null,
      team: 'Arsenal',
      notes: null,
    });
    const clubB = await DatabaseService.addMember(league.id, {
      name: 'Chelsea FC',
      email: null,
      avatar_url: null,
      team: 'Chelsea',
      notes: null,
    });

    // Save scheduled fixture
    const fixture = await LeagueService.saveFixture({
      leaderboardId: league.id,
      homeMemberId: clubA.id,
      awayMemberId: clubB.id,
      roundName: 'Round 1',
      scheduledAt: null,
      status: 'scheduled',
    });

    // Save fixture score
    await LeagueService.saveFixtureResult({
      fixtureId: fixture.id,
      homeScore: 3,
      awayScore: 1,
    });

    // Fetch activity logs
    const logs = await DatabaseService.getActivityLogs(league.id);
    expect(logs.length).toBeGreaterThan(0);

    const matchLog = logs.find((l) => l.message.includes('3 - 1'));
    expect(matchLog).toBeDefined();
    expect(matchLog?.message).toContain('3 - 1');
  });

  it('logs tournament match results and champion crowning to activity_logs in demo mode', async () => {
    // Create 2-player tournament
    const tournamentLb = await TournamentService.createTournamentCompetition({
      name: 'Smash Finals',
      description: 'Tournament logging test',
      visibility: 'public',
      competitionType: 'gaming',
      coverImageUrl: null,
      slug: 'smash-finals-logging',
      templateKey: 'gaming-tournament',
      seasonName: 'Championship 2026',
      startDate: new Date().toISOString(),
      endDate: null,
      bracketSize: 2,
      seedingMode: 'manual',
    });

    const p1 = await DatabaseService.addMember(tournamentLb.id, {
      name: 'FoxMaster',
      email: null,
      avatar_url: null,
      team: null,
      notes: null,
    });
    const p2 = await DatabaseService.addMember(tournamentLb.id, {
      name: 'FalcoGod',
      email: null,
      avatar_url: null,
      team: null,
      notes: null,
    });

    // Generate bracket
    await TournamentService.generateBracket({
      leaderboardId: tournamentLb.id,
      bracketSize: 2,
      seedingMode: 'manual',
      manualSeedMemberIds: [p1.id, p2.id],
    });

    const matches = await TournamentService.getMatches(tournamentLb.id);
    expect(matches.length).toBe(1);

    const finalMatch = matches[0];

    // Save match result (final match -> crowns champion)
    await TournamentService.saveMatchResult({
      matchId: finalMatch.id,
      homeScore: 3,
      awayScore: 0,
    });

    const logs = await DatabaseService.getActivityLogs(tournamentLb.id);
    expect(logs.length).toBeGreaterThan(0);

    const championLog = logs.find((l) => l.message.includes('FoxMaster') && (l.message.includes('champion') || l.message.includes('advanced')));
    expect(championLog).toBeDefined();
    expect(championLog?.message).toContain('3 - 0');
  });
});
