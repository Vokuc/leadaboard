import { NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/db';
import { ApiKey, ApiKeyScope } from '@/types';
import { hashSecret, timingSafeEqualString } from './crypto';
import { checkRateLimit, getRateLimitHeaders } from './rateLimiter';
import { apiError } from './response';

export interface ApiAuthSuccess {
  success: true;
  apiKey: ApiKey;
  ownerId: string;
  rateLimitHeaders: Record<string, string>;
}

export interface ApiAuthFailure {
  success: false;
  response: NextResponse;
  apiKey?: ApiKey;
}

export type ApiAuthResult = ApiAuthSuccess | ApiAuthFailure;

/**
 * Extract raw API key string from Authorization or X-API-Key header.
 */
export function extractApiKeyFromRequest(request: Request): string | null {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  const xApiKey = request.headers.get('x-api-key') || request.headers.get('X-API-Key');
  if (xApiKey && xApiKey.trim()) {
    return xApiKey.trim();
  }

  return null;
}

/**
 * Authenticate an incoming API request using an API key.
 * Enforces key validity, secret hash verification, expiration, scopes, and rate limits.
 */
export async function authenticateApiKey(
  request: Request,
  requiredScope?: ApiKeyScope
): Promise<ApiAuthResult> {
  const rawKey = extractApiKeyFromRequest(request);

  if (!rawKey) {
    return {
      success: false,
      response: apiError(
        'UNAUTHORIZED',
        'Authentication required. Provide a valid API key via Authorization: Bearer <key> or X-API-Key header.',
        401
      ),
    };
  }

  // Derive key prefix (lb_live_<keyId>)
  const parts = rawKey.split('_');
  if (parts.length < 3) {
    return {
      success: false,
      response: apiError('INVALID_API_KEY', 'Malformed API key format.', 401),
    };
  }

  const keyPrefix = `${parts[0]}_${parts[1]}_${parts[2]}`;
  const computedHash = hashSecret(rawKey);

  // Authoritatively lookup key from DatabaseService
  const allKeys = await DatabaseService.getApiKeys();
  const matchedKey = allKeys.find((k) => k.key_prefix === keyPrefix);

  if (!matchedKey) {
    return {
      success: false,
      response: apiError('INVALID_API_KEY', 'Invalid API key.', 401),
    };
  }

  // Constant-time hash verification
  if (!timingSafeEqualString(matchedKey.secret_hash, computedHash)) {
    return {
      success: false,
      response: apiError('INVALID_API_KEY', 'Invalid API key secret.', 401),
    };
  }

  // Check key status
  if (matchedKey.status === 'revoked') {
    return {
      success: false,
      response: apiError('API_KEY_REVOKED', 'This API key has been revoked and can no longer be used.', 401),
      apiKey: matchedKey,
    };
  }

  if (matchedKey.status === 'expired') {
    return {
      success: false,
      response: apiError('API_KEY_EXPIRED', 'This API key has expired.', 401),
      apiKey: matchedKey,
    };
  }

  // Check expiration timestamp
  if (matchedKey.expires_at && new Date(matchedKey.expires_at).getTime() < Date.now()) {
    void DatabaseService.updateApiKey(matchedKey.id, { status: 'expired' });
    return {
      success: false,
      response: apiError('API_KEY_EXPIRED', 'This API key has expired.', 401),
      apiKey: matchedKey,
    };
  }

  // Rate Limiter Check
  const rateLimitResult = checkRateLimit(matchedKey.id, matchedKey.rate_limit_per_minute);
  const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);

  if (!rateLimitResult.allowed) {
    return {
      success: false,
      apiKey: matchedKey,
      response: apiError(
        'RATE_LIMITED',
        `Rate limit exceeded. Maximum ${rateLimitResult.limit} requests per minute.`,
        429,
        { retryAfterSeconds: rateLimitResult.resetSeconds },
        rateLimitHeaders
      ),
    };
  }

  // Scope Verification
  if (requiredScope) {
    const hasScope =
      matchedKey.scopes.includes(requiredScope) || matchedKey.scopes.includes('admin');

    if (!hasScope) {
      return {
        success: false,
        apiKey: matchedKey,
        response: apiError(
          'INSUFFICIENT_SCOPE',
          `This API key does not have the required "${requiredScope}" scope. Available scopes: ${matchedKey.scopes.join(', ')}`,
          403,
          { requiredScope, availableScopes: matchedKey.scopes },
          rateLimitHeaders
        ),
      };
    }
  }

  // Record usage timestamp
  void DatabaseService.updateApiKey(matchedKey.id, { last_used_at: new Date().toISOString() });

  return {
    success: true,
    apiKey: matchedKey,
    ownerId: matchedKey.owner_id,
    rateLimitHeaders,
  };
}
