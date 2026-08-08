import { createSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server';
import {
  BillingCycle,
  CheckoutRequest,
  CheckoutResponse,
  CreateSubscriptionRequest,
  PaymentProviderKey,
  SubscriptionStatus,
} from '@/lib/payments/core/types';
import { getPaymentProvider, getSupportedProviders } from '@/lib/payments/providers';
import { getActivePlans, getPlanBySlug, getUserSubscription } from '@/lib/payments/core/queries';

interface StartCheckoutInput {
  userId: string;
  userEmail?: string;
  provider: PaymentProviderKey;
  kind: CheckoutRequest['kind'];
  currency: string;
  planSlug?: string;
  billingCycle?: BillingCycle;
  amount?: number;
  discountCode?: string;
  metadata?: Record<string, unknown>;
  successUrl: string;
  cancelUrl: string;
}

interface UsageSnapshot {
  leaderboards: number;
  tournaments: number;
  participants: number;
}

const PROVIDER_ALLOWED_CURRENCIES: Record<PaymentProviderKey, string[]> = {
  stripe: ['USD'],
  paystack: ['NGN'],
  flutterwave: ['USD', 'NGN'],
  pi: ['USD'],
};

function assertServerConfigured(): void {
  if (!isSupabaseServerConfigured) {
    throw new Error('Supabase server environment is not configured.');
  }
}

function coerceStatus(status: string | null | undefined): SubscriptionStatus {
  const valid: SubscriptionStatus[] = ['trialing', 'active', 'past_due', 'unpaid', 'cancelled', 'expired', 'incomplete'];
  if (status && valid.includes(status as SubscriptionStatus)) {
    return status as SubscriptionStatus;
  }
  return 'incomplete';
}

function validateProviderCurrency(provider: PaymentProviderKey, currency: string): string {
  const normalized = currency.trim().toUpperCase();
  const allowed = PROVIDER_ALLOWED_CURRENCIES[provider] || [];

  if (!allowed.includes(normalized)) {
    throw new Error(`${provider} does not support ${normalized} in the current app configuration.`);
  }

  return normalized;
}

async function computeUsage(userId: string): Promise<UsageSnapshot> {
  assertServerConfigured();
  const supabase = await createSupabaseServerClient();

  const { data: leaderboards, error: leaderboardError } = await supabase
    .from('leaderboards')
    .select('id')
    .eq('owner_id', userId)
    .eq('status', 'active');

  if (leaderboardError) {
    throw leaderboardError;
  }

  const ids = (leaderboards || []).map((row) => row.id);

  let tournamentsCount = 0;
  let participantsCount = 0;

  if (ids.length > 0) {
    const { count: tCount, error: tError } = await supabase
      .from('tournaments')
      .select('leaderboard_id', { count: 'exact', head: true })
      .in('leaderboard_id', ids);

    if (tError) {
      throw tError;
    }

    const { count: pCount, error: pError } = await supabase
      .from('leaderboard_members')
      .select('id', { count: 'exact', head: true })
      .in('leaderboard_id', ids);

    if (pError) {
      throw pError;
    }

    tournamentsCount = tCount || 0;
    participantsCount = pCount || 0;
  }

  return {
    leaderboards: ids.length,
    tournaments: tournamentsCount,
    participants: participantsCount,
  };
}

async function applyDiscountCode(code: string | undefined, amount: number, currency: string): Promise<number> {
  if (!code) {
    return amount;
  }

  assertServerConfigured();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('discount_codes')
    .select('*')
    .eq('code', code.toUpperCase())
    .eq('active', true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Invalid discount code.');
  }

  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    throw new Error('Discount code has expired.');
  }

  if (data.usage_limit && data.usage_count >= data.usage_limit) {
    throw new Error('Discount code usage limit reached.');
  }

  let discounted = amount;
  if (data.percentage) {
    discounted = Math.max(0, Math.round(amount - (amount * Number(data.percentage)) / 100));
  } else if (data.amount) {
    if (data.currency && data.currency !== currency) {
      throw new Error('Discount code currency mismatch.');
    }
    discounted = Math.max(0, amount - Number(data.amount));
  }

  return discounted;
}

