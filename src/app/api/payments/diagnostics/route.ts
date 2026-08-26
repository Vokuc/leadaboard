import { NextResponse } from 'next/server';
import { isSupabaseServerConfigured } from '@/lib/supabase/server';
import { getSupabaseAdminConfigStatus } from '@/lib/supabase/admin';
import { requireBillingAdminUser, toBillingErrorResponse } from '@/lib/billing/guards';
import { getPaystackDiagnostics } from '@/lib/payments/providers/paystack';

export async function GET() {
  try {
    const adminStatus = getSupabaseAdminConfigStatus();

    if (!isSupabaseServerConfigured) {
      return NextResponse.json(
        {
          ok: false,
          serverConfig: {
            hasSupabaseClientConfig: false,
          },
          adminConfig: adminStatus,
        },
        { status: 500 }
      );
    }

    await requireBillingAdminUser();

    const paystackDiagnostics = await getPaystackDiagnostics();

    return NextResponse.json({
      ok: adminStatus.errors.length === 0 && paystackDiagnostics.keyCheck !== 'invalid' && paystackDiagnostics.keyCheck !== 'error',
      serverConfig: {
        hasSupabaseClientConfig: true,
      },
      adminConfig: adminStatus,
      paystackConfig: paystackDiagnostics,
    });
  } catch (error) {
    return toBillingErrorResponse(error, 'Failed to inspect payments diagnostics.');
  }
}
