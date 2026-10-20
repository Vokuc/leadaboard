import { 
  CompetitionEngine, 
  CompetitionRules, 
  CompetitionTemplateKey, 
  TieBreakerRule 
} from '@/types';
import { getCompetitionTemplate } from '@/lib/competition/templates';

export function getDefaultTieBreakersForEngine(engine: CompetitionEngine): TieBreakerRule[] {
  switch (engine) {
    case 'league_table':
      return [
        { type: 'points', label: 'Points', direction: 'desc' },
        { type: 'goal_difference', label: 'Goal Difference', direction: 'desc' },
        { type: 'goals_for', label: 'Goals For', direction: 'desc' },
        { type: 'head_to_head', label: 'Head-to-Head', direction: 'desc' },
        { type: 'alphabetical', label: 'Alphabetical', direction: 'asc' },
      ];
    case 'tournament':
      return [
        { type: 'points', label: 'Seeding Points', direction: 'desc' },
        { type: 'alphabetical', label: 'Alphabetical', direction: 'asc' },
      ];
    case 'simple_points':
    default:
      return [
        { type: 'points', label: 'Total Points', direction: 'desc' },
        { type: 'earliest_score', label: 'Earliest Achieved', direction: 'asc' },
        { type: 'alphabetical', label: 'Alphabetical', direction: 'asc' },
      ];
  }
}

export function getDefaultCompetitionRules(
  engine: CompetitionEngine,
  leaderboardId = '',
  templateKey?: CompetitionTemplateKey
): CompetitionRules {
  const timestamp = new Date().toISOString();
  const template = templateKey ? getCompetitionTemplate(templateKey) : null;

  if (engine === 'league_table') {
    return {
      id: `rules-${leaderboardId || 'default'}-v1`,
      leaderboard_id: leaderboardId,
      version: 1,
      engine: 'league_table',
      ranking_order: 'desc',
      primary_metric: 'points',
      points_config: {
        points_for_win: template?.default_points_for_win ?? 3,
        points_for_draw: template?.default_points_for_draw ?? 1,
        points_for_loss: template?.default_points_for_loss ?? 0,
        allow_draws: template?.supports_draws ?? true,
        allow_negative_points: true,
        walkover_win_score: 3,
        walkover_loss_score: 0,
      },
      tie_breakers: getDefaultTieBreakersForEngine('league_table'),
      is_active: true,
      created_at: timestamp,
      updated_at: timestamp,
    };
  }

  if (engine === 'tournament') {
    return {
      id: `rules-${leaderboardId || 'default'}-v1`,
      leaderboard_id: leaderboardId,
      version: 1,
      engine: 'tournament',
      ranking_order: 'desc',
      primary_metric: 'score',
      points_config: {
        points_for_win: 1,
        points_for_draw: 0,
        points_for_loss: 0,
        allow_draws: false,
        allow_negative_points: false,
        walkover_win_score: 3,
        walkover_loss_score: 0,
      },
      tie_breakers: getDefaultTieBreakersForEngine('tournament'),
      is_active: true,
      created_at: timestamp,
      updated_at: timestamp,
    };
  }

  // simple_points
  return {
    id: `rules-${leaderboardId || 'default'}-v1`,
    leaderboard_id: leaderboardId,
    version: 1,
    engine: 'simple_points',
    ranking_order: 'desc',
    primary_metric: 'total_points',
    points_config: {
      points_for_win: 1,
      points_for_draw: 0,
      points_for_loss: 0,
      allow_draws: true,
      allow_negative_points: true,
      min_points_per_event: null,
      max_points_per_event: null,
      walkover_win_score: 3,
      walkover_loss_score: 0,
    },
    tie_breakers: getDefaultTieBreakersForEngine('simple_points'),
    is_active: true,
    created_at: timestamp,
    updated_at: timestamp,
  };
}
