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
  organization_id?: string | null;
  organization?: Organization | null;
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
  organization_id?: string | null;
  canonical_team_id?: string | null;
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
  organization_id?: string | null;
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
  | 'pending_payment'
  | 'approved'
  | 'rejected'
  | 'waitlisted'
  | 'withdrawn'
  | 'confirmed';

export type RefundPolicy =
  | 'no_refunds'
  | 'full_refund_before_deadline'
  | 'partial_refund'
  | 'organizer_discretion';

export type PayoutStatus =
  | 'unconfigured'
  | 'configured'
  | 'pending_approval'
  | 'disabled';

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
  // Financial & Entry Fee additions
  entry_fee?: number | null; // In minor currency units (e.g. 500000 = 5000.00 NGN) or 0 if free
  currency?: string;
  payment_deadline?: string | null;
  refund_policy?: RefundPolicy;
  platform_fee_percent?: number;
  prize_pool_percentage?: number;
  guaranteed_prize_pool?: number | null;
  payout_status?: PayoutStatus;
  created_at: string;
  updated_at: string;
}

export type RegistrationPaymentStatus =
  | 'not_required'
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'refunded'
  | 'disputed';

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
  // Payment tracking
  payment_id?: string | null;
  payment_status?: RegistrationPaymentStatus | null;
  payment_reference?: string | null;
  amount_paid?: number;
  currency?: string;
  paid_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type CompetitionPaymentStatus =
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'expired'
  | 'refunded'
  | 'partially_refunded'
  | 'disputed';

export interface CompetitionPayment {
  id: string;
  leaderboard_id: string;
  registration_id: string;
  user_id: string | null;
  participant_name: string;
  participant_email: string;
  provider: string;
  payment_reference: string;
  external_reference?: string | null;
  amount: number; // In minor units
  currency: string;
  provider_fee: number;
  platform_fee: number;
  net_amount: number;
  status: CompetitionPaymentStatus;
  idempotency_key?: string | null;
  payment_method?: string | null;
  receipt_url?: string | null;
  paid_at?: string | null;
  refund_id?: string | null;
  refunded_at?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type LedgerEntryType =
  | 'entry_fee_credit'
  | 'gross_entry_fee'
  | 'provider_fee_debit'
  | 'provider_fee'
  | 'platform_fee_debit'
  | 'platform_fee'
  | 'refund_debit'
  | 'prize_allocation'
  | 'prize_allocation_debit'
  | 'organizer_payout'
  | 'adjustment';

export interface CompetitionLedgerEntry {
  id: string;
  leaderboard_id: string;
  entry_type: LedgerEntryType;
  amount: number; // positive for credits, negative or positive depending on type
  currency: string;
  balance_after: number;
  payment_id?: string | null;
  registration_id?: string | null;
  actor_id?: string | null;
  description: string;
  metadata?: Record<string, unknown>;
  credit_amount?: number;
  debit_amount?: number;
  running_balance?: number;
  payment_reference?: string;
  created_at: string;
}

export type CompetitionRefundStatus = 'pending' | 'succeeded' | 'failed' | 'cancelled';

export interface CompetitionRefund {
  id: string;
  leaderboard_id: string;
  competition_payment_id: string;
  registration_id: string;
  initiated_by: string | null;
  amount: number;
  currency: string;
  provider: string;
  provider_refund_id?: string | null;
  reason?: string | null;
  status: CompetitionRefundStatus;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type PrizeAllocationType = 'fixed_amount' | 'percentage_of_pool';
export type PrizePayoutStatus = 'allocated' | 'pending_approval' | 'processing' | 'paid' | 'cancelled';

export interface CompetitionPrizeAllocation {
  id: string;
  leaderboard_id: string;
  rank_position: number;
  title: string;
  allocation_type: PrizeAllocationType;
  allocated_amount: number;
  percentage?: number | null;
  currency: string;
  recipient_member_id?: string | null;
  recipient_name?: string | null;
  payout_status: PrizePayoutStatus;
  created_at: string;
  updated_at: string;
}

export interface CompetitionFinancialSummary {
  leaderboard_id: string;
  currency: string;
  total_entry_fees_gross: number;
  total_provider_fees: number;
  total_platform_fees: number;
  total_refunds: number;
  net_revenue: number;
  total_prize_allocated: number;
  available_organizer_balance: number;
  paid_registrations_count: number;
  refunded_registrations_count: number;
  pending_payments_count: number;

