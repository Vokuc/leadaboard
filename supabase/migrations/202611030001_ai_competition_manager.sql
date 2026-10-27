-- ============================================================================
-- 202611030001_ai_competition_manager.sql
-- Era 7 Prompt 1: AI Competition Manager (Proposals, Audits, Usage Controls)
-- ============================================================================

BEGIN;

-- 1. AI Action Proposals Table
CREATE TABLE IF NOT EXISTS public.ai_action_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_id UUID NOT NULL REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL CHECK (task_type IN ('schedule_draft', 'points_rules_draft', 'announcement_draft', 'pathway_proposal', 'venue_setup')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  validation_errors TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  applied_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_proposals_leaderboard ON public.ai_action_proposals(leaderboard_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_proposals_created_at ON public.ai_action_proposals(created_at DESC);

-- 2. AI Usage & Rate-Limiting Log
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  leaderboard_id UUID REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'grounded_local',
  model TEXT NOT NULL DEFAULT 'deterministic-rules-v1',
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  action_type TEXT NOT NULL DEFAULT 'query',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_user ON public.ai_usage_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_leaderboard ON public.ai_usage_logs(leaderboard_id, created_at DESC);

-- 3. Touch updated_at Trigger
DROP TRIGGER IF EXISTS ai_action_proposals_touch_updated_at ON public.ai_action_proposals;
CREATE TRIGGER ai_action_proposals_touch_updated_at
  BEFORE UPDATE ON public.ai_action_proposals
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. Enable Row Level Security
ALTER TABLE public.ai_action_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
-- Only authorized organizers can view and manage AI proposals for their competition
DROP POLICY IF EXISTS "Organizers can view competition ai proposals" ON public.ai_action_proposals;
CREATE POLICY "Organizers can view competition ai proposals"
  ON public.ai_action_proposals
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards l
      WHERE l.id = ai_action_proposals.leaderboard_id
        AND (l.owner_id = auth.uid() OR EXISTS (
          SELECT 1 FROM public.leaderboard_admins la
          WHERE la.leaderboard_id = l.id AND la.user_id = auth.uid()
        ))
    )
  );

DROP POLICY IF EXISTS "Organizers can create ai proposals" ON public.ai_action_proposals;
CREATE POLICY "Organizers can create ai proposals"
  ON public.ai_action_proposals
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leaderboards l
      WHERE l.id = leaderboard_id
        AND (l.owner_id = auth.uid() OR EXISTS (
          SELECT 1 FROM public.leaderboard_admins la
          WHERE la.leaderboard_id = l.id AND la.user_id = auth.uid()
        ))
    )
  );

DROP POLICY IF EXISTS "Organizers can update ai proposals" ON public.ai_action_proposals;
CREATE POLICY "Organizers can update ai proposals"
  ON public.ai_action_proposals
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards l
      WHERE l.id = ai_action_proposals.leaderboard_id
        AND (l.owner_id = auth.uid() OR EXISTS (
          SELECT 1 FROM public.leaderboard_admins la
          WHERE la.leaderboard_id = l.id AND la.user_id = auth.uid()
        ))
    )
  );

DROP POLICY IF EXISTS "Organizers can view ai usage" ON public.ai_usage_logs;
CREATE POLICY "Organizers can view ai usage"
  ON public.ai_usage_logs
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.leaderboards l
      WHERE l.id = ai_usage_logs.leaderboard_id
        AND (l.owner_id = auth.uid() OR EXISTS (
          SELECT 1 FROM public.leaderboard_admins la
          WHERE la.leaderboard_id = l.id AND la.user_id = auth.uid()
        ))
    )
  );

DROP POLICY IF EXISTS "Authenticated users can insert ai usage" ON public.ai_usage_logs;
CREATE POLICY "Authenticated users can insert ai usage"
  ON public.ai_usage_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 6. Add to Realtime Publication safely
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND tablename = 'ai_action_proposals'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_action_proposals;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
  WHEN OTHERS THEN
    NULL;
END $$;

COMMIT;
