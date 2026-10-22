import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { DatabaseService } from '@/lib/db';
import { ApiIdempotencyRecord } from '@/types';
import { apiError } from './response';

export interface IdempotencyCheckResult {
  hasKey: boolean;
  idempotencyKey?: string;
  isReplay?: boolean;
  replayResponse?: NextResponse;
  conflictResponse?: NextResponse;
  requestHash?: string;
}

/**
 * Extract and validate Idempotency-Key from request headers.
 */
export async function checkIdempotency(
  request: Request,
  keyId: string,
  rawBodyText: string
): Promise<IdempotencyCheckResult> {
  const idempotencyKey =
    request.headers.get('idempotency-key') ||
    request.headers.get('Idempotency-Key') ||
    request.headers.get('x-idempotency-key');

  if (!idempotencyKey || !idempotencyKey.trim()) {
    return { hasKey: false };
  }

  const cleanKey = idempotencyKey.trim();
  const requestHash = crypto.createHash('sha256').update(rawBodyText).digest('hex');

  const existing = await DatabaseService.getIdempotencyRecord(keyId, cleanKey);
  if (!existing) {
    return {
      hasKey: true,
      idempotencyKey: cleanKey,
      requestHash,
    };
  }

  // Check if payload matches original
  if (existing.request_hash !== requestHash) {
    return {
      hasKey: true,
      idempotencyKey: cleanKey,
      requestHash,
      conflictResponse: apiError(
        'IDEMPOTENCY_CONFLICT',
        'This Idempotency-Key has already been used with a different request payload.',
        409,
        { idempotencyKey: cleanKey }
      ),
    };
  }

  // Payload matches - replay cached response
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(existing.response_body);
  } catch {
    parsedJson = { response: existing.response_body };
  }

  const replayResponse = NextResponse.json(parsedJson, {
    status: existing.response_status,
    headers: {
      'Content-Type': 'application/json',
      'Idempotent-Replay': 'true',
    },
  });

  return {
    hasKey: true,
    idempotencyKey: cleanKey,
    isReplay: true,
    replayResponse,
    requestHash,
  };
}

/**
 * Save completed mutation response in the idempotency store.
 */
export async function saveIdempotencyResponse(
  keyId: string,
  idempotencyKey: string,
  endpoint: string,
  requestHash: string,
  responseStatus: number,
  responseJson: unknown
): Promise<void> {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours
  const record: ApiIdempotencyRecord = {
    id: `idem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    key_id: keyId,
    idempotency_key: idempotencyKey,
    endpoint,
    request_hash: requestHash,
    response_status: responseStatus,
    response_body: JSON.stringify(responseJson),
    expires_at: expiresAt,
    created_at: new Date().toISOString(),
  };

  await DatabaseService.saveIdempotencyRecord(record);
}
