import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/db';
import { CompetitionSponsorshipService } from '@/lib/competition/sponsorship/service';

export const runtime = 'nodejs';

/**
 * POST /api/competitions/[idOrSlug]/sponsors/[sponsorId]/track
 * Records a verified sponsor impression or click event with deduplication.
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ idOrSlug: string; sponsorId: string }> }
) {
  try {
    const { idOrSlug, sponsorId } = await context.params;
    let lb = await DatabaseService.getLeaderboard(idOrSlug);
    if (!lb) lb = await DatabaseService.getLeaderboardBySlug(idOrSlug);

    const body = await req.json().catch(() => ({}));
    const eventType = body.eventType === 'click' ? 'click' : 'impression';

    // Derive anonymous visitor hash from IP + User Agent if not provided
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || '127.0.0.1';
    const ua = req.headers.get('user-agent') || 'browser';
    const clientVisitorHash = body.visitorHash && typeof body.visitorHash === 'string' ? body.visitorHash : null;

    // Simple deterministic hash
    const combined = clientVisitorHash || `${ip}:${ua.slice(0, 32)}`;
    let hashNum = 0;
    for (let i = 0; i < combined.length; i++) {
      hashNum = (hashNum << 5) - hashNum + combined.charCodeAt(i);
      hashNum |= 0;
    }
    const visitorHash = Math.abs(hashNum).toString(36);

    if (eventType === 'click') {
      const result = await CompetitionSponsorshipService.recordClick(sponsorId, lb?.id, visitorHash);
      return NextResponse.json({
        success: true,
        recorded: result.recorded,
        deduplicated: result.deduplicated,
        targetUrl: result.targetUrl,
      });
    } else {
      const result = await CompetitionSponsorshipService.recordImpression(sponsorId, lb?.id, visitorHash);
      return NextResponse.json({
        success: true,
        recorded: result.recorded,
        deduplicated: result.deduplicated,
      });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Tracking failed.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
