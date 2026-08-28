import { NextResponse } from 'next/server';
import { createSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  try {
    // 1. Authenticate the user server-side
    if (!isSupabaseServerConfigured) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const serverSupabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await serverSupabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse the request body
    const body = await request.json();
    const { leaderboard, rules, season } = body;

    if (!leaderboard || !leaderboard.name || !leaderboard.slug) {
      return NextResponse.json({ error: 'Missing required leaderboard fields' }, { status: 400 });
    }

    // 3. Use the admin client (bypasses RLS) for the insert
    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json({ error: 'Admin client not configured' }, { status: 500 });
    }

    const admin = createSupabaseAdminClient();

    // Insert the leaderboard with the authenticated user as owner
    const { data: newLb, error: lbErr } = await admin
      .from('leaderboards')
      .insert([{
        name: leaderboard.name,
        description: leaderboard.description || null,
        slug: leaderboard.slug,
        visibility: leaderboard.visibility || 'public',
        competition_type: leaderboard.competition_type || 'custom',
        cover_image_url: leaderboard.cover_image_url || null,
        owner_id: user.id,
        status: 'active',
      }])
      .select()
      .single();

    if (lbErr) {
      console.error('[create-leaderboard] Insert failed:', lbErr);
      return NextResponse.json({ error: lbErr.message }, { status: 400 });
    }

    // Insert scoring rules if provided
    if (rules && Array.isArray(rules) && rules.length > 0) {
      const rulesToInsert = rules.map((r: { event_name: string; points: number; description?: string }) => ({
        event_name: r.event_name,
        points: r.points,
        description: r.description || null,
        leaderboard_id: newLb.id,
      }));

      const { error: rErr } = await admin.from('scoring_rules').insert(rulesToInsert);
      if (rErr) {
        // Rollback: delete the leaderboard
        await admin.from('leaderboards').delete().eq('id', newLb.id);
        console.error('[create-leaderboard] Scoring rules insert failed:', rErr);
        return NextResponse.json({ error: rErr.message }, { status: 400 });
      }
    }

    // Insert season if provided
    if (season && season.name) {
      const { error: sErr } = await admin
        .from('seasons')
        .insert([{
          name: season.name,
          start_date: season.start_date,
          end_date: season.end_date || null,
          leaderboard_id: newLb.id,
        }]);

      if (sErr) {
        await admin.from('leaderboards').delete().eq('id', newLb.id);
        console.error('[create-leaderboard] Season insert failed:', sErr);
        return NextResponse.json({ error: sErr.message }, { status: 400 });
      }
    }

    return NextResponse.json({ data: newLb }, { status: 201 });
  } catch (err) {
    console.error('[create-leaderboard] Unexpected error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
