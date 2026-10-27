import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/db';
import { OrganizationService } from '@/lib/organization/service';
import { OrganizationRole } from '@/types';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const { id, memberId } = await params;
    const profile = await DatabaseService.getCurrentProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const org = await OrganizationService.getOrganization(id);
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const body = await req.json();
    const { role } = body;

    const validRoles: OrganizationRole[] = ['owner', 'admin', 'manager', 'viewer'];
    if (!role || !validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid organization role' }, { status: 400 });
    }

    const updated = await OrganizationService.updateMemberRole(
      org.id,
      profile.id,
      memberId,
      role
    );

    return NextResponse.json({ success: true, member: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update member role';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const { id, memberId } = await params;
    const profile = await DatabaseService.getCurrentProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const org = await OrganizationService.getOrganization(id);
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const result = await OrganizationService.removeMember(org.id, profile.id, memberId);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to remove member';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
