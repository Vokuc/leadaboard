-- ============================================================================
-- 202611010001_paid_competition_registration_and_ledger.sql
-- Era 6 Prompt 1: Paid Competition Registration and Financial Ledger
-- ============================================================================

BEGIN;

-- 1. Enhance competition_registration_configs with financial & pricing columns
ALTER TABLE public.competition_registration_configs
  ADD COLUMN IF NOT EXISTS entry_fee BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'NGN',
  ADD COLUMN IF NOT EXISTS payment_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refund_policy TEXT NOT NULL DEFAULT 'no_refunds',
  ADD COLUMN IF NOT EXISTS platform_fee_percent NUMERIC(5,2) NOT NULL DEFAULT 5.00,
  ADD COLUMN IF NOT EXISTS prize_pool_percentage NUMERIC(5,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS guaranteed_prize_pool BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payout_status TEXT NOT NULL DEFAULT 'unconfigured';

-- Add refund policy check constraint
ALTER TABLE public.competition_registration_configs
  DROP CONSTRAINT IF EXISTS competition_registration_configs_refund_policy_check;
ALTER TABLE public.competition_registration_configs
  ADD CONSTRAINT competition_registration_configs_refund_policy_check
  CHECK (refund_policy IN ('no_refunds', 'full_refund_before_deadline', 'partial_refund', 'organizer_discretion'));

-- Add payout status check constraint
ALTER TABLE public.competition_registration_configs
  DROP CONSTRAINT IF EXISTS competition_registration_configs_payout_status_check;
ALTER TABLE public.competition_registration_configs
  ADD CONSTRAINT competition_registration_configs_payout_status_check
  CHECK (payout_status IN ('unconfigured', 'configured', 'pending_approval', 'disabled'));

-- 2. Enhance competition_registrations with payment association
ALTER TABLE public.competition_registrations
  ADD COLUMN IF NOT EXISTS payment_id UUID,
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS amount_paid BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'NGN',
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Update registration status check to include pending_payment
ALTER TABLE public.competition_registrations
  DROP CONSTRAINT IF EXISTS competition_registrations_status_check;
ALTER TABLE public.competition_registrations
  ADD CONSTRAINT competition_registrations_status_check
  CHECK (status IN ('pending', 'pending_payment', 'approved', 'rejected', 'waitlisted', 'withdrawn', 'confirmed'));

-- Add payment status check constraint
ALTER TABLE public.competition_registrations
  DROP CONSTRAINT IF EXISTS competition_registrations_payment_status_check;
ALTER TABLE public.competition_registrations
  ADD CONSTRAINT competition_registrations_payment_status_check
  CHECK (payment_status IN ('not_required', 'pending', 'succeeded', 'failed', 'refunded', 'disputed'));

-- 3. Dedicated competition_payments table (separate from SaaS subscriptions)
CREATE TABLE IF NOT EXISTS public.competition_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_id UUID NOT NULL REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  registration_id UUID NOT NULL REFERENCES public.competition_registrations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  participant_name TEXT NOT NULL,
  participant_email TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'paystack',
  payment_reference TEXT UNIQUE NOT NULL,
  external_reference TEXT,
  amount BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  provider_fee BIGINT NOT NULL DEFAULT 0,
  platform_fee BIGINT NOT NULL DEFAULT 0,
  net_amount BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'expired', 'refunded', 'partially_refunded', 'disputed')),
  idempotency_key TEXT UNIQUE,
  payment_method TEXT,
  receipt_url TEXT,
  paid_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comp_payments_leaderboard ON public.competition_payments(leaderboard_id);
CREATE INDEX IF NOT EXISTS idx_comp_payments_registration ON public.competition_payments(registration_id);
CREATE INDEX IF NOT EXISTS idx_comp_payments_reference ON public.competition_payments(payment_reference);
CREATE INDEX IF NOT EXISTS idx_comp_payments_user ON public.competition_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_comp_payments_status ON public.competition_payments(status);

