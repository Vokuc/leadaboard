import {
  CheckoutRequest,
  CheckoutResponse,
  CreateSubscriptionRequest,
  NormalizedWebhookEvent,
  PaymentProvider,
  PaymentProviderKey,
  ProviderSubscriptionUpsert,
  RefundRequest,
  RefundResponse,
  WebhookVerificationInput,
} from '@/lib/payments/core/types';

function makeRef(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
}

export abstract class BaseProvider implements PaymentProvider {
  readonly key: PaymentProviderKey;

  protected constructor(key: PaymentProviderKey) {
    this.key = key;
  }

  async createCheckoutSession(input: CheckoutRequest): Promise<CheckoutResponse> {
    return {
      provider: this.key,
      checkoutUrl: input.successUrl,
      paymentReference: makeRef(this.key),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
  }

  async verifyWebhook(input: WebhookVerificationInput): Promise<NormalizedWebhookEvent> {
    if (!input.payload) {
      throw new Error('Empty webhook payload.');
    }

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(input.payload) as Record<string, unknown>;
    } catch {
      parsed = { raw_payload: input.payload };
    }

    return {
      provider: this.key,
      eventId: String(parsed.event_id || parsed.id || makeRef('evt')),
      eventType: String(parsed.type || 'unknown.event'),
      data: parsed,
    };
  }

  async createOrUpdateSubscription(input: CreateSubscriptionRequest): Promise<ProviderSubscriptionUpsert> {
    void input;
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    return {
      providerCustomerId: makeRef('cus'),
      providerSubscriptionId: makeRef('sub'),
      status: 'active',
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: periodEnd.toISOString(),
      metadata: {},
    };
  }

  async cancelSubscription(providerSubscriptionId: string): Promise<ProviderSubscriptionUpsert> {
    return {
      providerSubscriptionId,
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
      metadata: {},
    };
  }

  async processRefund(input: RefundRequest): Promise<RefundResponse> {
    void input;
    return {
      providerRefundId: makeRef('rfnd'),
      status: 'succeeded',
    };
  }
}
