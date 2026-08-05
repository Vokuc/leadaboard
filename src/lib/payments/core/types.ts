export type PaymentProviderKey = 'stripe' | 'paystack' | 'flutterwave' | 'pi';

export type BillingCycle = 'monthly' | 'yearly' | 'custom';

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'unpaid'
  | 'cancelled'
  | 'expired'
  | 'incomplete';

export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'cancelled' | 'refunded' | 'partially_refunded';

export type CheckoutKind = 'subscription' | 'one_time' | 'entry_fee' | 'template_purchase';

export interface CheckoutRequest {
  userId: string;
  provider: PaymentProviderKey;
  kind: CheckoutKind;
  amount: number;
  currency: string;
  planSlug?: string;
  billingCycle?: BillingCycle;
  discountCode?: string;
  metadata?: Record<string, unknown>;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutResponse {
  provider: PaymentProviderKey;
  checkoutUrl: string;
  paymentReference: string;
  expiresAt?: string;
}

export interface CreateSubscriptionRequest {
  userId: string;
  provider: PaymentProviderKey;
  planId: string;
  billingCycle: BillingCycle;
  trialEnd?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ProviderSubscriptionUpsert {
  providerCustomerId?: string;
  providerSubscriptionId?: string;
  status: SubscriptionStatus;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  gracePeriodEnd?: string | null;
  cancelledAt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface WebhookVerificationInput {
  signature: string | null;
  payload: string;
  headers: Record<string, string | string[] | undefined>;
}

export interface NormalizedWebhookEvent {
  provider: PaymentProviderKey;
  eventId: string;
  eventType: string;
  data: Record<string, unknown>;
}

export interface RefundRequest {
  paymentReference: string;
  amount: number;
  currency: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface RefundResponse {
  providerRefundId: string;
  status: 'pending' | 'succeeded' | 'failed' | 'cancelled';
}

export interface PaymentProvider {
  readonly key: PaymentProviderKey;
  createCheckoutSession(input: CheckoutRequest): Promise<CheckoutResponse>;
  verifyWebhook(input: WebhookVerificationInput): Promise<NormalizedWebhookEvent>;
  createOrUpdateSubscription(input: CreateSubscriptionRequest): Promise<ProviderSubscriptionUpsert>;
  cancelSubscription(providerSubscriptionId: string): Promise<ProviderSubscriptionUpsert>;
  processRefund(input: RefundRequest): Promise<RefundResponse>;
}
