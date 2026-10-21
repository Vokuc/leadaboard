import {
  CompetitionRating,
  RatingEntityType,
  RatingHistoryEntry,
  RatingScope,
} from '@/types';
import { DatabaseService } from '@/lib/db';

export const DEFAULT_STARTING_RATING = 1200;
export const DEFAULT_K_FACTOR = 32;

/**
 * Deterministically formats a canonical scope key.
 * Guarantees isolation across competition types, games, seasons, regions, and entity types.
 */
export function formatScopeKey(scope: RatingScope): string {
  const compType = (scope.competition_type || 'custom').toLowerCase().trim();
  const gameType = (scope.game_type || 'default').toLowerCase().trim();
  const season = scope.season_id ? scope.season_id.trim() : 'all_time';
  const region = (scope.region || 'global').toLowerCase().trim();
  const entity = scope.entity_type || 'individual';

  return `${compType}:${gameType}:${season}:${region}:${entity}`;
}

export interface EloCalculationResult {
  newRatingA: number;
  newRatingB: number;
  changeA: number;
  changeB: number;
  expectedA: number;
  expectedB: number;
  kFactorA: number;
  kFactorB: number;
}

export const EloCalculator = {
  /**
   * Determine appropriate K-factor based on match experience and rating tier.
   */
  getKFactor(matchesPlayed: number, currentRating: number, customK?: number): number {
    if (customK && customK > 0) return customK;
    if (matchesPlayed < 10) return 40; // Provisional / placement matches
    if (currentRating >= 2000) return 16; // Master / elite tier stability
    return DEFAULT_K_FACTOR; // Standard 32
  },

  /**
   * Calculate expected outcome for Participant A against Participant B.
   * E_A = 1 / (1 + 10^((R_B - R_A) / 400))
   */
  calculateExpectedScore(ratingA: number, ratingB: number): number {
    return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  },

  /**
   * Pure deterministic Elo calculation for two opponents.
   */
  calculateUpdate(params: {
    ratingA: number;
    ratingB: number;
    outcomeA: 1 | 0.5 | 0; // 1 = Win for A, 0.5 = Draw, 0 = Loss for A (Win for B)
    matchesPlayedA?: number;
    matchesPlayedB?: number;
    customK?: number;
  }): EloCalculationResult {
    const { ratingA, ratingB, outcomeA, matchesPlayedA = 0, matchesPlayedB = 0, customK } = params;

    const outcomeB = (1 - outcomeA) as 1 | 0.5 | 0;
    const expectedA = this.calculateExpectedScore(ratingA, ratingB);
    const expectedB = 1 - expectedA;

    const kFactorA = this.getKFactor(matchesPlayedA, ratingA, customK);
    const kFactorB = this.getKFactor(matchesPlayedB, ratingB, customK);

    const changeA = Math.round(kFactorA * (outcomeA - expectedA));
    const changeB = Math.round(kFactorB * (outcomeB - expectedB));

    return {
      newRatingA: Math.max(100, ratingA + changeA),
      newRatingB: Math.max(100, ratingB + changeB),
      changeA,
      changeB,
      expectedA: Number(expectedA.toFixed(4)),
      expectedB: Number(expectedB.toFixed(4)),
      kFactorA,
      kFactorB,
    };
  },
};

