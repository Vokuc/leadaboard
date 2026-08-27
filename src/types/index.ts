export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: 'member' | 'admin' | 'billing_admin' | 'super_admin';
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export type CompetitionType = 'custom' | 'sports' | 'gaming' | 'reading' | 'fitness' | 'workplace' | 'education';
export type VisibilityType = 'public' | 'private';
export type LeaderboardStatus = 'active' | 'archived';
export type CompetitionEngine = 'simple_points' | 'league_table' | 'tournament';
export type CompetitionEntityType = 'individual' | 'team';
export type StatisticCategory = 'input' | 'derived';
export type StatisticCalculationType =
  | 'played'
  | 'goal_difference'
  | 'point_difference'
  | 'set_difference'
  | 'win_percentage'
  | 'average_points'
  | 'kill_death_ratio';
export type RankingCriterionType = 'statistic' | 'alphabetical';
export type RankingDirection = 'asc' | 'desc';
export type FixtureStatus = 'scheduled' | 'live' | 'completed';
export type TournamentState = 'draft' | 'registration_open' | 'in_progress' | 'completed' | 'cancelled';
export type TournamentMatchState = 'scheduled' | 'live' | 'completed' | 'cancelled' | 'walkover' | 'bye';
export type TournamentFormat = 'single_elimination';
export type TournamentSeedingMode = 'random' | 'manual' | 'league_standings';
export type CompetitionTemplateKey =
  | 'football'
  | 'basketball'
  | 'volleyball'
  | 'cricket'
  | 'rugby'
  | 'baseball'
  | 'hockey'
  | 'table_tennis'
  | 'tennis'
  | 'chess'
  | 'esports'
  | 'racing'
  | 'swimming'
  | 'athletics'
  | 'custom';

export interface Leaderboard {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  slug: string;
  visibility: VisibilityType;
  competition_type: CompetitionType;
  cover_image_url: string | null;
  status: LeaderboardStatus;
  created_at: string;
  updated_at: string;
}

export interface LeaderboardAdmin {
  leaderboard_id: string;
  user_id: string;
  created_at: string;
  profile?: Profile;
}


export interface Season {
  id: string;
  leaderboard_id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  created_at: string;
}

export interface ScoringRule {
  id: string;
  leaderboard_id: string;
  event_name: string;
  points: number;
  description: string | null;
  created_at: string;
}

export interface LeaderboardMember {
  id: string;
  leaderboard_id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  team: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ScoreEvent {
  id: string;
  leaderboard_id: string;
  member_id: string;
  rule_id: string | null;
  points: number;
  reason: string;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  leaderboard_id: string;
  message: string;
  created_at: string;
}

export interface Ranking {
  member_id: string;
  leaderboard_id: string;
  player_name: string;
  player_email: string | null;
  avatar_url: string | null;
  team: string | null;
  notes: string | null;
  is_active: boolean;
  total_points: number;
  last_score_at: string;
  joined_at: string;
}

export interface CompetitionConfig {
  leaderboard_id: string;
  engine_type: CompetitionEngine;
  template_key: CompetitionTemplateKey;
  entity_type: CompetitionEntityType;
  created_at: string;
  updated_at: string;
}

export interface StatisticsRegistryItem {
  key: string;
  label: string;
  category: StatisticCategory;
  calculation_type: StatisticCalculationType | null;
  created_at?: string;
}

export interface CompetitionStatistic {
  id: string;
  leaderboard_id: string;
  statistic_key: string;
  label: string;
  category: StatisticCategory;
  calculation_type: StatisticCalculationType | null;
  is_enabled: boolean;
  display_order: number;
  created_at: string;
}

export interface CompetitionStatValue {
  id: string;
  leaderboard_id: string;
  member_id: string;
  statistic_key: string;
  value: number;
  updated_at: string;
}

export interface CompetitionRankingRule {
  id: string;
  leaderboard_id: string;
  criterion_type: RankingCriterionType;
  statistic_key: string | null;
  label: string;
  direction: RankingDirection;
  priority: number;
  created_at: string;
}

export interface LeagueSettings {
  leaderboard_id: string;
  season_name: string;
  points_for_win: number;
  points_for_draw: number;
  points_for_loss: number;
  created_at: string;
  updated_at: string;
}

export interface Fixture {
  id: string;
  leaderboard_id: string;
  home_member_id: string;
  away_member_id: string;
  round_name: string | null;
  scheduled_at: string | null;
  status: FixtureStatus;
  created_at: string;
  updated_at: string;
}

export interface FixtureResult {
  fixture_id: string;
  home_score: number;
  away_score: number;
  created_at: string;
  updated_at: string;
}

export interface LeagueStandingRow {
  member_id: string;
  name: string;
  avatar_url: string | null;
  team: string | null;
  notes: string | null;
  is_active: boolean;
  stats: Record<string, number>;
  position: number;
}

export interface CompetitionTemplate {
  key: CompetitionTemplateKey;
  label: string;
  description: string;
  competition_type: CompetitionType;
  entity_type: CompetitionEntityType;
  supports_draws: boolean;
  score_label: string;
  scored_stat_key: string;
  allowed_stat_key: string;
  default_points_for_win: number;
  default_points_for_draw: number;
  default_points_for_loss: number;
  statistic_keys: string[];
  standings_column_keys: string[];
  ranking_rules: Array<{
    criterion_type: RankingCriterionType;
    statistic_key: string | null;
    label: string;
    direction: RankingDirection;
  }>;
}

export interface CompetitionContext {
  leaderboard: Leaderboard;
  config: CompetitionConfig | null;
  members: LeaderboardMember[];
  season: Season | null;
}

export interface Tournament {
  leaderboard_id: string;
  format: TournamentFormat;
  bracket_size: number;
  seeding_mode: TournamentSeedingMode;
  state: TournamentState;
  season_name: string;
  template_key: CompetitionTemplateKey;
  champion_member_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TournamentRound {
  id: string;
  leaderboard_id: string;
  round_index: number;
  round_name: string;
  match_count: number;
  created_at: string;
}

export interface TournamentMatch {
  id: string;
  leaderboard_id: string;
  round_id: string;
  round_index: number;
  match_index: number;
  home_member_id: string | null;
  away_member_id: string | null;
  winner_member_id: string | null;
  loser_member_id: string | null;
  scheduled_at: string | null;
  state: TournamentMatchState;
  next_match_id: string | null;
  next_match_slot: 'home' | 'away' | null;
  created_at: string;
  updated_at: string;
}

export interface TournamentMatchResult {
  match_id: string;
  home_score: number;
  away_score: number;
  created_at: string;
  updated_at: string;
}

export interface TournamentAdvancement {
  id: string;
  leaderboard_id: string;
  from_match_id: string;
  to_match_id: string;
  to_slot: 'home' | 'away';
  advanced_member_id: string;
  reason: 'win' | 'bye' | 'walkover';
  created_at: string;
}

export interface TournamentBracketNode {
  match: TournamentMatch;
  result: TournamentMatchResult | null;
  homeMember: LeaderboardMember | null;
  awayMember: LeaderboardMember | null;
}

export interface TournamentRoundView {
  round: TournamentRound;
  matches: TournamentBracketNode[];
}

export interface TournamentBracketView {
  tournament: Tournament;
  rounds: TournamentRoundView[];
  champion: LeaderboardMember | null;
}