-- 4. Transparent Financial Ledger: competition_ledger_entries
CREATE TABLE IF NOT EXISTS public.competition_ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_id UUID NOT NULL REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL CHECK (entry_type IN (
    'entry_fee_credit',
    'provider_fee_debit',
    'platform_fee_debit',
    'refund_debit',
    'prize_allocation',
    'organizer_payout',
    'adjustment'
  )),
  amount BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  balance_after BIGINT NOT NULL DEFAULT 0,
  payment_id UUID REFERENCES public.competition_payments(id) ON DELETE SET NULL,
  registration_id UUID REFERENCES public.competition_registrations(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comp_ledger_leaderboard ON public.competition_ledger_entries(leaderboard_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comp_ledger_payment ON public.competition_ledger_entries(payment_id);
CREATE INDEX IF NOT EXISTS idx_comp_ledger_type ON public.competition_ledger_entries(entry_type);

-- 5. Competition Refunds: competition_refunds
CREATE TABLE IF NOT EXISTS public.competition_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_id UUID NOT NULL REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  competition_payment_id UUID NOT NULL REFERENCES public.competition_payments(id) ON DELETE CASCADE,
  registration_id UUID NOT NULL REFERENCES public.competition_registrations(id) ON DELETE CASCADE,
  initiated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  amount BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  provider TEXT NOT NULL DEFAULT 'paystack',
  provider_refund_id TEXT,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'cancelled')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comp_refunds_leaderboard ON public.competition_refunds(leaderboard_id);
CREATE INDEX IF NOT EXISTS idx_comp_refunds_payment ON public.competition_refunds(competition_payment_id);

-- 6. Competition Prize Allocations: competition_prize_allocations
CREATE TABLE IF NOT EXISTS public.competition_prize_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_id UUID NOT NULL REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  rank_position INTEGER NOT NULL,
  title TEXT NOT NULL,
  allocation_type TEXT NOT NULL CHECK (allocation_type IN ('fixed_amount', 'percentage_of_pool')),
  allocated_amount BIGINT NOT NULL DEFAULT 0,
  percentage NUMERIC(5,2),
  currency TEXT NOT NULL DEFAULT 'NGN',
  recipient_member_id UUID REFERENCES public.leaderboard_members(id) ON DELETE SET NULL,
  recipient_name TEXT,
  payout_status TEXT NOT NULL DEFAULT 'allocated' CHECK (payout_status IN ('allocated', 'pending_approval', 'processing', 'paid', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comp_prizes_leaderboard ON public.competition_prize_allocations(leaderboard_id);

-- Trigger for touch_updated_at on payments and refunds
DROP TRIGGER IF EXISTS competition_payments_touch_updated_at ON public.competition_payments;
CREATE TRIGGER competition_payments_touch_updated_at BEFORE UPDATE ON public.competition_payments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS competition_refunds_touch_updated_at ON public.competition_refunds;
CREATE TRIGGER competition_refunds_touch_updated_at BEFORE UPDATE ON public.competition_refunds FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS competition_prize_allocations_touch_updated_at ON public.competition_prize_allocations;
CREATE TRIGGER competition_prize_allocations_touch_updated_at BEFORE UPDATE ON public.competition_prize_allocations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 7. Row Level Security Policies
ALTER TABLE public.competition_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_prize_allocations ENABLE ROW LEVEL SECURITY;

-- Payments: Participant can read own payment records
DROP POLICY IF EXISTS "Participants can read own competition payments" ON public.competition_payments;
CREATE POLICY "Participants can read own competition payments" ON public.competition_payments
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- Payments: Competition owners and admins can read all competition payments
DROP POLICY IF EXISTS "Competition owners and admins can view competition payments" ON public.competition_payments;
CREATE POLICY "Competition owners and admins can view competition payments" ON public.competition_payments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards l
      WHERE l.id = leaderboard_id AND (
        l.owner_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.leaderboard_admins la
          WHERE la.leaderboard_id = l.id AND la.user_id = (SELECT auth.uid())
        )
      )
    )
  );

-- Ledger: Competition owners and admins can view ledger entries
DROP POLICY IF EXISTS "Competition owners and admins can view ledger entries" ON public.competition_ledger_entries;
CREATE POLICY "Competition owners and admins can view ledger entries" ON public.competition_ledger_entries
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards l
      WHERE l.id = leaderboard_id AND (
        l.owner_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.leaderboard_admins la
          WHERE la.leaderboard_id = l.id AND la.user_id = (SELECT auth.uid())
        )
      )
    )
  );

-- Refunds: Competition owners and admins can view and create refunds
DROP POLICY IF EXISTS "Competition owners and admins can manage refunds" ON public.competition_refunds;
CREATE POLICY "Competition owners and admins can manage refunds" ON public.competition_refunds
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards l
      WHERE l.id = leaderboard_id AND (
        l.owner_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.leaderboard_admins la
          WHERE la.leaderboard_id = l.id AND la.user_id = (SELECT auth.uid())
        )
      )
    )
  );

-- Prize Allocations: Anyone can read prize allocations for accessible leaderboards
DROP POLICY IF EXISTS "Anyone can view prize allocations for accessible leaderboards" ON public.competition_prize_allocations;
CREATE POLICY "Anyone can view prize allocations for accessible leaderboards" ON public.competition_prize_allocations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards l
      WHERE l.id = leaderboard_id AND (
        l.visibility = 'public'
        OR l.owner_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.leaderboard_admins la
          WHERE la.leaderboard_id = l.id AND la.user_id = (SELECT auth.uid())
        )
      )
    )
  );

-- Prize Allocations: Competition owners and admins can manage prize allocations
DROP POLICY IF EXISTS "Competition owners and admins can manage prize allocations" ON public.competition_prize_allocations;
CREATE POLICY "Competition owners and admins can manage prize allocations" ON public.competition_prize_allocations
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards l
      WHERE l.id = leaderboard_id AND (
        l.owner_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.leaderboard_admins la
          WHERE la.leaderboard_id = l.id AND la.user_id = (SELECT auth.uid())
        )
      )
    )
  );

-- 8. Enable Realtime Publications for competition payments and ledger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'competition_payments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.competition_payments;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'competition_ledger_entries'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.competition_ledger_entries;
  END IF;
END $$;

COMMIT;
