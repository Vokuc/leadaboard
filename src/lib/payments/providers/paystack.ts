import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  CheckoutRequest,
  CheckoutResponse,
  CreateSubscriptionRequest,
  NormalizedWebhookEvent,
  ProviderSubscriptionUpsert,
  RefundRequest,
  RefundResponse,
  WebhookVerificationInput,
} from '@/lib/payments/core/types';
import { BaseProvider } from '@/lib/payments/providers/base';

const PAYSTACK_API_BASE = process.env.PAYSTACK_API_BASE_URL || 'https://api.paystack.co';

function requireSecret(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    throw new Error('PAYSTACK_SECRET_KEY is missing.');
  }
  return key;
}

function normalizeCurrency(currency: string): string {
  return currency.trim().toUpperCase();
}

function resolvePlanCode(planSlug?: string, billingCycle?: string): string | undefined {
  if (!planSlug) {
    return undefined;
  }

  const slug = planSlug.toUpperCase().replace(/-/g, '_');
  const cycle = (billingCycle || 'monthly').toUpperCase();

  return (
    process.env[`PAYSTACK_PLAN_CODE_${slug}_${cycle}`] ||
    process.env[`PAYSTACK_PLAN_CODE_${slug}`] ||
    undefined
  );
}

function secureEquals(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

type PaystackInitializeResponse = {
  status: boolean;
  message: string;
  data?: {
    authorization_url?: string;
    access_code?: string;
    reference?: string;
  };
};

type PaystackRefundResponse = {
  status: boolean;
  message: string;
  data?: {
    id?: number;
    refund_reference?: string;
    status?: string;
  };
};

export class PaystackProvider extends BaseProvider {
  constructor() {
    super('paystack');
  }

  override async createCheckoutSession(input: CheckoutRequest): Promise<CheckoutResponse> {
    const secretKey = requireSecret();
    const payerEmail = input.userEmail?.trim();

    if (!payerEmail) {
      throw new Error('Paystack requires an authenticated user email.');
    }

    const reference = `paystack_${randomUUID().replace(/-/g, '').slice(0, 24)}`;
    const planCode = input.kind === 'subscription' ? resolvePlanCode(input.planSlug, input.billingCycle) : undefined;

    if (input.kind === 'subscription' && !planCode) {
      const planKey = `${String(input.planSlug || '').toUpperCase().replace(/-/g, '_')}_${String(input.billingCycle || 'monthly').toUpperCase()}`;
      throw new Error(`Missing Paystack plan code configuration for ${planKey}. Set PAYSTACK_PLAN_CODE_${planKey} in the server environment.`);
    }

    const body: Record<string, unknown> = {
      email: payerEmail,
      amount: input.amount,
      currency: normalizeCurrency(input.currency),
      reference,
      callback_url: input.successUrl,
      metadata: {
        provider: 'paystack',
        user_id: input.userId,
        kind: input.kind,
        plan_slug: input.planSlug,
        billing_cycle: input.billingCycle,
        ...(input.metadata || {}),
      },
    };

    if (planCode) {
      body.plan = planCode;
    }

    const response = await fetch(`${PAYSTACK_API_BASE}/transaction/initialize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const payload = (await response.json()) as PaystackInitializeResponse;
    if (!response.ok || !payload.status || !payload.data?.authorization_url) {
      throw new Error(payload.message || 'Failed to initialize Paystack checkout.');
    }

    return {
      provider: this.key,
      checkoutUrl: payload.data.authorization_url,
      paymentReference: payload.data.reference || reference,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };
  }

  override async verifyWebhook(input: WebhookVerificationInput): Promise<NormalizedWebhookEvent> {
    const secret = process.env.PAYSTACK_WEBHOOK_SECRET || requireSecret();
    const signature = input.signature?.trim();

    if (!signature) {
      throw new Error('Missing Paystack webhook signature.');
    }

    const digest = createHmac('sha512', secret).update(input.payload).digest('hex');
    if (!secureEquals(digest, signature)) {
      throw new Error('Invalid Paystack webhook signature.');
    }

    const parsed = JSON.parse(input.payload) as Record<string, unknown>;
    const eventType = String(parsed.event || parsed.type || 'unknown.event');
    const data = (parsed.data || {}) as Record<string, unknown>;
    const reference = String(data.reference || '');

    const subscriptionBlock =
      typeof data.subscription === 'object' && data.subscription
        ? (data.subscription as Record<string, unknown>)
        : {};

    const subscriptionCode = String(
      subscriptionBlock.subscription_code || data.subscription_code || data.subscriptionCode || ''
    );

    const fallbackId = createHash('sha256').update(`${eventType}:${reference}:${input.payload}`).digest('hex').slice(0, 32);
    const eventId = String(parsed.id || data.id || `${eventType}:${reference || fallbackId}`);

    return {
      provider: this.key,
      eventId,
      eventType,
      data: {
        ...data,
        payment_reference: reference,
        provider_subscription_id: subscriptionCode,
      },
    };
  }

  override async createOrUpdateSubscription(input: CreateSubscriptionRequest): Promise<ProviderSubscriptionUpsert> {
    const now = new Date();

    return {
      providerCustomerId: `paystack_cus_${input.userId}`,
      providerSubscriptionId: String((input.metadata || {}).provider_subscription_id || ''),
      status: 'incomplete',
      currentPeriodStart: now.toISOString(),
      metadata: {
        plan_id: input.planId,
        billing_cycle: input.billingCycle,
        ...(input.metadata || {}),
      },
    };
  }

  override async cancelSubscription(providerSubscriptionId: string): Promise<ProviderSubscriptionUpsert> {
    return {
      providerSubscriptionId,
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
      metadata: {
        cancellation_mode: 'local_mark_only',
      },
    };
  }

  override async processRefund(input: RefundRequest): Promise<RefundResponse> {
    const secretKey = requireSecret();

    const response = await fetch(`${PAYSTACK_API_BASE}/refund`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transaction: input.paymentReference,
        amount: input.amount,
        currency: normalizeCurrency(input.currency),
      }),
    });

    const payload = (await response.json()) as PaystackRefundResponse;
    if (!response.ok || !payload.status) {
      throw new Error(payload.message || 'Failed to process Paystack refund.');
    }

    return {
      providerRefundId: payload.data?.refund_reference || String(payload.data?.id || `rfnd_${randomUUID()}`),
      status: payload.data?.status === 'processed' ? 'succeeded' : 'pending',
    };
  }
}
