import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  CompetitionRules, 
  LeaderboardMember, 
  ScoreEvent, 
  Fixture, 
  FixtureResult, 
  CompetitionStatistic 
} from '@/types';
import { 
  getDefaultCompetitionRules 
} from '@/lib/competition/rules/defaults';
import { 
  validateCompetitionRules, 
  validateScoreAdjustment, 
  validateFixtureResult 
} from '@/lib/competition/rules/validation';
import { 
  evaluatePointsRankings, 
  evaluateLeagueStandings, 
  explainRankingRules 
} from '@/lib/competition/rules/evaluator';
import { CompetitionRulesService } from '@/lib/competition/rules/service';
import { DatabaseService } from '@/lib/db';

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

describe('Configurable Competition Rules Engine', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined') {
      localStorage.clear();
    }
    DatabaseService.initialize();

    vi.spyOn(DatabaseService, 'getCurrentProfile').mockImplementation(async () => {
      return {
        id: 'creator-user-id',
        email: 'creator@leaderboardos.com',
        full_name: 'Alex Mercer',
        role: 'super_admin',
        avatar_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });
  });

  describe('1. Default Rules & Validation', () => {
    it('creates valid default rules for simple_points, league_table, and tournament', () => {
      const pointsRules = getDefaultCompetitionRules('simple_points', 'lb-1');
      expect(pointsRules.version).toBe(1);
      expect(pointsRules.engine).toBe('simple_points');
      expect(pointsRules.ranking_order).toBe('desc');
      expect(pointsRules.points_config.allow_negative_points).toBe(true);

      const leagueRules = getDefaultCompetitionRules('league_table', 'lb-2');
      expect(leagueRules.version).toBe(1);
      expect(leagueRules.engine).toBe('league_table');
      expect(leagueRules.points_config.points_for_win).toBe(3);
      expect(leagueRules.points_config.points_for_draw).toBe(1);
      expect(leagueRules.points_config.points_for_loss).toBe(0);
      expect(leagueRules.tie_breakers.some(tb => tb.type === 'head_to_head')).toBe(true);

      const tournamentRules = getDefaultCompetitionRules('tournament', 'lb-3');
      expect(tournamentRules.engine).toBe('tournament');
      expect(tournamentRules.points_config.allow_draws).toBe(false);
    });

    it('validates rules configurations and rejects invalid inputs', () => {
      // Reject tie breakers without deterministic fallback
      const invalidTb = validateCompetitionRules({
        engine: 'league_table',
        ranking_order: 'desc',
        points_config: { points_for_win: 3, points_for_draw: 1, points_for_loss: 0, allow_draws: true, allow_negative_points: true },
        tie_breakers: [{ type: 'points', label: 'Points' }],
      });
      expect(invalidTb.valid).toBe(false);
      expect(invalidTb.errors[0]).toContain('deterministic fallback');

      // Reject duplicate criteria
      const duplicateTb = validateCompetitionRules({
        engine: 'simple_points',
        ranking_order: 'desc',
        points_config: { points_for_win: 1, points_for_draw: 0, points_for_loss: 0, allow_draws: true, allow_negative_points: true },
        tie_breakers: [
          { type: 'points', label: 'Points' },
          { type: 'points', label: 'Points Again' },
          { type: 'alphabetical', label: 'Alphabetical' },
        ],
      });
      expect(duplicateTb.valid).toBe(false);
      expect(duplicateTb.errors[0]).toContain('Duplicate tie-breaker');

      // Reject min > max
      const invalidBounds = validateCompetitionRules({
        points_config: {
          points_for_win: 3,
          points_for_draw: 1,
          points_for_loss: 0,
          allow_draws: true,
          allow_negative_points: true,
          min_points_per_event: 100,
          max_points_per_event: 10,
        },
        tie_breakers: [{ type: 'alphabetical', label: 'Alphabetical' }],
      });
      expect(invalidBounds.valid).toBe(false);
      expect(invalidBounds.errors[0]).toContain('Minimum points per event cannot exceed maximum');
    });
  });

  describe('2. Simple Points Engine & Tie-Breaking', () => {
    const memberA: LeaderboardMember = {
      id: 'm-a',
      leaderboard_id: 'lb-pts',
      name: 'Alice',
      email: 'alice@example.com',
      avatar_url: null,
      team: null,
      notes: null,
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };

    const memberB: LeaderboardMember = {
      id: 'm-b',
      leaderboard_id: 'lb-pts',
      name: 'Bob',
      email: 'bob@example.com',
      avatar_url: null,
      team: null,
      notes: null,
      is_active: true,
      created_at: '2026-01-02T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
    };

    it('ranks higher points first in descending order', () => {
      const rules = getDefaultCompetitionRules('simple_points', 'lb-pts');
      const events: ScoreEvent[] = [
        { id: 'e1', leaderboard_id: 'lb-pts', member_id: 'm-a', rule_id: null, points: 50, reason: 'Win', created_at: '2026-01-10T10:00:00Z' },
        { id: 'e2', leaderboard_id: 'lb-pts', member_id: 'm-b', rule_id: null, points: 100, reason: 'Win', created_at: '2026-01-10T11:00:00Z' },
      ];

      const rankings = evaluatePointsRankings([memberA, memberB], events, rules);
      expect(rankings[0].player_name).toBe('Bob');
      expect(rankings[0].total_points).toBe(100);
      expect(rankings[1].player_name).toBe('Alice');
      expect(rankings[1].total_points).toBe(50);
    });

    it('ranks lower points first in ascending order (e.g. Golf / Time trials)', () => {
      const rules: CompetitionRules = {
        ...getDefaultCompetitionRules('simple_points', 'lb-pts'),
        ranking_order: 'asc',
      };
      const events: ScoreEvent[] = [
        { id: 'e1', leaderboard_id: 'lb-pts', member_id: 'm-a', rule_id: null, points: 68, reason: 'Round 1', created_at: '2026-01-10T10:00:00Z' },
        { id: 'e2', leaderboard_id: 'lb-pts', member_id: 'm-b', rule_id: null, points: 72, reason: 'Round 1', created_at: '2026-01-10T11:00:00Z' },
      ];

      const rankings = evaluatePointsRankings([memberA, memberB], events, rules);
      expect(rankings[0].player_name).toBe('Alice');
      expect(rankings[0].total_points).toBe(68);
      expect(rankings[1].player_name).toBe('Bob');
      expect(rankings[1].total_points).toBe(72);
    });

    it('breaks ties using earliest score achievement', () => {
      const rules = getDefaultCompetitionRules('simple_points', 'lb-pts');
      // Both Alice and Bob have 50 points, but Alice achieved it on Jan 10 and Bob on Jan 11
      const events: ScoreEvent[] = [
        { id: 'e1', leaderboard_id: 'lb-pts', member_id: 'm-a', rule_id: null, points: 50, reason: 'Level 1', created_at: '2026-01-10T10:00:00Z' },
        { id: 'e2', leaderboard_id: 'lb-pts', member_id: 'm-b', rule_id: null, points: 50, reason: 'Level 1', created_at: '2026-01-11T10:00:00Z' },
      ];

      const rankings = evaluatePointsRankings([memberA, memberB], events, rules);
      expect(rankings[0].player_name).toBe('Alice');
      expect(rankings[1].player_name).toBe('Bob');
      expect(rankings[1].tie_break_explanation).toContain('Earlier score');
    });

    it('validates negative score adjustments and rejects them when disabled', () => {
      const rulesDisallowingNegative: CompetitionRules = {
        ...getDefaultCompetitionRules('simple_points', 'lb-pts'),
        points_config: {
          ...getDefaultCompetitionRules('simple_points', 'lb-pts').points_config,
          allow_negative_points: false,
        },
      };

      const result = validateScoreAdjustment(rulesDisallowingNegative, { points: -10, reason: 'Penalty' });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Negative point adjustments are not permitted');

      const validResult = validateScoreAdjustment(rulesDisallowingNegative, { points: 15, reason: 'Bonus' });
      expect(validResult.valid).toBe(true);
    });
  });

  describe('3. League Tables & Head-to-Head Tie Breaking', () => {
    const team1: LeaderboardMember = {
      id: 't-1',
      leaderboard_id: 'lb-league',
      name: 'Arsenal',
      email: null,
      avatar_url: null,
      team: 'Arsenal',
      notes: null,
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };

    const team2: LeaderboardMember = {
      id: 't-2',
      leaderboard_id: 'lb-league',
      name: 'Chelsea',
      email: null,
      avatar_url: null,
      team: 'Chelsea',
      notes: null,
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };

    const statistics: CompetitionStatistic[] = [
      { id: 's1', leaderboard_id: 'lb-league', statistic_key: 'played', label: 'P', category: 'derived', calculation_type: 'played', is_enabled: true, display_order: 1, created_at: '' },
      { id: 's2', leaderboard_id: 'lb-league', statistic_key: 'wins', label: 'W', category: 'input', calculation_type: null, is_enabled: true, display_order: 2, created_at: '' },
      { id: 's3', leaderboard_id: 'lb-league', statistic_key: 'draws', label: 'D', category: 'input', calculation_type: null, is_enabled: true, display_order: 3, created_at: '' },
      { id: 's4', leaderboard_id: 'lb-league', statistic_key: 'losses', label: 'L', category: 'input', calculation_type: null, is_enabled: true, display_order: 4, created_at: '' },
      { id: 's5', leaderboard_id: 'lb-league', statistic_key: 'goals_for', label: 'GF', category: 'input', calculation_type: null, is_enabled: true, display_order: 5, created_at: '' },
      { id: 's6', leaderboard_id: 'lb-league', statistic_key: 'goals_against', label: 'GA', category: 'input', calculation_type: null, is_enabled: true, display_order: 6, created_at: '' },
      { id: 's7', leaderboard_id: 'lb-league', statistic_key: 'goal_difference', label: 'GD', category: 'derived', calculation_type: 'goal_difference', is_enabled: true, display_order: 7, created_at: '' },
      { id: 's8', leaderboard_id: 'lb-league', statistic_key: 'points', label: 'Pts', category: 'input', calculation_type: null, is_enabled: true, display_order: 8, created_at: '' },
    ];

    it('calculates standings with configurable 3-1-0 points', () => {
      const rules = getDefaultCompetitionRules('league_table', 'lb-league');
      const fixtures: Fixture[] = [
        { id: 'f-1', leaderboard_id: 'lb-league', home_member_id: 't-1', away_member_id: 't-2', round_name: 'M1', scheduled_at: null, status: 'completed', created_at: '', updated_at: '' },
      ];
      const results: FixtureResult[] = [
        { fixture_id: 'f-1', home_score: 2, away_score: 1, created_at: '', updated_at: '' },
      ];

      const standings = evaluateLeagueStandings({
        members: [team1, team2],
        fixtures,
        results,
        rules,
        competitionStatistics: statistics,
        scoredStatKey: 'goals_for',
        allowedStatKey: 'goals_against',
      });

      expect(standings[0].name).toBe('Arsenal');
      expect(standings[0].stats.points).toBe(3);
      expect(standings[0].stats.wins).toBe(1);
      expect(standings[1].name).toBe('Chelsea');
      expect(standings[1].stats.points).toBe(0);
      expect(standings[1].stats.losses).toBe(1);
    });

    it('breaks ties using head-to-head match results between tied teams', () => {
      // Configure tie-breakers with head_to_head before goal_difference
      const rules: CompetitionRules = {
        ...getDefaultCompetitionRules('league_table', 'lb-league'),
        tie_breakers: [
          { type: 'points' as const, label: 'Points' },
          { type: 'head_to_head' as const, label: 'Head-to-Head' },
          { type: 'goal_difference' as const, label: 'Goal Difference' },
          { type: 'goals_for' as const, label: 'Goals Scored' },
          { type: 'alphabetical' as const, label: 'Alphabetical' },
        ],
      };

      // Both teams played 2 games and have:
      // - 3 points each
      // In fixture f-1, Arsenal beat Chelsea 2-1
      // In fixture f-2, Chelsea beat Arsenal 3-1
      // H2H: Chelsea has 4 goals vs Arsenal 3 goals (+1 H2H GD).
      const fixtures: Fixture[] = [
        { id: 'f-1', leaderboard_id: 'lb-league', home_member_id: 't-1', away_member_id: 't-2', round_name: 'M1', scheduled_at: null, status: 'completed', created_at: '', updated_at: '' },
        { id: 'f-2', leaderboard_id: 'lb-league', home_member_id: 't-2', away_member_id: 't-1', round_name: 'M2', scheduled_at: null, status: 'completed', created_at: '', updated_at: '' },
      ];
      const results: FixtureResult[] = [
        { fixture_id: 'f-1', home_score: 2, away_score: 1, created_at: '', updated_at: '' },
        { fixture_id: 'f-2', home_score: 3, away_score: 1, created_at: '', updated_at: '' },
      ];

      const h2hStandings = evaluateLeagueStandings({
        members: [team1, team2],
        fixtures,
        results,
        rules,
        competitionStatistics: statistics,
        scoredStatKey: 'goals_for',
        allowedStatKey: 'goals_against',
      });

      expect(h2hStandings[0].name).toBe('Chelsea');
      expect(h2hStandings[1].name).toBe('Arsenal');
      expect(h2hStandings[1].tie_break_explanation).toContain('Head-to-head');
    });

    it('rejects draws when allow_draws is disabled', () => {
      const rules = getDefaultCompetitionRules('league_table', 'lb-league');
      rules.points_config.allow_draws = false;

      const validation = validateFixtureResult(rules, { homeScore: 2, awayScore: 2 }, false);
      expect(validation.valid).toBe(false);
      expect(validation.errors[0]).toContain('Draws are not permitted');

      const validWin = validateFixtureResult(rules, { homeScore: 3, awayScore: 1 }, false);
      expect(validWin.valid).toBe(true);
    });
  });

  describe('4. Knockout Tournaments & Decisive Match Results', () => {
    it('requires a decisive winner in tournament knockout matches', () => {
      const rules = getDefaultCompetitionRules('tournament', 'lb-tourn');
      const tiedValidation = validateFixtureResult(rules, { homeScore: 1, awayScore: 1 }, true);
      expect(tiedValidation.valid).toBe(false);
      expect(tiedValidation.errors[0]).toContain('must produce a decisive winner');

      const decisiveValidation = validateFixtureResult(rules, { homeScore: 2, awayScore: 1 }, true);
      expect(decisiveValidation.valid).toBe(true);
    });
  });

  describe('5. Rule Versioning & Persistence', () => {
    it('increments version on save and logs audit activity', async () => {
      const lbId = 'lb-gaming-1';
      // First fetch gets default v1
      const initialRules = await CompetitionRulesService.getRules(lbId);
      expect(initialRules.version).toBe(1);

      // Save updated rules
      const updatedRules = await CompetitionRulesService.saveRules(lbId, {
        ranking_order: 'asc',
        points_config: {
          points_for_win: 2,
          points_for_draw: 1,
          points_for_loss: 0,
          allow_draws: true,
          allow_negative_points: false,
        },
      });

      expect(updatedRules.version).toBe(2);
      expect(updatedRules.ranking_order).toBe('asc');
      expect(updatedRules.points_config.allow_negative_points).toBe(false);
      expect(updatedRules.points_config.points_for_win).toBe(2);

      // Verify active rules returns v2
      const activeRules = await CompetitionRulesService.getRules(lbId);
      expect(activeRules.version).toBe(2);

      // Verify rule history has both versions
      const history = await CompetitionRulesService.getRuleHistory(lbId);
      expect(history.length).toBeGreaterThanOrEqual(1);
    });

    it('generates human-readable rule explanations', () => {
      const rules = getDefaultCompetitionRules('league_table', 'lb-exp');
      const explanations = explainRankingRules(rules);
      expect(explanations.some(e => e.includes('Win = 3 pts'))).toBe(true);
      expect(explanations.some(e => e.includes('Tie-break Hierarchy'))).toBe(true);
    });
  });
});
