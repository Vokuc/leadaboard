import { NextResponse } from 'next/server';
import { isSupabaseServerConfigured } from '@/lib/supabase/server';
import { createSupabaseAdminClient, getSupabaseAdminConfigStatus } from '@/lib/supabase/admin';
import { requireBillingAdminUser, toBillingErrorResponse } from '@/lib/billing/guards';
import { getPaystackDiagnostics } from '@/lib/payments/providers/paystack';

async function getPlansDiagnostics() {
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from('plans').select('slug,active');

    if (error) {
      return { reachable: false, error: error.message, totalPlans: 0, activePlanSlugs: [] as string[] };
    }

    const rows = data || [];
    return {
      reachable: true,
      error: null,
      totalPlans: rows.length,
      activePlanSlugs: rows.filter((row) => row.active).map((row) => row.slug),
    };
  } catch (error) {
    return {
      reachable: false,
      error: error instanceof Error ? error.message : 'Failed to query plans table.',
      totalPlans: 0,
      activePlanSlugs: [] as string[],
    };
  }
}

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

    const [paystackDiagnostics, plansDiagnostics] = await Promise.all([
      getPaystackDiagnostics(),
      getPlansDiagnostics(),
    ]);

    return NextResponse.json({
      ok:
        adminStatus.errors.length === 0 &&
        paystackDiagnostics.keyCheck !== 'invalid' &&
        paystackDiagnostics.keyCheck !== 'error' &&
        plansDiagnostics.reachable &&
        plansDiagnostics.activePlanSlugs.length > 0,
      serverConfig: {
        hasSupabaseClientConfig: true,
      },
      adminConfig: adminStatus,
      paystackConfig: paystackDiagnostics,
      plansConfig: plansDiagnostics,
    });
  } catch (error) {
    return toBillingErrorResponse(error, 'Failed to inspect payments diagnostics.');
  }
}
