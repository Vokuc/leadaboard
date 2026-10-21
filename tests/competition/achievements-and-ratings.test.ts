import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseService, mockDb } from '@/lib/db';
import { AchievementService } from '@/lib/competition/achievements/service';
import {
  CompetitionRatingsService,
  EloCalculator,
  formatScopeKey,
  DEFAULT_STARTING_RATING,
} from '@/lib/competition/ratings/service';
import { CompetitionPassportService } from '@/lib/competition/passport/service';
import {
  AchievementDefinition,
  Leaderboard,
  LeaderboardMember,
  RatingScope,
  CompetitionFixture,
} from '@/types';

// Mock localStorage and window in node test environment
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

describe('Achievements and Competition Ratings (Era 3 Prompt 2)', () => {
  const ADMIN_USER_ID = 'admin-user-001';
  const REGULAR_USER_ID = 'regular-user-002';
  const OPPONENT_USER_ID = 'opponent-user-003';

  const LB_CHESS_ID = 'lb-chess-masters-2026';
  const LB_FOOTBALL_ID = 'lb-football-league-2026';

  beforeEach(() => {
    localStorage.clear();
    DatabaseService.initialize();

    // Set up admin user profile
    mockDb.setProfile({
      id: ADMIN_USER_ID,
      email: 'admin@leaderboardos.com',
      full_name: 'Platform Administrator',
      role: 'admin',
      avatar_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Seed official test leaderboards
    const leaderboards: Leaderboard[] = [
      {
        id: LB_CHESS_ID,
        name: 'Grandmaster Chess Championship',
        slug: 'chess-masters-2026',
        description: 'Elite head-to-head competitive chess ladder',
        competition_type: 'gaming',
        owner_id: ADMIN_USER_ID,
        is_verified: true,
        primary_color: '#8b5cf6',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: LB_FOOTBALL_ID,
        name: 'Premier Football League',
        slug: 'premier-football-2026',
        description: 'Outdoor competitive football league',
        competition_type: 'sports',
        owner_id: ADMIN_USER_ID,
        is_verified: true,
        primary_color: '#10b981',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    mockDb.set('leaderboards', leaderboards);
  });

  // ==========================================
  // 1. ACHIEVEMENT DEFINITION & AWARD MODELS
  // ==========================================
  describe('Achievement Definition and Award Models', () => {
    it('initializes with comprehensive default achievement definitions', async () => {
      const defs = await AchievementService.getDefinitions();
      expect(defs.length).toBeGreaterThanOrEqual(9);

      const firstComp = defs.find((d) => d.id === 'first_competition');
      expect(firstComp).toBeDefined();
      expect(firstComp?.name).toBe('Debutant');
      expect(firstComp?.category).toBe('participation');
      expect(firstComp?.rarity).toBe('common');

      const champ = defs.find((d) => d.id === 'champion');
      expect(champ).toBeDefined();
      expect(champ?.rarity).toBe('legendary');
    });

    it('allows an administrator to register custom achievement definitions', async () => {
      const customDef: Omit<AchievementDefinition, 'created_at' | 'updated_at'> = {
        id: 'chess_grandmaster',
        name: 'Grandmaster Titled',
        description: 'Achieve a verified Elo rating above 2000 in official chess competition',
        category: 'mastery',
        badge_icon: '♟️',
        badge_color: '#a855f7',
        rarity: 'legendary',
        points_reward: 250,
        criteria: { type: 'custom', custom_field: 'elo_rating', custom_value: 2000 },
        is_active: true,
      };

      const created = await AchievementService.createDefinition(customDef, ADMIN_USER_ID);
      expect(created.id).toBe('chess_grandmaster');

      const fetched = await AchievementService.getDefinition('chess_grandmaster');
      expect(fetched?.name).toBe('Grandmaster Titled');
      expect(fetched?.points_reward).toBe(250);
    });

    it('rejects custom achievement definition creation by non-admin users', async () => {
      // Mock regular user profile in both active profile and all profiles list
      const regularProfile = {
        id: REGULAR_USER_ID,
        email: 'regular@example.com',
        full_name: 'Regular Competitor',
        role: 'user' as const,
        avatar_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockDb.setProfile(regularProfile);
      mockDb.set('mock_all_profiles', [regularProfile]);

      const unauthorizedDef: Omit<AchievementDefinition, 'created_at' | 'updated_at'> = {
        id: 'hacker_badge',
        name: 'Illegitimate Badge',
        description: 'Should not be allowed',
        category: 'milestone',
        badge_icon: '🚫',
        badge_color: '#ef4444',
        rarity: 'common',
        points_reward: 1000,
        criteria: { type: 'custom' },
        is_active: true,
      };

      await expect(
        AchievementService.createDefinition(unauthorizedDef, REGULAR_USER_ID)
      ).rejects.toThrow(/Unauthorized/);
    });
  });

  // ==========================================
  // 2. IDEMPOTENT AWARDING & PROVENANCE
  // ==========================================
  describe('Idempotent Award Processing & Provenance', () => {
    it('awards an achievement with full provenance and prevents duplicate awards for repeated events', async () => {
      const input = {
        achievementId: 'first_win',
        userId: REGULAR_USER_ID,
        leaderboardId: LB_CHESS_ID,
        provenance: {
          match_id: 'match-101',
          fixture_id: 'fix-101',
          competition_name: 'Grandmaster Chess Championship',
          score_summary: '1 - 0',
          opponent_name: 'Grandmaster Kaspar',
          triggered_by: 'fixture_finalization',
          notes: 'Flawless endgame checkmate',
        },
      };

      // 1. First award event
      const award1 = await AchievementService.awardAchievement(input);
      expect(award1).toBeDefined();
      expect(award1.achievement_id).toBe('first_win');
      expect(award1.user_id).toBe(REGULAR_USER_ID);
      expect(award1.is_revoked).toBe(false);
      expect(award1.provenance.opponent_name).toBe('Grandmaster Kaspar');
      expect(award1.provenance.score_summary).toBe('1 - 0');

      // 2. Repeated trigger of the same event (e.g. webhook replay or re-evaluation)
      const award2 = await AchievementService.awardAchievement(input);
      expect(award2.id).toBe(award1.id);
      expect(award2.awarded_at).toBe(award1.awarded_at);

      // Verify only 1 award exists in database
      const allAwards = await AchievementService.getParticipantAchievements(REGULAR_USER_ID);
      expect(allAwards.length).toBe(1);
    });
  });

  // ==========================================
  // 3. AUTHORITATIVE EVALUATION & INTEGRITY
  // ==========================================
  describe('Authoritative Server-Side Achievement Evaluation', () => {
    it('authoritatively evaluates milestones (first win, streak of 3, clean sheet) from real match records', async () => {
      // 1. Set up participant profile and linked leaderboard membership
      const profile = await CompetitionPassportService.getOrCreateProfile(
        REGULAR_USER_ID,
        'competitor@example.com',
        'Ace Competitor'
      );
      expect(profile).toBeDefined();

      const memberId = 'mem-ace-101';
      const oppMemberId = 'mem-opp-102';
      const members: LeaderboardMember[] = [
        {
          id: memberId,
          leaderboard_id: LB_CHESS_ID,
          name: 'Ace Competitor',
          user_id: REGULAR_USER_ID,
          role: 'competitor',
          points: 30,
          created_at: '2026-01-01T10:00:00Z',
          updated_at: '2026-01-01T10:00:00Z',
        },
        {
          id: oppMemberId,
          leaderboard_id: LB_CHESS_ID,
          name: 'Challenger Bob',
          user_id: OPPONENT_USER_ID,
          role: 'competitor',
          points: 10,
          created_at: '2026-01-01T10:00:00Z',
          updated_at: '2026-01-01T10:00:00Z',
        },
      ];
      mockDb.setMembers(members);

      // 2. Seed 3 consecutive completed matches where Ace won (3-0, 2-0, 1-0)
      const fixtures: CompetitionFixture[] = [
        {
          id: 'fix-001',
          leaderboard_id: LB_CHESS_ID,
          participant1_id: memberId,
          participant2_id: oppMemberId,
          stage: 'regular',
          round_name: 'Round 1',
          scheduled_at: '2026-01-02T10:00:00Z',
          venue: 'Board 1',
          status: 'completed',
          participant1_score: 3,
          participant2_score: 0,
          winner_id: memberId,
          completed_at: '2026-01-02T11:00:00Z',
          created_at: '2026-01-02T09:00:00Z',
          updated_at: '2026-01-02T11:00:00Z',
        },
        {
          id: 'fix-002',
          leaderboard_id: LB_CHESS_ID,
          participant1_id: memberId,
          participant2_id: oppMemberId,
          stage: 'regular',
          round_name: 'Round 2',
          scheduled_at: '2026-01-03T10:00:00Z',
          venue: 'Board 1',
          status: 'completed',
          participant1_score: 2,
          participant2_score: 0,
          winner_id: memberId,
          completed_at: '2026-01-03T11:00:00Z',
          created_at: '2026-01-03T09:00:00Z',
          updated_at: '2026-01-03T11:00:00Z',
        },
        {
          id: 'fix-003',
          leaderboard_id: LB_CHESS_ID,
          participant1_id: memberId,
          participant2_id: oppMemberId,
          stage: 'regular',
          round_name: 'Round 3',
          scheduled_at: '2026-01-04T10:00:00Z',
          venue: 'Board 1',
          status: 'completed',
          participant1_score: 1,
          participant2_score: 0,
          winner_id: memberId,
          completed_at: '2026-01-04T11:00:00Z',
          created_at: '2026-01-04T09:00:00Z',
          updated_at: '2026-01-04T11:00:00Z',
        },
      ];
      mockDb.set('competition_fixtures', fixtures);

      // 3. Trigger authoritative server-side achievement evaluation
      const awarded = await AchievementService.evaluateParticipantAchievements(REGULAR_USER_ID);
      expect(awarded.length).toBeGreaterThanOrEqual(4);

      const unlockedKeys = awarded.map((a) => a.achievement_id);
      expect(unlockedKeys).toContain('first_competition'); // Debut completed
      expect(unlockedKeys).toContain('first_win');         // Won match
      expect(unlockedKeys).toContain('win_streak_3');      // 3-match win streak
      expect(unlockedKeys).toContain('clean_sheet');       // Won with 0 conceded

      // 4. Repeated evaluation must be idempotent (zero duplicate awards)
      const secondEval = await AchievementService.evaluateParticipantAchievements(REGULAR_USER_ID);
      expect(secondEval.length).toBe(0); // No new awards
    });
  });

  // ==========================================
  // 4. REVOCATION & AUDIT TRAIL
  // ==========================================
  describe('Revocation and Audit Trail', () => {
    it('revokes an achievement with audit trail and preserves provenance history', async () => {
      // Award an achievement first
      const award = await AchievementService.awardAchievement({
        achievementId: 'champion',
        userId: REGULAR_USER_ID,
        leaderboardId: LB_CHESS_ID,
        provenance: {
          competition_name: 'Grandmaster Chess Championship',
          score_summary: 'Tournament Champion',
          notes: 'Initial bracket winner',
        },
      });

      expect(award.is_revoked).toBe(false);

      // Revoke the achievement
      const revocationReason = 'Disqualification due to referee technical violation';
      const revoked = await AchievementService.revokeAchievement(
        award.id,
        revocationReason,
        ADMIN_USER_ID
      );

      expect(revoked.is_revoked).toBe(true);
      expect(revoked.revoked_at).toBeDefined();
      expect(revoked.revocation_reason).toBe(revocationReason);
      expect(revoked.revocation_audit_id).toBeDefined();
      // Original provenance is preserved intact
      expect(revoked.provenance.competition_name).toBe('Grandmaster Chess Championship');

      // Default public query excludes revoked achievements
      const publicAwards = await AchievementService.getParticipantAchievements(REGULAR_USER_ID, false);
      expect(publicAwards.some((a) => a.id === award.id)).toBe(false);

      // Audit query includes revoked achievements
      const auditAwards = await AchievementService.getParticipantAchievements(REGULAR_USER_ID, true);
      expect(auditAwards.some((a) => a.id === award.id && a.is_revoked)).toBe(true);

      // Can be restored if cleared upon appeal
      const restored = await AchievementService.restoreAchievement(award.id, ADMIN_USER_ID);
      expect(restored.is_revoked).toBe(false);
      expect(restored.revoked_at).toBeNull();
    });
  });

  // ==========================================
  // 5. DETERMINISTIC ELO CALCULATIONS
  // ==========================================
  describe('Pluggable Deterministic Elo Engine', () => {
    it('correctly calculates expected scores and symmetric rating adjustments for equal opponents', () => {
      const result = EloCalculator.calculateUpdate({
        ratingA: 1200,
        ratingB: 1200,
        outcomeA: 1, // Participant A wins
        matchesPlayedA: 15,
        matchesPlayedB: 15,
      });

      // Expected score for identical ratings must be 0.5
      expect(result.expectedA).toBe(0.5);
      expect(result.expectedB).toBe(0.5);

      // K=32: Math.round(32 * (1 - 0.5)) = +16 for A, -16 for B
      expect(result.changeA).toBe(16);
      expect(result.changeB).toBe(-16);
      expect(result.newRatingA).toBe(1216);
      expect(result.newRatingB).toBe(1184);
    });

    it('handles draws deterministically with zero net drift for equal opponents', () => {
      const result = EloCalculator.calculateUpdate({
        ratingA: 1400,
        ratingB: 1400,
        outcomeA: 0.5, // Draw
        matchesPlayedA: 20,
        matchesPlayedB: 20,
      });

      expect(result.expectedA).toBe(0.5);
      expect(result.changeA).toBe(0);
      expect(result.changeB).toBe(0);
      expect(result.newRatingA).toBe(1400);
      expect(result.newRatingB).toBe(1400);
    });

    it('adapts K-factor dynamically for provisional players vs master tier', () => {
      // Provisional (<10 matches) => K=40
      const provisionalK = EloCalculator.getKFactor(5, 1200);
      expect(provisionalK).toBe(40);

      // Standard (>=10 matches, <2000 rating) => K=32
      const standardK = EloCalculator.getKFactor(25, 1500);
      expect(standardK).toBe(32);

      // Master tier (>=2000 rating) => K=16 for rating stability
      const masterK = EloCalculator.getKFactor(50, 2150);
      expect(masterK).toBe(16);
    });

    it('gives higher rewards for upset victories against stronger opponents', () => {
      const underdogRating = 1100;
      const favoriteRating = 1500;

      const underdogExpected = EloCalculator.calculateExpectedScore(underdogRating, favoriteRating);
      // Underdog has ~9% expected win probability
      expect(underdogExpected).toBeLessThan(0.12);

      const upsetResult = EloCalculator.calculateUpdate({
        ratingA: underdogRating,
        ratingB: favoriteRating,
        outcomeA: 1, // Underdog wins
        matchesPlayedA: 15,
        matchesPlayedB: 15,
      });

      // Underdog gains significantly more points (+29) than standard win (+16)
      expect(upsetResult.changeA).toBeGreaterThan(25);
      expect(upsetResult.changeB).toBeLessThan(-25);
    });
  });

  // ==========================================
  // 6. SCOPE ISOLATION (CROSS-SPORT & SEASON)
  // ==========================================
  describe('Strict Rating Scope Isolation', () => {
    it('strictly isolates ratings across different games, seasons, and competition formats', async () => {
      const chessScope: RatingScope = {
        competition_type: 'gaming',
        game_type: 'chess',
        season_id: 'season_2026',
        region: 'global',
        entity_type: 'individual',
      };

      const footballScope: RatingScope = {
        competition_type: 'sports',
        game_type: 'football',
        season_id: 'season_2026',
        region: 'global',
        entity_type: 'individual',
      };

      const chessScopeKey = formatScopeKey(chessScope);
      const footballScopeKey = formatScopeKey(footballScope);

      expect(chessScopeKey).not.toBe(footballScopeKey);
      expect(chessScopeKey).toBe('gaming:chess:season_2026:global:individual');
      expect(footballScopeKey).toBe('sports:football:season_2026:global:individual');

      // Initialize both ratings
      const initialChess = await CompetitionRatingsService.getOrCreateRating(REGULAR_USER_ID, chessScope);
      const initialFootball = await CompetitionRatingsService.getOrCreateRating(REGULAR_USER_ID, footballScope);

      expect(initialChess.current_rating).toBe(DEFAULT_STARTING_RATING);
      expect(initialFootball.current_rating).toBe(DEFAULT_STARTING_RATING);

      // Play and win a verified CHESS match
      const updateResult = await CompetitionRatingsService.applyMatchRatingUpdate({
        matchId: 'chess-match-001',
        leaderboardId: LB_CHESS_ID,
        competitionName: 'Grandmaster Chess Championship',
        scope: chessScope,
        participantA: { id: REGULAR_USER_ID, name: 'Ace Competitor' },
        participantB: { id: OPPONENT_USER_ID, name: 'Challenger Bob' },
        outcomeA: 1, // Ace wins chess
        isVerified: true,
      });

      expect(updateResult.skipped).toBe(false);
      expect(updateResult.ratingA.current_rating).toBeGreaterThan(DEFAULT_STARTING_RATING);

      // Verify CHESS rating changed
      const updatedChess = await CompetitionRatingsService.getOrCreateRating(REGULAR_USER_ID, chessScope);
      expect(updatedChess.current_rating).toBe(updateResult.ratingA.current_rating);
      expect(updatedChess.wins).toBe(1);

      // CRITICAL: FOOTBALL rating must remain COMPLETELY UNTOUCHED at baseline 1200
      const currentFootball = await CompetitionRatingsService.getOrCreateRating(REGULAR_USER_ID, footballScope);
      expect(currentFootball.current_rating).toBe(DEFAULT_STARTING_RATING);
      expect(currentFootball.matches_played).toBe(0);
      expect(currentFootball.wins).toBe(0);
    });
  });

  // ==========================================
  // 7. VERIFIED MATCH POLICY & AUDITING
  // ==========================================
  describe('Verified Match Policy and Audit Logging', () => {
    it('refuses to award competitive ratings for unverified matches unless explicitly permitted', async () => {
      const scope: RatingScope = {
        competition_type: 'gaming',
        game_type: 'chess',
        entity_type: 'individual',
      };

      const result = await CompetitionRatingsService.applyMatchRatingUpdate({
        matchId: 'scrim-unverified-001',
        leaderboardId: LB_CHESS_ID,
        scope,
        participantA: { id: REGULAR_USER_ID },
        participantB: { id: OPPONENT_USER_ID },
        outcomeA: 1,
        isVerified: false, // Unverified scrim
        allowUnverified: false,
      });

      expect(result.skipped).toBe(true);
      expect(result.skipReason).toContain('unverified');

      // Ratings must remain at baseline
      const ratingA = await CompetitionRatingsService.getOrCreateRating(REGULAR_USER_ID, scope);
      expect(ratingA.matches_played).toBe(0);
      expect(ratingA.current_rating).toBe(DEFAULT_STARTING_RATING);
    });

    it('enforces idempotency preventing duplicate rating updates for the same match', async () => {
      const scope: RatingScope = {
        competition_type: 'gaming',
        game_type: 'chess',
        entity_type: 'individual',
      };

      const updateInput = {
        matchId: 'match-unique-999',
        leaderboardId: LB_CHESS_ID,
        competitionName: 'Grandmaster Chess Championship',
        scope,
        participantA: { id: REGULAR_USER_ID, name: 'Ace Competitor' },
        participantB: { id: OPPONENT_USER_ID, name: 'Challenger Bob' },
        outcomeA: 1 as const,
        isVerified: true,
      };

      // 1. First execution
      const firstRun = await CompetitionRatingsService.applyMatchRatingUpdate(updateInput);
      expect(firstRun.skipped).toBe(false);
      const ratingAfterFirst = firstRun.ratingA.current_rating;

      // 2. Second execution with same match ID
      const secondRun = await CompetitionRatingsService.applyMatchRatingUpdate(updateInput);
      expect(secondRun.skipped).toBe(true);
      expect(secondRun.skipReason).toContain('already been applied');

      // Rating must NOT double-increment
      const finalRating = await CompetitionRatingsService.getOrCreateRating(REGULAR_USER_ID, scope);
      expect(finalRating.current_rating).toBe(ratingAfterFirst);
      expect(finalRating.matches_played).toBe(1);
    });
  });

  // ==========================================
  // 8. HISTORICAL CORRECTIONS & DETERMINISTIC REPLAY
  // ==========================================
  describe('Historical Corrections: Rollback and Deterministic Replay', () => {
    it('safely rolls back a match rating update and updates audit status', async () => {
      const scope: RatingScope = {
        competition_type: 'gaming',
        game_type: 'chess',
        entity_type: 'individual',
      };
      const scopeKey = formatScopeKey(scope);

      // Apply match update
      const update = await CompetitionRatingsService.applyMatchRatingUpdate({
        matchId: 'match-to-void-001',
        leaderboardId: LB_CHESS_ID,
        scope,
        participantA: { id: REGULAR_USER_ID, name: 'Ace Competitor' },
        participantB: { id: OPPONENT_USER_ID, name: 'Challenger Bob' },
        outcomeA: 1,
        isVerified: true,
      });

      expect(update.ratingA.current_rating).toBeGreaterThan(DEFAULT_STARTING_RATING);

      // Roll back match
      const rollback = await CompetitionRatingsService.rollbackMatchRating({
        matchId: 'match-to-void-001',
        scopeKey,
        reason: 'Match voided by tournament referee due to network interruption',
        actorUserId: ADMIN_USER_ID,
      });

      expect(rollback.rolledBackCount).toBe(2);

      // Ratings must revert to baseline
      const revertedRating = await CompetitionRatingsService.getOrCreateRating(REGULAR_USER_ID, scope);
      expect(revertedRating.current_rating).toBe(DEFAULT_STARTING_RATING);
      expect(revertedRating.matches_played).toBe(0);
      expect(revertedRating.wins).toBe(0);

      // Audit history entry status must reflect rolled_back
      const history = await CompetitionRatingsService.getRatingHistory(REGULAR_USER_ID, scopeKey);
      const voidedEntry = history.find((h) => h.match_id === 'match-to-void-001');
      expect(voidedEntry?.status).toBe('rolled_back');
    });

    it('deterministically recalculates chronological ratings from baseline 1200 without compounding drift', async () => {
      const scope: RatingScope = {
        competition_type: 'gaming',
        game_type: 'chess',
        season_id: 'season_1',
        entity_type: 'individual',
      };

      // Chronological sequence of 3 matches
      const matches = [
        {
          matchId: 'm-1',
          leaderboardId: LB_CHESS_ID,
          participantAId: REGULAR_USER_ID,
          participantBId: OPPONENT_USER_ID,
          outcomeA: 1 as const, // A wins
          isVerified: true,
          timestamp: '2026-01-01T10:00:00Z',
        },
        {
          matchId: 'm-2',
          leaderboardId: LB_CHESS_ID,
          participantAId: REGULAR_USER_ID,
          participantBId: OPPONENT_USER_ID,
          outcomeA: 0.5 as const, // Draw
          isVerified: true,
          timestamp: '2026-01-02T10:00:00Z',
        },
        {
          matchId: 'm-3',
          leaderboardId: LB_CHESS_ID,
          participantAId: REGULAR_USER_ID,
          participantBId: OPPONENT_USER_ID,
          outcomeA: 0 as const, // B wins
          isVerified: true,
          timestamp: '2026-01-03T10:00:00Z',
        },
      ];

      const replayed = await CompetitionRatingsService.replayScopeRatings(scope, matches);

      const finalA = replayed.get(REGULAR_USER_ID);
      const finalB = replayed.get(OPPONENT_USER_ID);

      expect(finalA).toBeDefined();
      expect(finalB).toBeDefined();

      expect(finalA?.matches_played).toBe(3);
      expect(finalA?.wins).toBe(1);
      expect(finalA?.draws).toBe(1);
      expect(finalA?.losses).toBe(1);

      expect(finalB?.matches_played).toBe(3);
      expect(finalB?.wins).toBe(1);
      expect(finalB?.draws).toBe(1);
      expect(finalB?.losses).toBe(1);

      // Replaying again with identical inputs must be 100% deterministic
      const replayedSecondTime = await CompetitionRatingsService.replayScopeRatings(scope, matches);
      const secondA = replayedSecondTime.get(REGULAR_USER_ID);
      expect(secondA?.current_rating).toBe(finalA?.current_rating);
    });
  });

  // ==========================================
  // 9. COMPETITION PASSPORT INTEGRATION
  // ==========================================
  describe('Competition Passport Achievements & Ratings Integration', () => {
    it('returns earned achievements and scoped ratings on the public Competition Passport', async () => {
      // 1. Create participant profile
      const profile = await CompetitionPassportService.getOrCreateProfile(
        REGULAR_USER_ID,
        'grandmaster@example.com',
        'Grandmaster Alice'
      );

      // 2. Award achievement
      await AchievementService.awardAchievement({
        achievementId: 'first_win',
        userId: REGULAR_USER_ID,
        leaderboardId: LB_CHESS_ID,
        provenance: {
          competition_name: 'Grandmaster Chess Championship',
          score_summary: 'Checkmate in 24 moves',
        },
      });

      // 3. Award scoped Elo rating
      const scope: RatingScope = {
        competition_type: 'gaming',
        game_type: 'chess',
        entity_type: 'individual',
      };
      await CompetitionRatingsService.applyMatchRatingUpdate({
        matchId: 'match-passport-001',
        leaderboardId: LB_CHESS_ID,
        competitionName: 'Grandmaster Chess Championship',
        scope,
        participantA: { id: REGULAR_USER_ID, name: 'Grandmaster Alice' },
        participantB: { id: OPPONENT_USER_ID, name: 'Opponent Bob' },
        outcomeA: 1,
        isVerified: true,
      });

      // 4. Fetch public passport
      const passport = await CompetitionPassportService.getPassport(profile.username);

      expect(passport).toBeDefined();
      expect(passport.achievements).toBeDefined();
      expect(passport.achievements?.length).toBe(1);
      expect(passport.achievements?.[0].achievement_id).toBe('first_win');

      expect(passport.ratings).toBeDefined();
      expect(passport.ratings?.length).toBe(1);
      expect(passport.ratings?.[0].game_type).toBe('chess');
      expect(passport.ratings?.[0].current_rating).toBeGreaterThan(1200);

      expect(passport.rating_history).toBeDefined();
      expect(passport.rating_history?.length).toBe(1);
      expect(passport.rating_history?.[0].match_id).toBe('match-passport-001');
    });

    it('redacts achievements and ratings when participant privacy controls are disabled', async () => {
      const profile = await CompetitionPassportService.getOrCreateProfile(
        REGULAR_USER_ID,
        'secret@example.com',
        'Secret Player'
      );

      // Hide trophy case and ratings in privacy settings
      await CompetitionPassportService.updateProfile(
        REGULAR_USER_ID,
        {
          privacy_settings: {
            ...profile.privacy_settings,
            show_trophy_case: false,
            show_ratings: false,
          },
        },
        REGULAR_USER_ID
      );

      // Public viewer fetches passport
      const viewerUserId = 'anonymous-viewer-999';
      const passport = await CompetitionPassportService.getPassport(profile.username, viewerUserId);

      // Public viewer cannot see hidden trophy case or ratings
      expect(passport.achievements).toEqual([]);
      expect(passport.ratings).toEqual([]);

      // But owner can always view their own passport details
      const ownerPassport = await CompetitionPassportService.getPassport(profile.username, REGULAR_USER_ID);
      expect(ownerPassport.is_owner).toBe(true);
    });
  });
});
