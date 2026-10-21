-- ==========================================
-- LEAGUEBOARD DATABASE SCHEMA (SUPABASE POSTGRES)
-- ==========================================

-- Enable UUID extension if not already active
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles Table (Extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin', 'billing_admin', 'super_admin')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to automatically create a profile when a new user signs up via auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
    updated_at = NOW();
  RETURN new;
END;
$$;

-- Safe trigger setup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Leaderboards Table
CREATE TABLE IF NOT EXISTS public.leaderboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  slug TEXT UNIQUE NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  competition_type TEXT NOT NULL DEFAULT 'custom' CHECK (competition_type IN ('custom', 'sports', 'gaming', 'reading', 'fitness', 'workplace', 'education')),
  cover_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Seasons Table
CREATE TABLE IF NOT EXISTS public.seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_id UUID NOT NULL REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ, -- Null means runs indefinitely
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Scoring Rules Table
CREATE TABLE IF NOT EXISTS public.scoring_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_id UUID NOT NULL REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  points DOUBLE PRECISION NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Leaderboard Members (Players in the leaderboard)
CREATE TABLE IF NOT EXISTS public.leaderboard_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_id UUID NOT NULL REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  avatar_url TEXT,
  team TEXT,
  team_id UUID,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(leaderboard_id, name)
);

-- 5b. Teams Table
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_id UUID NOT NULL REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  short_code TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (leaderboard_id, name)
);

ALTER TABLE public.leaderboard_members
  DROP CONSTRAINT IF EXISTS fk_leaderboard_members_team_id;
ALTER TABLE public.leaderboard_members
  ADD CONSTRAINT fk_leaderboard_members_team_id
  FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL;

-- 5c. Team Members (Rosters) Table
CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  leaderboard_id UUID NOT NULL REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.leaderboard_members(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('captain', 'player', 'substitute')) DEFAULT 'player',
  jersey_number INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (leaderboard_id, member_id),
  UNIQUE (team_id, member_id)
);

-- 6. Score Events (Score updates log)
CREATE TABLE IF NOT EXISTS public.score_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_id UUID NOT NULL REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.leaderboard_members(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES public.scoring_rules(id) ON DELETE SET NULL, -- Null if custom point adjustment
  points DOUBLE PRECISION NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Activity Logs
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_id UUID NOT NULL REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Competition engine configuration
CREATE TABLE IF NOT EXISTS public.competition_configs (
  leaderboard_id UUID PRIMARY KEY REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  engine_type TEXT NOT NULL CHECK (engine_type IN ('simple_points', 'league_table', 'tournament')) DEFAULT 'simple_points',
  template_key TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('individual', 'team')) DEFAULT 'team',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.competition_configs DROP CONSTRAINT IF EXISTS competition_configs_engine_type_check;
ALTER TABLE public.competition_configs
  ADD CONSTRAINT competition_configs_engine_type_check
  CHECK (engine_type IN ('simple_points', 'league_table', 'tournament'));

-- 9. Central statistics registry
CREATE TABLE IF NOT EXISTS public.statistics_registry (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('input', 'derived')),
  calculation_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Reusable template registry
CREATE TABLE IF NOT EXISTS public.competition_templates (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT NOT NULL,
  competition_type TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('individual', 'team')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Competition statistic configuration per leaderboard
CREATE TABLE IF NOT EXISTS public.competition_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_id UUID NOT NULL REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  statistic_key TEXT NOT NULL REFERENCES public.statistics_registry(key) ON DELETE CASCADE,
  label TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('input', 'derived')),
  calculation_type TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (leaderboard_id, statistic_key)
);

-- 12. Stored input statistic values per competitor/team
CREATE TABLE IF NOT EXISTS public.competition_stat_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_id UUID NOT NULL REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.leaderboard_members(id) ON DELETE CASCADE,
  statistic_key TEXT NOT NULL REFERENCES public.statistics_registry(key) ON DELETE CASCADE,
  value DOUBLE PRECISION NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (leaderboard_id, member_id, statistic_key)
);

-- 13. Ranking configuration for league standings
CREATE TABLE IF NOT EXISTS public.competition_ranking_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_id UUID NOT NULL REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  criterion_type TEXT NOT NULL CHECK (criterion_type IN ('statistic', 'alphabetical')),
  statistic_key TEXT REFERENCES public.statistics_registry(key) ON DELETE CASCADE,
  label TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('asc', 'desc')) DEFAULT 'desc',
  priority INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (leaderboard_id, priority)
);

-- 14. League specific settings
CREATE TABLE IF NOT EXISTS public.league_settings (
  leaderboard_id UUID PRIMARY KEY REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  season_name TEXT NOT NULL,
  points_for_win DOUBLE PRECISION NOT NULL DEFAULT 3,
  points_for_draw DOUBLE PRECISION NOT NULL DEFAULT 1,
  points_for_loss DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. Fixtures
CREATE TABLE IF NOT EXISTS public.fixtures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_id UUID NOT NULL REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  home_member_id UUID NOT NULL REFERENCES public.leaderboard_members(id) ON DELETE CASCADE,
  away_member_id UUID NOT NULL REFERENCES public.leaderboard_members(id) ON DELETE CASCADE,
  round_name TEXT,
  scheduled_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (home_member_id <> away_member_id)
);

