-- Migration: 202610260001_templates_and_event_day.sql
-- Description: Reusable versioned competition templates and mobile-first event-day operations for organizers and referees.

-- 1. Additive columns on leaderboard_admins for role-based permissions (organizer, referee)
ALTER TABLE public.leaderboard_admins
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'referee'));

-- 2. Security definer function to check if a user can operate event-day mode (owner, admin, or referee)
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

-- 3. Additive columns on competition_templates for versioning and engine specifications
ALTER TABLE public.competition_templates
  ADD COLUMN IF NOT EXISTS version TEXT NOT NULL DEFAULT '1.0.0',
  ADD COLUMN IF NOT EXISTS engine TEXT NOT NULL DEFAULT 'league_table',
  ADD COLUMN IF NOT EXISTS format TEXT NOT NULL DEFAULT 'league',
  ADD COLUMN IF NOT EXISTS default_config JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 4. Enable Realtime on fixtures, fixture_results, and tournament_matches if not already enabled
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'fixtures'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.fixtures;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'fixture_results'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.fixture_results;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'tournament_matches'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_matches;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL; -- Ignore publication errors if realtime publication is not configured in local environment
END $$;
