# Payments System

This repository now includes an additive, provider-agnostic billing foundation that is backward-compatible with existing features.

## What Was Added

- Additive migration: [supabase/migrations/202608050001_payments_system.sql](supabase/migrations/202608050001_payments_system.sql)
- Provider abstraction and registry:
  - [src/lib/payments/core/types.ts](src/lib/payments/core/types.ts)
  - [src/lib/payments/providers/index.ts](src/lib/payments/providers/index.ts)
- Runtime services:
  - [src/lib/payments/core/service.ts](src/lib/payments/core/service.ts)
  - [src/lib/payments/core/webhooks.ts](src/lib/payments/core/webhooks.ts)
- Billing access checks:
  - [src/lib/billing/access.ts](src/lib/billing/access.ts)
- APIs:
  - [src/app/api/payments/checkout/route.ts](src/app/api/payments/checkout/route.ts)
  - [src/app/api/payments/webhooks/[provider]/route.ts](src/app/api/payments/webhooks/[provider]/route.ts)
  - [src/app/api/payments/me/route.ts](src/app/api/payments/me/route.ts)
  - [src/app/api/payments/cancel/route.ts](src/app/api/payments/cancel/route.ts)
  - [src/app/api/payments/admin/metrics/route.ts](src/app/api/payments/admin/metrics/route.ts)
- UI:
  - [src/app/dashboard/billing/page.tsx](src/app/dashboard/billing/page.tsx)
  - [src/app/dashboard/admin/billing/page.tsx](src/app/dashboard/admin/billing/page.tsx)

## Provider Adapters

Current provider adapters are deterministic stubs with consistent interfaces:

- Stripe
- Paystack
- Flutterwave
- Pi

They are intentionally safe defaults. Replace methods in each provider class with real SDK/API calls while keeping return shapes the same.

## Webhooks

`/api/payments/webhooks/[provider]` performs:

- Provider normalization and verification hook
- Idempotency via `webhook_events(provider,event_id)`
- Payment status updates
- Subscription status transitions
- Invoice and notification updates

## Plan-Limit Enforcement

Migration adds SQL helper functions:

- `get_effective_plan_id(auth_user uuid)`
- `get_plan_limit(auth_user uuid, limit_key text)`
- `can_create_resource(auth_user uuid, resource_key text, target_leaderboard uuid)`

Policies for leaderboards, members, and tournaments were updated to enforce limits server-side at insert/write time.

## Production Hardening Checklist

- Add real signature verification per provider (HMAC/public-key as required)
- Replace stub checkout URLs with provider-hosted sessions
- Add explicit admin RBAC checks for admin billing routes
- Add integration tests for webhook retries and duplicate delivery
- Add provider-specific reconciliation jobs for failed events
