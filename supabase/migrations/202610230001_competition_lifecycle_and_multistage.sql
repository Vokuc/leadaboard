-- Migration: 202610230001_competition_lifecycle_and_multistage.sql
-- Description: Operational competition lifecycle and multi-stage qualification pathways (league-to-knockout).

-- 1. Add operational_status to competition_configs
ALTER TABLE public.competition_configs
  ADD COLUMN IF NOT EXISTS operational_status TEXT NOT NULL DEFAULT 'draft';

ALTER TABLE public.competition_configs
  DROP CONSTRAINT IF EXISTS competition_configs_operational_status_check;

ALTER TABLE public.competition_configs
  ADD CONSTRAINT competition_configs_operational_status_check
  CHECK (operational_status IN ('draft', 'registration_open', 'scheduled', 'in_progress', 'under_review', 'completed', 'cancelled'));

-- 2. Update tournaments state check constraint to support scheduled and under_review
ALTER TABLE public.tournaments
  DROP CONSTRAINT IF EXISTS tournaments_state_check;

ALTER TABLE public.tournaments
  ADD CONSTRAINT tournaments_state_check
  CHECK (state IN ('draft', 'registration_open', 'scheduled', 'in_progress', 'under_review', 'completed', 'cancelled'));

-- 3. Create Multi-Stage Competition Pathways Table
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

-- 4. Enable Row Level Security
ALTER TABLE public.competition_pathways ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for competition_pathways
DROP POLICY IF EXISTS competition_pathways_select ON public.competition_pathways;
CREATE POLICY competition_pathways_select ON public.competition_pathways
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards sl
      WHERE sl.id = source_leaderboard_id
        AND (sl.visibility = 'public' OR sl.owner_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.leaderboards dl
      WHERE dl.id = destination_leaderboard_id
        AND (dl.visibility = 'public' OR dl.owner_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.leaderboard_admins la
      WHERE (la.leaderboard_id = source_leaderboard_id OR la.leaderboard_id = destination_leaderboard_id)
        AND la.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS competition_pathways_insert ON public.competition_pathways;
CREATE POLICY competition_pathways_insert ON public.competition_pathways
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leaderboards sl
      WHERE sl.id = source_leaderboard_id AND sl.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.leaderboard_admins la
      WHERE la.leaderboard_id = source_leaderboard_id AND la.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS competition_pathways_update ON public.competition_pathways;
CREATE POLICY competition_pathways_update ON public.competition_pathways
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards sl
      WHERE sl.id = source_leaderboard_id AND sl.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.leaderboard_admins la
      WHERE la.leaderboard_id = source_leaderboard_id AND la.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS competition_pathways_delete ON public.competition_pathways;
CREATE POLICY competition_pathways_delete ON public.competition_pathways
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards sl
      WHERE sl.id = source_leaderboard_id AND sl.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.leaderboard_admins la
      WHERE la.leaderboard_id = source_leaderboard_id AND la.user_id = auth.uid()
    )
  );
