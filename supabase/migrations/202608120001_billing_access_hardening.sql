-- ==========================================
-- BILLING ACCESS HARDENING (ADDITIVE ONLY)
-- ==========================================

BEGIN;

-- Feature helper for centralized paid-feature gating logic.
CREATE OR REPLACE FUNCTION public.has_plan_feature(auth_user UUID, feature_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.plans p
    WHERE p.id = public.get_effective_plan_id(auth_user)
      AND p.features @> to_jsonb(ARRAY[feature_key])
  );
$$;

-- Lock subscription writes from regular authenticated users.
-- Subscription state is managed by trusted server code + provider webhooks.
DROP POLICY IF EXISTS "Users can create own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update own subscriptions" ON public.subscriptions;

-- Optional defense in depth: revoke direct mutation table privileges from client roles.
REVOKE INSERT, UPDATE, DELETE ON public.subscriptions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.payments FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.invoices FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.refunds FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.billing_notifications FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.webhook_events FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.discount_codes FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.creator_payouts FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.usage_counters FROM anon, authenticated;

COMMIT;