-- 16. Fixture results
CREATE TABLE IF NOT EXISTS public.fixture_results (
  fixture_id UUID PRIMARY KEY REFERENCES public.fixtures(id) ON DELETE CASCADE,
  home_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  away_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 17. Tournament settings and state
CREATE TABLE IF NOT EXISTS public.tournaments (
  leaderboard_id UUID PRIMARY KEY REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  format TEXT NOT NULL CHECK (format IN ('single_elimination')) DEFAULT 'single_elimination',
  bracket_size INTEGER NOT NULL CHECK (bracket_size IN (2, 4, 8, 16, 32, 64, 128)),
  seeding_mode TEXT NOT NULL CHECK (seeding_mode IN ('random', 'manual', 'league_standings')) DEFAULT 'random',
  state TEXT NOT NULL CHECK (state IN ('draft', 'registration_open', 'in_progress', 'completed', 'cancelled')) DEFAULT 'draft',
  season_name TEXT NOT NULL,
  template_key TEXT NOT NULL REFERENCES public.competition_templates(key),
  champion_member_id UUID REFERENCES public.leaderboard_members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 18. Tournament rounds
CREATE TABLE IF NOT EXISTS public.tournament_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_id UUID NOT NULL REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  round_index INTEGER NOT NULL CHECK (round_index >= 1),
  round_name TEXT NOT NULL,
  match_count INTEGER NOT NULL CHECK (match_count >= 1),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (leaderboard_id, round_index)
);

-- 19. Tournament matches
CREATE TABLE IF NOT EXISTS public.tournament_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_id UUID NOT NULL REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  round_id UUID NOT NULL REFERENCES public.tournament_rounds(id) ON DELETE CASCADE,
  round_index INTEGER NOT NULL CHECK (round_index >= 1),
  match_index INTEGER NOT NULL CHECK (match_index >= 1),
  home_member_id UUID REFERENCES public.leaderboard_members(id) ON DELETE SET NULL,
  away_member_id UUID REFERENCES public.leaderboard_members(id) ON DELETE SET NULL,
  winner_member_id UUID REFERENCES public.leaderboard_members(id) ON DELETE SET NULL,
  loser_member_id UUID REFERENCES public.leaderboard_members(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ,
  state TEXT NOT NULL CHECK (state IN ('scheduled', 'live', 'completed', 'cancelled', 'walkover', 'bye')) DEFAULT 'scheduled',
  next_match_id UUID REFERENCES public.tournament_matches(id) ON DELETE SET NULL,
  next_match_slot TEXT CHECK (next_match_slot IN ('home', 'away')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (leaderboard_id, round_index, match_index)
);

-- 20. Tournament match results
CREATE TABLE IF NOT EXISTS public.tournament_match_results (
  match_id UUID PRIMARY KEY REFERENCES public.tournament_matches(id) ON DELETE CASCADE,
  home_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  away_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 21. Tournament advancement audit log
CREATE TABLE IF NOT EXISTS public.tournament_advancements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_id UUID NOT NULL REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  from_match_id UUID NOT NULL REFERENCES public.tournament_matches(id) ON DELETE CASCADE,
  to_match_id UUID NOT NULL REFERENCES public.tournament_matches(id) ON DELETE CASCADE,
  to_slot TEXT NOT NULL CHECK (to_slot IN ('home', 'away')),
  advanced_member_id UUID NOT NULL REFERENCES public.leaderboard_members(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('win', 'bye', 'walkover')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tournaments_state ON public.tournaments(state);
CREATE INDEX IF NOT EXISTS idx_tournament_rounds_leaderboard ON public.tournament_rounds(leaderboard_id, round_index);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_leaderboard_round ON public.tournament_matches(leaderboard_id, round_index, match_index);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_next_match ON public.tournament_matches(next_match_id);
CREATE INDEX IF NOT EXISTS idx_tournament_advancements_leaderboard ON public.tournament_advancements(leaderboard_id, created_at DESC);

INSERT INTO public.statistics_registry (key, label, category, calculation_type)
VALUES
  ('points', 'Points', 'input', NULL),
  ('wins', 'Wins', 'input', NULL),
  ('draws', 'Draws', 'input', NULL),
  ('losses', 'Losses', 'input', NULL),
  ('goals_for', 'Goals For', 'input', NULL),
  ('goals_against', 'Goals Against', 'input', NULL),
  ('points_scored', 'Points Scored', 'input', NULL),
  ('points_allowed', 'Points Allowed', 'input', NULL),
  ('sets_won', 'Sets Won', 'input', NULL),
  ('sets_lost', 'Sets Lost', 'input', NULL),
  ('kills', 'Kills', 'input', NULL),
  ('deaths', 'Deaths', 'input', NULL),
  ('runs', 'Runs', 'input', NULL),
  ('runs_allowed', 'Runs Allowed', 'input', NULL),
  ('frames_won', 'Frames Won', 'input', NULL),
  ('frames_lost', 'Frames Lost', 'input', NULL),
  ('played', 'Played', 'derived', 'played'),
  ('goal_difference', 'Goal Difference', 'derived', 'goal_difference'),
  ('point_difference', 'Point Difference', 'derived', 'point_difference'),
  ('set_difference', 'Set Difference', 'derived', 'set_difference'),
  ('win_percentage', 'Win Percentage', 'derived', 'win_percentage'),
  ('average_points', 'Average Points', 'derived', 'average_points'),
  ('kill_death_ratio', 'Kill/Death Ratio', 'derived', 'kill_death_ratio')
ON CONFLICT (key) DO UPDATE
SET
  label = EXCLUDED.label,
  category = EXCLUDED.category,
  calculation_type = EXCLUDED.calculation_type;

INSERT INTO public.competition_templates (key, label, description, competition_type, entity_type)
VALUES
  ('football', 'Football', 'Classic league table with goal statistics and draw support.', 'sports', 'team'),
  ('basketball', 'Basketball', 'Win percentage and scoring difference standings.', 'sports', 'team'),
  ('volleyball', 'Volleyball', 'Set based standings with set difference.', 'sports', 'team'),
  ('cricket', 'Cricket', 'League points with run totals and draw support.', 'sports', 'team'),
  ('rugby', 'Rugby', 'Team standings with scoring difference.', 'sports', 'team'),
  ('baseball', 'Baseball', 'Run difference and win percentage table.', 'sports', 'team'),
  ('hockey', 'Hockey', 'Goal difference standings for hockey leagues.', 'sports', 'team'),
  ('table_tennis', 'Table Tennis', 'Set based standings for players or doubles.', 'sports', 'individual'),
  ('tennis', 'Tennis', 'Set based standings for tennis ladders.', 'sports', 'individual'),
  ('chess', 'Chess', 'Individual standings with draws and points.', 'education', 'individual'),
  ('esports', 'Esports', 'League table with wins and kill/death ratio.', 'gaming', 'team'),
  ('racing', 'Racing', 'Season standings for race events.', 'sports', 'individual'),
  ('swimming', 'Swimming', 'Meet standings for swimmers.', 'fitness', 'individual'),
  ('athletics', 'Athletics', 'Track and field season standings.', 'fitness', 'individual'),
  ('custom', 'Custom', 'Flexible competition template with editable columns and ranking rules.', 'custom', 'team')
ON CONFLICT (key) DO UPDATE
SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  competition_type = EXCLUDED.competition_type,
  entity_type = EXCLUDED.entity_type;

-- Trigger to automatically create activity log entry on score events
CREATE OR REPLACE FUNCTION public.log_score_event()
RETURNS TRIGGER AS $$
DECLARE
  p_name TEXT;
  msg TEXT;
  pts_str TEXT;
BEGIN
  SELECT name INTO p_name FROM public.leaderboard_members WHERE id = NEW.member_id;
  IF NEW.points >= 0 THEN
    pts_str := '+' || NEW.points::text;
  ELSE
    pts_str := NEW.points::text;
  END IF;
  msg := p_name || ' score adjusted by ' || pts_str || ' points: ' || NEW.reason;
  
  INSERT INTO public.activity_logs (leaderboard_id, message, created_at)
  VALUES (NEW.leaderboard_id, msg, NEW.created_at);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Safe trigger setup for logs
DROP TRIGGER IF EXISTS on_score_event_added ON public.score_events;
CREATE TRIGGER on_score_event_added
  AFTER INSERT ON public.score_events
  FOR EACH ROW EXECUTE FUNCTION public.log_score_event();


-- ==========================================
-- STORAGE SETUP (SUPABASE BUCKETS)
-- ==========================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'leaderboard-media',
  'leaderboard-media',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Authenticated users can upload leaderboard media" ON storage.objects;
CREATE POLICY "Authenticated users can upload leaderboard media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'leaderboard-media'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  );

DROP POLICY IF EXISTS "Authenticated users can update leaderboard media" ON storage.objects;
CREATE POLICY "Authenticated users can update leaderboard media" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'leaderboard-media'
    AND owner_id = (SELECT auth.uid()::text)
  )
  WITH CHECK (
    bucket_id = 'leaderboard-media'
    AND owner_id = (SELECT auth.uid()::text)
  );

DROP POLICY IF EXISTS "Authenticated users can delete leaderboard media" ON storage.objects;
CREATE POLICY "Authenticated users can delete leaderboard media" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'leaderboard-media'
    AND owner_id = (SELECT auth.uid()::text)
  );

-- ==========================================
-- LEADERBOARD DYNAMIC RANKING VIEW
-- ==========================================
-- Dynamic Rankings incorporating Tie-Breaker logic:
-- 1. Order by points descending (COALESCE to 0 if no score events)
-- 2. Tie-breaker: Whomever reached their current score earlier wins (MAX(se.created_at) ascending)
-- 3. If no score events, fallback to the member creation date (earliest join wins)
-- ==========================================

CREATE OR REPLACE VIEW public.leaderboard_rankings AS
SELECT 
  m.id as member_id,
  m.leaderboard_id,
  m.name as player_name,
  m.email as player_email,
  m.avatar_url,
  m.team,
  m.notes,
  m.is_active,
  COALESCE(SUM(se.points), 0) as total_points,
  COALESCE(MAX(se.created_at), m.created_at) as last_score_at,
  m.created_at as joined_at
FROM public.leaderboard_members m
LEFT JOIN public.score_events se ON m.id = se.member_id
GROUP BY m.id, m.leaderboard_id, m.name, m.email, m.avatar_url, m.team, m.notes, m.is_active, m.created_at;-- ==========================================
-- LEADERBOARD ADMINS & PERMISSIONS
-- ==========================================

CREATE TABLE IF NOT EXISTS public.leaderboard_admins (
  leaderboard_id UUID NOT NULL REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (leaderboard_id, user_id)
);

CREATE OR REPLACE FUNCTION public.can_manage_leaderboard(p_leaderboard_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM leaderboards l
    WHERE l.id = p_leaderboard_id AND l.owner_id = p_user_id
  ) OR EXISTS (
    SELECT 1 FROM leaderboard_admins la
    WHERE la.leaderboard_id = p_leaderboard_id AND la.user_id = p_user_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.can_view_leaderboard(p_leaderboard_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM leaderboards l
    WHERE l.id = p_leaderboard_id 
      AND (l.visibility = 'public' OR l.owner_id = p_user_id)
  ) OR EXISTS (
    SELECT 1 FROM leaderboard_admins la
    WHERE la.leaderboard_id = p_leaderboard_id AND la.user_id = p_user_id
  );
END;
$$;


-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scoring_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.score_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statistics_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_stat_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_ranking_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixtures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixture_results ENABLE ROW LEVEL SECURITY;

-- 1. Profiles Policies
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- 2. Leaderboards Policies
CREATE POLICY "Anyone can view public leaderboards" ON public.leaderboards
  FOR SELECT USING (public.can_view_leaderboard(id, auth.uid()));

CREATE POLICY "Owners can insert leaderboards" ON public.leaderboards
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners and admins can update leaderboards" ON public.leaderboards
  FOR UPDATE USING (public.can_manage_leaderboard(id, auth.uid()));

CREATE POLICY "Owners can delete their own leaderboards" ON public.leaderboards
  FOR DELETE USING (auth.uid() = owner_id);

-- 3. Leaderboard Admins Policies
CREATE POLICY "Anyone can view leaderboard admins" ON public.leaderboard_admins
  FOR SELECT USING (public.can_view_leaderboard(leaderboard_id, auth.uid()));

CREATE POLICY "Owners can manage leaderboard admins" ON public.leaderboard_admins
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards l 
      WHERE l.id = leaderboard_id AND auth.uid() = l.owner_id
    )
  );

-- 4. Seasons Policies
CREATE POLICY "Anyone can select seasons for accessible leaderboards" ON public.seasons
  FOR SELECT USING (public.can_view_leaderboard(leaderboard_id, auth.uid()));

CREATE POLICY "Owners and admins can manage seasons" ON public.seasons
  FOR ALL USING (public.can_manage_leaderboard(leaderboard_id, auth.uid()));

-- 5. Scoring Rules Policies
CREATE POLICY "Anyone can view scoring rules for accessible leaderboards" ON public.scoring_rules
  FOR SELECT USING (public.can_view_leaderboard(leaderboard_id, auth.uid()));

CREATE POLICY "Owners and admins can manage scoring rules" ON public.scoring_rules
  FOR ALL USING (public.can_manage_leaderboard(leaderboard_id, auth.uid()));

-- 6. Leaderboard Members Policies
CREATE POLICY "Anyone can view leaderboard members for accessible leaderboards" ON public.leaderboard_members
  FOR SELECT USING (public.can_view_leaderboard(leaderboard_id, auth.uid()));

CREATE POLICY "Owners and admins can manage leaderboard members" ON public.leaderboard_members
  FOR ALL USING (public.can_manage_leaderboard(leaderboard_id, auth.uid()));

-- 7. Competition config policies
CREATE POLICY "Anyone can view competition config for accessible leaderboards" ON public.competition_configs
  FOR SELECT USING (public.can_view_leaderboard(leaderboard_id, auth.uid()));

CREATE POLICY "Owners and admins can manage competition config" ON public.competition_configs
  FOR ALL USING (public.can_manage_leaderboard(leaderboard_id, auth.uid()));

-- 8. Registry policies
CREATE POLICY "Anyone can read statistics registry" ON public.statistics_registry
  FOR SELECT USING (true);

CREATE POLICY "Anyone can read competition templates" ON public.competition_templates
  FOR SELECT USING (true);

-- 9. League statistic/ranking/fixture policies
CREATE POLICY "Anyone can read competition statistics" ON public.competition_statistics
  FOR SELECT USING (public.can_view_leaderboard(leaderboard_id, auth.uid()));

CREATE POLICY "Owners and admins can manage competition statistics" ON public.competition_statistics
  FOR ALL USING (public.can_manage_leaderboard(leaderboard_id, auth.uid()));

CREATE POLICY "Anyone can read competition stat values" ON public.competition_stat_values
  FOR SELECT USING (public.can_view_leaderboard(leaderboard_id, auth.uid()));

CREATE POLICY "Owners and admins can manage competition stat values" ON public.competition_stat_values
  FOR ALL USING (public.can_manage_leaderboard(leaderboard_id, auth.uid()));

CREATE POLICY "Anyone can read ranking rules" ON public.competition_ranking_rules
  FOR SELECT USING (public.can_view_leaderboard(leaderboard_id, auth.uid()));

CREATE POLICY "Owners and admins can manage ranking rules" ON public.competition_ranking_rules
  FOR ALL USING (public.can_manage_leaderboard(leaderboard_id, auth.uid()));

CREATE POLICY "Anyone can read league settings" ON public.league_settings
  FOR SELECT USING (public.can_view_leaderboard(leaderboard_id, auth.uid()));

CREATE POLICY "Owners and admins can manage league settings" ON public.league_settings
  FOR ALL USING (public.can_manage_leaderboard(leaderboard_id, auth.uid()));

CREATE POLICY "Anyone can read fixtures" ON public.fixtures
  FOR SELECT USING (public.can_view_leaderboard(leaderboard_id, auth.uid()));

CREATE POLICY "Owners and admins can manage fixtures" ON public.fixtures
  FOR ALL USING (public.can_manage_leaderboard(leaderboard_id, auth.uid()));

CREATE POLICY "Anyone can read fixture results" ON public.fixture_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.fixtures f
      WHERE f.id = fixture_id AND public.can_view_leaderboard(f.leaderboard_id, auth.uid())
    )
  );

