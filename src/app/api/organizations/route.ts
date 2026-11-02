import { NextRequest, NextResponse } from 'next/server';
import { OrganizationService } from '@/lib/organization/service';
import { getServerAuthUser } from '@/lib/auth/server-user';
import { createSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export async function GET(req?: NextRequest) {
  try {
    const url = req ? new URL(req.url) : null;
    const isDiscover = url ? url.searchParams.get('discover') === 'true' : false;
    const query = url ? url.searchParams.get('q') || undefined : undefined;

    const client = isSupabaseServerConfigured ? await createSupabaseServerClient() : null;

    if (isDiscover) {
      // Public organization discovery: does not require user authentication
      const organizations = await OrganizationService.getDiscoverableOrganizations(query, client);
      return NextResponse.json({ success: true, organizations });
    }

    // Authenticated "My Organizations": requires authenticated user
    const user = await getServerAuthUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const organizations = await OrganizationService.getUserOrganizations(user.id, client);
    return NextResponse.json({ success: true, organizations });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch organizations';
    console.error('[GET /api/organizations error]:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getServerAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, slug, description, website_url, logo_url, primary_color, secondary_color, accent_color } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Organization name is required.' }, { status: 400 });
    }

    // Prefer admin client when available to guarantee atomic creation and owner attachment across RLS boundaries;
    // otherwise fallback to authenticated server client or demo store.
    const client = isSupabaseAdminConfigured()
      ? createSupabaseAdminClient()
      : isSupabaseServerConfigured
      ? await createSupabaseServerClient()
      : null;

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
      user.id,
      client
    );

    return NextResponse.json({ success: true, organization: org }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create organization';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
