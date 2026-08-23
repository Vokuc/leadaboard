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
  - [src/app/api/payments/admin/users/route.ts](src/app/api/payments/admin/users/route.ts)
- UI:
  - [src/app/dashboard/billing/page.tsx](src/app/dashboard/billing/page.tsx)
  - [src/app/dashboard/admin/billing/page.tsx](src/app/dashboard/admin/billing/page.tsx)
  - [src/app/dashboard/admin/users/page.tsx](src/app/dashboard/admin/users/page.tsx)

## Provider Adapters

Provider adapters use a shared interface with provider-specific implementations:

- Stripe
- Paystack
- Flutterwave
- Pi

Current status:

- Paystack has live transaction initialization + webhook signature verification implemented in [src/lib/payments/providers/paystack.ts](src/lib/payments/providers/paystack.ts).
- Stripe, Flutterwave, and Pi remain contract stubs and should be implemented similarly before production use.

## Paystack Go-Live

1. Set environment variables in production:
  - `PAYSTACK_SECRET_KEY`
  - `PAYSTACK_WEBHOOK_SECRET` (optional, defaults to secret key)
  - Optional plan envs for subscriptions: `PAYSTACK_PLAN_CODE_*`
2. Configure Paystack Dashboard Webhook URL:
  - `https://<your-domain>/api/payments/webhooks/paystack`
3. Ensure your app URL in checkout is HTTPS and publicly reachable.
4. Start in test mode and run a full payment lifecycle:
  - start checkout
  - pay with test card/bank
  - confirm `payments.status` updates from `pending` to `succeeded`
  - confirm `invoices.status` updates to `paid`
5. Switch to live key only after test verification.

### Expected Paystack Event Handling

- Incoming signatures are verified with HMAC SHA512.
- Idempotency is enforced by `webhook_events(provider,event_id)`.
- Payment and invoice statuses are synced in webhook processing.

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

- Add real signature verification per remaining providers (Stripe/Flutterwave/Pi)
- Implement provider-side subscription cancellation APIs where needed
- Add explicit admin RBAC checks for admin billing routes
- Add integration tests for webhook retries and duplicate delivery
- Add provider-specific reconciliation jobs for failed events
