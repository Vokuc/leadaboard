import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/db';
import { createSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server';

export const runtime = 'nodejs';

async function getUser() {
  if (isSupabaseServerConfigured) {
    try {
      const supabase = await createSupabaseServerClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) return user;
    } catch {
      // Fall through to profile fallback
    }
  }
  const currentProfile = await DatabaseService.getCurrentProfile();
  return currentProfile ? { id: currentProfile.id, email: currentProfile.email } : null;
}

/**
 * DELETE /api/developer/keys/[id]
 * Revoke or delete an API key.
 */
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const apiKey = await DatabaseService.getApiKeyById(id);

    if (!apiKey) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }

    if (apiKey.owner_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Revoke the key
    await DatabaseService.updateApiKey(id, { status: 'revoked' });

    return NextResponse.json({ message: 'API key revoked successfully' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
