'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BadgeDollarSign, Check, Loader2, ShieldAlert } from 'lucide-react';
import { ACTIVE_PAYMENT_PROVIDER, getProviderDefaultCurrency } from '@/lib/payments/config';

type Plan = {
  id: string;
  name: string;
  slug: string;
  price: number;
  yearly_price: number | null;
  currency: string;
  limits: Record<string, unknown>;
  features: unknown[];
  active: boolean;
};

type BillingOverview = {
  plans: Plan[];
  subscription: {
    id: string;
    provider: 'stripe' | 'paystack' | 'flutterwave' | 'pi';
    billing_cycle: 'monthly' | 'yearly' | 'custom';
    status: 'trialing' | 'active' | 'past_due' | 'unpaid' | 'cancelled' | 'expired' | 'incomplete';
    current_period_end: string | null;
    plans?: Plan;
  } | null;
  effectivePlan: Plan | null;
  usage: {
    leaderboards: number;
    tournaments: number;
    participants: number;
  };
  now: string;
};

type ProviderKey = 'stripe' | 'paystack' | 'flutterwave' | 'pi';

function formatPlanAmount(amountInMinorUnits: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountInMinorUnits / 100);
}

export default function BillingPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const provider: ProviderKey = ACTIVE_PAYMENT_PROVIDER;
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');
  const hasAutoStartedRef = useRef(false);

  async function loadOverview() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/payments/me', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      const payload = (await response.json()) as BillingOverview | { error: string };
      if (!response.ok) {
        const message = 'error' in payload ? payload.error : 'Failed to load billing overview.';
        throw new Error(message);
      }

      setOverview(payload as BillingOverview);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load billing overview.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      void loadOverview();
    });
  }, []);

  const currentPlanSlug = overview?.effectivePlan?.slug || 'free';
  const providerCurrency = getProviderDefaultCurrency(provider).toUpperCase();

  const sortedPlans = useMemo(() => {
    return [...(overview?.plans || [])].sort((a, b) => a.price - b.price);
  }, [overview]);

  useEffect(() => {
    let ignore = false;

    const verifyTransaction = async () => {
      const params = new URLSearchParams(window.location.search);
      const checkoutState = params.get('checkout');
      const reference = params.get('reference') || params.get('trxref');

      if (checkoutState === 'cancelled') {
        if (!ignore) {
          setError('Payment was cancelled before completion.');
        }
        return;
      }

      if (checkoutState !== 'success' || !reference) {
        return;
      }

      try {
        setBusy(true);
        setError(null);

        const response = await fetch('/api/payments/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reference }),
        });

        const payload = (await response.json()) as { ok?: boolean; status?: string; error?: string };
        if (!response.ok || payload.ok === false) {
          throw new Error(payload.error || 'Payment verification failed.');
        }

        if (!ignore) {
          setVerificationMessage('Payment verified successfully. Subscription status updated.');
          await loadOverview();
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Payment verification failed.';
        if (!ignore) {
          setError(message);
        }
      } finally {
        if (!ignore) {
          setBusy(false);
        }
      }
    };

    void verifyTransaction();

    return () => {
      ignore = true;
    };
  }, []);

  const startCheckout = useCallback(async (planSlug: string, cycleOverride?: 'monthly' | 'yearly') => {
    setBusy(true);
    setError(null);

    try {
      const targetCycle = cycleOverride || cycle;
      const response = await fetch('/api/payments/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          kind: 'subscription',
          currency: providerCurrency,
          planSlug,
          billingCycle: targetCycle,
          successUrl: `${window.location.origin}/dashboard/billing?checkout=success`,
          cancelUrl: `${window.location.origin}/dashboard/billing?checkout=cancelled`,
          metadata: {
            source: 'billing_page',
          },
        }),
      });

      const rawBody = await response.text();
      let payload: { checkoutUrl?: string; error?: string; message?: string } = {};

      if (rawBody) {
        try {
          payload = JSON.parse(rawBody) as { checkoutUrl?: string; error?: string; message?: string };
        } catch {
          payload = {
            error: `Checkout failed with HTTP ${response.status}.`,
          };
        }
      }

      if (!response.ok || !payload.checkoutUrl) {
        throw new Error(payload.error || payload.message || `Unable to start checkout (HTTP ${response.status}).`);
      }

      window.location.assign(payload.checkoutUrl);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to start checkout.';
      setError(message);
      setBusy(false);
    }
  }, [cycle, provider, providerCurrency]);

  useEffect(() => {
    if (!overview || loading || busy || hasAutoStartedRef.current) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const shouldAutoStart = params.get('autostart') === '1';

    if (!shouldAutoStart) {
      return;
    }

    const planSlug = (params.get('plan') || '').trim().toLowerCase();
    const cycleParam = params.get('cycle');
    const targetCycle = cycleParam === 'yearly' ? 'yearly' : 'monthly';

    const targetPlan = overview.plans.find((plan) => plan.slug === planSlug);
    if (!targetPlan) {
      hasAutoStartedRef.current = true;
      return;
    }

    if (targetPlan.slug === 'free' || Number(targetPlan.price) === 0) {
      hasAutoStartedRef.current = true;
      return;
    }

    hasAutoStartedRef.current = true;
    queueMicrotask(() => {
      void startCheckout(targetPlan.slug, targetCycle);
    });
  }, [busy, loading, overview, startCheckout]);

  async function cancelSubscription() {
    if (!overview?.subscription) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const response = await fetch('/api/payments/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: overview.subscription.provider }),
      });

      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'Unable to cancel subscription.');
      }

      await loadOverview();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to cancel subscription.';
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="flex items-center gap-2 text-neutral-300">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading billing...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pb-16">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div>
            <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white">
              <ArrowLeft className="w-4 h-4" /> Back to Dashboard
            </Link>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">Billing & Subscription</h1>
            <p className="text-sm text-neutral-400 mt-1">Manage your plan, provider, billing cycle, and limits.</p>
          </div>
          <div className="px-3 py-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 text-sm">
            Effective plan: <span className="font-semibold">{overview?.effectivePlan?.name || 'Free'}</span>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-xl border border-red-500/20 bg-red-500/10 text-red-300 text-sm flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" /> {error}
          </div>
        )}

        {verificationMessage && (
          <div className="mb-6 p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 text-sm">
            {verificationMessage}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="rounded-2xl border border-white/10 bg-neutral-950 p-5">
            <h2 className="text-sm uppercase tracking-wider text-neutral-400">Current Subscription</h2>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-400">Status</span>
                <span className="font-semibold">{overview?.subscription?.status || 'free'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Provider</span>
                <span className="font-semibold">{overview?.subscription?.provider || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Renewal</span>
                <span className="font-semibold">
                  {overview?.subscription?.current_period_end
                    ? new Date(overview.subscription.current_period_end).toLocaleDateString()
                    : '-'}
                </span>
              </div>
            </div>

            {overview?.subscription && (
              <button
                disabled={busy}
                onClick={cancelSubscription}
                className="mt-5 w-full rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 py-2 text-sm font-semibold hover:bg-red-500/20 disabled:opacity-50"
              >
                Cancel Subscription
              </button>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-neutral-950 p-5">
            <h2 className="text-sm uppercase tracking-wider text-neutral-400">Checkout Provider</h2>
            <div className="mt-4 rounded-xl border border-violet-400/30 bg-violet-500/10 px-3 py-2 text-sm text-violet-200">
              Paystack (NGN)
            </div>

            <p className="mt-4 text-xs text-amber-300">
              Billing is currently routed through Paystack only. Stripe and Pi can be enabled later without changing this flow.
            </p>

            <h2 className="text-sm uppercase tracking-wider text-neutral-400 mt-6">Billing Cycle</h2>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              {(['monthly', 'yearly'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCycle(item)}
                  className={`rounded-lg border px-3 py-2 capitalize ${
                    cycle === item
                      ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                      : 'border-white/10 bg-neutral-900 text-neutral-300'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-neutral-950 p-5">
            <h2 className="text-sm uppercase tracking-wider text-neutral-400">Usage Snapshot</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Leaderboards</span>
                <span className="font-semibold">{overview?.usage.leaderboards || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Tournaments</span>
                <span className="font-semibold">{overview?.usage.tournaments || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Participants</span>
                <span className="font-semibold">{overview?.usage.participants || 0}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {sortedPlans.map((plan) => {
            const isCurrent = plan.slug === currentPlanSlug;
            const isFreePlan = plan.slug === 'free' || plan.price === 0;
            const canRetryCheckout = !isFreePlan;
            const monthly = formatPlanAmount(plan.price, providerCurrency);
            const yearly = formatPlanAmount(plan.yearly_price || plan.price, providerCurrency);

            return (
              <div
                key={plan.id}
                className={`rounded-2xl border p-5 ${
                  isCurrent
                    ? 'border-emerald-400/40 bg-emerald-500/10'
                    : 'border-white/10 bg-neutral-950'
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold">{plan.name}</h3>
                  {isCurrent && <span className="text-xs px-2 py-1 rounded bg-emerald-500/20 text-emerald-200">Current</span>}
                </div>

                <div className="mt-3 flex items-end gap-2">
                  <span className="text-3xl font-bold">{cycle === 'yearly' ? yearly : monthly}</span>
                  <span className="text-sm text-neutral-400">/{cycle === 'yearly' ? 'year' : 'month'}</span>
                </div>

                <ul className="mt-5 space-y-2 text-sm text-neutral-300">
                  {Object.entries(plan.limits || {}).slice(0, 5).map(([key, value]) => (
                    <li key={key} className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>
                        {key.replaceAll('_', ' ')}: <strong>{String(value)}</strong>
                      </span>
                    </li>
                  ))}
                </ul>

                <button
                  disabled={busy || !canRetryCheckout}
                  onClick={() => startCheckout(plan.slug)}
                  className="mt-6 w-full rounded-xl py-2.5 text-sm font-semibold bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isFreePlan ? 'Included Plan' : isCurrent ? 'Retry Paystack Checkout' : 'Upgrade with Paystack'}
                </button>

                {!isFreePlan && isCurrent && (
                  <p className="mt-2 text-[11px] text-neutral-400">Current plan is selectable for test retries.</p>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-8 p-4 rounded-2xl border border-white/10 bg-neutral-950 text-sm text-neutral-300 flex items-start gap-3">
          <BadgeDollarSign className="w-5 h-5 text-cyan-300 mt-0.5" />
          <div>
            Paystack checkout uses NGN pricing. If checkout fails, fix the reported blocker (env key, plan code, or callback verification) and retry on the same plan card.
          </div>
        </div>
      </div>
    </div>
  );
}
