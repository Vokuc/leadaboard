import { BaseProvider } from '@/lib/payments/providers/base';

export class FlutterwaveProvider extends BaseProvider {
  constructor() {
    super('flutterwave');
  }
}
