import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server';
import { PaymentService } from '@/lib/payments/core/service';
import { PaymentProviderKey } from '@/lib/payments/core/types';
import { isPaymentProviderEnabled } from '@/lib/payments/config';

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

    const body = (await request.json()) as { provider?: PaymentProviderKey };
    if (!body.provider) {
      return NextResponse.json({ error: 'provider is required.' }, { status: 400 });
    }

    if (!isPaymentProviderEnabled(body.provider)) {
      return NextResponse.json({ error: `${body.provider} is not enabled right now.` }, { status: 400 });
    }

    await PaymentService.cancelSubscription(user.id, body.provider);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to cancel subscription.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
