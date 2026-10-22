import { NextRequest } from 'next/server';
import { DatabaseService } from '@/lib/db';
import { authenticateApiKey } from '@/lib/api/auth';
import { apiError, apiSuccess } from '@/lib/api/response';
import { checkIdempotency, saveIdempotencyResponse } from '@/lib/api/idempotency';
import { dispatchWebhookEvent } from '@/lib/api/webhooks';

export const runtime = 'nodejs';

/**
 * POST /api/v1/competitions/[idOrSlug]/register
 * Authenticated endpoint to register a participant/member into a competition.
 * Requires scope: "competitions:write" or "participants:write".
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ idOrSlug: string }> }
) {
  const startTime = Date.now();
  let keyIdForAudit: string | null = null;
  let ownerIdForAudit: string | null = null;
  let idempotencyKeyHeader: string | null = null;

  try {
    const { idOrSlug } = await context.params;

    // 1. Authenticate with scope check
    let auth = await authenticateApiKey(request, 'competitions:write');
    if (!auth.success) {
      auth = await authenticateApiKey(request, 'participants:write');
      if (!auth.success) return auth.response;
    }

    const { apiKey, ownerId, rateLimitHeaders } = auth;
    keyIdForAudit = apiKey.id;
    ownerIdForAudit = ownerId;

    // 2. Read raw request body
    const rawBodyText = await request.text();
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBodyText);
    } catch {
      return apiError('VALIDATION_ERROR', 'Invalid JSON request body.', 400, undefined, rateLimitHeaders);
    }

    // 3. Idempotency Check
    const idempotency = await checkIdempotency(request, apiKey.id, rawBodyText);
    idempotencyKeyHeader = idempotency.idempotencyKey || null;

    if (idempotency.isReplay && idempotency.replayResponse) {
      return idempotency.replayResponse;
    }
    if (idempotency.conflictResponse) {
      return idempotency.conflictResponse;
    }

    // 4. Resolve competition
    let lb = await DatabaseService.getLeaderboard(idOrSlug);
    if (!lb) lb = await DatabaseService.getLeaderboardBySlug(idOrSlug);

    if (!lb) {
      return apiError('NOT_FOUND', `Competition "${idOrSlug}" not found.`, 404, undefined, rateLimitHeaders);
    }

    // Authorization: key owner must be owner, admin, or key has admin scope
    const admins = await DatabaseService.getAdmins(lb.id);
    const isAdmin = admins.some((a) => a.user_id === ownerId);
    const isOwner = lb.owner_id === ownerId || apiKey.scopes.includes('admin');

    if (!isOwner && !isAdmin) {
      return apiError(
        'FORBIDDEN',
        'Your API key is not authorized to register participants for this competition.',
        403,
        undefined,
        rateLimitHeaders
      );
    }

    const name = String(body.name || '').trim();
    const team = body.team ? String(body.team).trim() : null;
    const avatarUrl = body.avatar_url ? String(body.avatar_url).trim() : null;
    const email = body.email ? String(body.email).trim() : null;

    if (!name) {
      return apiError('VALIDATION_ERROR', 'Participant "name" is required.', 400, undefined, rateLimitHeaders);
    }

    // Check for duplicate active member in this competition
    const existingMembers = await DatabaseService.getMembers(lb.id);
    const duplicate = existingMembers.find(
      (m) => m.name.toLowerCase() === name.toLowerCase() && m.is_active
    );
    if (duplicate) {
      return apiError(
        'DUPLICATE_PARTICIPANT',
        `A participant named "${name}" is already registered in this competition.`,
        409,
        { existingMemberId: duplicate.id },
        rateLimitHeaders
      );
    }

    // Add member
    const newMember = await DatabaseService.addMember(
      lb.id,
      {
        name,
        team: team || null,
        avatar_url: avatarUrl || null,
        email: email || null,
        notes: null,
      },
      { skipAdminCheck: true }
    );

    const resultData = {
      message: 'Participant registered successfully.',
      member: {
        id: newMember.id,
        competition_id: lb.id,
        name: newMember.name,
        team: newMember.team,
        avatar_url: newMember.avatar_url,
        created_at: newMember.created_at,
      },
    };

    // Dispatch webhook
    void dispatchWebhookEvent({
      event: 'participant.registered',
      payload: resultData.member,
      ownerId: lb.owner_id,
    });
    void dispatchWebhookEvent({
      event: 'competition.updated',
      payload: { competition_id: lb.id, slug: lb.slug, name: lb.name },
      ownerId: lb.owner_id,
    });

    // Save idempotency response
    if (idempotency.hasKey && idempotency.idempotencyKey && idempotency.requestHash) {
      void saveIdempotencyResponse(
        apiKey.id,
        idempotency.idempotencyKey,
        `/api/v1/competitions/${idOrSlug}/register`,
        idempotency.requestHash,
        201,
        { success: true, data: resultData }
      );
    }

    // Audit log
    void DatabaseService.saveApiAuditLog({
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      key_id: keyIdForAudit,
      owner_id: ownerIdForAudit,
      endpoint: `/api/v1/competitions/${idOrSlug}/register`,
      method: 'POST',
      status_code: 201,
      duration_ms: Date.now() - startTime,
      idempotency_key: idempotencyKeyHeader,
      created_at: new Date().toISOString(),
    });

    return apiSuccess(resultData, undefined, 201, rateLimitHeaders);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return apiError('SERVER_ERROR', message, 500);
  }
}
