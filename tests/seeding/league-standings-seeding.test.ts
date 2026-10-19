import { describe, expect, it, vi, beforeEach } from 'vitest';
import { DatabaseService } from '@/lib/db';
import { LeagueService } from '@/lib/league/service';
import { TournamentService } from '@/lib/tournament/service';
import {
  generateSingleEliminationBracket,
  getSeedingPattern,
} from '@/services/tournamentAdvancement';
import { LeaderboardMember } from '@/types';

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

describe('League to Tournament Seeding', () => {
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

  describe('Standard Seeding Algorithm', () => {
    it('generates correct mathematical seeding patterns across bracket sizes', () => {
      expect(getSeedingPattern(2)).toEqual([1, 2]);
      expect(getSeedingPattern(4)).toEqual([1, 4, 2, 3]);
      expect(getSeedingPattern(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
      expect(getSeedingPattern(16)).toEqual([1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11]);
    });

    it('places seeds and handles BYE advancement in generateSingleEliminationBracket', () => {
      const mockMembers: LeaderboardMember[] = Array.from({ length: 6 }, (_, i) => ({
        id: `mem-${i + 1}`,
        leaderboard_id: 'lb-tourney-1',
        name: `Seed ${i + 1}`,
        email: null,
        avatar_url: null,
        team: null,
        notes: null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      // Bracket of 8 with 6 members (Seeds 1 to 6; Seeds 7 and 8 are BYEs)
      const result = generateSingleEliminationBracket({
        leaderboardId: 'lb-tourney-1',
        participants: mockMembers,
        bracketSize: 8,
        seedingMode: 'league_standings',
      });

      const round1 = result.rounds.find((r) => r.round_index === 1);
      expect(round1).toBeDefined();

      const round1Matches = result.matches.filter((m) => m.round_id === round1?.id);
      expect(round1Matches.length).toBe(4);

      // Match 1: Seed 1 vs Seed 8 (null) -> Seed 1 gets a BYE
      const match1 = round1Matches.find((m) => m.match_index === 1);
      expect(match1?.home_member_id).toBe('mem-1');
      expect(match1?.away_member_id).toBeNull();
      expect(match1?.state).toBe('bye');
      expect(match1?.winner_member_id).toBe('mem-1');

      // Match 3: Seed 2 vs Seed 7 (null) -> Seed 2 gets a BYE
      const match3 = round1Matches.find((m) => m.match_index === 3);
      expect(match3?.home_member_id).toBe('mem-2');
      expect(match3?.away_member_id).toBeNull();
      expect(match3?.state).toBe('bye');
      expect(match3?.winner_member_id).toBe('mem-2');

      // Check that Round 2 matches have the auto-advanced BYE winners already placed
      const round2 = result.rounds.find((r) => r.round_index === 2);
      const round2Matches = result.matches.filter((m) => m.round_id === round2?.id);
      expect(round2Matches[0].home_member_id).toBe('mem-1');
      expect(round2Matches[1].home_member_id).toBe('mem-2');
    });
  });

  describe('End-to-End League to Tournament Seeding', () => {
    it('seeds tournament bracket from league standings with auto participant synchronization', async () => {
      // 1. Create source league
      const league = await LeagueService.createLeagueCompetition({
        name: 'Championship League',
        description: 'Source league for playoffs',
        visibility: 'public',
        competitionType: 'sports',
        coverImageUrl: null,
        slug: 'championship-league-seeding',
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

      // Add 4 teams
      const teamAlpha = await DatabaseService.addMember(league.id, {
        name: 'Team Alpha',
        email: null,
        avatar_url: null,
        team: 'Alpha Group',
        notes: null,
      });
      const teamBeta = await DatabaseService.addMember(league.id, {
        name: 'Team Beta',
        email: null,
        avatar_url: null,
        team: 'Beta Group',
        notes: null,
      });
      const teamGamma = await DatabaseService.addMember(league.id, {
        name: 'Team Gamma',
        email: null,
        avatar_url: null,
        team: 'Gamma Group',
        notes: null,
      });
      const teamDelta = await DatabaseService.addMember(league.id, {
        name: 'Team Delta',
        email: null,
        avatar_url: null,
        team: 'Delta Group',
        notes: null,
      });

      // Play match: Alpha beats Beta (Alpha gets 3 points, Beta gets 0)
      const fixture1 = await LeagueService.saveFixture({
        leaderboardId: league.id,
        homeMemberId: teamAlpha.id,
        awayMemberId: teamBeta.id,
        roundName: 'Matchday 1',
        scheduledAt: null,
        status: 'scheduled',
      });
      await LeagueService.saveFixtureResult({
        fixtureId: fixture1.id,
        homeScore: 4,
        awayScore: 0,
      });

      // Play match: Gamma beats Delta (Gamma gets 3 points, goal diff +2; Alpha has goal diff +4 so Alpha is 1st, Gamma is 2nd)
      const fixture2 = await LeagueService.saveFixture({
        leaderboardId: league.id,
        homeMemberId: teamGamma.id,
        awayMemberId: teamDelta.id,
        roundName: 'Matchday 1',
        scheduledAt: null,
        status: 'scheduled',
      });
      await LeagueService.saveFixtureResult({
        fixtureId: fixture2.id,
        homeScore: 2,
        awayScore: 0,
      });

      // Verify league standings
      const standings = await LeagueService.getLeagueStandings(league.id);
      expect(standings.length).toBe(4);
      expect(standings[0].name).toBe('Team Alpha'); // Rank 1
      expect(standings[1].name).toBe('Team Gamma'); // Rank 2

      // 2. Create Tournament for Playoffs
      const tournament = await TournamentService.createTournamentCompetition({
        name: 'Playoff Bracket',
        description: 'Post-season playoffs',
        visibility: 'public',
        competitionType: 'sports',
        coverImageUrl: null,
        slug: 'playoff-bracket-seeded',
        templateKey: 'gaming-tournament',
        seasonName: 'Playoffs 2026',
        startDate: new Date().toISOString(),
        endDate: null,
        bracketSize: 4,
        seedingMode: 'league_standings',
      });

      // 3. Generate bracket from league standings
      await TournamentService.generateBracket({
        leaderboardId: tournament.id,
        bracketSize: 4,
        seedingMode: 'league_standings',
        sourceLeagueId: league.id,
      });

      // Verify participants were auto-synced to tournament leaderboard
      const tourneyMembers = await DatabaseService.getMembers(tournament.id);
      expect(tourneyMembers.length).toBe(4);
      const alphaTourneyMember = tourneyMembers.find((m) => m.name === 'Team Alpha');
      const gammaTourneyMember = tourneyMembers.find((m) => m.name === 'Team Gamma');
      expect(alphaTourneyMember).toBeDefined();
      expect(gammaTourneyMember).toBeDefined();

      // Verify bracket matches
      const matches = await TournamentService.getMatches(tournament.id);
      expect(matches.length).toBe(3); // 2 in R1, 1 in Final

      const round1Matches = matches.filter((m) => m.round_index === 1);
      // For size 4 pattern [1, 4, 2, 3]:
      // Match 1: Seed 1 (Alpha) vs Seed 4
      expect(round1Matches[0].home_member_id).toBe(alphaTourneyMember?.id);
      // Match 2: Seed 2 (Gamma) vs Seed 3
      expect(round1Matches[1].home_member_id).toBe(gammaTourneyMember?.id);
    });
  });
});
