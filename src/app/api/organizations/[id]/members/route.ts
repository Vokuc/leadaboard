import { NextRequest, NextResponse } from 'next/server';
import { OrganizationService } from '@/lib/organization/service';
import { getServerAuthUser } from '@/lib/auth/server-user';
import { createSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getServerAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = isSupabaseServerConfigured ? await createSupabaseServerClient() : null;
    const org = await OrganizationService.getOrganization(id, client);
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const role = await OrganizationService.getMemberRole(org.id, user.id, client);
    if (!role) {
      return NextResponse.json({ error: 'Access denied: You are not a member of this organization.' }, { status: 403 });
    }

    const members = await OrganizationService.getMembers(org.id, client);
    const invitations = role === 'owner' || role === 'admin'
      ? await OrganizationService.getInvitations(org.id)
      : [];

    return NextResponse.json({
      success: true,
      members,
      invitations,
      current_user_role: role,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch members';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getServerAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = isSupabaseServerConfigured ? await createSupabaseServerClient() : null;
    const org = await OrganizationService.getOrganization(id, client);
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const body = await req.json();
    const { email, role } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Valid email is required.' }, { status: 400 });
    }

    const assignedRole = role === 'admin' || role === 'manager' || role === 'viewer' ? role : 'viewer';

    const invitation = await OrganizationService.inviteMember(
      org.id,
      user.id,
      email,
      assignedRole
    );

    return NextResponse.json({ success: true, invitation }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to invite member';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
