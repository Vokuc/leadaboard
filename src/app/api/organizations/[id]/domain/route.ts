import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/db';
import { OrganizationService } from '@/lib/organization/service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const profile = await DatabaseService.getCurrentProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const org = await OrganizationService.getOrganization(id);
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
      profile.id,
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
    const profile = await DatabaseService.getCurrentProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const org = await OrganizationService.getOrganization(id);
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const result = await OrganizationService.verifyCustomDomain(
      org.id,
      profile.id,
      { forceSimulateSuccess: Boolean(body?.forceSimulateSuccess) }
    );

    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to verify custom domain';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
