import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server';
import { PaymentService } from '@/lib/payments/core/service';
import { PaymentProviderKey } from '@/lib/payments/core/types';

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  if (error && typeof error === 'object') {
    const maybe = error as Record<string, unknown>;
    const parts = [maybe.message, maybe.error, maybe.details, maybe.hint]
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((item) => item.trim());

    if (parts.length > 0) {
      return parts.join(' | ');
    }
  }

  return 'Failed to start checkout.';
}

export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseServerConfigured) {
      return NextResponse.json({ error: 'Server is not configured for payments.' }, { status: 500 });
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as {
      provider?: PaymentProviderKey;
      kind?: 'subscription' | 'one_time' | 'entry_fee' | 'template_purchase';
      currency?: string;
      planSlug?: string;
      billingCycle?: 'monthly' | 'yearly' | 'custom';
      amount?: number;
      discountCode?: string;
      metadata?: Record<string, unknown>;
      successUrl?: string;
      cancelUrl?: string;
    };

    if (!body.provider || !body.kind || !body.currency || !body.successUrl || !body.cancelUrl) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    if (body.provider !== 'paystack') {
      return NextResponse.json({ error: 'Only Paystack is enabled right now.' }, { status: 400 });
    }

    const checkout = await PaymentService.startCheckout({
      userId: user.id,
      userEmail: user.email,
      provider: body.provider,
      kind: body.kind,
      currency: body.currency,
      planSlug: body.planSlug,
      billingCycle: body.billingCycle,
      amount: body.amount,
      discountCode: body.discountCode,
      metadata: body.metadata,
      successUrl: body.successUrl,
      cancelUrl: body.cancelUrl,
    });

    return NextResponse.json(checkout);
  } catch (error) {
    const message = extractErrorMessage(error);
    console.error('Payments checkout failed:', error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
