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

describe('Embed Parity across Competition Engines', () => {
  beforeEach(() => {
    localStorage.clear();
    DatabaseService.initialize();
  });

  it('resolves simple_points embed data', async () => {
    const lb = await DatabaseService.getLeaderboardBySlug('cyber-arena');
    expect(lb).toBeDefined();

    const config = await LeagueService.getCompetitionConfig(lb!.id);
    expect(config?.engine_type).not.toBe('tournament');
    expect(config?.engine_type).not.toBe('league_table');

    const rankings = await DatabaseService.getRankings(lb!.id);
    expect(rankings.length).toBeGreaterThan(0);
  });

  it('resolves league_table embed standings correctly', async () => {
    // Seed creator profile
    vi.spyOn(DatabaseService, 'getCurrentProfile').mockImplementation(async () => ({
      id: 'creator-user-id',
      email: 'creator@leaderboardos.com',
      full_name: 'Creator',
      role: 'admin',
      avatar_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const league = await LeagueService.createLeagueCompetition({
      name: 'Embed League Cup',
      description: 'Testing embed league',
      visibility: 'public',
      competitionType: 'sports',
      coverImageUrl: null,
      slug: 'embed-league-cup',
      templateKey: 'football-league-table',
      entityType: 'team',
      seasonName: '2026',
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

    const config = await LeagueService.getCompetitionConfig(league.id);
    expect(config?.engine_type).toBe('league_table');

    const standings = await LeagueService.getLeagueStandings(league.id);
    expect(Array.isArray(standings)).toBe(true);
  });

  it('resolves tournament embed bracket view correctly', async () => {
    vi.spyOn(DatabaseService, 'getCurrentProfile').mockImplementation(async () => ({
      id: 'creator-user-id',
      email: 'creator@leaderboardos.com',
      full_name: 'Creator',
      role: 'admin',
      avatar_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const tourney = await TournamentService.createTournamentCompetition({
      name: 'Embed Tournament Bracket',
      description: 'Testing embed tournament',
      visibility: 'public',
      competitionType: 'gaming',
      coverImageUrl: null,
      slug: 'embed-tournament-bracket',
      templateKey: 'gaming-tournament',
      seasonName: '2026',
      startDate: new Date().toISOString(),
      endDate: null,
      bracketSize: 2,
      seedingMode: 'random',
    });

    const config = await LeagueService.getCompetitionConfig(tourney.id);
    expect(config?.engine_type).toBe('tournament');

    await DatabaseService.addMember(tourney.id, {
      name: 'Gamer 1',
      email: null,
      avatar_url: null,
      team: null,
      notes: null,
    });
    await DatabaseService.addMember(tourney.id, {
      name: 'Gamer 2',
      email: null,
      avatar_url: null,
      team: null,
      notes: null,
    });

    await TournamentService.generateBracket({
      leaderboardId: tourney.id,
      bracketSize: 2,
      seedingMode: 'random',
    });

    const bracketView = await TournamentService.getBracketView(tourney.id);
    expect(bracketView).toBeDefined();
    expect(bracketView?.rounds.length).toBe(1);
    expect(bracketView?.rounds[0].matches.length).toBe(1);
  });
});