export const CompetitionRatingsService = {
  /**
   * Get an entity's current rating in a given scope, or initialize a default rating.
   */
  async getOrCreateRating(
    entityId: string,
    scope: RatingScope,
    initialRating = DEFAULT_STARTING_RATING
  ): Promise<CompetitionRating> {
    const scopeKey = formatScopeKey(scope);
    const existing = await DatabaseService.getRatingByScope(entityId, scope.entity_type, scopeKey);
    if (existing) {
      return existing;
    }

    const timestamp = new Date().toISOString();
    const newRating: CompetitionRating = {
      id: `rating-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      entity_type: scope.entity_type,
      entity_id: entityId,
      scope_key: scopeKey,
      competition_type: scope.competition_type,
      game_type: scope.game_type || null,
      season_id: scope.season_id || null,
      region: scope.region || 'global',
      rating_system: 'elo',
      current_rating: initialRating,
      peak_rating: initialRating,
      lowest_rating: initialRating,
      matches_played: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      last_match_at: null,
      created_at: timestamp,
      updated_at: timestamp,
    };

    return DatabaseService.saveCompetitionRating(newRating);
  },

  /**
   * Get all ratings associated with an individual participant or team.
   */
  async getRatingsForEntity(
    entityId: string,
    entityType: RatingEntityType = 'individual'
  ): Promise<CompetitionRating[]> {
    return DatabaseService.getCompetitionRatings(entityId, entityType);
  },

  /**
   * Get the transaction history of rating updates for an entity or scope.
   */
  async getRatingHistory(entityId?: string, scopeKey?: string): Promise<RatingHistoryEntry[]> {
    return DatabaseService.getRatingHistory(entityId, scopeKey);
  },

  /**
   * Get the transaction history of rating updates specifically for an entity.
   */
  async getRatingHistoryForEntity(entityId: string): Promise<RatingHistoryEntry[]> {
    return DatabaseService.getRatingHistory(entityId);
  },

  /**
   * Process a match result and apply Elo updates to both participants in the given scope.
   * Enforces verification policy, idempotency, and audit logging.
   */
  async applyMatchRatingUpdate(input: {
    matchId: string;
    leaderboardId: string;
    competitionName?: string;
    scope: RatingScope;
    participantA: { id: string; name?: string };
    participantB: { id: string; name?: string };
    outcomeA: 1 | 0.5 | 0; // 1 = Win for A, 0.5 = Draw, 0 = Loss for A
    isVerified: boolean;
    allowUnverified?: boolean;
    customK?: number;
    matchTimestamp?: string;
    reason?: string;
  }): Promise<{
    ratingA: CompetitionRating;
    ratingB: CompetitionRating;
    historyEntryA: RatingHistoryEntry;
    historyEntryB: RatingHistoryEntry;
    skipped?: boolean;
    skipReason?: string;
  }> {
    const {
      matchId,
      leaderboardId,
      competitionName,
      scope,
      participantA,
      participantB,
      outcomeA,
      isVerified,
      allowUnverified = false,
      customK,
      matchTimestamp = new Date().toISOString(),
      reason = 'Match completed',
    } = input;

    const scopeKey = formatScopeKey(scope);

    // 1. Verification policy: Do not alter ratings for unverified matches unless explicitly permitted
    if (!isVerified && !allowUnverified) {
      const ratingA = await this.getOrCreateRating(participantA.id, scope);
      const ratingB = await this.getOrCreateRating(participantB.id, scope);
      return {
        ratingA,
        ratingB,
        historyEntryA: {} as RatingHistoryEntry,
        historyEntryB: {} as RatingHistoryEntry,
        skipped: true,
        skipReason: 'Match is unverified and rating scope policy requires verified results.',
      };
    }

    // 2. Idempotency check: verify this match hasn't already been applied for this scope
    const existingHistory = await DatabaseService.getRatingHistory(participantA.id, scopeKey);
    const existingEntryA = existingHistory.find((h) => h.match_id === matchId && h.status === 'applied');
    if (existingEntryA) {
      const ratingA = await this.getOrCreateRating(participantA.id, scope);
      const ratingB = await this.getOrCreateRating(participantB.id, scope);
      const existingHistoryB = await DatabaseService.getRatingHistory(participantB.id, scopeKey);
      const existingEntryB = existingHistoryB.find((h) => h.match_id === matchId && h.status === 'applied') || existingEntryA;

      return {
        ratingA,
        ratingB,
        historyEntryA: existingEntryA,
        historyEntryB: existingEntryB,
        skipped: true,
        skipReason: 'Match result has already been applied to ratings in this scope.',
      };
    }

    // 3. Retrieve current ratings
    const currentRatingA = await this.getOrCreateRating(participantA.id, scope);
    const currentRatingB = await this.getOrCreateRating(participantB.id, scope);

    // 4. Calculate new ratings using pure deterministic Elo engine
    const elo = EloCalculator.calculateUpdate({
      ratingA: currentRatingA.current_rating,
      ratingB: currentRatingB.current_rating,
      outcomeA,
      matchesPlayedA: currentRatingA.matches_played,
      matchesPlayedB: currentRatingB.matches_played,
      customK,
    });

    const isDraw = outcomeA === 0.5;
    const isWinA = outcomeA === 1;

    // 5. Build updated rating records
    const updatedRatingA: CompetitionRating = {
      ...currentRatingA,
      current_rating: elo.newRatingA,
      peak_rating: Math.max(currentRatingA.peak_rating, elo.newRatingA),
      lowest_rating: Math.min(currentRatingA.lowest_rating, elo.newRatingA),
      matches_played: currentRatingA.matches_played + 1,
      wins: currentRatingA.wins + (isWinA ? 1 : 0),
      losses: currentRatingA.losses + (!isWinA && !isDraw ? 1 : 0),
      draws: currentRatingA.draws + (isDraw ? 1 : 0),
      last_match_at: matchTimestamp,
      updated_at: matchTimestamp,
    };

    const updatedRatingB: CompetitionRating = {
      ...currentRatingB,
      current_rating: elo.newRatingB,
      peak_rating: Math.max(currentRatingB.peak_rating, elo.newRatingB),
      lowest_rating: Math.min(currentRatingB.lowest_rating, elo.newRatingB),
      matches_played: currentRatingB.matches_played + 1,
      wins: currentRatingB.wins + (!isWinA && !isDraw ? 1 : 0),
      losses: currentRatingB.losses + (isWinA ? 1 : 0),
      draws: currentRatingB.draws + (isDraw ? 1 : 0),
      last_match_at: matchTimestamp,
      updated_at: matchTimestamp,
    };

    // 6. Record immutable history transactions
    const historyEntryA: RatingHistoryEntry = {
      id: `rh-${Date.now()}-A-${Math.random().toString(36).substring(2, 6)}`,
      rating_id: currentRatingA.id,
      scope_key: scopeKey,
      entity_type: scope.entity_type,
      entity_id: participantA.id,
      opponent_id: participantB.id,
      opponent_name: participantB.name || 'Opponent',
      leaderboard_id: leaderboardId,
      competition_name: competitionName || null,
      match_id: matchId,
      previous_rating: currentRatingA.current_rating,
      new_rating: elo.newRatingA,
      rating_change: elo.changeA,
      k_factor: elo.kFactorA,
      expected_score: elo.expectedA,
      actual_score: outcomeA,
      is_verified: isVerified,
      status: 'applied',
      reason,
      reversal_reason: null,
      created_at: matchTimestamp,
    };

    const historyEntryB: RatingHistoryEntry = {
      id: `rh-${Date.now()}-B-${Math.random().toString(36).substring(2, 6)}`,
      rating_id: currentRatingB.id,
      scope_key: scopeKey,
      entity_type: scope.entity_type,
      entity_id: participantB.id,
      opponent_id: participantA.id,
      opponent_name: participantA.name || 'Opponent',
      leaderboard_id: leaderboardId,
      competition_name: competitionName || null,
      match_id: matchId,
      previous_rating: currentRatingB.current_rating,
      new_rating: elo.newRatingB,
      rating_change: elo.changeB,
      k_factor: elo.kFactorB,
      expected_score: elo.expectedB,
      actual_score: (1 - outcomeA) as 1 | 0.5 | 0,
      is_verified: isVerified,
      status: 'applied',
      reason,
      reversal_reason: null,
      created_at: matchTimestamp,
    };

    // Save history and current rating snapshots
    await Promise.all([
      DatabaseService.addRatingHistoryEntry(historyEntryA),
      DatabaseService.addRatingHistoryEntry(historyEntryB),
      DatabaseService.saveCompetitionRating(updatedRatingA),
      DatabaseService.saveCompetitionRating(updatedRatingB),
    ]);

    return {
      ratingA: updatedRatingA,
      ratingB: updatedRatingB,
      historyEntryA,
      historyEntryB,
      skipped: false,
    };
  },

  /**
   * Rollback a match rating update if a match was disputed, voided, or wrongly linked.
   * Adjusts the participants' ratings back without deleting the audit trail.
   */
  async rollbackMatchRating(
    matchIdOrInput:
      | string
      | {
          matchId: string;
          scope?: RatingScope;
          scopeKey?: string;
          reason: string;
          actorUserId?: string;
        },
    maybeScope?: RatingScope | string,
    maybeReason?: string,
    maybeActorUserId?: string
  ): Promise<{ rolledBackCount: number; reason: string }> {
    let matchId = '';
    let scopeKey = '';
    let reason = '';
    let actorUserId: string | undefined;

    if (typeof matchIdOrInput === 'object' && matchIdOrInput) {
      matchId = matchIdOrInput.matchId;
      reason = matchIdOrInput.reason;
      actorUserId = matchIdOrInput.actorUserId;
      if (matchIdOrInput.scopeKey) {
        scopeKey = matchIdOrInput.scopeKey;
      } else if (matchIdOrInput.scope) {
        scopeKey = formatScopeKey(matchIdOrInput.scope);
      }
    } else {
      matchId = matchIdOrInput;
      reason = maybeReason || '';
      actorUserId = maybeActorUserId;
      if (typeof maybeScope === 'string') {
        scopeKey = maybeScope;
      } else if (maybeScope) {
        scopeKey = formatScopeKey(maybeScope);
      }
    }

    if (!reason || !reason.trim()) {
      throw new Error('Rollback reason is required.');
    }

    if (actorUserId) {
      const profile = await DatabaseService.getProfile(actorUserId);
      if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
        throw new Error('Unauthorized: only administrators or referees can rollback rating changes.');
      }
    }

    const history = await DatabaseService.getRatingHistory(undefined, scopeKey || undefined);
    const entries = history.filter((h) => h.match_id === matchId && h.status === 'applied');

    if (entries.length === 0) {
      return { rolledBackCount: 0, reason: 'No applied rating updates found for this match.' };
    }

    for (const entry of entries) {
      // Mark entry as rolled_back
      await DatabaseService.updateRatingHistoryEntry(entry.id, {
        status: 'rolled_back',
        reversal_reason: reason.trim(),
      });

      // Adjust the entity's current rating back by the negated delta
      const current = await DatabaseService.getRatingByScope(
        entry.entity_id,
        entry.entity_type,
        entry.scope_key
      );
      if (!current) continue;

      const isWin = entry.actual_score === 1.0;
      const isDraw = entry.actual_score === 0.5;

      const revertedRating: CompetitionRating = {
        ...current,
        current_rating: Math.max(100, current.current_rating - entry.rating_change),
        matches_played: Math.max(0, current.matches_played - 1),
        wins: Math.max(0, current.wins - (isWin ? 1 : 0)),
        losses: Math.max(0, current.losses - (!isWin && !isDraw ? 1 : 0)),
        draws: Math.max(0, current.draws - (isDraw ? 1 : 0)),
        updated_at: new Date().toISOString(),
      };
      await DatabaseService.saveCompetitionRating(revertedRating);
    }

    return { rolledBackCount: entries.length, reason: reason.trim() };
  },

  /**
   * Replay and recalculate all ratings within a scope from baseline 1200.
   * Useful when historical corrections occur, completely eliminating rounding drift or orphaned updates.
   */
  async replayScopeRatings(
    scope: RatingScope,
    matches: Array<{
      matchId: string;
      leaderboardId: string;
      participantAId: string;
      participantBId: string;
      outcomeA: 1 | 0.5 | 0;
      isVerified: boolean;
      timestamp: string;
    }>
  ): Promise<Map<string, CompetitionRating>> {
    const scopeKey = formatScopeKey(scope);

    // Sort matches chronologically
    const chronological = [...matches].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // In-memory replay state
    const ratingsMap = new Map<
      string,
      {
        rating: number;
        peak: number;
        lowest: number;
        played: number;
        wins: number;
        losses: number;
        draws: number;
        lastMatchAt: string | null;
      }
    >();

    const getStats = (id: string) => {
      if (!ratingsMap.has(id)) {
        ratingsMap.set(id, {
          rating: DEFAULT_STARTING_RATING,
          peak: DEFAULT_STARTING_RATING,
          lowest: DEFAULT_STARTING_RATING,
          played: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          lastMatchAt: null,
        });
      }
      return ratingsMap.get(id)!;
    };

    for (const m of chronological) {
      if (!m.isVerified) continue; // Only verified matches count in official replay

      const a = getStats(m.participantAId);
      const b = getStats(m.participantBId);

      const elo = EloCalculator.calculateUpdate({
        ratingA: a.rating,
        ratingB: b.rating,
        outcomeA: m.outcomeA,
        matchesPlayedA: a.played,
        matchesPlayedB: b.played,
      });

      const isWinA = m.outcomeA === 1;
      const isDraw = m.outcomeA === 0.5;

      a.rating = elo.newRatingA;
      a.peak = Math.max(a.peak, elo.newRatingA);
      a.lowest = Math.min(a.lowest, elo.newRatingA);
      a.played += 1;
      a.wins += isWinA ? 1 : 0;
      a.losses += !isWinA && !isDraw ? 1 : 0;
      a.draws += isDraw ? 1 : 0;
      a.lastMatchAt = m.timestamp;

      b.rating = elo.newRatingB;
      b.peak = Math.max(b.peak, elo.newRatingB);
      b.lowest = Math.min(b.lowest, elo.newRatingB);
      b.played += 1;
      b.wins += !isWinA && !isDraw ? 1 : 0;
      b.losses += isWinA ? 1 : 0;
      b.draws += isDraw ? 1 : 0;
      b.lastMatchAt = m.timestamp;
    }

    // Persist replayed ratings
    const resultMap = new Map<string, CompetitionRating>();
    const timestamp = new Date().toISOString();

    for (const [entityId, stats] of ratingsMap.entries()) {
      const persisted: CompetitionRating = {
        id: `rating-replayed-${entityId}-${Date.now()}`,
        entity_type: scope.entity_type,
        entity_id: entityId,
        scope_key: scopeKey,
        competition_type: scope.competition_type,
        game_type: scope.game_type || null,
        season_id: scope.season_id || null,
        region: scope.region || 'global',
        rating_system: 'elo',
        current_rating: stats.rating,
        peak_rating: stats.peak,
        lowest_rating: stats.lowest,
        matches_played: stats.played,
        wins: stats.wins,
        losses: stats.losses,
        draws: stats.draws,
        last_match_at: stats.lastMatchAt,
        created_at: timestamp,
        updated_at: timestamp,
      };

      await DatabaseService.saveCompetitionRating(persisted);
      resultMap.set(entityId, persisted);
    }

    return resultMap;
  },
};
