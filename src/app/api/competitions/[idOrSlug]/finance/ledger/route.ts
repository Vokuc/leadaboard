import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/db';
import { CompetitionPaymentService } from '@/lib/payments/competition/service';

export const runtime = 'nodejs';

/**
 * GET /api/competitions/[idOrSlug]/finance/ledger
 * Returns financial summary and transparent audit ledger entries.
 * Restricted to competition organizer or admin.
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
        { error: 'You do not have permission to view financial records for this competition.' },
        { status: 403 }
      );
    }

    const summary = await CompetitionPaymentService.getFinancialSummary(lb.id);

    return NextResponse.json({
      success: true,
      summary,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to retrieve financial summary.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
