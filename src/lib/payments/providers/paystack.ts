import { BaseProvider } from '@/lib/payments/providers/base';

export class PaystackProvider extends BaseProvider {
  constructor() {
    super('paystack');
  }
}
