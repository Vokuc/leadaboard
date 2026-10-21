-- Migration: 202610240001_competition_scheduler.sql
-- Description: Competition scheduling system with venues, schedule configurations, and additive scheduling attributes for fixtures and tournament matches.

-- 1. Create competition_venues table
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

-- 2. Create competition_schedule_configs table
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

-- 3. Add additive scheduling columns to fixtures
ALTER TABLE public.fixtures
  ADD COLUMN IF NOT EXISTS scheduled_end_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS venue_id UUID REFERENCES public.competition_venues(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS venue_name TEXT,
  ADD COLUMN IF NOT EXISTS court_field TEXT,
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS scheduling_status TEXT NOT NULL DEFAULT 'unscheduled',
  ADD COLUMN IF NOT EXISTS conflict_reason TEXT;

ALTER TABLE public.fixtures
  DROP CONSTRAINT IF EXISTS fixtures_scheduling_status_check;

ALTER TABLE public.fixtures
  ADD CONSTRAINT fixtures_scheduling_status_check
  CHECK (scheduling_status IN ('unscheduled', 'scheduled', 'rescheduled', 'conflict', 'cancelled'));

-- 4. Add additive scheduling columns to tournament_matches
ALTER TABLE public.tournament_matches
  ADD COLUMN IF NOT EXISTS scheduled_end_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS venue_id UUID REFERENCES public.competition_venues(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS venue_name TEXT,
  ADD COLUMN IF NOT EXISTS court_field TEXT,
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS scheduling_status TEXT NOT NULL DEFAULT 'unscheduled',
  ADD COLUMN IF NOT EXISTS conflict_reason TEXT;

ALTER TABLE public.tournament_matches
  DROP CONSTRAINT IF EXISTS tournament_matches_scheduling_status_check;

ALTER TABLE public.tournament_matches
  ADD CONSTRAINT tournament_matches_scheduling_status_check
  CHECK (scheduling_status IN ('unscheduled', 'scheduled', 'rescheduled', 'conflict', 'cancelled'));

-- 5. Enable Row Level Security
ALTER TABLE public.competition_venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_schedule_configs ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for competition_venues
DROP POLICY IF EXISTS competition_venues_select ON public.competition_venues;
CREATE POLICY competition_venues_select ON public.competition_venues
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards l
      WHERE l.id = leaderboard_id
        AND (l.visibility = 'public' OR l.owner_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.leaderboard_admins la
      WHERE la.leaderboard_id = competition_venues.leaderboard_id
        AND la.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS competition_venues_insert ON public.competition_venues;
CREATE POLICY competition_venues_insert ON public.competition_venues
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leaderboards l
      WHERE l.id = leaderboard_id AND l.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.leaderboard_admins la
      WHERE la.leaderboard_id = competition_venues.leaderboard_id
        AND la.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS competition_venues_update ON public.competition_venues;
CREATE POLICY competition_venues_update ON public.competition_venues
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards l
      WHERE l.id = leaderboard_id AND l.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.leaderboard_admins la
      WHERE la.leaderboard_id = competition_venues.leaderboard_id
        AND la.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS competition_venues_delete ON public.competition_venues;
CREATE POLICY competition_venues_delete ON public.competition_venues
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards l
      WHERE l.id = leaderboard_id AND l.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.leaderboard_admins la
      WHERE la.leaderboard_id = competition_venues.leaderboard_id
        AND la.user_id = auth.uid()
    )
  );

-- 7. RLS Policies for competition_schedule_configs
DROP POLICY IF EXISTS competition_schedule_configs_select ON public.competition_schedule_configs;
CREATE POLICY competition_schedule_configs_select ON public.competition_schedule_configs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards l
      WHERE l.id = leaderboard_id
        AND (l.visibility = 'public' OR l.owner_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.leaderboard_admins la
      WHERE la.leaderboard_id = competition_schedule_configs.leaderboard_id
        AND la.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS competition_schedule_configs_insert ON public.competition_schedule_configs;
CREATE POLICY competition_schedule_configs_insert ON public.competition_schedule_configs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leaderboards l
      WHERE l.id = leaderboard_id AND l.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.leaderboard_admins la
      WHERE la.leaderboard_id = competition_schedule_configs.leaderboard_id
        AND la.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS competition_schedule_configs_update ON public.competition_schedule_configs;
CREATE POLICY competition_schedule_configs_update ON public.competition_schedule_configs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards l
      WHERE l.id = leaderboard_id AND l.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.leaderboard_admins la
      WHERE la.leaderboard_id = competition_schedule_configs.leaderboard_id
        AND la.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS competition_schedule_configs_delete ON public.competition_schedule_configs;
CREATE POLICY competition_schedule_configs_delete ON public.competition_schedule_configs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards l
      WHERE l.id = leaderboard_id AND l.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.leaderboard_admins la
      WHERE la.leaderboard_id = competition_schedule_configs.leaderboard_id
        AND la.user_id = auth.uid()
    )
  );
