import {
  CompetitionEngine,
  CompetitionTemplateDefinition,
  ScoringRule,
} from '@/types';

export type { CompetitionTemplateDefinition };

export const REUSABLE_COMPETITION_TEMPLATES: CompetitionTemplateDefinition[] = [
  {
    key: 'football_league',
    name: 'Football League',
    version: '1.0.0',
    description: 'Traditional football / soccer league with 3 points for a win, 1 for a draw, goal difference, and goals scored tiebreakers.',
    engine: 'league_table',
    format: 'league',
    competition_type: 'sports',
    entity_type: 'team',
    rules: {
      points_for_win: 3,
      points_for_draw: 1,
      points_for_loss: 0,
    },
    tie_breakers: ['goal_difference', 'goals_for', 'head_to_head', 'alphabetical'],
    fixture_settings: {
      match_duration_minutes: 90,
      buffer_minutes: 15,
      two_legged: false,
    },
    public_display_options: {
      show_standings: true,
      show_fixtures: true,
      show_rules: true,
      show_activity_feed: true,
      highlight_top_n: 4,
    },
  },
  {
    key: 'knockout_tournament',
    name: 'Knockout Tournament',
    version: '1.0.0',
    description: 'Single-elimination knockout bracket with randomized or seeded matchups leading to a championship final.',
    engine: 'tournament',
    format: 'knockout',
    competition_type: 'sports',
    entity_type: 'team',
    rules: {
      points_for_win: 1,
      points_for_draw: 0,
      points_for_loss: 0,
    },
    tie_breakers: ['extra_time_sudden_death'],
    fixture_settings: {
      match_duration_minutes: 60,
      buffer_minutes: 15,
      default_bracket_size: 8,
      seeding_mode: 'random',
    },
    public_display_options: {
      show_bracket: true,
      show_fixtures: true,
      show_rules: true,
      show_activity_feed: true,
    },
  },
  {
    key: 'round_robin_tournament',
    name: 'Round-Robin Tournament',
    version: '1.0.0',
    description: 'Every participant or team plays every other competitor once in a balanced group round-robin format.',
    engine: 'league_table',
    format: 'round_robin',
    competition_type: 'sports',
    entity_type: 'team',
    rules: {
      points_for_win: 3,
      points_for_draw: 1,
      points_for_loss: 0,
    },
    tie_breakers: ['head_to_head', 'goal_difference', 'points', 'alphabetical'],
    fixture_settings: {
      match_duration_minutes: 60,
      buffer_minutes: 10,
      two_legged: false,
    },
    public_display_options: {
      show_standings: true,
      show_fixtures: true,
      show_rules: true,
      highlight_top_n: 2,
    },
  },
  {
    key: 'points_leaderboard',
    name: 'Points Leaderboard',
    version: '1.0.0',
    description: 'Accumulative score-event leaderboard for general challenges, sales sprints, hackathons, or gaming tournaments.',
    engine: 'simple_points',
    format: 'points_race',
    competition_type: 'custom',
    entity_type: 'individual',
    rules: {
      scoring_rules: [
        { event_name: 'Primary Milestone', points: 50, description: 'Awarded when a core competition goal is achieved' },
        { event_name: 'Secondary Objective', points: 25, description: 'Awarded for completing bonus tasks' },
        { event_name: 'Quick Win / Assist', points: 10, description: 'Minor progress event' },
        { event_name: 'Foul / Penalty', points: -10, description: 'Penalty deduction for infractions' },
      ],
    },
    tie_breakers: ['points', 'earliest_score', 'alphabetical'],
    fixture_settings: {
      match_duration_minutes: 0,
      buffer_minutes: 0,
    },
    public_display_options: {
      show_standings: true,
      show_rules: true,
      show_activity_feed: true,
      highlight_top_n: 3,
    },
  },
  {
    key: 'fitness_challenge',
    name: 'Fitness Challenge',
    version: '1.0.0',
    description: 'Fitness and habit-tracking leaderboard measuring workouts, running distance, streaks, and personal records.',
    engine: 'simple_points',
    format: 'fitness',
    competition_type: 'fitness',
    entity_type: 'individual',
    rules: {
      scoring_rules: [
        { event_name: 'Workout Session Completed', points: 50, description: 'Completed a scheduled exercise session' },
        { event_name: '5K Run Milestone', points: 100, description: 'Logged an endurance running session' },
        { event_name: 'Daily Consistency Streak', points: 25, description: 'Logged activity on 3+ consecutive days' },
        { event_name: 'Personal Best Record', points: 150, description: 'Broke an existing personal benchmark' },
      ],
    },
    tie_breakers: ['points', 'earliest_score', 'alphabetical'],
    fixture_settings: {
      match_duration_minutes: 0,
      buffer_minutes: 0,
    },
    public_display_options: {
      show_standings: true,
      show_rules: true,
      show_activity_feed: true,
      highlight_top_n: 5,
    },
  },
  {
    key: 'quiz_academic',
    name: 'Quiz & Academic Competition',
    version: '1.0.0',
    description: 'Educational leaderboard for quizzes, classroom trivia, hackathons, and academic examinations.',
    engine: 'simple_points',
    format: 'quiz',
    competition_type: 'education',
    entity_type: 'individual',
    rules: {
      scoring_rules: [
        { event_name: 'Correct Answer', points: 10, description: 'Awarded for each correct answer' },
        { event_name: 'Speed Bonus', points: 5, description: 'Submitted correct answer in top 10% response time' },
        { event_name: 'Perfect Round Bonus', points: 50, description: 'Scored 100% on a full question round' },
        { event_name: 'Incorrect Answer Penalty', points: -2, description: 'Small deduction for incorrect submissions' },
      ],
    },
    tie_breakers: ['points', 'latest_score', 'alphabetical'],
    fixture_settings: {
      match_duration_minutes: 30,
      buffer_minutes: 5,
    },
    public_display_options: {
      show_standings: true,
      show_rules: true,
      show_activity_feed: true,
      highlight_top_n: 3,
    },
  },
  {
    key: 'custom_competition',
    name: 'General Custom Competition',
    version: '1.0.0',
    description: 'Fully flexible, blank canvas competition allowing organizers to define custom scoring systems, formats, and rules.',
    engine: 'simple_points',
    format: 'custom',
    competition_type: 'custom',
    entity_type: 'individual',
    rules: {
      scoring_rules: [
        { event_name: 'Standard Point', points: 10, description: 'Default custom event' },
      ],
    },
    tie_breakers: ['points', 'alphabetical'],
    fixture_settings: {
      match_duration_minutes: 60,
      buffer_minutes: 15,
    },
    public_display_options: {
      show_standings: true,
      show_rules: true,
      show_activity_feed: true,
      highlight_top_n: 3,
    },
  },
];

