-- ============================================================================
-- 202611040001_competition_data_graph_and_analytics.sql
-- Era 7 Prompt 2: Competition Data Graph and Cross-Competition Analytics
-- ============================================================================

BEGIN;

-- 1. Additive columns on teams for cross-competition and organizational identity
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS canonical_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_teams_organization_id ON public.teams(organization_id);
CREATE INDEX IF NOT EXISTS idx_teams_canonical_team_id ON public.teams(canonical_team_id);

-- 2. Team Name History (Preserves historical team identity across seasons without rewriting past records)
CREATE TABLE IF NOT EXISTS public.team_name_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  short_code TEXT,
  logo_url TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_team_name_history_team ON public.team_name_history(team_id, changed_at DESC);

-- 3. Additive columns on competition_venues for organization-wide sharing
ALTER TABLE public.competition_venues
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_competition_venues_organization_id ON public.competition_venues(organization_id);

-- 4. Competition Participations Table (Normalized cross-competition participation snapshots)
CREATE TABLE IF NOT EXISTS public.competition_participations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_id UUID NOT NULL REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  season_id UUID REFERENCES public.seasons(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('individual', 'team')),
  member_id UUID NOT NULL REFERENCES public.leaderboard_members(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  team_name_snapshot TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  final_position INTEGER,
  matches_played INTEGER NOT NULL DEFAULT 0,
  matches_won INTEGER NOT NULL DEFAULT 0,
  matches_drawn INTEGER NOT NULL DEFAULT 0,
  matches_lost INTEGER NOT NULL DEFAULT 0,
  total_points NUMERIC NOT NULL DEFAULT 0,
  verified_matches_count INTEGER NOT NULL DEFAULT 0,
  unverified_matches_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(leaderboard_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_comp_part_leaderboard ON public.competition_participations(leaderboard_id);
CREATE INDEX IF NOT EXISTS idx_comp_part_user ON public.competition_participations(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comp_part_team ON public.competition_participations(team_id) WHERE team_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comp_part_season ON public.competition_participations(season_id) WHERE season_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comp_part_verified ON public.competition_participations(is_verified);

-- 5. Additional High-Performance Query Indexes for Cross-Competition Analytics
CREATE INDEX IF NOT EXISTS idx_leaderboards_owner_type ON public.leaderboards(owner_id, competition_type);
CREATE INDEX IF NOT EXISTS idx_leaderboards_org_type ON public.leaderboards(organization_id, competition_type) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fixtures_lb_status ON public.fixtures(leaderboard_id, status);
CREATE INDEX IF NOT EXISTS idx_fixture_results_status ON public.fixture_results(fixture_id, status);

-- 6. Row Level Security
ALTER TABLE public.team_name_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_participations ENABLE ROW LEVEL SECURITY;

-- Team Name History Policies:
DROP POLICY IF EXISTS "Public can view team name history for visible competitions" ON public.team_name_history;
CREATE POLICY "Public can view team name history for visible competitions" ON public.team_name_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.teams t
      JOIN public.leaderboards l ON l.id = t.leaderboard_id
      WHERE t.id = team_name_history.team_id
      AND (l.visibility = 'public' OR l.owner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins can manage team name history" ON public.team_name_history;
CREATE POLICY "Admins can manage team name history" ON public.team_name_history
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.teams t
      JOIN public.leaderboards l ON l.id = t.leaderboard_id
      WHERE t.id = team_name_history.team_id
      AND (l.owner_id = auth.uid())
    )
  );

-- Competition Participations Policies:
DROP POLICY IF EXISTS "Public can view participations for visible competitions" ON public.competition_participations;
CREATE POLICY "Public can view participations for visible competitions" ON public.competition_participations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards l
      WHERE l.id = competition_participations.leaderboard_id
      AND (l.visibility = 'public' OR l.owner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Organizers can manage competition participations" ON public.competition_participations;
CREATE POLICY "Organizers can manage competition participations" ON public.competition_participations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards l
      WHERE l.id = competition_participations.leaderboard_id
      AND (l.owner_id = auth.uid())
    )
  );

-- 7. Realtime Publication (Safe Idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'competition_participations'
  ) THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.competition_participations;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

COMMIT;
