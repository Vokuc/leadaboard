-- Migration: 202610200001_teams_and_rosters.sql
-- Description: Introduces first-class normalized teams and roster memberships while preserving legacy free-text team field.

-- 1. Create Teams Table
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

-- 2. Add team_id to leaderboard_members
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leaderboard_members' AND column_name = 'team_id'
  ) THEN
    ALTER TABLE public.leaderboard_members ADD COLUMN team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Create Team Members (Roster) Table
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

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_teams_leaderboard ON public.teams(leaderboard_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON public.team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_member ON public.team_members(member_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_members_team_id ON public.leaderboard_members(team_id);

-- 5. Row Level Security
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

-- 6. Add to Realtime Publication if available
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = 'teams'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = 'team_members'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.team_members;
    END IF;
  END IF;
END $$;

-- 7. Safe, Repeatable Backfill of existing free-text team names into normalized teams
DO $$
DECLARE
  rec RECORD;
  new_team_id UUID;
  clean_code TEXT;
BEGIN
  -- Iterate through distinct non-empty legacy team names per leaderboard
  FOR rec IN
    SELECT DISTINCT leaderboard_id, TRIM(team) AS team_name
    FROM public.leaderboard_members
    WHERE team IS NOT NULL AND TRIM(team) <> ''
  LOOP
    -- Generate 2-4 uppercase letter short code from team name
    clean_code := UPPER(SUBSTRING(REGEXP_REPLACE(rec.team_name, '[^a-zA-Z0-9]', '', 'g') FROM 1 FOR 4));
    IF clean_code IS NULL OR clean_code = '' THEN
      clean_code := 'TEAM';
    END IF;

    -- Insert team if it doesn't already exist
    INSERT INTO public.teams (leaderboard_id, name, short_code, created_at, updated_at)
    VALUES (rec.leaderboard_id, rec.team_name, clean_code, NOW(), NOW())
    ON CONFLICT (leaderboard_id, name) DO NOTHING;

    -- Get team id
    SELECT id INTO new_team_id
    FROM public.teams
    WHERE leaderboard_id = rec.leaderboard_id AND name = rec.team_name;

    -- Link leaderboard_members.team_id where not set
    IF new_team_id IS NOT NULL THEN
      UPDATE public.leaderboard_members
      SET team_id = new_team_id
      WHERE leaderboard_id = rec.leaderboard_id
        AND TRIM(team) = rec.team_name
        AND team_id IS NULL;

      -- Add roster entries
      INSERT INTO public.team_members (team_id, leaderboard_id, member_id, role, created_at, updated_at)
      SELECT new_team_id, m.leaderboard_id, m.id, 'player', m.created_at, m.updated_at
      FROM public.leaderboard_members m
      WHERE m.leaderboard_id = rec.leaderboard_id
        AND m.team_id = new_team_id
      ON CONFLICT (leaderboard_id, member_id) DO NOTHING;
    END IF;
  END LOOP;
END $$;
