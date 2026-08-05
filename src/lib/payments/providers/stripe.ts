import { BaseProvider } from '@/lib/payments/providers/base';

export class StripeProvider extends BaseProvider {
  constructor() {
    super('stripe');
  }
}