CREATE POLICY "Owners and admins can manage fixture results" ON public.fixture_results
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.fixtures f
      WHERE f.id = fixture_id AND public.can_manage_leaderboard(f.leaderboard_id, auth.uid())
    )
  );

-- 10. Score Events Policies
CREATE POLICY "Anyone can view score events for accessible leaderboards" ON public.score_events
  FOR SELECT USING (public.can_view_leaderboard(leaderboard_id, auth.uid()));

CREATE POLICY "Owners and admins can manage score events" ON public.score_events
  FOR ALL USING (public.can_manage_leaderboard(leaderboard_id, auth.uid()));

-- 11. Activity Logs Policies
CREATE POLICY "Anyone can view activity logs for accessible leaderboards" ON public.activity_logs
  FOR SELECT USING (public.can_view_leaderboard(leaderboard_id, auth.uid()));

CREATE POLICY "Owners and admins can manage activity logs" ON public.activity_logs
  FOR ALL USING (public.can_manage_leaderboard(leaderboard_id, auth.uid()));

-- 12. Tournament policies
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_match_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_advancements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read tournaments" ON public.tournaments;
CREATE POLICY "Anyone can read tournaments" ON public.tournaments
  FOR SELECT USING (public.can_view_leaderboard(leaderboard_id, auth.uid()));

