import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/db';
import { OrganizationService } from '@/lib/organization/service';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const org = await OrganizationService.getOrganization(id);
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const profile = await DatabaseService.getCurrentProfile();
    let userRole = null;
    if (profile) {
      userRole = await OrganizationService.getMemberRole(org.id, profile.id);
    }

    return NextResponse.json({
      success: true,
      organization: {
        ...org,
        user_role: userRole,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch organization';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
