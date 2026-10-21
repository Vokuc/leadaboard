-- Migration: 202610280001_achievements_and_ratings.sql
-- Description: Reusable Achievement Definitions, Award Records, Pluggable Competition Ratings & Audit History

-- ============================================================================
-- 1. ACHIEVEMENT DEFINITIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.achievement_definitions (
  id TEXT PRIMARY KEY, -- Slug / identifier e.g. 'first_win', 'champion', 'win_streak_3'
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('participation', 'victory', 'streak', 'milestone', 'mastery')),
  badge_icon TEXT NOT NULL DEFAULT 'trophy',
  badge_color TEXT NOT NULL DEFAULT '#8b5cf6',
  rarity TEXT NOT NULL CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')) DEFAULT 'common',
  points_reward INTEGER NOT NULL DEFAULT 10,
  criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_achievement_definitions_category ON public.achievement_definitions(category);
CREATE INDEX IF NOT EXISTS idx_achievement_definitions_rarity ON public.achievement_definitions(rarity);

-- ============================================================================
-- 2. PARTICIPANT ACHIEVEMENTS (AWARDS) TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.participant_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  achievement_id TEXT NOT NULL REFERENCES public.achievement_definitions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  member_id UUID REFERENCES public.leaderboard_members(id) ON DELETE SET NULL,
  leaderboard_id UUID REFERENCES public.leaderboards(id) ON DELETE SET NULL,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_revoked BOOLEAN NOT NULL DEFAULT false,
  revoked_at TIMESTAMPTZ,
  revocation_reason TEXT,
  revocation_audit_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_participant_achievements_user ON public.participant_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_participant_achievements_achievement ON public.participant_achievements(achievement_id);
CREATE INDEX IF NOT EXISTS idx_participant_achievements_leaderboard ON public.participant_achievements(leaderboard_id);

-- Idempotency constraint: Prevent awarding the same achievement twice to a user in the same competition context
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_user_achievement
  ON public.participant_achievements(achievement_id, user_id, COALESCE(leaderboard_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE is_revoked = false;

-- ============================================================================
-- 3. COMPETITION RATINGS (CURRENT SNAPSHOT) TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.competition_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('individual', 'team')),
  entity_id TEXT NOT NULL, -- user_id (individual) or team_id (team)
  scope_key TEXT NOT NULL, -- Deterministic scope key e.g. 'gaming:chess:all_time:global:individual'
  competition_type TEXT NOT NULL,
  game_type TEXT,
  season_id UUID REFERENCES public.seasons(id) ON DELETE CASCADE,
  region TEXT DEFAULT 'global',
  rating_system TEXT NOT NULL DEFAULT 'elo' CHECK (rating_system IN ('elo', 'glicko2')),
  current_rating INTEGER NOT NULL DEFAULT 1200,
  peak_rating INTEGER NOT NULL DEFAULT 1200,
  lowest_rating INTEGER NOT NULL DEFAULT 1200,
  matches_played INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  last_match_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entity_type, entity_id, scope_key)
);

