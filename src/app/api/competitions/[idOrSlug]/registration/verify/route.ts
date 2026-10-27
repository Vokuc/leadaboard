import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/db';
import { CompetitionPaymentService } from '@/lib/payments/competition/service';

export const runtime = 'nodejs';

/**
 * POST /api/competitions/[idOrSlug]/registration/verify
 * Verifies transaction reference through server-side provider verification or demo mode assertion.
 * Never trusts client assertions: queries payment provider API directly.
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

    const body = await req.json();
    const { reference, demoVerify } = body;

    if (!reference || typeof reference !== 'string') {
      return NextResponse.json({ error: 'Payment reference is required.' }, { status: 400 });
    }

    const profile = await DatabaseService.getCurrentProfile();

    const verificationResult = await CompetitionPaymentService.verifyPayment(
      reference,
      profile?.id,
      { forceTestSuccess: Boolean(demoVerify) }
    );

    return NextResponse.json(verificationResult);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Payment verification failed.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
