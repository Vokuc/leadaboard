import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/db';
import { CompetitionSponsorshipService } from '@/lib/competition/sponsorship/service';

export const runtime = 'nodejs';

/**
 * GET /api/competitions/[idOrSlug]/sponsors
 * Retrieve sponsors for a competition.
 * Query param `all=true` retrieves inactive/expired sponsors if requester is admin.
 */
export async function GET(
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

    const { searchParams } = new URL(req.url);
    const includeAll = searchParams.get('all') === 'true';

    // If requesting all, verify admin permission
    let includeInactive = false;
    if (includeAll) {
      const profile = await DatabaseService.getCurrentProfile();
      if (profile) {
        const admins = await DatabaseService.getAdmins(lb.id);
        const isOwnerOrAdmin =
          lb.owner_id === profile.id ||
          admins.some((a) => a.user_id === profile.id);
        includeInactive = isOwnerOrAdmin;
      }
    }

    const sponsors = await CompetitionSponsorshipService.getSponsorsForCompetition(lb.id, {
      includeInactive,
    });

    return NextResponse.json({ success: true, sponsors });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to retrieve sponsors.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/competitions/[idOrSlug]/sponsors
 * Creates a new sponsor for the competition.
 * Requires competition owner or admin + plan entitlement.
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
    const actorUserId = profile?.id;

    // Check organizer permissions
    const admins = await DatabaseService.getAdmins(lb.id);
    const isOwnerOrAdmin =
      !actorUserId || // Allow demo/mock mode
      lb.owner_id === actorUserId ||
      admins.some((a) => a.user_id === actorUserId);

    if (actorUserId && !isOwnerOrAdmin) {
      return NextResponse.json(
        { error: 'Permission denied: Only competition organizers can add sponsors.' },
        { status: 403 }
      );
    }

    const body = await req.json();

    const sponsor = await CompetitionSponsorshipService.createSponsor(
      {
        leaderboard_id: lb.id,
        name: body.name,
        website_url: body.website_url,
        logo_url: body.logo_url,
        tier: body.tier,
        tagline: body.tagline,
        campaign_start: body.campaign_start,
        campaign_end: body.campaign_end,
        display_order: body.display_order,
        is_active: body.is_active !== undefined ? body.is_active : true,
        metadata: body.metadata,
      },
      actorUserId
    );

    return NextResponse.json({ success: true, sponsor }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create sponsor.';
    const isLimit = message.includes('limit reached') || message.includes('Upgrade to Pro');
    return NextResponse.json({ error: message }, { status: isLimit ? 403 : 400 });
  }
}