CREATE INDEX IF NOT EXISTS idx_ratings_entity ON public.competition_ratings(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ratings_scope ON public.competition_ratings(scope_key);
CREATE INDEX IF NOT EXISTS idx_ratings_leaderboard_order ON public.competition_ratings(scope_key, current_rating DESC);

-- ============================================================================
-- 4. RATING HISTORY & AUDIT TRAIL TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.rating_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rating_id UUID REFERENCES public.competition_ratings(id) ON DELETE CASCADE,
  scope_key TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('individual', 'team')),
  entity_id TEXT NOT NULL,
  opponent_id TEXT,
  leaderboard_id UUID NOT NULL REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  match_id TEXT NOT NULL, -- tournament_match ID or fixture ID
  previous_rating INTEGER NOT NULL,
  new_rating INTEGER NOT NULL,
  rating_change INTEGER NOT NULL,
  k_factor INTEGER NOT NULL,
  expected_score NUMERIC(5, 4) NOT NULL,
  actual_score NUMERIC(3, 2) NOT NULL, -- 1.0 (win), 0.5 (draw), 0.0 (loss)
  is_verified BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL CHECK (status IN ('applied', 'rolled_back', 'recalculated')) DEFAULT 'applied',
  reason TEXT,
  reversal_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(scope_key, match_id, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_rating_history_entity ON public.rating_history(entity_id);
CREATE INDEX IF NOT EXISTS idx_rating_history_match ON public.rating_history(match_id);
CREATE INDEX IF NOT EXISTS idx_rating_history_scope ON public.rating_history(scope_key);
CREATE INDEX IF NOT EXISTS idx_rating_history_rating ON public.rating_history(rating_id);

-- ============================================================================
-- 5. ROW LEVEL SECURITY POLICIES
-- ============================================================================
ALTER TABLE public.achievement_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participant_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rating_history ENABLE ROW LEVEL SECURITY;

-- Achievement Definitions Policies
DROP POLICY IF EXISTS "Public can view active achievement definitions" ON public.achievement_definitions;
CREATE POLICY "Public can view active achievement definitions"
  ON public.achievement_definitions FOR SELECT
  USING (is_active = true);

-- Participant Achievements Policies
DROP POLICY IF EXISTS "Public can view non-revoked achievements" ON public.participant_achievements;
CREATE POLICY "Public can view non-revoked achievements"
  ON public.participant_achievements FOR SELECT
  USING (is_revoked = false OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Users or system can insert achievements" ON public.participant_achievements;
CREATE POLICY "Users or system can insert achievements"
  ON public.participant_achievements FOR INSERT
  WITH CHECK (auth.uid() = user_id OR auth.uid() IS NOT NULL);

-- Competition Ratings Policies
DROP POLICY IF EXISTS "Public can view competition ratings" ON public.competition_ratings;
CREATE POLICY "Public can view competition ratings"
  ON public.competition_ratings FOR SELECT
  USING (true);

-- Rating History Policies
DROP POLICY IF EXISTS "Public can view rating history" ON public.rating_history;
CREATE POLICY "Public can view rating history"
  ON public.rating_history FOR SELECT
  USING (true);

-- ============================================================================
-- 6. DEFAULT INITIAL SEEDED ACHIEVEMENTS
-- ============================================================================
INSERT INTO public.achievement_definitions (id, name, description, category, badge_icon, badge_color, rarity, points_reward, criteria)
VALUES
  ('first_competition', 'Debutant', 'Completed your first competitive tournament or league match.', 'participation', 'award', '#38bdf8', 'common', 10, '{"type": "first_competition"}'::jsonb),
  ('first_win', 'First Blood', 'Claimed your first victory in official or community competition.', 'victory', 'trophy', '#10b981', 'common', 15, '{"type": "first_win"}'::jsonb),
  ('champion', 'Undisputed Champion', 'Finished in 1st place in an official competition or tournament.', 'mastery', 'crown', '#f59e0b', 'legendary', 100, '{"type": "champion"}'::jsonb),
  ('win_streak_3', 'On Fire', 'Won 3 competitive matches in a row.', 'streak', 'flame', '#ec4899', 'rare', 30, '{"type": "win_streak", "min_streak": 3}'::jsonb),
  ('win_streak_5', 'Unstoppable', 'Won 5 competitive matches in a row.', 'streak', 'zap', '#8b5cf6', 'epic', 60, '{"type": "win_streak", "min_streak": 5}'::jsonb),
  ('matches_10', 'Veteran Contender', 'Competed in 10 or more competitive matches.', 'milestone', 'shield', '#6366f1', 'uncommon', 25, '{"type": "matches_count", "min_matches": 10}'::jsonb),
  ('matches_25', 'Seasoned Gladiator', 'Competed in 25 or more competitive matches.', 'milestone', 'star', '#d946ef', 'rare', 50, '{"type": "matches_count", "min_matches": 25}'::jsonb),
  ('competitions_5', 'Cross-Arena Veteran', 'Competed across 5 or more distinct competitions.', 'milestone', 'globe', '#06b6d4', 'epic', 75, '{"type": "competitions_count", "min_competitions": 5}'::jsonb),
  ('clean_sheet', 'Iron Defense', 'Won a match while conceding zero points or goals.', 'mastery', 'shield-check', '#14b8a6', 'rare', 35, '{"type": "clean_sheet"}'::jsonb),
  ('podium_triple', 'Podium Regular', 'Finished in the top 3 on the podium in 3 distinct competitions.', 'mastery', 'medal', '#eab308', 'epic', 80, '{"type": "podium_count", "min_podiums": 3}'::jsonb)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  badge_icon = EXCLUDED.badge_icon,
  badge_color = EXCLUDED.badge_color,
  rarity = EXCLUDED.rarity,
  points_reward = EXCLUDED.points_reward,
  criteria = EXCLUDED.criteria,
  updated_at = NOW();
