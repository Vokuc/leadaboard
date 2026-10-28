import { NextRequest, NextResponse } from 'next/server';
import { OrganizationService } from '@/lib/organization/service';
import { getServerAuthUser } from '@/lib/auth/server-user';
import { createSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server';

export const runtime = 'nodejs';

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
    const { domain } = body;

    if (!domain || typeof domain !== 'string') {
      return NextResponse.json({ error: 'Valid custom domain is required' }, { status: 400 });
    }

    const result = await OrganizationService.configureCustomDomain(
      org.id,
      user.id,
      domain
    );

    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to configure custom domain';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(
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

    const body = await req.json().catch(() => ({}));
    const result = await OrganizationService.verifyCustomDomain(
      org.id,
      user.id,
      { forceSimulateSuccess: body.forceSimulatedSuccess === true || body.forceSimulateSuccess === true }
    );

    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to verify custom domain';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
