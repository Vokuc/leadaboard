-- ==========================================
-- PAYMENTS SYSTEM (ADDITIVE ONLY)
-- ==========================================

BEGIN;

-- Plans are DB-configured and provider-agnostic.
CREATE TABLE IF NOT EXISTS public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  price BIGINT NOT NULL DEFAULT 0,
  yearly_price BIGINT,
  currency TEXT NOT NULL DEFAULT 'NGN',
  limits JSONB NOT NULL DEFAULT '{}'::jsonb,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_customer_id TEXT,
  provider_subscription_id TEXT,
  plan_id UUID NOT NULL REFERENCES public.plans(id),
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  status TEXT NOT NULL CHECK (status IN ('trialing', 'active', 'past_due', 'unpaid', 'cancelled', 'expired', 'incomplete')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  grace_period_end TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (provider, provider_subscription_id)
);

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  payment_reference TEXT NOT NULL,
  amount BIGINT NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'cancelled', 'refunded', 'partially_refunded')),
  payment_kind TEXT NOT NULL DEFAULT 'subscription' CHECK (payment_kind IN ('subscription', 'one_time', 'entry_fee', 'template_purchase')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (provider, payment_reference)
);

CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invoice_number TEXT UNIQUE NOT NULL,
  provider_invoice_id TEXT,
  amount BIGINT NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible', 'refunded')),
  download_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT,
  payload JSONB NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (provider, event_id)
);

CREATE TABLE IF NOT EXISTS public.discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  percentage NUMERIC(5,2),
  amount BIGINT,
  currency TEXT,
  expires_at TIMESTAMPTZ,
  usage_limit INTEGER,
  usage_count INTEGER NOT NULL DEFAULT 0,
  single_use BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (
    (percentage IS NOT NULL AND amount IS NULL)
    OR (percentage IS NULL AND amount IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invited UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reward JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'converted', 'rewarded', 'rejected')),
  conversion_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (inviter, invited)
);

CREATE TABLE IF NOT EXISTS public.creator_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  amount BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'paid', 'failed', 'cancelled')),
  provider_reference TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_refund_id TEXT,
  amount BIGINT NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'cancelled')),
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (provider, provider_refund_id)
);

