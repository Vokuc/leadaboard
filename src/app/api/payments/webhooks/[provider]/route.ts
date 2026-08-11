import { NextRequest, NextResponse } from 'next/server';
import { PaymentWebhookService } from '@/lib/payments/core/webhooks';
import { PaymentProviderKey } from '@/lib/payments/core/types';
import { ENABLED_PAYMENT_PROVIDERS } from '@/lib/payments/config';

const supportedProviders: PaymentProviderKey[] = ENABLED_PAYMENT_PROVIDERS;

export async function POST(request: NextRequest, context: { params: Promise<{ provider: string }> }) {
  try {
    const params = await context.params;
    const provider = params.provider as PaymentProviderKey;

    if (!supportedProviders.includes(provider)) {
      return NextResponse.json({ error: 'Unsupported provider.' }, { status: 404 });
    }

    const payload = await request.text();
    const result = await PaymentWebhookService.process(provider, payload, request.headers);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook processing failed.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
