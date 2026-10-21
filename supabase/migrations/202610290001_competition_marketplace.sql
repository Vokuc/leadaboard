-- Migration: 202610290001_competition_marketplace.sql
-- Description: Public Competition Discovery Marketplace metadata, indexing, and participation attributes.

-- ============================================================================
-- 1. ADDITIVE COLUMNS TO COMPETITION_CONFIGS FOR MARKETPLACE METADATA
-- ============================================================================

ALTER TABLE public.competition_configs
  ADD COLUMN IF NOT EXISTS participation_type TEXT NOT NULL DEFAULT 'unspecified',
  ADD COLUMN IF NOT EXISTS location_name TEXT,
  ADD COLUMN IF NOT EXISTS entry_fee NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS rules_summary TEXT,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;

-- Add check constraint for participation_type
ALTER TABLE public.competition_configs
  DROP CONSTRAINT IF EXISTS competition_configs_participation_type_check;

ALTER TABLE public.competition_configs
  ADD CONSTRAINT competition_configs_participation_type_check
  CHECK (participation_type IN ('online', 'in_person', 'hybrid', 'unspecified'));

-- ============================================================================
-- 2. HIGH PERFORMANCE INDEXES FOR MARKETPLACE DISCOVERY QUERIES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_leaderboards_public_discovery 
  ON public.leaderboards(visibility, status, updated_at DESC) 
  WHERE visibility = 'public' AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_leaderboards_public_type 
  ON public.leaderboards(competition_type, visibility, status) 
  WHERE visibility = 'public' AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_competition_configs_engine 
  ON public.competition_configs(engine_type);

CREATE INDEX IF NOT EXISTS idx_competition_configs_op_status 
  ON public.competition_configs(operational_status);

CREATE INDEX IF NOT EXISTS idx_competition_configs_participation 
  ON public.competition_configs(participation_type);

CREATE INDEX IF NOT EXISTS idx_comp_reg_configs_window 
  ON public.competition_registration_configs(is_enabled, opens_at, closes_at);

-- ============================================================================
-- 3. RLS POLICIES FOR PUBLIC DISCOVERY
-- ============================================================================

-- Ensure anyone (authenticated or anonymous) can view competition_registration_configs for public leaderboards
DROP POLICY IF EXISTS "Public can view registration config for public leaderboards" ON public.competition_registration_configs;
CREATE POLICY "Public can view registration config for public leaderboards" 
  ON public.competition_registration_configs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards lb
      WHERE lb.id = leaderboard_id
        AND lb.visibility = 'public'
    )
  );

-- Ensure anyone can view venue info for public leaderboards
DROP POLICY IF EXISTS "Public can view venues for public leaderboards" ON public.competition_venues;
CREATE POLICY "Public can view venues for public leaderboards" 
  ON public.competition_venues
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards lb
      WHERE lb.id = leaderboard_id
        AND lb.visibility = 'public'
    )
  );
