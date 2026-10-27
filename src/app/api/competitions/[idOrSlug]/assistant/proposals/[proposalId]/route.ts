import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/db';
import { CompetitionAiService } from '@/lib/ai/service';

export const runtime = 'nodejs';

/**
 * GET /api/competitions/[idOrSlug]/assistant/proposals/[proposalId]
 * Retrieve an AI proposal by ID.
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ idOrSlug: string; proposalId: string }> }
) {
  try {
    const { proposalId } = await context.params;
    const proposal = await CompetitionAiService.getProposal(proposalId);

    if (!proposal) {
      return NextResponse.json({ error: 'Proposal not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, proposal });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error fetching proposal.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/competitions/[idOrSlug]/assistant/proposals/[proposalId]
 * Confirm and apply or reject an AI proposal.
 * Body: { action: 'confirm' | 'reject' }
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ idOrSlug: string; proposalId: string }> }
) {
  try {
    const { idOrSlug, proposalId } = await context.params;
    let lb = await DatabaseService.getLeaderboard(idOrSlug);
    if (!lb) lb = await DatabaseService.getLeaderboardBySlug(idOrSlug);

    if (!lb) {
      return NextResponse.json({ error: 'Competition not found.' }, { status: 404 });
    }

    const profile = await DatabaseService.getCurrentProfile();
    const actorUserId = profile?.id;

    // Verify organizer permission
    if (actorUserId) {
      const admins = await DatabaseService.getAdmins(lb.id);
      const isOwnerOrAdmin =
        lb.owner_id === actorUserId || admins.some((a) => a.user_id === actorUserId);
      if (!isOwnerOrAdmin) {
        return NextResponse.json(
          { error: 'Forbidden: You must be an organizer or admin to modify proposals.' },
          { status: 403 }
        );
      }
    }

    const body = await req.json().catch(() => ({}));
    const { action } = body;

    if (action === 'confirm') {
      const execution = await CompetitionAiService.confirmProposal(proposalId, actorUserId);
      return NextResponse.json({
        success: true,
        action: 'confirmed',
        execution,
      });
    } else if (action === 'reject') {
      const proposal = await CompetitionAiService.rejectProposal(proposalId, actorUserId);
      return NextResponse.json({
        success: true,
        action: 'rejected',
        proposal,
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Expected "confirm" or "reject".' },
      { status: 400 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error processing proposal action.';
    const isForbidden = message.toLowerCase().includes('permission') || message.toLowerCase().includes('forbidden');
    return NextResponse.json({ error: message }, { status: isForbidden ? 403 : 400 });
  }
}