export interface TemplateApplicationResult {
  engine: CompetitionEngine;
  templateKey: string;
  templateVersion: string;
  name: string;
  competitionType: string;
  entityType: 'individual' | 'team';
  pointsForWin: number;
  pointsForDraw: number;
  pointsForLoss: number;
  bracketSize: number;
  seedingMode: 'random' | 'manual' | 'league_standings';
  scoringRules: Array<Omit<ScoringRule, 'id' | 'leaderboard_id' | 'created_at'>>;
  tieBreakers: string[];
  publicDisplayOptions: Record<string, boolean | number | string>;
  fixtureSettings: {
    matchDurationMinutes: number;
    bufferMinutes: number;
  };
}

export const CompetitionTemplateRegistry = {
  /**
   * Return all registered, versioned competition templates.
   */
  getAllTemplates(): CompetitionTemplateDefinition[] {
    return REUSABLE_COMPETITION_TEMPLATES;
  },

  /**
   * Find a specific template by key.
   */
  getTemplateByKey(key: string): CompetitionTemplateDefinition | null {
    return REUSABLE_COMPETITION_TEMPLATES.find((t) => t.key === key) || null;
  },

  /**
   * Find templates filtered by underlying engine.
   */
  getTemplatesByEngine(engine: CompetitionEngine): CompetitionTemplateDefinition[] {
    return REUSABLE_COMPETITION_TEMPLATES.filter((t) => t.engine === engine);
  },

  /**
   * Validate that template configuration and any custom overrides are compatible with engine rules.
   */
  validateTemplateApplication(
    templateKey: string,
    customOptions?: {
      pointsForWin?: number;
      pointsForDraw?: number;
      pointsForLoss?: number;
      bracketSize?: number;
      scoringRules?: Array<{ event_name: string; points: number }>;
    }
  ): { valid: boolean; errors: string[] } {
    const template = this.getTemplateByKey(templateKey);
    const errors: string[] = [];

    if (!template) {
      return { valid: false, errors: [`Template "${templateKey}" does not exist.`] };
    }

    if (template.engine === 'league_table') {
      const winPts = customOptions?.pointsForWin ?? template.rules.points_for_win ?? 3;
      const drawPts = customOptions?.pointsForDraw ?? template.rules.points_for_draw ?? 1;
      const lossPts = customOptions?.pointsForLoss ?? template.rules.points_for_loss ?? 0;

      if (winPts < drawPts) {
        errors.push('Points for a win must be greater than or equal to points for a draw.');
      }
      if (drawPts < lossPts) {
        errors.push('Points for a draw must be greater than or equal to points for a loss.');
      }
    }

    if (template.engine === 'tournament') {
      const bSize = customOptions?.bracketSize ?? template.fixture_settings.default_bracket_size ?? 8;
      const validSizes = [4, 8, 16, 32, 64];
      if (!validSizes.includes(bSize)) {
        errors.push(`Invalid tournament bracket size: ${bSize}. Must be one of: 4, 8, 16, 32, 64.`);
      }
    }

    if (template.engine === 'simple_points') {
      const rules = customOptions?.scoringRules ?? template.rules.scoring_rules ?? [];
      if (rules.length === 0) {
        errors.push('Points leaderboards must configure at least one scoring rule.');
      }
      for (const rule of rules) {
        if (!rule.event_name || !rule.event_name.trim()) {
          errors.push('All scoring rules must have a valid event name.');
        }
        if (typeof rule.points !== 'number' || isNaN(rule.points)) {
          errors.push(`Rule "${rule.event_name}" must specify a numeric point value.`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  /**
   * Apply a template with optional customizations, producing a clean payload for competition creation.
   * Applying a template creates a new configuration and never mutates or overwrites an existing leaderboard.
   */
  applyTemplate(
    templateKey: string,
    overrides?: {
      name?: string;
      competitionType?: string;
      entityType?: 'individual' | 'team';
      pointsForWin?: number;
      pointsForDraw?: number;
      pointsForLoss?: number;
      bracketSize?: number;
      seedingMode?: 'random' | 'manual' | 'league_standings';
      scoringRules?: Array<{ event_name: string; points: number; description?: string }>;
    }
  ): TemplateApplicationResult {
    const template = this.getTemplateByKey(templateKey);
    if (!template) {
      throw new Error(`Template "${templateKey}" not found.`);
    }

    const validation = this.validateTemplateApplication(templateKey, overrides);
    if (!validation.valid) {
      throw new Error(`Cannot apply template: ${validation.errors.join(' ')}`);
    }

    const rulesToInsert = (overrides?.scoringRules || template.rules.scoring_rules || []).map((r) => ({
      event_name: r.event_name,
      points: r.points,
      description: r.description || null,
    }));

    return {
      engine: template.engine,
      templateKey: template.key,
      templateVersion: template.version,
      name: overrides?.name || template.name,
      competitionType: overrides?.competitionType || template.competition_type,
      entityType: overrides?.entityType || template.entity_type,
      pointsForWin: overrides?.pointsForWin ?? template.rules.points_for_win ?? 3,
      pointsForDraw: overrides?.pointsForDraw ?? template.rules.points_for_draw ?? 1,
      pointsForLoss: overrides?.pointsForLoss ?? template.rules.points_for_loss ?? 0,
      bracketSize: overrides?.bracketSize ?? template.fixture_settings.default_bracket_size ?? 8,
      seedingMode: overrides?.seedingMode ?? template.fixture_settings.seeding_mode ?? 'random',
      scoringRules: rulesToInsert,
      tieBreakers: template.tie_breakers,
      publicDisplayOptions: template.public_display_options,
      fixtureSettings: {
        matchDurationMinutes: template.fixture_settings.match_duration_minutes,
        bufferMinutes: template.fixture_settings.buffer_minutes,
      },
    };
  },
};
