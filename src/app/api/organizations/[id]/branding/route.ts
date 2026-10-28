import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured } from '@/lib/db';
import { OrganizationService } from '@/lib/organization/service';
import { ensureFeatureAccess } from '@/lib/billing/guards';
import { getServerAuthUser } from '@/lib/auth/server-user';
import { createSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function PATCH(
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

    // Enforce custom branding plan entitlement
    if (isSupabaseConfigured) {
      try {
        await ensureFeatureAccess(org.created_by || user.id, 'custom_branding');
      } catch (err: unknown) {
        if (err instanceof Error && (err.message.includes('subscription') || err.message.includes('plan') || err.message.includes('Feature'))) {
          return NextResponse.json(
            { error: 'Custom branding requires an active Pro or Business subscription.' },
            { status: 403 }
          );
        }
      }
    }

    const body = await req.json();
    const { logo_url, website_url, primary_color, secondary_color, accent_color, hide_powered_by } = body;

    const updated = await OrganizationService.updateBranding(
      org.id,
      user.id,
      {
        logo_url,
        website_url,
        primary_color,
        secondary_color,
        accent_color,
        hide_powered_by,
      }
    );

    return NextResponse.json({ success: true, organization: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update branding';
    const isBilling = message.includes('subscription') || message.includes('Pro') || message.includes('plan');
    return NextResponse.json(
      { error: message },
      { status: isBilling ? 403 : 400 }
    );
  }
}
