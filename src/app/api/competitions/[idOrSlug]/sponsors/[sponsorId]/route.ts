import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/db';
import { CompetitionSponsorshipService } from '@/lib/competition/sponsorship/service';

export const runtime = 'nodejs';

/**
 * GET /api/competitions/[idOrSlug]/sponsors/[sponsorId]
 * Get sponsor details and metrics.
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ idOrSlug: string; sponsorId: string }> }
) {
  try {
    const { sponsorId } = await context.params;
    const sponsor = await CompetitionSponsorshipService.getSponsorById(sponsorId);
    if (!sponsor) {
      return NextResponse.json({ error: 'Sponsor not found.' }, { status: 404 });
    }

    const metrics = await CompetitionSponsorshipService.getSponsorMetrics(sponsorId);
    return NextResponse.json({ success: true, sponsor, metrics });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to retrieve sponsor.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/competitions/[idOrSlug]/sponsors/[sponsorId]
 * Updates an existing sponsor.
 * Requires competition owner or admin.
 */
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ idOrSlug: string; sponsorId: string }> }
) {
  try {
    const { idOrSlug, sponsorId } = await context.params;
    let lb = await DatabaseService.getLeaderboard(idOrSlug);
    if (!lb) lb = await DatabaseService.getLeaderboardBySlug(idOrSlug);

    if (!lb) {
      return NextResponse.json({ error: 'Competition not found.' }, { status: 404 });
    }

    const profile = await DatabaseService.getCurrentProfile();
    const actorUserId = profile?.id;

    // Check permissions
    const admins = await DatabaseService.getAdmins(lb.id);
    const isOwnerOrAdmin =
      !actorUserId ||
      lb.owner_id === actorUserId ||
      admins.some((a) => a.user_id === actorUserId);

    if (actorUserId && !isOwnerOrAdmin) {
      return NextResponse.json(
        { error: 'Permission denied: Only competition organizers can edit sponsors.' },
        { status: 403 }
      );
    }

    const body = await req.json();

    const updated = await CompetitionSponsorshipService.updateSponsor(
      sponsorId,
      {
        name: body.name,
        website_url: body.website_url,
        logo_url: body.logo_url,
        tier: body.tier,
        tagline: body.tagline,
        campaign_start: body.campaign_start,
        campaign_end: body.campaign_end,
        display_order: body.display_order,
        is_active: body.is_active,
        metadata: body.metadata,
      },
      actorUserId
    );

    return NextResponse.json({ success: true, sponsor: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update sponsor.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/**
 * DELETE /api/competitions/[idOrSlug]/sponsors/[sponsorId]
 * Removes a sponsor.
 * Requires competition owner or admin.
 */
export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ idOrSlug: string; sponsorId: string }> }
) {
  try {
    const { idOrSlug, sponsorId } = await context.params;
    let lb = await DatabaseService.getLeaderboard(idOrSlug);
    if (!lb) lb = await DatabaseService.getLeaderboardBySlug(idOrSlug);

    if (!lb) {
      return NextResponse.json({ error: 'Competition not found.' }, { status: 404 });
    }

    const profile = await DatabaseService.getCurrentProfile();
    const actorUserId = profile?.id;

    const admins = await DatabaseService.getAdmins(lb.id);
    const isOwnerOrAdmin =
      !actorUserId ||
      lb.owner_id === actorUserId ||
      admins.some((a) => a.user_id === actorUserId);

    if (actorUserId && !isOwnerOrAdmin) {
      return NextResponse.json(
        { error: 'Permission denied: Only competition organizers can remove sponsors.' },
        { status: 403 }
      );
    }

    await CompetitionSponsorshipService.deleteSponsor(sponsorId, actorUserId);
    return NextResponse.json({ success: true, removed: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete sponsor.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
