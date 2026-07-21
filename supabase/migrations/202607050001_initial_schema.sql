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
