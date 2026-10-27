import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/db';
import { CompetitionPaymentService } from '@/lib/payments/competition/service';

export const runtime = 'nodejs';

/**
 * POST /api/competitions/[idOrSlug]/finance/refund
 * Initiates and records a refund for a paid participant.
 * Applies double-entry ledger adjustment, updates registration status, and logs audit record.
 */
export async function POST(
  req: NextRequest,
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
        { error: 'You do not have permission to issue refunds for this competition.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { registrationId, reason, amount } = body;

    if (!registrationId) {
      return NextResponse.json({ error: 'Registration ID is required.' }, { status: 400 });
    }

    const refundResult = await CompetitionPaymentService.processRefund({
      leaderboardId: lb.id,
      registrationId,
      reason: reason || 'Organizer initiated refund',
      actorUserId: profile.id,
      amount: amount !== undefined ? Number(amount) : undefined,
    });

    return NextResponse.json({
      success: true,
      refund: refundResult.refund,
      message: 'Refund recorded and processed successfully.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Refund failed.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
