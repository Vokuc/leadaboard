import { PaymentProvider, PaymentProviderKey } from '@/lib/payments/core/types';
import { FlutterwaveProvider } from '@/lib/payments/providers/flutterwave';
import { PaystackProvider } from '@/lib/payments/providers/paystack';
import { PiProvider } from '@/lib/payments/providers/pi';
import { StripeProvider } from '@/lib/payments/providers/stripe';

const providers: Record<PaymentProviderKey, PaymentProvider> = {
  stripe: new StripeProvider(),
  paystack: new PaystackProvider(),
  flutterwave: new FlutterwaveProvider(),
  pi: new PiProvider(),
};

export function getPaymentProvider(provider: PaymentProviderKey): PaymentProvider {
  return providers[provider];
}

export function getSupportedProviders(): PaymentProviderKey[] {
  return Object.keys(providers) as PaymentProviderKey[];
}
