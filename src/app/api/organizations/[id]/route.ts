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
    const client = isSupabaseServerConfigured ? await createSupabaseServerClient() : null;
    const org = await OrganizationService.getOrganization(id, client);
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const user = await getServerAuthUser();
    let userRole = null;
    if (user) {
      userRole = await OrganizationService.getMemberRole(org.id, user.id, client);
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
