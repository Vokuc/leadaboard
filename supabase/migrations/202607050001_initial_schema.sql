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
  end_date TIMESTAMPTZ,
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
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(leaderboard_id, name)
);

-- 6. Score Events (Score updates log)
CREATE TABLE IF NOT EXISTS public.score_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_id UUID NOT NULL REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.leaderboard_members(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES public.scoring_rules(id) ON DELETE SET NULL,
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

CREATE TABLE IF NOT EXISTS public.statistics_registry (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('input', 'derived')),
  calculation_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.competition_templates (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT NOT NULL,
  competition_type TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('individual', 'team')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS public.competition_stat_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_id UUID NOT NULL REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.leaderboard_members(id) ON DELETE CASCADE,
  statistic_key TEXT NOT NULL REFERENCES public.statistics_registry(key) ON DELETE CASCADE,
  value DOUBLE PRECISION NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (leaderboard_id, member_id, statistic_key)
);

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

CREATE TABLE IF NOT EXISTS public.league_settings (
  leaderboard_id UUID PRIMARY KEY REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  season_name TEXT NOT NULL,
  points_for_win DOUBLE PRECISION NOT NULL DEFAULT 3,
  points_for_draw DOUBLE PRECISION NOT NULL DEFAULT 1,
  points_for_loss DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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
GROUP BY m.id, m.leaderboard_id, m.name, m.email, m.avatar_url, m.team, m.notes, m.is_active, m.created_at;


-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scoring_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.score_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- 1. Profiles Policies
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- 2. Leaderboards Policies
CREATE POLICY "Anyone can view public leaderboards" ON public.leaderboards
  FOR SELECT USING (visibility = 'public' OR auth.uid() = owner_id);

CREATE POLICY "Owners can insert leaderboards" ON public.leaderboards
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update their own leaderboards" ON public.leaderboards
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Owners can delete their own leaderboards" ON public.leaderboards
  FOR DELETE USING (auth.uid() = owner_id);

-- 3. Seasons Policies
CREATE POLICY "Anyone can select seasons for accessible leaderboards" ON public.seasons
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards l
      WHERE l.id = leaderboard_id AND (l.visibility = 'public' OR auth.uid() = l.owner_id)
    )
  );

CREATE POLICY "Owners can manage seasons" ON public.seasons
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards l
      WHERE l.id = leaderboard_id AND auth.uid() = l.owner_id
    )
  );

-- 4. Scoring Rules Policies
CREATE POLICY "Anyone can view scoring rules for accessible leaderboards" ON public.scoring_rules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards l
      WHERE l.id = leaderboard_id AND (l.visibility = 'public' OR auth.uid() = l.owner_id)
    )
  );

CREATE POLICY "Owners can manage scoring rules" ON public.scoring_rules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards l
      WHERE l.id = leaderboard_id AND auth.uid() = l.owner_id
    )
  );

-- 5. Leaderboard Members Policies
CREATE POLICY "Anyone can view leaderboard members for accessible leaderboards" ON public.leaderboard_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards l
      WHERE l.id = leaderboard_id AND (l.visibility = 'public' OR auth.uid() = l.owner_id)
    )
  );

CREATE POLICY "Owners can manage leaderboard members" ON public.leaderboard_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards l
      WHERE l.id = leaderboard_id AND auth.uid() = l.owner_id
    )
  );

-- 6. Score Events Policies
CREATE POLICY "Anyone can view score events for accessible leaderboards" ON public.score_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards l
      WHERE l.id = leaderboard_id AND (l.visibility = 'public' OR auth.uid() = l.owner_id)
    )
  );

CREATE POLICY "Owners can manage score events" ON public.score_events
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards l
      WHERE l.id = leaderboard_id AND auth.uid() = l.owner_id
    )
  );

-- 7. Activity Logs Policies
CREATE POLICY "Anyone can view activity logs for accessible leaderboards" ON public.activity_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards l
      WHERE l.id = leaderboard_id AND (l.visibility = 'public' OR auth.uid() = l.owner_id)
    )
  );

CREATE POLICY "Owners can manage activity logs" ON public.activity_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards l
      WHERE l.id = leaderboard_id AND auth.uid() = l.owner_id
    )
  );

-- 11. Tournament policies
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_match_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_advancements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read tournaments" ON public.tournaments;
CREATE POLICY "Anyone can read tournaments" ON public.tournaments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards l
      WHERE l.id = leaderboard_id AND (l.visibility = 'public' OR auth.uid() = l.owner_id)
    )
  );

DROP POLICY IF EXISTS "Owners can manage tournaments" ON public.tournaments;
CREATE POLICY "Owners can manage tournaments" ON public.tournaments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards l
      WHERE l.id = leaderboard_id AND auth.uid() = l.owner_id
    )
  );

DROP POLICY IF EXISTS "Anyone can read tournament rounds" ON public.tournament_rounds;
CREATE POLICY "Anyone can read tournament rounds" ON public.tournament_rounds
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards l
      WHERE l.id = leaderboard_id AND (l.visibility = 'public' OR auth.uid() = l.owner_id)
    )
  );

DROP POLICY IF EXISTS "Owners can manage tournament rounds" ON public.tournament_rounds;
CREATE POLICY "Owners can manage tournament rounds" ON public.tournament_rounds
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards l
      WHERE l.id = leaderboard_id AND auth.uid() = l.owner_id
    )
  );

DROP POLICY IF EXISTS "Anyone can read tournament matches" ON public.tournament_matches;
CREATE POLICY "Anyone can read tournament matches" ON public.tournament_matches
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards l
      WHERE l.id = leaderboard_id AND (l.visibility = 'public' OR auth.uid() = l.owner_id)
    )
  );

DROP POLICY IF EXISTS "Owners can manage tournament matches" ON public.tournament_matches;
CREATE POLICY "Owners can manage tournament matches" ON public.tournament_matches
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards l
      WHERE l.id = leaderboard_id AND auth.uid() = l.owner_id
    )
  );

DROP POLICY IF EXISTS "Anyone can read tournament match results" ON public.tournament_match_results;
CREATE POLICY "Anyone can read tournament match results" ON public.tournament_match_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.tournament_matches tm
      JOIN public.leaderboards l ON l.id = tm.leaderboard_id
      WHERE tm.id = match_id AND (l.visibility = 'public' OR auth.uid() = l.owner_id)
    )
  );

DROP POLICY IF EXISTS "Owners can manage tournament match results" ON public.tournament_match_results;
CREATE POLICY "Owners can manage tournament match results" ON public.tournament_match_results
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.tournament_matches tm
      JOIN public.leaderboards l ON l.id = tm.leaderboard_id
      WHERE tm.id = match_id AND auth.uid() = l.owner_id
    )
  );

DROP POLICY IF EXISTS "Anyone can read tournament advancements" ON public.tournament_advancements;
CREATE POLICY "Anyone can read tournament advancements" ON public.tournament_advancements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards l
      WHERE l.id = leaderboard_id AND (l.visibility = 'public' OR auth.uid() = l.owner_id)
    )
  );

DROP POLICY IF EXISTS "Owners can manage tournament advancements" ON public.tournament_advancements;
CREATE POLICY "Owners can manage tournament advancements" ON public.tournament_advancements
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards l
      WHERE l.id = leaderboard_id AND auth.uid() = l.owner_id
    )
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_match_results;
