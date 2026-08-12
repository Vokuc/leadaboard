import { NextResponse } from 'next/server';
import { isSupabaseServerConfigured } from '@/lib/supabase/server';
import { PaymentService } from '@/lib/payments/core/service';
import { requireAuthenticatedUser, toBillingErrorResponse } from '@/lib/billing/guards';

export async function GET() {
  try {
    if (!isSupabaseServerConfigured) {
      return NextResponse.json({ error: 'Server is not configured for payments.' }, { status: 500 });
    }

    const user = await requireAuthenticatedUser();

    const data = await PaymentService.getBillingOverview(user.id);
    return NextResponse.json(data);
  } catch (error) {
    return toBillingErrorResponse(error, 'Failed to load billing overview.');
  }
}
