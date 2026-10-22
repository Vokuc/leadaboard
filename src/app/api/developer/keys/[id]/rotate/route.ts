import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { DatabaseService } from '@/lib/db';
import { createSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server';
import { hashSecret } from '@/lib/api/crypto';

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
 * POST /api/developer/keys/[id]/rotate
 * Rotate secret for an existing active API key.
 * Generates a new secret, updates hash, and returns the new plaintext secret once.
 */
export async function POST(
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

    if (apiKey.status !== 'active') {
      return NextResponse.json({ error: 'Cannot rotate a revoked or expired key' }, { status: 400 });
    }

    const secretRandom = crypto.randomBytes(24).toString('hex');
    const newPlaintextSecret = `${apiKey.key_prefix}_${secretRandom}`;
    const newSecretHash = hashSecret(newPlaintextSecret);

    await DatabaseService.updateApiKey(id, {
      secret_hash: newSecretHash,
      status: 'active',
    });

    return NextResponse.json({
      message: 'Secret rotated successfully. Store your new secret securely.',
      keyId: apiKey.id,
      keyPrefix: apiKey.key_prefix,
      newPlaintextSecret, // Only returned once
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
