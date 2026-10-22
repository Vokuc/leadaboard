import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/db';
import { createSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server';
import { generateApiKey } from '@/lib/api/crypto';
import { ApiKey, ApiKeyScope } from '@/types';

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
 * GET /api/developer/keys
 * List API keys for dashboard developer tab.
 */
export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const keys = await DatabaseService.getApiKeys(user.id);

    // Never return secret_hash to client
    const safeKeys = keys.map((k) => ({
      id: k.id,
      name: k.name,
      key_prefix: k.key_prefix,
      scopes: k.scopes,
      rate_limit_per_minute: k.rate_limit_per_minute,
      status: k.status,
      expires_at: k.expires_at,
      last_used_at: k.last_used_at,
      created_at: k.created_at,
    }));

    return NextResponse.json({ keys: safeKeys });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/developer/keys
 * Create a new API key. Returns the plaintext secret ONCE.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const name = String(body.name || 'API Key').trim();
    const scopes = (Array.isArray(body.scopes) && body.scopes.length > 0
      ? body.scopes
      : ['competitions:read', 'scores:submit']) as ApiKeyScope[];
    const rateLimit = typeof body.rate_limit_per_minute === 'number' ? Math.max(10, body.rate_limit_per_minute) : 60;
    const expiresAt = body.expires_at ? new Date(String(body.expires_at)).toISOString() : null;

    const { keyId, keyPrefix, plaintextSecret, secretHash } = generateApiKey('lb_live');
    const timestamp = new Date().toISOString();

    const apiKey: ApiKey = {
      id: keyId,
      owner_id: user.id,
      name,
      key_prefix: keyPrefix,
      secret_hash: secretHash,
      scopes,
      rate_limit_per_minute: rateLimit,
      status: 'active',
      expires_at: expiresAt,
      last_used_at: null,
      created_at: timestamp,
      updated_at: timestamp,
    };

    const saved = await DatabaseService.saveApiKey(apiKey);

    return NextResponse.json(
      {
        apiKey: {
          id: saved.id,
          name: saved.name,
          key_prefix: saved.key_prefix,
          scopes: saved.scopes,
          rate_limit_per_minute: saved.rate_limit_per_minute,
          status: saved.status,
          expires_at: saved.expires_at,
          created_at: saved.created_at,
        },
        plaintextSecret, // Only returned once!
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
