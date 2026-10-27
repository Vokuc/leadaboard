-- ============================================================================
-- 202611020001_competition_sponsorship.sql
-- Era 6 Prompt 2: Sponsorship and Organizer Monetization
-- ============================================================================

BEGIN;

-- 1. Competition Sponsors Table
CREATE TABLE IF NOT EXISTS public.competition_sponsors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_id UUID REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  logo_url TEXT,
  website_url TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'community' CHECK (tier IN ('headline', 'gold', 'silver', 'bronze', 'community', 'partner')),
  display_order INTEGER NOT NULL DEFAULT 0,
  tagline TEXT,
  campaign_start TIMESTAMPTZ,
  campaign_end TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  impressions_count BIGINT NOT NULL DEFAULT 0,
  clicks_count BIGINT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT competition_sponsors_scope_check CHECK (leaderboard_id IS NOT NULL OR organization_id IS NOT NULL)
);

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_comp_sponsors_leaderboard ON public.competition_sponsors(leaderboard_id);
CREATE INDEX IF NOT EXISTS idx_comp_sponsors_organization ON public.competition_sponsors(organization_id);
CREATE INDEX IF NOT EXISTS idx_comp_sponsors_active ON public.competition_sponsors(is_active, tier, display_order);
CREATE INDEX IF NOT EXISTS idx_comp_sponsors_campaign ON public.competition_sponsors(campaign_start, campaign_end);

-- 2. Measurable Metrics & Event Log Table (for reliable, non-inflated tracking)
CREATE TABLE IF NOT EXISTS public.competition_sponsor_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id UUID NOT NULL REFERENCES public.competition_sponsors(id) ON DELETE CASCADE,
  leaderboard_id UUID REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('impression', 'click')),
  dedup_key TEXT UNIQUE,
  user_agent TEXT,
  ip_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comp_sponsor_events_sponsor ON public.competition_sponsor_events(sponsor_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comp_sponsor_events_dedup ON public.competition_sponsor_events(dedup_key);

-- 3. Touch updated_at trigger
DROP TRIGGER IF EXISTS competition_sponsors_touch_updated_at ON public.competition_sponsors;
CREATE TRIGGER competition_sponsors_touch_updated_at
  BEFORE UPDATE ON public.competition_sponsors
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. Enable Row-Level Security (RLS)
ALTER TABLE public.competition_sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_sponsor_events ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for competition_sponsors
-- Public can read active sponsors whose campaign is current
DROP POLICY IF EXISTS "Public can view active sponsors" ON public.competition_sponsors;
CREATE POLICY "Public can view active sponsors"
  ON public.competition_sponsors
  FOR SELECT
  TO public
  USING (
    is_active = true
    AND (campaign_start IS NULL OR campaign_start <= now())
    AND (campaign_end IS NULL OR campaign_end >= now())
  );

-- Organizers can view all sponsors for their leaderboards
DROP POLICY IF EXISTS "Organizers can view own competition sponsors" ON public.competition_sponsors;
CREATE POLICY "Organizers can view own competition sponsors"
  ON public.competition_sponsors
  FOR SELECT
  TO authenticated
  USING (
    (leaderboard_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.leaderboards l
      WHERE l.id = competition_sponsors.leaderboard_id
        AND (l.owner_id = auth.uid() OR EXISTS (
          SELECT 1 FROM public.leaderboard_admins la
          WHERE la.leaderboard_id = l.id AND la.user_id = auth.uid()
        ))
    ))
    OR
    (organization_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = competition_sponsors.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'manager')
    ))
  );

-- Organizers can insert/update/delete sponsors
DROP POLICY IF EXISTS "Organizers can insert competition sponsors" ON public.competition_sponsors;
CREATE POLICY "Organizers can insert competition sponsors"
  ON public.competition_sponsors
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (leaderboard_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.leaderboards l
      WHERE l.id = leaderboard_id
        AND (l.owner_id = auth.uid() OR EXISTS (
          SELECT 1 FROM public.leaderboard_admins la
          WHERE la.leaderboard_id = l.id AND la.user_id = auth.uid()
        ))
    ))
    OR
    (organization_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = competition_sponsors.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    ))
  );

DROP POLICY IF EXISTS "Organizers can update competition sponsors" ON public.competition_sponsors;
CREATE POLICY "Organizers can update competition sponsors"
  ON public.competition_sponsors
  FOR UPDATE
  TO authenticated
  USING (
    (leaderboard_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.leaderboards l
      WHERE l.id = competition_sponsors.leaderboard_id
        AND (l.owner_id = auth.uid() OR EXISTS (
          SELECT 1 FROM public.leaderboard_admins la
          WHERE la.leaderboard_id = l.id AND la.user_id = auth.uid()
        ))
    ))
    OR
    (organization_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = competition_sponsors.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    ))
  );

DROP POLICY IF EXISTS "Organizers can delete competition sponsors" ON public.competition_sponsors;
CREATE POLICY "Organizers can delete competition sponsors"
  ON public.competition_sponsors
  FOR DELETE
  TO authenticated
  USING (
    (leaderboard_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.leaderboards l
      WHERE l.id = competition_sponsors.leaderboard_id
        AND (l.owner_id = auth.uid() OR EXISTS (
          SELECT 1 FROM public.leaderboard_admins la
          WHERE la.leaderboard_id = l.id AND la.user_id = auth.uid()
        ))
    ))
    OR
    (organization_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = competition_sponsors.organization_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    ))
  );

-- 6. RLS Policies for competition_sponsor_events
-- Public can log events (insert only)
DROP POLICY IF EXISTS "Public can record sponsor events" ON public.competition_sponsor_events;
CREATE POLICY "Public can record sponsor events"
  ON public.competition_sponsor_events
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Organizers can read sponsor events for their own competitions
DROP POLICY IF EXISTS "Organizers can read sponsor events" ON public.competition_sponsor_events;
CREATE POLICY "Organizers can read sponsor events"
  ON public.competition_sponsor_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.competition_sponsors cs
      WHERE cs.id = competition_sponsor_events.sponsor_id
        AND (
          (cs.leaderboard_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.leaderboards l
            WHERE l.id = cs.leaderboard_id
              AND (l.owner_id = auth.uid() OR EXISTS (
                SELECT 1 FROM public.leaderboard_admins la
                WHERE la.leaderboard_id = l.id AND la.user_id = auth.uid()
              ))
          ))
          OR
          (cs.organization_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.organization_id = cs.organization_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin', 'manager')
          ))
        )
    )
  );

-- 7. Add to Realtime Publication
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'competition_sponsors'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.competition_sponsors;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    NULL; -- Already a member of publication
  WHEN OTHERS THEN
    NULL; -- Ignore publication errors if realtime publication is not configured in local environment
END $$;

COMMIT;