DROP POLICY IF EXISTS "Owners can manage tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Owners and admins can manage tournaments" ON public.tournaments;
CREATE POLICY "Owners and admins can manage tournaments" ON public.tournaments
  FOR ALL USING (public.can_manage_leaderboard(leaderboard_id, auth.uid()));

DROP POLICY IF EXISTS "Anyone can read tournament rounds" ON public.tournament_rounds;
CREATE POLICY "Anyone can read tournament rounds" ON public.tournament_rounds
  FOR SELECT USING (public.can_view_leaderboard(leaderboard_id, auth.uid()));

DROP POLICY IF EXISTS "Owners can manage tournament rounds" ON public.tournament_rounds;
DROP POLICY IF EXISTS "Owners and admins can manage tournament rounds" ON public.tournament_rounds;
CREATE POLICY "Owners and admins can manage tournament rounds" ON public.tournament_rounds
  FOR ALL USING (public.can_manage_leaderboard(leaderboard_id, auth.uid()));

DROP POLICY IF EXISTS "Anyone can read tournament matches" ON public.tournament_matches;
CREATE POLICY "Anyone can read tournament matches" ON public.tournament_matches
  FOR SELECT USING (public.can_view_leaderboard(leaderboard_id, auth.uid()));

DROP POLICY IF EXISTS "Owners can manage tournament matches" ON public.tournament_matches;
DROP POLICY IF EXISTS "Owners and admins can manage tournament matches" ON public.tournament_matches;
CREATE POLICY "Owners and admins can manage tournament matches" ON public.tournament_matches
  FOR ALL USING (public.can_manage_leaderboard(leaderboard_id, auth.uid()));

