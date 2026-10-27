import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/db';
import { CompetitionRegistrationService } from '@/lib/competition/registration/service';

export const runtime = 'nodejs';

/**
 * GET /api/competitions/[idOrSlug]/registration/config
 * Retrieves registration and financial configuration for a competition.
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

    const config = await CompetitionRegistrationService.getConfig(lb.id);
    return NextResponse.json({ success: true, config });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to retrieve configuration.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/competitions/[idOrSlug]/registration/config
 * Updates registration pricing, capacity, deadlines, and refund rules.
 * Requires competition owner or admin.
 */
export async function PATCH(
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

    // Authenticate organizer
    const profile = await DatabaseService.getCurrentProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const admins = await DatabaseService.getAdmins(lb.id);
    const isOwnerOrAdmin = lb.owner_id === profile.id || admins.some((a) => a.user_id === profile.id);

    if (!isOwnerOrAdmin) {
      return NextResponse.json(
        { error: 'You do not have permission to modify configuration for this competition.' },
        { status: 403 }
      );
    }

    const body = await req.json();

    // Validate financial inputs
    if (body.entry_fee !== undefined && body.entry_fee !== null) {
      const fee = Number(body.entry_fee);
      if (isNaN(fee) || fee < 0) {
        return NextResponse.json({ error: 'Entry fee must be a positive integer or zero.' }, { status: 400 });
      }
    }

    if (body.refund_policy) {
      const validPolicies = ['no_refunds', 'flexible_24h', 'before_start', 'organizer_discretion'];
      if (!validPolicies.includes(body.refund_policy)) {
        return NextResponse.json(
          { error: `Invalid refund policy. Must be one of: ${validPolicies.join(', ')}` },
          { status: 400 }
        );
      }
    }

    const updated = await CompetitionRegistrationService.saveConfig(lb.id, {
      is_enabled: body.is_enabled,
      capacity: body.capacity !== undefined ? (body.capacity ? Number(body.capacity) : null) : undefined,
      opens_at: body.opens_at !== undefined ? body.opens_at : undefined,
      closes_at: body.closes_at !== undefined ? body.closes_at : undefined,
      require_approval: body.require_approval !== undefined ? Boolean(body.require_approval) : undefined,
      allow_waitlist: body.allow_waitlist !== undefined ? Boolean(body.allow_waitlist) : undefined,
      allow_team_registration: body.allow_team_registration !== undefined ? Boolean(body.allow_team_registration) : undefined,
      eligibility_rules: body.eligibility_rules,
      entry_fee: body.entry_fee !== undefined ? (body.entry_fee !== null ? Math.round(Number(body.entry_fee)) : null) : undefined,
      currency: body.currency ? String(body.currency).toUpperCase() : undefined,
      payment_deadline: body.payment_deadline !== undefined ? body.payment_deadline : undefined,
      refund_policy: body.refund_policy,
      platform_fee_percent: body.platform_fee_percent !== undefined ? Number(body.platform_fee_percent) : undefined,
      prize_pool_percentage: body.prize_pool_percentage !== undefined ? Number(body.prize_pool_percentage) : undefined,
      guaranteed_prize_pool: body.guaranteed_prize_pool !== undefined ? (body.guaranteed_prize_pool ? Number(body.guaranteed_prize_pool) : null) : undefined,
      payout_status: body.payout_status,
    });

    return NextResponse.json({ success: true, config: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update configuration.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
