import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/db';
import { CompetitionPaymentService } from '@/lib/payments/competition/service';

export const runtime = 'nodejs';

/**
 * GET /api/competitions/[idOrSlug]/finance/reconcile
 * Runs reconciliation between payment receipts, refund records, prize allocations,
 * and double-entry ledger totals.
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ idOrSlug: string }> }
) {
  try {
    const { idOrSlug } = await context.params;
    let lb = await DatabaseService.getLeaderboard(idOrSlug);
    if (!lb) lb = await DatabaseService.getLeaderboardBySlug(idOrSlug);

    if (!lb) {
      return NextResponse.json({ error: 'Competition not found.' }, { status: 404 });
    }

    const profile = await DatabaseService.getCurrentProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const admins = await DatabaseService.getAdmins(lb.id);
    const isOwnerOrAdmin = lb.owner_id === profile.id || admins.some((a) => a.user_id === profile.id);

    if (!isOwnerOrAdmin) {
      return NextResponse.json(
        { error: 'You do not have permission to run reconciliation for this competition.' },
        { status: 403 }
      );
    }

    const reconciliation = await CompetitionPaymentService.reconcileLedger(lb.id);

    return NextResponse.json({
      success: true,
      reconciliation,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Reconciliation check failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
