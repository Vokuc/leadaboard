import { PaymentProviderKey } from '@/lib/payments/core/types';

export const ACTIVE_PAYMENT_PROVIDER: PaymentProviderKey = 'paystack';

export const ENABLED_PAYMENT_PROVIDERS: PaymentProviderKey[] = [ACTIVE_PAYMENT_PROVIDER];

export const PROVIDER_ALLOWED_CURRENCIES: Record<PaymentProviderKey, string[]> = {
  stripe: ['USD', 'NGN'],
  paystack: ['NGN'],
  flutterwave: ['USD', 'NGN'],
  pi: ['USD', 'NGN'],
};

export function isPaymentProviderEnabled(provider: PaymentProviderKey): boolean {
  return ENABLED_PAYMENT_PROVIDERS.includes(provider);
}

export function getProviderDefaultCurrency(provider: PaymentProviderKey): string {
  const currencies = PROVIDER_ALLOWED_CURRENCIES[provider] || [];
  return currencies[0] || 'NGN';
}