async function upsertSubscription(input: {
  userId: string;
  provider: PaymentProviderKey;
  planId: string;
  billingCycle: BillingCycle;
  providerCustomerId?: string;
  providerSubscriptionId?: string;
  status: SubscriptionStatus;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  gracePeriodEnd?: string | null;
  trialEnd?: string | null;
  cancelledAt?: string | null;
  metadata?: Record<string, unknown>;
}) {
  assertServerConfigured();
  const supabase = await createSupabaseServerClient();

  const { data: existing, error: existingError } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('user_id', input.userId)
    .eq('provider', input.provider)
    .eq('plan_id', input.planId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing?.id) {
    const { data, error } = await supabase
      .from('subscriptions')
      .update({
        provider_customer_id: input.providerCustomerId || null,
        provider_subscription_id: input.providerSubscriptionId || null,
        billing_cycle: input.billingCycle,
        status: input.status,
        current_period_start: input.currentPeriodStart || null,
        current_period_end: input.currentPeriodEnd || null,
        grace_period_end: input.gracePeriodEnd || null,
        trial_end: input.trialEnd || null,
        cancelled_at: input.cancelledAt || null,
        metadata: input.metadata || {},
      })
      .eq('id', existing.id)
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  const { data, error } = await supabase
    .from('subscriptions')
    .insert({
      user_id: input.userId,
      provider: input.provider,
      provider_customer_id: input.providerCustomerId || null,
      provider_subscription_id: input.providerSubscriptionId || null,
      plan_id: input.planId,
      billing_cycle: input.billingCycle,
      status: input.status,
      current_period_start: input.currentPeriodStart || null,
      current_period_end: input.currentPeriodEnd || null,
      grace_period_end: input.gracePeriodEnd || null,
      trial_end: input.trialEnd || null,
      cancelled_at: input.cancelledAt || null,
      metadata: input.metadata || {},
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function createPayment(input: {
  userId: string;
  subscriptionId: string | null;
  provider: PaymentProviderKey;
  paymentReference: string;
  amount: number;
  currency: string;
  status: 'pending' | 'succeeded' | 'failed' | 'cancelled' | 'refunded' | 'partially_refunded';
  kind: 'subscription' | 'one_time' | 'entry_fee' | 'template_purchase';
  metadata?: Record<string, unknown>;
}) {
  assertServerConfigured();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('payments')
    .insert({
      user_id: input.userId,
      subscription_id: input.subscriptionId,
      provider: input.provider,
      payment_reference: input.paymentReference,
      amount: input.amount,
      currency: input.currency,
      status: input.status,
      payment_kind: input.kind,
      metadata: input.metadata || {},
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function createInvoice(input: {
  userId: string;
  paymentId: string;
  amount: number;
  currency: string;
  providerInvoiceId?: string | null;
  status?: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible' | 'refunded';
  downloadUrl?: string | null;
  metadata?: Record<string, unknown>;
}) {
  assertServerConfigured();
  const supabase = await createSupabaseServerClient();

  const invoiceNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  const { data, error } = await supabase
    .from('invoices')
    .insert({
      user_id: input.userId,
      payment_id: input.paymentId,
      invoice_number: invoiceNumber,
      provider_invoice_id: input.providerInvoiceId || null,
      amount: input.amount,
      currency: input.currency,
      status: input.status || 'paid',
      download_url: input.downloadUrl || null,
      metadata: input.metadata || {},
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function enqueueNotification(userId: string, type: string, payload: Record<string, unknown>) {
  assertServerConfigured();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from('billing_notifications')
    .insert({
      user_id: userId,
      notification_type: type,
      payload,
      sent_at: new Date().toISOString(),
    });

  if (error) {
    throw error;
  }
}

export const PaymentService = {
  getSupportedProviders,

  async getBillingOverview(userId: string) {
    assertServerConfigured();
    const [plans, subscription, usage] = await Promise.all([
      getActivePlans(),
      getUserSubscription(userId),
      computeUsage(userId),
    ]);

    const effectivePlan = subscription?.plans || plans.find((plan) => plan.slug === 'free') || null;

    return {
      plans,
      subscription: subscription
        ? {
            ...subscription,
            status: coerceStatus(subscription.status),
          }
        : null,
      effectivePlan,
      usage,
      now: new Date().toISOString(),
    };
  },

  async startCheckout(input: StartCheckoutInput): Promise<CheckoutResponse> {
    assertServerConfigured();

    const currency = validateProviderCurrency(input.provider, input.currency);

    if (input.kind === 'subscription' && !input.planSlug) {
      throw new Error('Plan is required for subscription checkout.');
    }

    const provider = getPaymentProvider(input.provider);
    const plan = input.planSlug ? await getPlanBySlug(input.planSlug) : null;

    if (input.kind === 'subscription' && !plan) {
      throw new Error('Selected plan does not exist.');
    }

    const cycle = input.billingCycle || 'monthly';
    const baseAmount = input.amount ?? (plan ? (cycle === 'yearly' ? (plan.yearly_price || plan.price) : plan.price) : 0);
    const finalAmount = await applyDiscountCode(input.discountCode, baseAmount, currency);

    const checkout = await provider.createCheckoutSession({
      userId: input.userId,
      userEmail: input.userEmail,
      provider: input.provider,
      kind: input.kind,
      amount: finalAmount,
      currency,
      planSlug: input.planSlug,
      billingCycle: cycle,
      discountCode: input.discountCode,
      metadata: input.metadata,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
    });

    let subscriptionId: string | null = null;
    if (input.kind === 'subscription' && plan) {
      const providerSubscription = await provider.createOrUpdateSubscription({
        userId: input.userId,
        provider: input.provider,
        planId: plan.id,
        billingCycle: cycle,
        metadata: {
          checkout_reference: checkout.paymentReference,
          ...(input.metadata || {}),
        },
      } as CreateSubscriptionRequest);

      const sub = await upsertSubscription({
        userId: input.userId,
        provider: input.provider,
        planId: plan.id,
        billingCycle: cycle,
        providerCustomerId: providerSubscription.providerCustomerId,
        providerSubscriptionId: providerSubscription.providerSubscriptionId,
        status: providerSubscription.status,
        currentPeriodStart: providerSubscription.currentPeriodStart,
        currentPeriodEnd: providerSubscription.currentPeriodEnd,
        gracePeriodEnd: providerSubscription.gracePeriodEnd,
        cancelledAt: providerSubscription.cancelledAt,
        metadata: providerSubscription.metadata,
      });

      subscriptionId = sub.id;
    }

    const payment = await createPayment({
      userId: input.userId,
      subscriptionId,
      provider: input.provider,
      paymentReference: checkout.paymentReference,
      amount: finalAmount,
      currency,
      status: 'pending',
      kind: input.kind,
      metadata: input.metadata,
    });

    await createInvoice({
      userId: input.userId,
      paymentId: payment.id,
      amount: finalAmount,
      currency,
      status: 'open',
      metadata: {
        provider: input.provider,
        checkout_reference: checkout.paymentReference,
      },
    });

    await enqueueNotification(input.userId, 'checkout_started', {
      provider: input.provider,
      kind: input.kind,
      amount: finalAmount,
      currency,
      payment_reference: checkout.paymentReference,
    });

    return checkout;
  },

  async cancelSubscription(userId: string, providerKey: PaymentProviderKey): Promise<void> {
    assertServerConfigured();
    const supabase = await createSupabaseServerClient();

    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', providerKey)
      .in('status', ['trialing', 'active', 'past_due', 'unpaid', 'incomplete'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!subscription) {
      return;
    }

    const provider = getPaymentProvider(providerKey);
    const cancelled = await provider.cancelSubscription(subscription.provider_subscription_id || '');

    const gracePeriod = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({
        status: cancelled.status,
        cancelled_at: cancelled.cancelledAt || new Date().toISOString(),
        grace_period_end: gracePeriod,
        metadata: {
          ...(subscription.metadata || {}),
          ...(cancelled.metadata || {}),
          cancelled_via: 'dashboard',
        },
      })
      .eq('id', subscription.id);

    if (updateError) {
      throw updateError;
    }

    await enqueueNotification(userId, 'subscription_cancelled', {
      provider: providerKey,
      grace_period_end: gracePeriod,
    });
  },
};
