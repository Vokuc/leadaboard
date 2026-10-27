import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/db';
import { CompetitionGraphService } from '@/lib/analytics/competition-graph';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await DatabaseService.getCurrentProfile().catch(() => null);
    const { searchParams } = new URL(req.url);

    const type = searchParams.get('type') || 'results';
    const leaderboardId = searchParams.get('leaderboardId');
    const organizationId = searchParams.get('organizationId');

    let csvContent = '';
    let filename = 'competition-analytics-export.csv';

    if (type === 'participations' && leaderboardId) {
      // Check admin permission
      await DatabaseService.requireAdminPermission(leaderboardId, user?.id);
      csvContent = await CompetitionGraphService.exportParticipationsCsv(leaderboardId, user?.id);
      filename = `competition-${leaderboardId}-participations.csv`;
    } else {
      csvContent = await CompetitionGraphService.exportResultsCsv(
        {
          organizationId: organizationId || undefined,
          ownerId: user?.id || undefined,
        },
        user?.id
      );
      filename = `cross-competition-summary-${new Date().toISOString().split('T')[0]}.csv`;
    }

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to export CSV';
    console.error('Error generating CSV export:', err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
