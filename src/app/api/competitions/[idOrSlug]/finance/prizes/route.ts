import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/db';
import { CompetitionPaymentService } from '@/lib/payments/competition/service';

export const runtime = 'nodejs';

/**
 * GET /api/competitions/[idOrSlug]/finance/prizes
 * Retrieves allocated prize records for a competition.
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

    const allocations = await CompetitionPaymentService.getPrizeAllocations(lb.id);

    return NextResponse.json({
      success: true,
      allocations,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to retrieve prize allocations.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/competitions/[idOrSlug]/finance/prizes
 * Allocates prize pool amounts as transparent accounting records against the organizer balance.
 * Prevents allocating more than available net revenue.
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
        { error: 'You do not have permission to allocate prizes for this competition.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { allocations } = body;

    if (!Array.isArray(allocations) || allocations.length === 0) {
      return NextResponse.json({ error: 'At least one prize allocation is required.' }, { status: 400 });
    }

    const result = await CompetitionPaymentService.allocatePrizePool({
      leaderboardId: lb.id,
      allocations,
      actorUserId: profile.id,
    });

    return NextResponse.json({
      success: true,
      allocations: result.allocations,
      message: 'Prize pool allocated successfully as accounting ledger entries.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Prize allocation failed.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
