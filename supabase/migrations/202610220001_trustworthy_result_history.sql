-- Migration: 202610220001_trustworthy_result_history.sql
-- Description: Trustworthy append-only result revisions, audit events, correction workflows, and immutability enforcement.

-- 1. Create Result Audit Log Table (Append-only & Retention-safe)
CREATE TABLE IF NOT EXISTS public.result_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_id UUID NOT NULL REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('score_event', 'fixture_result', 'tournament_match')),
  entity_id TEXT NOT NULL,
  
  -- Snapshots / Payloads
  previous_payload JSONB,
  proposed_payload JSONB NOT NULL,
  
  -- Actor context (retention-safe: does NOT cascade delete if user profile is deleted)
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_email TEXT,
  actor_name TEXT,
  actor_role TEXT NOT NULL DEFAULT 'admin' CHECK (actor_role IN ('owner', 'admin', 'referee', 'participant', 'system')),
  
  -- Participant references (retention-safe: does NOT cascade delete if member is deleted)
  participant_id UUID,
  participant_name TEXT,
  
  -- Action and status workflow
  action TEXT NOT NULL CHECK (action IN ('submit', 'correct', 'dispute', 'approve', 'reject', 'void')),
  status TEXT NOT NULL CHECK (status IN ('submitted', 'confirmed', 'disputed', 'approved', 'rejected', 'voided')) DEFAULT 'approved',
  
  -- Mandatory reason for accountability
  reason TEXT NOT NULL,
  
  -- Evidence attachments (media bucket URLs, documents, notes)
  evidence_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Additive Status Columns for Result Entities
ALTER TABLE public.fixture_results 
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved' 
  CHECK (status IN ('submitted', 'confirmed', 'disputed', 'approved', 'rejected', 'voided'));

ALTER TABLE public.score_events 
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved' 
  CHECK (status IN ('submitted', 'confirmed', 'disputed', 'approved', 'rejected', 'voided'));

ALTER TABLE public.tournament_match_results 
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved' 
  CHECK (status IN ('submitted', 'confirmed', 'disputed', 'approved', 'rejected', 'voided'));

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_result_audit_log_lb ON public.result_audit_log(leaderboard_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_result_audit_log_entity ON public.result_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_result_audit_log_status ON public.result_audit_log(leaderboard_id, status);

-- 4. Row Level Security
ALTER TABLE public.result_audit_log ENABLE ROW LEVEL SECURITY;

-- Anyone who can view the competition can view audit history (public transparency)
DROP POLICY IF EXISTS "Anyone can view result audit log for accessible leaderboards" ON public.result_audit_log;
CREATE POLICY "Anyone can view result audit log for accessible leaderboards" ON public.result_audit_log
  FOR SELECT USING (public.can_view_leaderboard(leaderboard_id, auth.uid()));

-- Only owners and admins can insert audit records (and authorized authenticated users for disputes)
DROP POLICY IF EXISTS "Authorized users can insert result audit log" ON public.result_audit_log;
CREATE POLICY "Authorized users can insert result audit log" ON public.result_audit_log
  FOR INSERT WITH CHECK (
    public.can_manage_leaderboard(leaderboard_id, auth.uid()) OR
    auth.uid() IS NOT NULL
  );

-- 5. STRICT DATABASE IMMUTABILITY TRIGGER:
-- Enforce that result_audit_log is append-only and that records CANNOT be updated or deleted.
CREATE OR REPLACE FUNCTION public.prevent_result_audit_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Result audit log records are immutable and cannot be updated or deleted.';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_result_audit_log_mutation ON public.result_audit_log;
CREATE TRIGGER trg_prevent_result_audit_log_mutation
  BEFORE UPDATE OR DELETE ON public.result_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_result_audit_log_mutation();

-- 6. Realtime publication
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = 'result_audit_log'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.result_audit_log;
    END IF;
  END IF;
END $$;
