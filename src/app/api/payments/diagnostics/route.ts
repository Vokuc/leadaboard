import { NextResponse } from 'next/server';
import { createSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server';
import { getSupabaseAdminConfigStatus } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const adminStatus = getSupabaseAdminConfigStatus();

    if (!isSupabaseServerConfigured) {
      return NextResponse.json(
        {
          ok: false,
          serverConfig: {
            hasSupabaseClientConfig: false,
          },
          adminConfig: adminStatus,
        },
        { status: 500 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      ok: adminStatus.errors.length === 0,
      serverConfig: {
        hasSupabaseClientConfig: true,
      },
      adminConfig: adminStatus,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to inspect payments diagnostics.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