DROP POLICY IF EXISTS "Anyone can read tournament match results" ON public.tournament_match_results;
CREATE POLICY "Anyone can read tournament match results" ON public.tournament_match_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.tournament_matches tm
      WHERE tm.id = match_id AND public.can_view_leaderboard(tm.leaderboard_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Owners can manage tournament match results" ON public.tournament_match_results;
DROP POLICY IF EXISTS "Owners and admins can manage tournament match results" ON public.tournament_match_results;
CREATE POLICY "Owners and admins can manage tournament match results" ON public.tournament_match_results
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.tournament_matches tm
      WHERE tm.id = match_id AND public.can_manage_leaderboard(tm.leaderboard_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Anyone can read tournament advancements" ON public.tournament_advancements;
CREATE POLICY "Anyone can read tournament advancements" ON public.tournament_advancements
  FOR SELECT USING (public.can_view_leaderboard(leaderboard_id, auth.uid()));

DROP POLICY IF EXISTS "Owners can manage tournament advancements" ON public.tournament_advancements;
DROP POLICY IF EXISTS "Owners and admins can manage tournament advancements" ON public.tournament_advancements;
CREATE POLICY "Owners and admins can manage tournament advancements" ON public.tournament_advancements
  FOR ALL USING (public.can_manage_leaderboard(leaderboard_id, auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_match_results;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fixtures;
ALTER PUBLICATION supabase_realtime ADD TABLE public.fixture_results;
ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.competition_rules;

-- Teams and Team Members Policies
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view teams for accessible leaderboards" ON public.teams;
CREATE POLICY "Anyone can view teams for accessible leaderboards" ON public.teams
  FOR SELECT USING (public.can_view_leaderboard(leaderboard_id, auth.uid()));

DROP POLICY IF EXISTS "Owners and admins can manage teams" ON public.teams;
CREATE POLICY "Owners and admins can manage teams" ON public.teams
  FOR ALL USING (public.can_manage_leaderboard(leaderboard_id, auth.uid()));

DROP POLICY IF EXISTS "Anyone can view team members for accessible leaderboards" ON public.team_members;
CREATE POLICY "Anyone can view team members for accessible leaderboards" ON public.team_members
  FOR SELECT USING (public.can_view_leaderboard(leaderboard_id, auth.uid()));

DROP POLICY IF EXISTS "Owners and admins can manage team members" ON public.team_members;
CREATE POLICY "Owners and admins can manage team members" ON public.team_members
  FOR ALL USING (public.can_manage_leaderboard(leaderboard_id, auth.uid()));

-- Competition Rules Table and Policies
CREATE TABLE IF NOT EXISTS public.competition_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_id UUID NOT NULL REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  engine TEXT NOT NULL CHECK (engine IN ('simple_points', 'league_table', 'tournament')),
  ranking_order TEXT NOT NULL DEFAULT 'desc' CHECK (ranking_order IN ('asc', 'desc')),
  primary_metric TEXT NOT NULL DEFAULT 'points',
  points_for_win DOUBLE PRECISION NOT NULL DEFAULT 3,
  points_for_draw DOUBLE PRECISION NOT NULL DEFAULT 1,
  points_for_loss DOUBLE PRECISION NOT NULL DEFAULT 0,
  allow_draws BOOLEAN NOT NULL DEFAULT TRUE,
  allow_negative_points BOOLEAN NOT NULL DEFAULT TRUE,
  min_points_per_event DOUBLE PRECISION,
  max_points_per_event DOUBLE PRECISION,
  walkover_win_score DOUBLE PRECISION NOT NULL DEFAULT 3,
  walkover_loss_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  tie_breakers JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (leaderboard_id, version)
);

ALTER TABLE public.competition_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view competition rules for accessible leaderboards" ON public.competition_rules;
CREATE POLICY "Anyone can view competition rules for accessible leaderboards" ON public.competition_rules
  FOR SELECT USING (public.can_view_leaderboard(leaderboard_id, auth.uid()));

DROP POLICY IF EXISTS "Owners and admins can manage competition rules" ON public.competition_rules;
CREATE POLICY "Owners and admins can manage competition rules" ON public.competition_rules
  FOR ALL USING (public.can_manage_leaderboard(leaderboard_id, auth.uid()));

-- Result Audit Log (Append-only Result Revisions & Dispute Workflow)
CREATE TABLE IF NOT EXISTS public.result_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_id UUID NOT NULL REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('score_event', 'fixture_result', 'tournament_match')),
  entity_id TEXT NOT NULL,
  previous_payload JSONB,
  proposed_payload JSONB NOT NULL,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_email TEXT,
  actor_name TEXT,
  actor_role TEXT NOT NULL DEFAULT 'admin' CHECK (actor_role IN ('owner', 'admin', 'referee', 'participant', 'system')),
  participant_id UUID,
  participant_name TEXT,
  action TEXT NOT NULL CHECK (action IN ('submit', 'correct', 'dispute', 'approve', 'reject', 'void')),
  status TEXT NOT NULL CHECK (status IN ('submitted', 'confirmed', 'disputed', 'approved', 'rejected', 'voided')) DEFAULT 'approved',
  reason TEXT NOT NULL,
  evidence_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.fixture_results 
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved' 
  CHECK (status IN ('submitted', 'confirmed', 'disputed', 'approved', 'rejected', 'voided'));

ALTER TABLE public.score_events 
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved' 
  CHECK (status IN ('submitted', 'confirmed', 'disputed', 'approved', 'rejected', 'voided'));

ALTER TABLE public.tournament_match_results 
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved' 
  CHECK (status IN ('submitted', 'confirmed', 'disputed', 'approved', 'rejected', 'voided'));

CREATE INDEX IF NOT EXISTS idx_result_audit_log_lb ON public.result_audit_log(leaderboard_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_result_audit_log_entity ON public.result_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_result_audit_log_status ON public.result_audit_log(leaderboard_id, status);

ALTER TABLE public.result_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view result audit log for accessible leaderboards" ON public.result_audit_log;
CREATE POLICY "Anyone can view result audit log for accessible leaderboards" ON public.result_audit_log
  FOR SELECT USING (public.can_view_leaderboard(leaderboard_id, auth.uid()));

DROP POLICY IF EXISTS "Authorized users can insert result audit log" ON public.result_audit_log;
CREATE POLICY "Authorized users can insert result audit log" ON public.result_audit_log
  FOR INSERT WITH CHECK (
    public.can_manage_leaderboard(leaderboard_id, auth.uid()) OR
    auth.uid() IS NOT NULL
  );

CREATE OR REPLACE FUNCTION public.prevent_result_audit_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Result audit log records are immutable and cannot be updated or deleted.';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_result_audit_log_mutation ON public.result_audit_log;
CREATE TRIGGER trg_prevent_result_audit_log_mutation
  BEFORE UPDATE OR DELETE ON public.result_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_result_audit_log_mutation();

ALTER PUBLICATION supabase_realtime ADD TABLE public.result_audit_log;

-- ============================================================================
-- 31. Operational Competition Lifecycle & Multi-Stage Pathways
-- ============================================================================
ALTER TABLE public.competition_configs
  ADD COLUMN IF NOT EXISTS operational_status TEXT NOT NULL DEFAULT 'draft';

ALTER TABLE public.competition_configs
  DROP CONSTRAINT IF EXISTS competition_configs_operational_status_check;

ALTER TABLE public.competition_configs
  ADD CONSTRAINT competition_configs_operational_status_check
  CHECK (operational_status IN ('draft', 'registration_open', 'scheduled', 'in_progress', 'under_review', 'completed', 'cancelled'));

ALTER TABLE public.tournaments
  DROP CONSTRAINT IF EXISTS tournaments_state_check;

ALTER TABLE public.tournaments
  ADD CONSTRAINT tournaments_state_check
  CHECK (state IN ('draft', 'registration_open', 'scheduled', 'in_progress', 'under_review', 'completed', 'cancelled'));

CREATE TABLE IF NOT EXISTS public.competition_pathways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_leaderboard_id UUID NOT NULL REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  destination_leaderboard_id UUID NOT NULL REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  stage_order INTEGER NOT NULL DEFAULT 1,
  qualifier_count INTEGER NOT NULL CHECK (qualifier_count >= 1),
  tie_handling TEXT NOT NULL CHECK (tie_handling IN ('standard_rules', 'playoff', 'manual_approval', 'random')) DEFAULT 'standard_rules',
  status TEXT NOT NULL CHECK (status IN ('configured', 'previewed', 'committed', 'cancelled')) DEFAULT 'configured',
  committed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (source_leaderboard_id, destination_leaderboard_id)
);

CREATE INDEX IF NOT EXISTS idx_competition_pathways_source ON public.competition_pathways(source_leaderboard_id);
CREATE INDEX IF NOT EXISTS idx_competition_pathways_dest ON public.competition_pathways(destination_leaderboard_id);
CREATE INDEX IF NOT EXISTS idx_competition_pathways_status ON public.competition_pathways(status);

ALTER TABLE public.competition_pathways ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 32. Competition Scheduler, Venues & Constraints
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.competition_venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_id UUID NOT NULL REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  court_field TEXT,
  location TEXT,
  capacity INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_competition_venues_leaderboard ON public.competition_venues(leaderboard_id);

CREATE TABLE IF NOT EXISTS public.competition_schedule_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_id UUID NOT NULL UNIQUE REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  playable_days INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5,6,0}',
  daily_start_time TEXT NOT NULL DEFAULT '09:00',
  daily_end_time TEXT NOT NULL DEFAULT '18:00',
  match_duration_minutes INTEGER NOT NULL DEFAULT 60,
  buffer_minutes INTEGER NOT NULL DEFAULT 15,
  rest_interval_minutes INTEGER NOT NULL DEFAULT 120,
  participant_availability JSONB NOT NULL DEFAULT '[]'::jsonb,
  auto_assign_venues BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_competition_schedule_configs_leaderboard ON public.competition_schedule_configs(leaderboard_id);

ALTER TABLE public.fixtures
  ADD COLUMN IF NOT EXISTS scheduled_end_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS venue_id UUID REFERENCES public.competition_venues(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS venue_name TEXT,
  ADD COLUMN IF NOT EXISTS court_field TEXT,
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS scheduling_status TEXT NOT NULL DEFAULT 'unscheduled',
  ADD COLUMN IF NOT EXISTS conflict_reason TEXT;

ALTER TABLE public.tournament_matches
  ADD COLUMN IF NOT EXISTS scheduled_end_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS venue_id UUID REFERENCES public.competition_venues(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS venue_name TEXT,
  ADD COLUMN IF NOT EXISTS court_field TEXT,
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS scheduling_status TEXT NOT NULL DEFAULT 'unscheduled',
  ADD COLUMN IF NOT EXISTS conflict_reason TEXT;

ALTER TABLE public.competition_venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_schedule_configs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 33. Participant Registration & Competition Notifications
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.competition_registration_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_id UUID NOT NULL UNIQUE REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  capacity INTEGER,
  opens_at TIMESTAMPTZ,
  closes_at TIMESTAMPTZ,
  require_approval BOOLEAN NOT NULL DEFAULT true,
  allow_waitlist BOOLEAN NOT NULL DEFAULT true,
  allow_team_registration BOOLEAN NOT NULL DEFAULT false,
  eligibility_rules JSONB NOT NULL DEFAULT '{"allowed_domains": [], "min_age": null, "notes": ""}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comp_reg_configs_leaderboard ON public.competition_registration_configs(leaderboard_id);

CREATE TABLE IF NOT EXISTS public.competition_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_id UUID NOT NULL REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  member_id UUID REFERENCES public.leaderboard_members(id) ON DELETE SET NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  participant_name TEXT NOT NULL,
  participant_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  claim_token TEXT UNIQUE,
  claimed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.competition_registrations
  DROP CONSTRAINT IF EXISTS competition_registrations_status_check;

ALTER TABLE public.competition_registrations
  ADD CONSTRAINT competition_registrations_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'waitlisted', 'withdrawn', 'confirmed'));

CREATE INDEX IF NOT EXISTS idx_comp_reg_leaderboard ON public.competition_registrations(leaderboard_id);
CREATE INDEX IF NOT EXISTS idx_comp_reg_user ON public.competition_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_comp_reg_status ON public.competition_registrations(leaderboard_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_comp_reg_claim_token ON public.competition_registrations(claim_token) WHERE claim_token IS NOT NULL;

ALTER TABLE public.leaderboard_members
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leaderboard_members_user ON public.leaderboard_members(user_id);

CREATE TABLE IF NOT EXISTS public.competition_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_id UUID REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_email TEXT,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  action_url TEXT,
  delivery_status TEXT NOT NULL DEFAULT 'delivered',
  idempotency_key TEXT UNIQUE,
  read_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.competition_notifications
  DROP CONSTRAINT IF EXISTS competition_notifications_delivery_status_check;

ALTER TABLE public.competition_notifications
  ADD CONSTRAINT competition_notifications_delivery_status_check
  CHECK (delivery_status IN ('queued', 'delivered', 'read', 'failed'));

CREATE INDEX IF NOT EXISTS idx_comp_notif_user ON public.competition_notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comp_notif_status ON public.competition_notifications(user_id, delivery_status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_comp_notif_idempotency ON public.competition_notifications(idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  leaderboard_id UUID REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  email_opt_in BOOLEAN NOT NULL DEFAULT true,
  in_app_opt_in BOOLEAN NOT NULL DEFAULT true,
  match_reminders BOOLEAN NOT NULL DEFAULT true,
  result_updates BOOLEAN NOT NULL DEFAULT true,
  announcements BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, leaderboard_id)
);

CREATE INDEX IF NOT EXISTS idx_notif_pref_user ON public.notification_preferences(user_id);

ALTER TABLE public.competition_registration_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- 34. Templates Versioning & Event-Day Mode (Era 2 Prompt 3)
ALTER TABLE public.leaderboard_admins
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'referee'));

