export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export type CompetitionType = 'custom' | 'sports' | 'gaming' | 'reading' | 'fitness' | 'workplace' | 'education';
export type VisibilityType = 'public' | 'private';
export type LeaderboardStatus = 'active' | 'archived';

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
