import { describe, expect, it } from 'vitest';
import { StripeProvider } from '@/lib/payments/providers/stripe';

describe('webhook normalization', () => {
  it('normalizes generic payload into event format', async () => {
    const provider = new StripeProvider();

    const event = await provider.verifyWebhook({
      signature: null,
      payload: JSON.stringify({
        id: 'evt_123',
        type: 'payment.succeeded',
        payment_reference: 'pay_ref_1',
      }),
      headers: {},
    });

    expect(event.eventId).toBe('evt_123');
    expect(event.eventType).toBe('payment.succeeded');
    expect(event.provider).toBe('stripe');
  });
});
