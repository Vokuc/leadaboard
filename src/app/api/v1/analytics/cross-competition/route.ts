import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/db';
import { CompetitionGraphService } from '@/lib/analytics/competition-graph';
import { CompetitionType } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await DatabaseService.getCurrentProfile().catch(() => null);
    const { searchParams } = new URL(req.url);

    const organizationId = searchParams.get('organizationId');
    const ownerId = searchParams.get('ownerId') || user?.id || null;
    const competitionType = searchParams.get('competitionType') as CompetitionType | null;
    const isVerifiedOnly = searchParams.get('isVerifiedOnly') === 'true';

    // If querying an organization, verify access if user is logged in
    if (organizationId && user?.id) {
      const org = await DatabaseService.getOrganization(organizationId).catch(() => null);
      if (org && org.created_by !== user.id) {
        const members = await DatabaseService.getOrganizationMembers(organizationId).catch(() => []);
        const isMember = members.some((m) => m.user_id === user.id);
        if (!isMember) {
          return NextResponse.json(
            { error: 'You do not have permission to view this organization\'s analytics.' },
            { status: 403 }
          );
        }
      }
    }

    const analytics = await CompetitionGraphService.getOrganizerAnalytics(
      {
        organizationId,
        ownerId,
        competitionType,
        isVerifiedOnly,
      },
      user?.id
    );

    return NextResponse.json({
      success: true,
      analytics,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve cross-competition analytics';
    console.error('Error fetching cross-competition analytics:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
