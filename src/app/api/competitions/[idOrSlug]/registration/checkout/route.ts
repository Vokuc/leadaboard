import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/db';
import { CompetitionPaymentService } from '@/lib/payments/competition/service';

export const runtime = 'nodejs';

/**
 * POST /api/competitions/[idOrSlug]/registration/checkout
 * Initiates registration checkout.
 * Enforces server-side amount calculation from config (ignores any client-provided amount).
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
    const {
      participantName,
      participantEmail,
      teamId,
      notes,
      successUrl,
      cancelUrl,
    } = body;

    if (!participantName || typeof participantName !== 'string' || !participantName.trim()) {
      return NextResponse.json({ error: 'Participant name is required.' }, { status: 400 });
    }

    if (!participantEmail || typeof participantEmail !== 'string' || !participantEmail.trim()) {
      return NextResponse.json({ error: 'Participant email is required.' }, { status: 400 });
    }

    // Resolve current authenticated user if logged in
    const profile = await DatabaseService.getCurrentProfile();

    // Default redirect URLs if not provided
    const origin = req.nextUrl.origin;
    const defaultSuccess = `${origin}/leaderboards/${lb.slug}?registered=true`;
    const defaultCancel = `${origin}/leaderboards/${lb.slug}?checkout_cancelled=true`;

    const checkoutResult = await CompetitionPaymentService.initializeRegistrationCheckout({
      leaderboardId: lb.id,
      participantName: participantName.trim(),
      participantEmail: participantEmail.trim().toLowerCase(),
      teamId: teamId || null,
      notes: notes || null,
      userId: profile?.id || null,
      successUrl: successUrl || defaultSuccess,
      cancelUrl: cancelUrl || defaultCancel,
    });

    return NextResponse.json({
      success: true,
      result: checkoutResult,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Registration checkout initialization failed.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
