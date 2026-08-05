import { BaseProvider } from '@/lib/payments/providers/base';

// Pi is implemented as first-class provider in the same abstraction.
export class PiProvider extends BaseProvider {
  constructor() {
    super('pi');
  }
}
