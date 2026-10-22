-- Migration: 202610300001_api_keys_and_webhooks.sql
-- Description: API Keys, Webhook Subscriptions, Deliveries, and Idempotency Records for Era 5 Secure API.

-- ============================================================================
-- 1. API KEYS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  secret_hash TEXT NOT NULL,
  scopes JSONB NOT NULL DEFAULT '["competitions:read"]'::jsonb,
  rate_limit_per_minute INTEGER NOT NULL DEFAULT 60,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_owner ON public.api_keys(owner_id, status);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON public.api_keys(key_prefix);

-- ============================================================================
-- 2. WEBHOOK SUBSCRIPTIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events JSONB NOT NULL DEFAULT '["competition.updated"]'::jsonb,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_subs_owner ON public.webhook_subscriptions(owner_id, status);

-- ============================================================================
-- 3. WEBHOOK DELIVERIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.webhook_subscriptions(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'pending')),
  status_code INTEGER,
  attempts INTEGER NOT NULL DEFAULT 1,
  error_message TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_sub ON public.webhook_deliveries(subscription_id, created_at DESC);

-- ============================================================================
-- 4. API IDEMPOTENCY RECORDS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.api_idempotency_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id UUID NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_status INTEGER NOT NULL,
  response_body TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_api_idempotency_key UNIQUE (key_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_lookup ON public.api_idempotency_records(key_id, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON public.api_idempotency_records(expires_at);

-- ============================================================================
-- 5. API AUDIT LOGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.api_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id UUID REFERENCES public.api_keys(id) ON DELETE SET NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  duration_ms INTEGER,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_audit_owner ON public.api_audit_logs(owner_id, created_at DESC);

-- ============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_idempotency_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_audit_logs ENABLE ROW LEVEL SECURITY;

-- API Keys: Only owners can manage their keys
CREATE POLICY "Users manage their own API keys"
  ON public.api_keys
  FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Webhook Subscriptions: Only owners manage their subscriptions
CREATE POLICY "Users manage their own webhook subscriptions"
  ON public.webhook_subscriptions
  FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Webhook Deliveries: Users view deliveries for their subscriptions
CREATE POLICY "Users view deliveries for their webhooks"
  ON public.webhook_deliveries
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.webhook_subscriptions s
      WHERE s.id = subscription_id AND s.owner_id = auth.uid()
    )
  );

-- API Audit Logs: Users view their audit logs
CREATE POLICY "Users view their own audit logs"
  ON public.api_audit_logs
  FOR SELECT
  USING (auth.uid() = owner_id);