  // Extended summary & ledger convenience fields
  gross_revenue?: number;
  total_paid_registrations?: number;
  platform_fees?: number;
  provider_fees?: number;
  organizer_balance?: number;
  total_refunded?: number;
  refund_count?: number;
  prize_pool_allocated?: number;
  prize_allocations?: Array<{
    id: string;
    rank_position: number;
    amount: number;
    currency: string;
    recipient_name?: string | null;
    notes?: string | null;
  }>;
  payments?: CompetitionPayment[];
  entries?: Array<CompetitionLedgerEntry & { credit_amount?: number; debit_amount?: number; payment_reference?: string }>;
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
  organization_id?: string | null;
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

// ─── Organizations & White-Label ──────────────────────────────────────────────

export type OrganizationRole = 'owner' | 'admin' | 'manager' | 'viewer';
export type DomainStatus = 'unverified' | 'pending' | 'verified' | 'failed';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  website_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  custom_domain: string | null;
  domain_status: DomainStatus;
  custom_domain_status?: DomainStatus;
  domain_verification_token?: string | null;
  domain_verified_at?: string | null;
  hide_powered_by: boolean;
  created_by: string;
  owner_id?: string;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrganizationRole;
  created_at: string;
  updated_at: string;
  profile?: Profile;
  user?: Profile;
}

export interface OrganizationInvitation {
  id: string;
  organization_id: string;
  email: string;
  role: 'admin' | 'manager' | 'viewer';
  token: string;
  invited_by: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  expires_at: string;
  created_at: string;
  organization?: Organization;
}

export interface OrganizationAuditLog {
  id: string;
  organization_id: string;
  actor_id: string | null;
  actor_user_id?: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
  actor_profile?: Profile;
  actor?: Profile;
}

export interface OrganizationBrandingConfig {
  logo_url?: string | null;
  website_url?: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  hide_powered_by: boolean;
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

// ─── Sponsorship & Monetization (Era 6 Prompt 2) ──────────────────────────

export type SponsorshipTier =
  | 'headline'
  | 'gold'
  | 'silver'
  | 'bronze'
  | 'community'
  | 'partner';

export interface CompetitionSponsor {
  id: string;
  leaderboard_id?: string | null;
  organization_id?: string | null;
  name: string;
  logo_url?: string | null;
  website_url: string;
  tier: SponsorshipTier;
  display_order: number;
  tagline?: string | null;
  campaign_start?: string | null;
  campaign_end?: string | null;
  is_active: boolean;
  impressions_count: number;
  clicks_count: number;
  created_by?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CompetitionSponsorEvent {
  id: string;
  sponsor_id: string;
  leaderboard_id?: string | null;
  event_type: 'impression' | 'click';
  dedup_key?: string | null;
  user_agent?: string | null;
  ip_hash?: string | null;
  created_at: string;
}

export interface SponsorMetricsSummary {
  sponsor_id: string;
  impressions: number;
  clicks: number;
  ctr: number;
}

// ============================================================================
// AI Competition Manager Types (Era 7 Prompt 1)
// ============================================================================

export type AiTaskType =
  | 'schedule_draft'
  | 'points_rules_draft'
  | 'announcement_draft'
  | 'pathway_proposal'
  | 'venue_setup';

export type AiProposalStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface AiActionProposal {
  id: string;
  leaderboard_id: string;
  task_type: AiTaskType;
  title: string;
  summary: string;
  payload: Record<string, unknown>;
  status: AiProposalStatus;
  validation_errors?: string[];
  created_by?: string | null;
  applied_at?: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  proposal?: AiActionProposal;
  created_at: string;
  data_sources_used?: string[];
}

export interface AiAssistantContext {
  leaderboard: {
    id: string;
    name: string;
    slug: string;
    competition_type: string;
    status: string;
    visibility: string;
    description: string | null;
  };
  config?: {
    engine_type?: string;
    template_key?: string;
    entity_type?: string;
  } | null;
  members_count: number;
  members_sample: Array<{
    id: string;
    name: string;
    team: string | null;
  }>;
  standings_snapshot: Array<{
    position: number;
    name: string;
    member_id: string;
    points?: number;
    played?: number;
    wins?: number;
    draws?: number;
    losses?: number;
    goal_difference?: number;
  }>;
  rules_summary?: {
    engine?: string;
    points_for_win?: number;
    points_for_draw?: number;
    points_for_loss?: number;
    tie_breakers?: string[];
    ranking_order?: string;
  } | null;
  fixtures_summary?: {
    total: number;
    completed: number;
    outstanding: number;
    recent_results: Array<{
      home_name: string;
      away_name: string;
      home_score: number;
      away_score: number;
      round_name: string | null;
    }>;
    upcoming: Array<{
      home_name: string;
      away_name: string;
      scheduled_at: string | null;
      round_name: string | null;
      venue_name: string | null;
    }>;
  };
  registrations_summary?: {
    is_enabled: boolean;
    capacity: number | null;
    approved_count: number;
    pending_count: number;
    waitlisted_count: number;
  };
  venues_summary?: Array<{
    id: string;
    name: string;
    court_field: string | null;
  }>;
}

export interface AiUsageLog {
  id: string;
  user_id?: string | null;
  leaderboard_id: string;
  provider: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  action_type: string;
  created_at: string;
}

// ============================================================================
// Era 7 Prompt 2: Competition Data Graph & Cross-Competition Analytics
// ============================================================================

export interface TeamNameHistoryEntry {
  id: string;
  team_id: string;
  name: string;
  short_code?: string | null;
  logo_url?: string | null;
  changed_at: string;
  changed_by?: string | null;
  reason?: string | null;
}

export interface CompetitionParticipation {
  id: string;
  leaderboard_id: string;
  season_id?: string | null;
  entity_type: CompetitionEntityType;
  member_id: string;
  team_id?: string | null;
  user_id?: string | null;
  display_name: string;
  team_name_snapshot?: string | null;
  is_verified: boolean;
  final_position?: number | null;
  matches_played: number;
  matches_won: number;
  matches_drawn: number;
  matches_lost: number;
  total_points: number;
  verified_matches_count: number;
  unverified_matches_count: number;
  created_at: string;
  updated_at: string;
}

export interface VerificationBreakdown {
  total: number;
  verified: number;
  unverified: number;
  disputed: number;
  voided: number;
  verified_rate_pct: number;
}

export interface CrossCompetitionAnalyticsFilter {
  organizationId?: string | null;
  ownerId?: string | null;
  competitionType?: CompetitionType | null;
  templateKey?: CompetitionTemplateKey | null;
  seasonId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  isVerifiedOnly?: boolean;
  page?: number;
  pageSize?: number;
}

export interface OrganizerAnalyticsOverview {
  total_competitions: number;
  active_competitions: number;
  completed_competitions: number;
  total_seasons: number;
  total_unique_participants: number;
  total_teams: number;
  total_venues: number;
  match_verification: VerificationBreakdown;
  by_category: Record<string, number>;
  by_template: Record<string, number>;
  venues_utilization: Array<{
    venue_id: string;
    venue_name: string;
    court_field?: string | null;
    competitions_count: number;
    total_matches_scheduled: number;
    completed_matches: number;
  }>;
  recent_competitions: Array<{
    id: string;
    name: string;
    slug: string;
    competition_type: CompetitionType;
    status: LeaderboardStatus;
    is_verified: boolean;
    participants_count: number;
    matches_count: number;
    verified_matches_count: number;
    created_at: string;
  }>;
}

export interface TeamCrossCompetitionSummary {
  team_id: string;
  canonical_team_id?: string | null;
  current_name: string;
  short_code?: string | null;
  logo_url?: string | null;
  name_history: TeamNameHistoryEntry[];
  competitions_participated: Array<{
    leaderboard_id: string;
    competition_name: string;
    season_name?: string | null;
    team_name_in_competition: string;
    position?: number | null;
    matches_played: number;
    wins: number;
    draws: number;
    losses: number;
    points: number;
    is_verified: boolean;
  }>;
  aggregate_record: {
    competitions_count: number;
    total_matches: number;
    wins: number;
    draws: number;
    losses: number;
    win_rate_pct: number;
    podiums_count: number;
    verified_matches_count: number;
    unverified_matches_count: number;
  };
  roster_transitions: Array<{
    member_id: string;
    player_name: string;
    role: string;
    jersey_number?: number | null;
    joined_at: string;
    left_at?: string | null;
    competition_name: string;
  }>;
}

export interface ParticipantCrossCompetitionSummary {
  user_id?: string | null;
  passport_handle?: string | null;
  display_name: string;
  avatar_url?: string | null;
  is_identity_verified: boolean;
  participations: Array<{
    competition_id: string;
    competition_name: string;
    season_name?: string | null;
    team_name_snapshot?: string | null;
    position?: number | null;
    matches_played: number;
    matches_won: number;
    total_points: number;
    is_verified: boolean;
  }>;
  career_stats: {
    competitions_entered: number;
    total_matches: number;
    verified_matches: number;
    unverified_matches: number;
    wins: number;
    podiums: number;
    total_points: number;
  };
  team_affiliations: Array<{
    team_name: string;
    competition_name: string;
    role: string;
    joined_at: string;
    left_at?: string | null;
  }>;
}

export interface CrossCompetitionSeasonSummary {
  season_id: string;
  season_name: string;
  leaderboard_id: string;
  competition_name: string;
  start_date: string;
  end_date?: string | null;
  teams_count: number;
  participants_count: number;
  fixtures_total: number;
  fixtures_completed: number;
  fixtures_verified: number;
  completion_rate_pct: number;
}

export interface ExternalScoringConnectorConfig {
  id: string;
  name: string;
  target_system: 'manual_webhook' | 'scorekeeper_api' | 'electronic_scoreboard' | 'generic_push';
  api_endpoint?: string | null;
  webhook_secret_hash?: string | null;
  status: 'active' | 'paused' | 'deprecated';
  allowed_leaderboard_ids: string[];
  supported_match_types: string[];
  created_at: string;
}

