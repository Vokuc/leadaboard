import { describe, expect, it } from 'vitest';
import { getSupportedProviders } from '@/lib/payments/providers';

describe('payments providers registry', () => {
  it('includes all configured providers', () => {
    expect(getSupportedProviders()).toEqual(['stripe', 'paystack', 'flutterwave', 'pi']);
  });
});
