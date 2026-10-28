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

    const competitions = await OrganizationService.getOrganizationCompetitions(org.id);
    return NextResponse.json({ success: true, competitions });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch competitions';
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
    const { leaderboard_id } = body;

    if (!leaderboard_id) {
      return NextResponse.json({ error: 'leaderboard_id is required' }, { status: 400 });
    }

    const competition = await OrganizationService.linkCompetition(
      leaderboard_id,
      org.id,
      user.id
    );

    return NextResponse.json({ success: true, competition });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to link competition';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
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

    const { searchParams } = new URL(req.url);
    const leaderboardId = searchParams.get('leaderboard_id');

    if (!leaderboardId) {
      return NextResponse.json({ error: 'leaderboard_id is required' }, { status: 400 });
    }

    const competition = await OrganizationService.unlinkCompetition(
      leaderboardId,
      user.id
    );

    return NextResponse.json({ success: true, competition });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to unlink competition';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
