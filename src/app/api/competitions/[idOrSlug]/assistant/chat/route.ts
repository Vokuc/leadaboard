import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/db';
import { CompetitionAiService } from '@/lib/ai/service';

export const runtime = 'nodejs';

/**
 * POST /api/competitions/[idOrSlug]/assistant/chat
 * Query the AI competition manager with grounded context and rate-limiting.
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

    // Verify organizer permission
    if (actorUserId) {
      const admins = await DatabaseService.getAdmins(lb.id);
      const isOwnerOrAdmin =
        lb.owner_id === actorUserId || admins.some((a) => a.user_id === actorUserId);
      if (!isOwnerOrAdmin) {
        return NextResponse.json(
          { error: 'Forbidden: You must be an organizer or admin to use the AI assistant.' },
          { status: 403 }
        );
      }
    }

    const body = await req.json().catch(() => ({}));
    const { prompt, history, taskType } = body;

    if (!prompt && !taskType) {
      return NextResponse.json(
        { error: 'A prompt or taskType is required.' },
        { status: 400 }
      );
    }

    const result = await CompetitionAiService.askAssistant({
      leaderboardId: lb.id,
      prompt: String(prompt || `Generate proposal for ${taskType}`),
      history,
      taskType,
      actorUserId,
    });

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'AI assistant error.';
    const isForbidden = message.toLowerCase().includes('permission') || message.toLowerCase().includes('forbidden');
    const isRateLimited = message.toLowerCase().includes('limit');
    return NextResponse.json(
      { error: message },
      { status: isForbidden ? 403 : isRateLimited ? 429 : 500 }
    );
  }
}
