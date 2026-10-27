import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/db';
import { OrganizationService } from '@/lib/organization/service';

export async function GET() {
  try {
    const profile = await DatabaseService.getCurrentProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizations = await OrganizationService.getUserOrganizations(profile.id);
    return NextResponse.json({ success: true, organizations });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch organizations';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const profile = await DatabaseService.getCurrentProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, slug, description, website_url, logo_url, primary_color, secondary_color, accent_color } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Organization name is required.' }, { status: 400 });
    }

    const org = await OrganizationService.createOrganization(
      {
        name,
        slug,
        description,
        website_url,
        logo_url,
        primary_color,
        secondary_color,
        accent_color,
      },
      profile.id
    );

    return NextResponse.json({ success: true, organization: org }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create organization';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
