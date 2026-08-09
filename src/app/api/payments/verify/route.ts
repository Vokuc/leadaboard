import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server';
import { PaymentService } from '@/lib/payments/core/service';

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

    const body = (await request.json()) as { reference?: string };
    if (!body.reference) {
      return NextResponse.json({ error: 'reference is required.' }, { status: 400 });
    }

    const result = await PaymentService.verifyPaystackTransaction(user.id, body.reference);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to verify payment.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