CREATE OR REPLACE FUNCTION public.can_operate_event_day(p_leaderboard_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM leaderboards l
    WHERE l.id = p_leaderboard_id AND l.owner_id = p_user_id
  ) OR EXISTS (
    SELECT 1 FROM leaderboard_admins la
    WHERE la.leaderboard_id = p_leaderboard_id AND la.user_id = p_user_id
  );
END;
$$;

ALTER TABLE public.competition_templates
  ADD COLUMN IF NOT EXISTS version TEXT NOT NULL DEFAULT '1.0.0',
  ADD COLUMN IF NOT EXISTS engine TEXT NOT NULL DEFAULT 'league_table',
  ADD COLUMN IF NOT EXISTS format TEXT NOT NULL DEFAULT 'league',
  ADD COLUMN IF NOT EXISTS default_config JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ============================================================================
-- 35. Participant Profiles, Competition Passport, Claims & Disputes (Era 3 Prompt 1)
-- ============================================================================
ALTER TABLE public.leaderboards
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_leaderboards_verified ON public.leaderboards(is_verified);

CREATE TABLE IF NOT EXISTS public.participant_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  location TEXT,
  headline TEXT,
  social_links JSONB NOT NULL DEFAULT '{}'::jsonb,
  privacy_settings JSONB NOT NULL DEFAULT '{
    "is_public": true,
    "show_email": false,
    "show_unverified_results": true,
    "show_stats": true,
    "show_match_history": true,
    "show_teams": true,
    "show_trophy_case": true
  }'::jsonb,
  pinned_competition_ids TEXT[] NOT NULL DEFAULT '{}',
  hidden_entity_ids TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_participant_profiles_user ON public.participant_profiles(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_participant_profiles_username_lower ON public.participant_profiles(LOWER(username));

CREATE TABLE IF NOT EXISTS public.participant_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_id UUID NOT NULL REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.leaderboard_members(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  claim_token TEXT UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'verified')) DEFAULT 'pending',
  verification_method TEXT NOT NULL CHECK (verification_method IN ('email_match', 'token', 'organizer_approved')),
  claim_notes TEXT,
  rejection_reason TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(member_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_participant_claims_user ON public.participant_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_participant_claims_leaderboard ON public.participant_claims(leaderboard_id);
CREATE INDEX IF NOT EXISTS idx_participant_claims_member ON public.participant_claims(member_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_participant_claims_token ON public.participant_claims(claim_token) WHERE claim_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.participant_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  leaderboard_id UUID NOT NULL REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('membership_link', 'fixture_result', 'tournament_match', 'score_event')),
  entity_id TEXT NOT NULL,
  correction_type TEXT NOT NULL CHECK (correction_type IN ('wrongly_linked', 'wrong_score', 'wrong_team', 'duplicate_profile', 'remove_from_passport')),
  reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'resolved')) DEFAULT 'pending',
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_participant_corrections_user ON public.participant_corrections(user_id);
CREATE INDEX IF NOT EXISTS idx_participant_corrections_leaderboard ON public.participant_corrections(leaderboard_id);

CREATE TABLE IF NOT EXISTS public.participant_team_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.leaderboard_members(id) ON DELETE CASCADE,
  leaderboard_id UUID NOT NULL REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  team_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'player',
  jersey_number INTEGER,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_history_member ON public.participant_team_history(member_id);
CREATE INDEX IF NOT EXISTS idx_team_history_user ON public.participant_team_history(user_id);
CREATE INDEX IF NOT EXISTS idx_team_history_team ON public.participant_team_history(team_id);
CREATE INDEX IF NOT EXISTS idx_team_history_leaderboard ON public.participant_team_history(leaderboard_id);

ALTER TABLE public.participant_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participant_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participant_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participant_team_history ENABLE ROW LEVEL SECURITY;


