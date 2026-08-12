import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseServerConfigured } from '@/lib/supabase/server';
import { PaymentService } from '@/lib/payments/core/service';
import { requireAuthenticatedUser, toBillingErrorResponse } from '@/lib/billing/guards';

export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseServerConfigured) {
      return NextResponse.json({ error: 'Server is not configured for payments.' }, { status: 500 });
    }

    const user = await requireAuthenticatedUser();

    const body = (await request.json()) as { reference?: string };
    if (!body.reference) {
      return NextResponse.json({ error: 'reference is required.' }, { status: 400 });
    }

    const result = await PaymentService.verifyPaystackTransaction(user.id, body.reference);
    return NextResponse.json(result);
  } catch (error) {
    return toBillingErrorResponse(error, 'Failed to verify payment.');
  }
}
