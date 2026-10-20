import { 
  CompetitionRules, 
  PointsRuleConfig, 
  TieBreakerRule 
} from '@/types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validatePointsConfig(config: Partial<PointsRuleConfig>): ValidationResult {
  const errors: string[] = [];

  if (typeof config.points_for_win === 'number' && !Number.isFinite(config.points_for_win)) {
    errors.push('Points for win must be a valid number.');
  }
  if (typeof config.points_for_draw === 'number' && !Number.isFinite(config.points_for_draw)) {
    errors.push('Points for draw must be a valid number.');
  }
  if (typeof config.points_for_loss === 'number' && !Number.isFinite(config.points_for_loss)) {
    errors.push('Points for loss must be a valid number.');
  }

  if (
    config.min_points_per_event != null &&
    config.max_points_per_event != null &&
    config.min_points_per_event > config.max_points_per_event
  ) {
    errors.push('Minimum points per event cannot exceed maximum points per event.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateTieBreakers(tieBreakers: TieBreakerRule[]): ValidationResult {
  const errors: string[] = [];

  if (!Array.isArray(tieBreakers) || tieBreakers.length === 0) {
    errors.push('At least one ranking rule or tie-breaker must be specified.');
    return { valid: false, errors };
  }

  // Must have a deterministic fallback as one of the rules (usually last)
  const hasDeterministicFallback = tieBreakers.some(
    tb => tb.type === 'alphabetical' || tb.type === 'earliest_score'
  );

  if (!hasDeterministicFallback) {
    errors.push('Tie-breakers must include at least one deterministic fallback (such as Alphabetical or Earliest Achieved).');
  }

  // Check for duplicate criteria
  const seen = new Set<string>();
  for (const tb of tieBreakers) {
    const key = tb.type === 'statistic' ? `stat:${tb.statistic_key}` : tb.type;
    if (seen.has(key)) {
      errors.push(`Duplicate tie-breaker criterion: "${tb.label}".`);
    }
    seen.add(key);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateCompetitionRules(rules: Partial<CompetitionRules>): ValidationResult {
  const errors: string[] = [];

  if (rules.engine && !['simple_points', 'league_table', 'tournament'].includes(rules.engine)) {
    errors.push('Invalid competition engine specified.');
  }

  if (rules.ranking_order && !['asc', 'desc'].includes(rules.ranking_order)) {
    errors.push('Ranking order must be either ascending ("asc") or descending ("desc").');
  }

  if (rules.points_config) {
    const pointsValidation = validatePointsConfig(rules.points_config);
    if (!pointsValidation.valid) {
      errors.push(...pointsValidation.errors);
    }
  }

  if (rules.tie_breakers) {
    const tbValidation = validateTieBreakers(rules.tie_breakers);
    if (!tbValidation.valid) {
      errors.push(...tbValidation.errors);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export interface ScoreAdjustmentPayload {
  points: number;
  reason?: string;
}

export interface FixtureResultPayload {
  homeScore: number;
  awayScore: number;
}

export function validateScoreAdjustment(
  rules: CompetitionRules,
  payload: ScoreAdjustmentPayload
): ValidationResult {
  const errors: string[] = [];

  if (typeof payload.points !== 'number' || !Number.isFinite(payload.points)) {
    errors.push('Score points must be a valid numeric value.');
    return { valid: false, errors };
  }

  if (!rules.points_config.allow_negative_points && payload.points < 0) {
    errors.push('Negative point adjustments are not permitted by this competition\'s rules.');
  }

  if (
    rules.points_config.min_points_per_event != null &&
    payload.points < rules.points_config.min_points_per_event
  ) {
    errors.push(`Points adjustment cannot be lower than ${rules.points_config.min_points_per_event}.`);
  }

  if (
    rules.points_config.max_points_per_event != null &&
    payload.points > rules.points_config.max_points_per_event
  ) {
    errors.push(`Points adjustment cannot exceed ${rules.points_config.max_points_per_event}.`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateFixtureResult(
  rules: CompetitionRules,
  payload: FixtureResultPayload,
  isKnockoutMatch = false
): ValidationResult {
  const errors: string[] = [];

  if (typeof payload.homeScore !== 'number' || !Number.isFinite(payload.homeScore) || payload.homeScore < 0) {
    errors.push('Home score must be a non-negative number.');
  }
  if (typeof payload.awayScore !== 'number' || !Number.isFinite(payload.awayScore) || payload.awayScore < 0) {
    errors.push('Away score must be a non-negative number.');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Knockout elimination matches cannot end in an unresolved draw
  if (isKnockoutMatch && payload.homeScore === payload.awayScore) {
    errors.push('Knockout tournament matches must produce a decisive winner (scores cannot be tied).');
  }

  // League competitions with allow_draws disabled
  if (!isKnockoutMatch && !rules.points_config.allow_draws && payload.homeScore === payload.awayScore) {
    errors.push('Draws are not permitted in this competition.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
