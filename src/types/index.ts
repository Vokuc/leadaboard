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
export type RankingCriterionType = 'statistic' | 'alphabetical' | 'head_to_head';
export type TieBreakerCriterionType =
  | 'points'
  | 'goal_difference'
  | 'goals_for'
  | 'goals_against'
  | 'head_to_head'
  | 'statistic'
  | 'earliest_score'
  | 'latest_score'
  | 'event_count'
  | 'alphabetical'
  | 'random';
export type RankingDirection = 'asc' | 'desc';
export type FixtureStatus = 'scheduled' | 'live' | 'completed';
export type CompetitionOperationalStatus = 
  | 'draft' 
  | 'registration_open' 
  | 'scheduled' 
  | 'in_progress' 
  | 'under_review' 
  | 'completed' 
  | 'cancelled';
export type TournamentState = CompetitionOperationalStatus;
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
  is_verified?: boolean;
  created_at: string;
  updated_at: string;
}

export interface LeaderboardAdmin {
  leaderboard_id: string;
  user_id: string;
  role?: 'admin' | 'referee';
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

export type TeamRosterRole = 'captain' | 'player' | 'substitute';

export interface Team {
  id: string;
  leaderboard_id: string;
  name: string;
  short_code: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  leaderboard_id: string;
  member_id: string;
  role: TeamRosterRole;
  jersey_number?: number | null;
  created_at: string;
  updated_at: string;
  member?: LeaderboardMember;
}

export interface TeamWithRoster extends Team {
  members: Array<TeamMember & { member: LeaderboardMember }>;
  member_count: number;
}

export interface LeaderboardMember {
  id: string;
  leaderboard_id: string;
  user_id?: string | null;
  name: string;
  email: string | null;
  avatar_url: string | null;
  team: string | null;
  team_id?: string | null;
  notes: string | null;
  is_active: boolean;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export type ResultEntityType = 'score_event' | 'fixture_result' | 'tournament_match';
export type ResultAuditAction = 'submit' | 'correct' | 'dispute' | 'approve' | 'reject' | 'void';
export type ResultStatus = 'submitted' | 'confirmed' | 'disputed' | 'approved' | 'rejected' | 'voided';
export type ResultActorRole = 'owner' | 'admin' | 'referee' | 'participant' | 'system';

export interface ResultAuditEntry {
  id: string;
  leaderboard_id: string;
  entity_type: ResultEntityType;
  entity_id: string;
  previous_payload: Record<string, unknown> | null;
  proposed_payload: Record<string, unknown>;
  actor_id: string | null;
  actor_email: string | null;
  actor_name: string | null;
  actor_role: ResultActorRole;
  participant_id?: string | null;
  participant_name?: string | null;
  action: ResultAuditAction;
  status: ResultStatus;
  reason: string;
  evidence_urls: string[];
  created_at: string;
}

export interface CorrectResultInput {
  entityType: ResultEntityType;
  entityId: string;
  leaderboardId: string;
  newPayload: Record<string, unknown>;
  reason: string;
  evidenceUrls?: string[];
  forceDownstreamReset?: boolean;
}

export interface DisputeResultInput {
  entityType: ResultEntityType;
  entityId: string;
  leaderboardId: string;
  reason: string;
  evidenceUrls?: string[];
}

export interface ResolveDisputeInput {
  leaderboardId: string;
  entityType: ResultEntityType;
  entityId: string;
  decision: 'approve' | 'reject';
  resolutionReason: string;
  auditEntryId?: string;
}

export interface ScoreEvent {
  id: string;
  leaderboard_id: string;
  member_id: string;
  rule_id: string | null;
  points: number;
  reason: string;
  status?: ResultStatus;
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
  position?: number;
  tie_break_explanation?: string;
}

export interface TieBreakerRule {
  type: TieBreakerCriterionType;
  statistic_key?: string | null;
  direction?: RankingDirection;
  label: string;
}

export interface PointsRuleConfig {
  points_for_win: number;
  points_for_draw: number;
  points_for_loss: number;
  allow_draws: boolean;
  allow_negative_points: boolean;
  min_points_per_event?: number | null;
  max_points_per_event?: number | null;
  walkover_win_score?: number;
  walkover_loss_score?: number;
}

export interface CompetitionRules {
  id: string;
  leaderboard_id: string;
  version: number;
  engine: CompetitionEngine;
  ranking_order: RankingDirection;
  primary_metric: string;
  points_config: PointsRuleConfig;
  tie_breakers: TieBreakerRule[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CompetitionConfig {
  leaderboard_id: string;
  engine_type: CompetitionEngine;
  template_key: CompetitionTemplateKey;
  entity_type: CompetitionEntityType;
  operational_status?: CompetitionOperationalStatus;
  participation_type?: 'online' | 'in_person' | 'hybrid' | 'unspecified';
  location_name?: string | null;
  entry_fee?: number;
  currency?: string;
  rules_summary?: string | null;
  is_featured?: boolean;
  created_at: string;
  updated_at: string;
}

export type PathwayTieHandling = 'standard_rules' | 'playoff' | 'manual_approval' | 'random';
export type PathwayStatus = 'configured' | 'previewed' | 'committed' | 'cancelled';

export interface CompetitionPathway {
  id: string;
  source_leaderboard_id: string;
  destination_leaderboard_id: string;
  name: string;
  stage_order: number;
  qualifier_count: number;
  tie_handling: PathwayTieHandling;
  status: PathwayStatus;
  committed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePathwayInput {
  sourceLeaderboardId: string;
  destinationLeaderboardId: string;
  name: string;
  stageOrder?: number;
  qualifierCount: number;
  tieHandling?: PathwayTieHandling;
}

export interface QualificationPreviewRow {
  rank: number;
  memberId: string;
  name: string;
  team: string | null;
  avatarUrl: string | null;
  points: number;
  stats: Record<string, number>;
  seedIndex: number;
  isQualified: boolean;
  isCutoffTie: boolean;
}

export interface BracketMatchupPreview {
  matchIndex: number;
  homeSeed: number | null;
  homeParticipantName: string | null;
  awaySeed: number | null;
  awayParticipantName: string | null;
}

export interface QualificationPreview {
  sourceLeaderboardId: string;
  destinationLeaderboardId: string;
  qualifiers: QualificationPreviewRow[];
  bracketPlacementPreview: BracketMatchupPreview[];
  hasUnresolvedTies: boolean;
  unresolvedTieMembers: string[];
  canCommit: boolean;
  warnings: string[];
}

export interface CommitQualificationInput {
  pathwayId?: string;
  sourceLeaderboardId?: string;
  destinationLeaderboardId?: string;
  qualifierCount?: number;
  tieHandling?: PathwayTieHandling;
  forceReset?: boolean;
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

export type SchedulingStatus = 'unscheduled' | 'scheduled' | 'rescheduled' | 'conflict' | 'cancelled';

export interface CompetitionVenue {
  id: string;
  leaderboard_id: string;
  name: string;
  court_field?: string | null;
  location?: string | null;
  capacity?: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ParticipantBlackout {
  member_id: string;
  start_date: string;
  end_date: string;
  reason?: string;
}

export interface CompetitionScheduleConfig {
  id: string;
  leaderboard_id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  timezone: string;
  playable_days: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  daily_start_time: string; // HH:mm
  daily_end_time: string;   // HH:mm
  match_duration_minutes: number;
  buffer_minutes: number;
  rest_interval_minutes: number;
  participant_availability: ParticipantBlackout[];
  auto_assign_venues: boolean;
  created_at: string;
  updated_at: string;
}

export interface ScheduledSlotProposal {
  entity_id: string;
  entity_type: 'fixture' | 'tournament_match';
  home_member_id: string | null;
  away_member_id: string | null;
  home_name: string;
  away_name: string;
  round_name: string;
  round_index?: number;
  match_index?: number;
  scheduled_at: string;
  scheduled_end_at: string;
  venue_id: string | null;
  venue_name: string | null;
  court_field: string | null;
  timezone: string;
  status: SchedulingStatus;
  conflict_reason: string | null;
}

export interface ScheduleConflictExplanation {
  entity_id: string;
  home_name: string;
  away_name: string;
  round_name: string;
  reason: string;
  type: 'venue_overlap' | 'participant_overlap' | 'rest_interval_violation' | 'blackout_window' | 'outside_window' | 'exceeded_range' | 'manual_conflict';
}

export interface SchedulePreviewResult {
  total_items: number;
  scheduled_items: ScheduledSlotProposal[];
  unscheduled_items: Array<{
    entity_id: string;
    home_member_id: string | null;
    away_member_id: string | null;
    home_name: string;
    away_name: string;
    round_name: string;
    reason: string;
  }>;
  conflicts: ScheduleConflictExplanation[];
  has_conflicts: boolean;
  can_commit: boolean;
}

export interface Fixture {
  id: string;
  leaderboard_id: string;
  home_member_id: string;
  away_member_id: string;
  round_name: string | null;
  scheduled_at: string | null;
  scheduled_end_at?: string | null;
  venue_id?: string | null;
  venue_name?: string | null;
  court_field?: string | null;
  timezone?: string;
  scheduling_status?: SchedulingStatus;
  conflict_reason?: string | null;
  status: FixtureStatus;
  created_at: string;
  updated_at: string;
}


export interface FixtureResult {
  fixture_id: string;
  home_score: number;
  away_score: number;
  status?: ResultStatus;
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
  tie_break_explanation?: string;
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
  round_name?: string | null;
  match_index: number;
  home_member_id: string | null;
  away_member_id: string | null;
  winner_member_id: string | null;
  loser_member_id: string | null;
  scheduled_at: string | null;
  scheduled_end_at?: string | null;
  venue_id?: string | null;
  venue_name?: string | null;
  court_field?: string | null;
  timezone?: string;
  scheduling_status?: SchedulingStatus;
  conflict_reason?: string | null;
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
  status?: ResultStatus;
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

export type RegistrationStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'waitlisted'
  | 'withdrawn'
  | 'confirmed';

export interface CompetitionEligibilityRules {
  allowed_domains?: string[];
  min_age?: number | null;
  notes?: string;
}

export interface CompetitionRegistrationConfig {
  id: string;
  leaderboard_id: string;
  is_enabled: boolean;
  capacity: number | null;
  opens_at: string | null;
  closes_at: string | null;
  require_approval: boolean;
  allow_waitlist: boolean;
  allow_team_registration: boolean;
  eligibility_rules: CompetitionEligibilityRules;
  created_at: string;
  updated_at: string;
}

export interface CompetitionRegistration {
  id: string;
  leaderboard_id: string;
  user_id: string | null;
  member_id: string | null;
  team_id: string | null;
  participant_name: string;
  participant_email: string;
  status: RegistrationStatus;
  claim_token: string | null;
  claimed_at: string | null;
  rejection_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type NotificationType =
  | 'registration_received'
  | 'registration_approved'
  | 'registration_rejected'
  | 'registration_waitlisted'
  | 'fixture_scheduled'
  | 'match_rescheduled'
  | 'match_reminder'
  | 'result_updated'
  | 'competition_announcement';

export type NotificationDeliveryStatus = 'queued' | 'delivered' | 'read' | 'failed';

export interface CompetitionNotification {
  id: string;
  leaderboard_id: string | null;
  user_id: string;
  recipient_email: string | null;
  notification_type: NotificationType;
  title: string;
  message: string;
  action_url: string | null;
  delivery_status: NotificationDeliveryStatus;
  idempotency_key: string | null;
  read_at: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface NotificationPreference {
  id: string;
  user_id: string;
  leaderboard_id: string | null;
  email_opt_in: boolean;
  in_app_opt_in: boolean;
  match_reminders: boolean;
  result_updates: boolean;
  announcements: boolean;
  created_at: string;
  updated_at: string;
}

// ==========================================
// TEMPLATES & EVENT-DAY OPERATIONS (ERA 2 PROMPT 3)
// ==========================================

export interface CompetitionTemplateDefinition {
  key: string;
  name: string;
  version: string;
  description: string;
  engine: CompetitionEngine;
  format: 'league' | 'knockout' | 'round_robin' | 'points_race' | 'fitness' | 'quiz' | 'custom';
  competition_type: CompetitionType;
  entity_type: CompetitionEntityType;
  rules: {
    points_for_win?: number;
    points_for_draw?: number;
    points_for_loss?: number;
    scoring_rules?: Array<{ event_name: string; points: number; description?: string }>;
  };
  tie_breakers: string[];
  fixture_settings: {
    match_duration_minutes: number;
    buffer_minutes: number;
    two_legged?: boolean;
    default_bracket_size?: number;
    seeding_mode?: TournamentSeedingMode;
  };
  public_display_options: {
    show_standings?: boolean;
    show_bracket?: boolean;
    show_fixtures?: boolean;
    show_rules?: boolean;
    show_activity_feed?: boolean;
    highlight_top_n?: number;
  };
}

export type EventDayOperatorRole = 'organizer' | 'referee' | 'viewer';

export interface EventDayParticipant {
  id: string;
  name: string;
  avatar_url?: string | null;
  short_code?: string | null;
  seed?: number | null;
}

export interface EventDayMatch {
  id: string;
  leaderboard_id: string;
  engine: CompetitionEngine;
  home_participant: EventDayParticipant;
  away_participant: EventDayParticipant;
  home_score: number | null;
  away_score: number | null;
  status: 'scheduled' | 'live' | 'completed' | 'postponed' | 'cancelled';
  scheduled_at: string | null;
  scheduled_end_at: string | null;
  venue_name: string | null;
  court_field: string | null;
  round_name: string | null;
  is_live: boolean;
  next_actions: Array<'start' | 'update_score' | 'finalize' | 'edit'>;
}

export interface EventDayOfflineAction {
  id: string;
  matchId: string;
  leaderboardId: string;
  engine: CompetitionEngine;
  actionType: 'start' | 'score_update' | 'finalize';
  homeScore?: number;
  awayScore?: number;
  reason?: string;
  timestamp: string;
}

// ==========================================
// Era 3 Prompt 1: Participant Profiles & Competition Passport
// ==========================================

export interface ParticipantProfilePrivacy {
  is_public: boolean;
  show_email: boolean;
  show_unverified_results: boolean;
  show_stats: boolean;
  show_match_history: boolean;
  show_teams: boolean;
  show_trophy_case: boolean;
  show_ratings?: boolean;
}

export interface ParticipantProfile {
  id: string;
  user_id: string;
  username: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  location: string | null;
  headline: string | null;
  social_links: {
    twitter?: string;
    discord?: string;
    github?: string;
    website?: string;
  };
  privacy_settings: ParticipantProfilePrivacy;
  pinned_competition_ids: string[];
  hidden_entity_ids: string[];
  created_at: string;
  updated_at: string;
}

export type ParticipantClaimStatus = 'pending' | 'approved' | 'rejected' | 'verified';
export type ParticipantClaimVerificationMethod = 'email_match' | 'token' | 'organizer_approved';

export interface ParticipantClaim {
  id: string;
  leaderboard_id: string;
  member_id: string;
  user_id: string;
  claim_token: string | null;
  status: ParticipantClaimStatus;
  verification_method: ParticipantClaimVerificationMethod;
  claim_notes: string | null;
  rejection_reason: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ParticipantCorrectionType = 'wrongly_linked' | 'wrong_score' | 'wrong_team' | 'duplicate_profile' | 'remove_from_passport';
export type ParticipantCorrectionStatus = 'pending' | 'approved' | 'rejected' | 'resolved';

export interface ParticipantCorrection {
  id: string;
  user_id: string;
  leaderboard_id: string;
  entity_type: 'membership_link' | 'fixture_result' | 'tournament_match' | 'score_event';
  entity_id: string;
  correction_type: ParticipantCorrectionType;
  reason: string;
  status: ParticipantCorrectionStatus;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ParticipantTeamHistory {
  id: string;
  user_id: string | null;
  member_id: string;
  leaderboard_id: string;
  team_id: string;
  team_name: string;
  role: string;
  jersey_number: number | null;
  joined_at: string;
  left_at: string | null;
  created_at: string;
}

export interface PassportCompetitionEntry {
  leaderboard_id: string;
  competition_id?: string;
  competition_name: string;
  slug: string;
  competition_type: CompetitionType;
  engine_type: CompetitionEngine;
  season_name: string | null;
  member_id: string;
  member_name: string;
  team_id: string | null;
  team_name: string | null;
  role: string;
  rank: number | null;
  total_participants: number;
  points: number;
  matches_played: number;
  matches_won: number;
  matches_drawn: number;
  matches_lost: number;
  podium_finish: 1 | 2 | 3 | null;
  is_verified: boolean;
  verification_badge?: string;
  verification_reason: string;
  joined_at: string;
}

export interface PassportMatchRecord {
  match_id: string;
  fixture_id?: string;
  leaderboard_id: string;
  competition_name: string;
  slug: string;
  engine: CompetitionEngine;
  round_name: string;
  opponent_name: string;
  opponent_avatar_url: string | null;
  team_name: string | null;
  home_score: number | null;
  away_score: number | null;
  is_home: boolean;
  outcome: 'win' | 'loss' | 'draw' | 'pending';
  scheduled_at: string | null;
  venue_name: string | null;
  is_verified: boolean;
  verification_badge: 'verified' | 'unverified';
  is_hidden: boolean;
}

export interface PassportCareerOverview {
  total_competitions: number;
  verified_competitions: number;
  unverified_competitions: number;
  total_matches: number;
  matches_won: number;
  total_wins?: number;
  verified_wins?: number;
  matches_drawn: number;
  matches_lost: number;
  win_percentage: number;
  win_rate?: number;
  first_place_finishes: number;
  gold_finishes?: number;
  second_place_finishes: number;
  silver_finishes?: number;
  third_place_finishes: number;
  bronze_finishes?: number;
  highest_rank_achieved?: number | null;
  active_streak?: number;
  total_points_scored: number;
  active_teams: number;
}

export interface CompetitionPassportData {
  profile: ParticipantProfile;
  account_email?: string | null;
  overview: PassportCareerOverview;
  competitions: PassportCompetitionEntry[];
  matches: PassportMatchRecord[];
  teams: ParticipantTeamHistory[];
  achievements?: ParticipantAchievement[];
  ratings?: CompetitionRating[];
  rating_history?: RatingHistoryEntry[];
  is_owner: boolean;
}

// ==========================================
// ACHIEVEMENTS & RATINGS ENGINE TYPES
// ==========================================

export type AchievementCategory = 'participation' | 'victory' | 'streak' | 'milestone' | 'mastery';
export type AchievementRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface AchievementCriteria {
  type:
    | 'first_competition'
    | 'first_win'
    | 'champion'
    | 'win_streak'
    | 'matches_count'
    | 'competitions_count'
    | 'clean_sheet'
    | 'podium_count'
    | 'custom';
  min_streak?: number;
  min_matches?: number;
  min_competitions?: number;
  min_podiums?: number;
  custom_field?: string;
  custom_value?: unknown;
}

export interface AchievementDefinition {
  id: string; // Key slug e.g. 'first_win', 'champion', 'win_streak_3'
  name: string;
  description: string;
  category: AchievementCategory;
  badge_icon: string;
  badge_color: string;
  rarity: AchievementRarity;
  points_reward: number;
  criteria: AchievementCriteria;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ParticipantAchievement {
  id: string;
  achievement_id: string;
  user_id: string;
  member_id?: string | null;
  leaderboard_id?: string | null;
  awarded_at: string;
  provenance: {
    match_id?: string;
    fixture_id?: string;
    competition_name?: string;
    score_summary?: string;
    opponent_name?: string;
    triggered_by?: string;
    notes?: string;
  };
  is_revoked: boolean;
  revoked_at?: string | null;
  revocation_reason?: string | null;
  revocation_audit_id?: string | null;
  created_at: string;
  updated_at: string;
  achievement?: AchievementDefinition;
}

export type RatingEntityType = 'individual' | 'team';
export type RatingSystem = 'elo' | 'glicko2';

export interface RatingScope {
  competition_type: string;
  game_type?: string | null;
  season_id?: string | null;
  region?: string | null;
  entity_type: RatingEntityType;
}

export interface CompetitionRating {
  id: string;
  entity_type: RatingEntityType;
  entity_id: string; // user_id or team_id
  scope_key: string;
  competition_type: string;
  game_type?: string | null;
  season_id?: string | null;
  region?: string | null;
  rating_system: RatingSystem;
  current_rating: number;
  peak_rating: number;
  lowest_rating: number;
  matches_played: number;
  wins: number;
  losses: number;
  draws: number;
  last_match_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type RatingHistoryStatus = 'applied' | 'rolled_back' | 'recalculated';

export interface RatingHistoryEntry {
  id: string;
  rating_id?: string;
  scope_key: string;
  entity_type: RatingEntityType;
  entity_id: string;
  opponent_id?: string | null;
  opponent_name?: string | null;
  leaderboard_id: string;
  competition_name?: string | null;
  match_id: string;
  previous_rating: number;
  new_rating: number;
  rating_change: number;
  k_factor: number;
  expected_score: number;
  actual_score: number; // 1 (win), 0.5 (draw), 0 (loss)
  is_verified: boolean;
  status: RatingHistoryStatus;
  reason?: string | null;
  reversal_reason?: string | null;
  created_at: string;
}

// ==========================================
// COMPETITION MARKETPLACE DISCOVERY (ERA 4 PROMPT 1)
// ==========================================

export type MarketplaceParticipationType = 'all' | 'online' | 'in_person' | 'hybrid';
export type MarketplaceRegistrationStatusFilter = 'all' | 'open' | 'approval_required' | 'waitlist' | 'closed' | 'view_only';
export type MarketplaceSortOption = 'recently_updated' | 'upcoming' | 'popular' | 'newest';
export type MarketplacePricingFilter = 'all' | 'free' | 'paid';
export type MarketplaceDateRangeFilter = 'all' | 'upcoming' | 'ongoing' | 'past';

export interface MarketplaceOrganizerInfo {
  id: string;
  name: string;
  avatar_url: string | null;
}

export interface MarketplaceRegistrationInfo {
  is_enabled: boolean;
  status: 'open' | 'approval_required' | 'waitlist' | 'closed' | 'ended' | 'view_only';
  opens_at: string | null;
  closes_at: string | null;
  capacity: number | null;
  registered_count: number;
  require_approval: boolean;
  allow_waitlist: boolean;
  allow_team_registration: boolean;
  eligibility_rules?: CompetitionEligibilityRules | null;
  is_user_registered?: boolean;
  user_registration_status?: RegistrationStatus | null;
}

export interface MarketplaceSeasonInfo {
  id?: string;
  name: string;
  start_date: string;
  end_date: string | null;
}

export interface MarketplacePricingInfo {
  is_free: boolean;
  entry_fee: number;
  currency: string;
}

export interface MarketplaceCompetition {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  competition_type: CompetitionType;
  engine_type: CompetitionEngine;
  entity_type: CompetitionEntityType;
  operational_status: CompetitionOperationalStatus;
  cover_image_url: string | null;
  created_at: string;
  updated_at: string;
  organizer: MarketplaceOrganizerInfo;
  season: MarketplaceSeasonInfo | null;
  registration: MarketplaceRegistrationInfo;
  participation_type: 'online' | 'in_person' | 'hybrid' | 'unspecified';
  location_name: string | null;
  pricing: MarketplacePricingInfo;
  rules_summary: string | null;
  participant_count: number;
  is_demo: boolean;
}

export interface MarketplaceQueryOptions {
  query?: string;
  category?: CompetitionType | 'all';
  engine?: CompetitionEngine | 'all';
  participation_type?: MarketplaceParticipationType;
  registration_status?: MarketplaceRegistrationStatusFilter;
  pricing?: MarketplacePricingFilter;
  date_range?: MarketplaceDateRangeFilter;
  organizer_id?: string;
  sort?: MarketplaceSortOption;
  page?: number;
  pageSize?: number;
  includeDemo?: boolean;
  currentUserId?: string;
}

export interface MarketplaceQueryResult {
  items: MarketplaceCompetition[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  facets: {
    categories: Record<string, number>;
    engines: Record<string, number>;
    participationTypes: Record<string, number>;
    registrationStatuses: Record<string, number>;
  };
}

// ==========================================
// ERA 5: SECURE COMPETITION API & WEBHOOKS
// ==========================================

export type ApiKeyScope =
  | 'competitions:read'
  | 'competitions:write'
  | 'scores:submit'
  | 'participants:write'
  | 'webhooks:manage'
  | 'admin';

export type ApiKeyStatus = 'active' | 'revoked' | 'expired';

export interface ApiKey {
  id: string;
  owner_id: string;
  name: string;
  key_prefix: string;
  secret_hash: string;
  scopes: ApiKeyScope[];
  rate_limit_per_minute: number;
  status: ApiKeyStatus;
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiKeyCreateInput {
  name: string;
  scopes: ApiKeyScope[];
  rate_limit_per_minute?: number;
  expires_at?: string | null;
}

export interface ApiKeyCreatedResult {
  apiKey: ApiKey;
  plaintextSecret: string;
}

export type WebhookEventType =
  | 'competition.created'
  | 'competition.updated'
  | 'competition.completed'
  | 'result.submitted'
  | 'result.approved'
  | 'participant.registered'
  | 'ping';

export interface WebhookSubscription {
  id: string;
  owner_id: string;
  url: string;
  secret: string;
  events: WebhookEventType[];
  description?: string | null;
  status: 'active' | 'disabled';
  created_at: string;
  updated_at: string;
}

export interface WebhookDelivery {
  id: string;
  subscription_id: string;
  event: WebhookEventType;
  payload: Record<string, unknown>;
  status: 'success' | 'failed' | 'pending';
  status_code: number | null;
  attempts: number;
  error_message: string | null;
  delivered_at: string | null;
  created_at: string;
}

export interface ApiIdempotencyRecord {
  id: string;
  key_id: string;
  idempotency_key: string;
  endpoint: string;
  request_hash: string;
  response_status: number;
  response_body: string;
  expires_at: string;
  created_at: string;
}

export interface ApiAuditLog {
  id: string;
  key_id: string;
  owner_id: string;
  endpoint: string;
  method: string;
  status_code: number;
  duration_ms?: number;
  idempotency_key?: string | null;
  created_at: string;
}

export interface ApiMeta {
  page?: number;
  pageSize?: number;
  total?: number;
  hasMore?: boolean;
  version: string;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: ApiMeta;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorDetail;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;