CREATE TABLE IF NOT EXISTS public.billing_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Optional normalized usage cache. Limits can also be computed from canonical resources.
CREATE TABLE IF NOT EXISTS public.usage_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  resource_key TEXT NOT NULL,
  quantity BIGINT NOT NULL DEFAULT 0,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, resource_key, period_start)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status ON public.subscriptions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_provider ON public.subscriptions(provider, provider_subscription_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_status ON public.payments(user_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_user_created ON public.invoices(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider_processed ON public.webhook_events(provider, processed, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referrals_inviter_status ON public.referrals(inviter, status);
CREATE INDEX IF NOT EXISTS idx_creator_payouts_creator_status ON public.creator_payouts(creator_id, status);
CREATE INDEX IF NOT EXISTS idx_usage_counters_user_resource ON public.usage_counters(user_id, resource_key);

-- Keep updated_at fresh without breaking existing behavior.
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS plans_touch_updated_at ON public.plans;
CREATE TRIGGER plans_touch_updated_at BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS subscriptions_touch_updated_at ON public.subscriptions;
CREATE TRIGGER subscriptions_touch_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS invoices_touch_updated_at ON public.invoices;
CREATE TRIGGER invoices_touch_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS creator_payouts_touch_updated_at ON public.creator_payouts;
CREATE TRIGGER creator_payouts_touch_updated_at BEFORE UPDATE ON public.creator_payouts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed plans (idempotent). Existing users without subscriptions implicitly resolve to free.
INSERT INTO public.plans (name, slug, price, yearly_price, currency, limits, features, active)
VALUES
  (
    'Free',
    'free',
    0,
    0,
    'NGN',
    jsonb_build_object(
      'leaderboards', 3,
      'tournaments', 1,
      'participants_per_leaderboard', 32,
      'admins', 1,
      'storage_mb', 100,
      'uploads_per_month', 100,
      'api_requests_per_day', 500
    ),
    jsonb_build_array('basic_templates'),
    true
  ),
  (
    'Pro',
    'pro',
    3000000,
    30000000,
    'NGN',
    jsonb_build_object(
      'leaderboards', 25,
      'tournaments', 15,
      'participants_per_leaderboard', 512,
      'admins', 5,
      'storage_mb', 2048,
      'uploads_per_month', 3000,
      'api_requests_per_day', 10000
    ),
    jsonb_build_array('premium_templates', 'custom_branding', 'analytics'),
    true
  ),
  (
    'Business',
    'business',
    10000000,
    100000000,
    'NGN',
    jsonb_build_object(
      'leaderboards', 200,
      'tournaments', 100,
      'participants_per_leaderboard', 5000,
      'admins', 25,
      'storage_mb', 10240,
      'uploads_per_month', 20000,
      'api_requests_per_day', 100000
    ),
    jsonb_build_array('white_label', 'api_access', 'advanced_permissions', 'analytics'),
    true
  )
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  yearly_price = EXCLUDED.yearly_price,
  currency = EXCLUDED.currency,
  limits = EXCLUDED.limits,
  features = EXCLUDED.features,
  active = EXCLUDED.active;

-- Plan resolution helpers. Free is always fallback.
CREATE OR REPLACE FUNCTION public.get_free_plan_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT id FROM public.plans WHERE slug = 'free' LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_effective_plan_id(auth_user UUID)
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (
      SELECT s.plan_id
      FROM public.subscriptions s
      WHERE s.user_id = auth_user
        AND s.status IN ('trialing', 'active', 'past_due')
        AND (s.current_period_end IS NULL OR s.current_period_end > NOW())
      ORDER BY s.created_at DESC
      LIMIT 1
    ),
    public.get_free_plan_id()
  );
$$;

CREATE OR REPLACE FUNCTION public.get_plan_limit(auth_user UUID, limit_key TEXT)
RETURNS BIGINT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE((p.limits ->> limit_key)::BIGINT, 0)
  FROM public.plans p
  WHERE p.id = public.get_effective_plan_id(auth_user)
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.can_create_resource(auth_user UUID, resource_key TEXT, target_leaderboard UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  cap BIGINT;
  used_count BIGINT;
BEGIN
  cap := public.get_plan_limit(auth_user, resource_key);
  IF cap <= 0 THEN
    RETURN false;
  END IF;

  IF resource_key = 'leaderboards' THEN
    SELECT COUNT(*) INTO used_count FROM public.leaderboards WHERE owner_id = auth_user AND status = 'active';
    RETURN used_count < cap;
  ELSIF resource_key = 'tournaments' THEN
    SELECT COUNT(*) INTO used_count
    FROM public.tournaments t
    JOIN public.leaderboards l ON l.id = t.leaderboard_id
    WHERE l.owner_id = auth_user;
    RETURN used_count < cap;
  ELSIF resource_key = 'participants_per_leaderboard' THEN
    IF target_leaderboard IS NULL THEN
      RETURN false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.leaderboards WHERE id = target_leaderboard AND owner_id = auth_user) THEN
      RETURN false;
    END IF;

    SELECT COUNT(*) INTO used_count FROM public.leaderboard_members WHERE leaderboard_id = target_leaderboard;
    RETURN used_count < cap;
  END IF;

  RETURN true;
END;
$$;

-- RLS enablement
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;

-- Public plan readability
DROP POLICY IF EXISTS "Anyone can read active plans" ON public.plans;
CREATE POLICY "Anyone can read active plans" ON public.plans
  FOR SELECT USING (active = true);

-- Subscription visibility
DROP POLICY IF EXISTS "Users can read own subscriptions" ON public.subscriptions;
CREATE POLICY "Users can read own subscriptions" ON public.subscriptions
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own subscriptions" ON public.subscriptions;
CREATE POLICY "Users can create own subscriptions" ON public.subscriptions
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own subscriptions" ON public.subscriptions;
CREATE POLICY "Users can update own subscriptions" ON public.subscriptions
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Payments/invoices/refunds/notifications visibility
DROP POLICY IF EXISTS "Users can read own payments" ON public.payments;
CREATE POLICY "Users can read own payments" ON public.payments
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can read own invoices" ON public.invoices;
CREATE POLICY "Users can read own invoices" ON public.invoices
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can read own referrals" ON public.referrals;
CREATE POLICY "Users can read own referrals" ON public.referrals
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = inviter OR (SELECT auth.uid()) = invited);

DROP POLICY IF EXISTS "Users can create own referral" ON public.referrals;
CREATE POLICY "Users can create own referral" ON public.referrals
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = inviter);

DROP POLICY IF EXISTS "Users can read own creator payouts" ON public.creator_payouts;
CREATE POLICY "Users can read own creator payouts" ON public.creator_payouts
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = creator_id);

DROP POLICY IF EXISTS "Users can read own refunds" ON public.refunds;
CREATE POLICY "Users can read own refunds" ON public.refunds
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.payments p
      WHERE p.id = payment_id AND p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can read own billing notifications" ON public.billing_notifications;
CREATE POLICY "Users can read own billing notifications" ON public.billing_notifications
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can read own usage counters" ON public.usage_counters;
CREATE POLICY "Users can read own usage counters" ON public.usage_counters
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- Webhook/audit tables are intentionally locked for client roles.
REVOKE ALL ON public.webhook_events FROM anon, authenticated;

-- Tighten inserts on existing resource tables to enforce plan limits server-side.
DROP POLICY IF EXISTS "Owners can insert leaderboards" ON public.leaderboards;
CREATE POLICY "Owners can insert leaderboards" ON public.leaderboards
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = owner_id
    AND public.can_create_resource((SELECT auth.uid()), 'leaderboards', NULL)
  );

DROP POLICY IF EXISTS "Owners can manage leaderboard members" ON public.leaderboard_members;
CREATE POLICY "Owners can manage leaderboard members" ON public.leaderboard_members
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards l
      WHERE l.id = leaderboard_id AND (SELECT auth.uid()) = l.owner_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leaderboards l
      WHERE l.id = leaderboard_id
        AND (SELECT auth.uid()) = l.owner_id
        AND public.can_create_resource((SELECT auth.uid()), 'participants_per_leaderboard', leaderboard_id)
    )
  );

DROP POLICY IF EXISTS "Owners can manage tournaments" ON public.tournaments;
CREATE POLICY "Owners can manage tournaments" ON public.tournaments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards l
      WHERE l.id = leaderboard_id AND (SELECT auth.uid()) = l.owner_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leaderboards l
      WHERE l.id = leaderboard_id
        AND (SELECT auth.uid()) = l.owner_id
        AND public.can_create_resource((SELECT auth.uid()), 'tournaments', NULL)
    )
  );

-- Realtime includes billing-facing tables that are safe for user-scoped reads.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'subscriptions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.subscriptions;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'payments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
  END IF;
END $$;

COMMIT;
