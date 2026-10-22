import { NextRequest } from 'next/server';
import { DatabaseService } from '@/lib/db';
import { TournamentService } from '@/lib/tournament/service';
import { LeagueService } from '@/lib/league/service';
import { authenticateApiKey } from '@/lib/api/auth';
import { apiError, apiSuccess } from '@/lib/api/response';
import { checkIdempotency, saveIdempotencyResponse } from '@/lib/api/idempotency';
import { dispatchWebhookEvent } from '@/lib/api/webhooks';

export const runtime = 'nodejs';

/**
 * POST /api/v1/competitions/[idOrSlug]/scores
 * Authenticated endpoint to submit a score adjustment or match result.
 * Requires scope: "scores:submit" or "competitions:write".
 * Enforces ownership/admin authorization and supports Idempotency-Key.
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
    const auth = await authenticateApiKey(request, 'scores:submit');
    if (!auth.success) {
      // Also accept competitions:write
      const fallbackAuth = await authenticateApiKey(request, 'competitions:write');
      if (!fallbackAuth.success) {
        return auth.response;
      }
    }

    const authResult = auth.success ? auth : (await authenticateApiKey(request, 'competitions:write')) as Extract<typeof auth, { success: true }>;
    const { apiKey, ownerId, rateLimitHeaders } = authResult;
    keyIdForAudit = apiKey.id;
    ownerIdForAudit = ownerId;

    // 2. Read raw request body for idempotency
    const rawBodyText = await request.text();
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBodyText);
    } catch {
      return apiError('VALIDATION_ERROR', 'Invalid JSON request body.', 400, undefined, rateLimitHeaders);
    }

    // 3. Check Idempotency Key
    const idempotency = await checkIdempotency(request, apiKey.id, rawBodyText);
    idempotencyKeyHeader = idempotency.idempotencyKey || null;

    if (idempotency.isReplay && idempotency.replayResponse) {
      return idempotency.replayResponse;
    }
    if (idempotency.conflictResponse) {
      return idempotency.conflictResponse;
    }

    // 4. Resolve competition and verify ownership
    let lb = await DatabaseService.getLeaderboard(idOrSlug);
    if (!lb) lb = await DatabaseService.getLeaderboardBySlug(idOrSlug);

    if (!lb) {
      return apiError('NOT_FOUND', `Competition "${idOrSlug}" not found.`, 404, undefined, rateLimitHeaders);
    }

    // Verify key owner is authorized to submit scores for this leaderboard
    const admins = await DatabaseService.getAdmins(lb.id);
    const isAdmin = admins.some((a) => a.user_id === ownerId);
    const isOwner = lb.owner_id === ownerId || apiKey.scopes.includes('admin');

    if (!isOwner && !isAdmin) {
      return apiError(
        'FORBIDDEN',
        'Your API key owner is not authorized to submit scores for this competition.',
        403,
        undefined,
        rateLimitHeaders
      );
    }

    const config = await DatabaseService.getCompetitionConfig(lb.id);
    let resultPayload: Record<string, unknown> = {};

    // 5A. Tournament Match Result Mutation
    if (config?.engine_type === 'tournament' && (body.match_id || typeof body.home_score === 'number')) {
      const matchId = String(body.match_id || '');
      const homeScore = Number(body.home_score);
      const awayScore = Number(body.away_score);

      if (!matchId || isNaN(homeScore) || isNaN(awayScore)) {
        return apiError(
          'VALIDATION_ERROR',
          'match_id, home_score, and away_score are required for tournament results.',
          400,
          undefined,
          rateLimitHeaders
        );
      }

      await TournamentService.saveMatchResult(
        {
          matchId,
          homeScore,
          awayScore,
        },
        { skipAdminCheck: true }
      );

      resultPayload = {
        competition_id: lb.id,
        match_id: matchId,
        home_score: homeScore,
        away_score: awayScore,
        status: 'approved',
      };
    }
    // 5B. League Fixture Result Mutation
    else if (config?.engine_type === 'league_table' && (body.fixture_id || typeof body.home_score === 'number')) {
      const fixtureId = String(body.fixture_id || '');
      const homeScore = Number(body.home_score);
      const awayScore = Number(body.away_score);

      if (!fixtureId || isNaN(homeScore) || isNaN(awayScore)) {
        return apiError(
          'VALIDATION_ERROR',
          'fixture_id, home_score, and away_score are required for league results.',
          400,
          undefined,
          rateLimitHeaders
        );
      }

      await LeagueService.saveFixtureResult(
        {
          fixtureId,
          homeScore,
          awayScore,
        },
        { skipAdminCheck: true }
      );

      resultPayload = {
        competition_id: lb.id,
        fixture_id: fixtureId,
        home_score: homeScore,
        away_score: awayScore,
        status: 'completed',
      };
    }
    // 5C. Simple Points Event Mutation
    else {
      const memberId = String(body.member_id || '');
      const points = Number(body.points);
      const reason = String(body.reason || 'API Score Submission');
      const ruleId = body.rule_id ? String(body.rule_id) : null;

      if (!memberId || isNaN(points)) {
        return apiError(
          'VALIDATION_ERROR',
          'member_id and numeric points are required for points submissions.',
          400,
          undefined,
          rateLimitHeaders
        );
      }

      const scoreEvent = await DatabaseService.addScoreEvent(
        lb.id,
        memberId,
        {
          rule_id: ruleId,
          points,
          reason,
        },
        { skipAdminCheck: true }
      );

      resultPayload = {
        competition_id: lb.id,
        event_id: scoreEvent.id,
        member_id: memberId,
        points,
        reason,
        created_at: scoreEvent.created_at,
      };
    }

    // 6. Dispatch Webhooks asynchronously
    void dispatchWebhookEvent({
      event: 'result.submitted',
      payload: resultPayload,
      ownerId: lb.owner_id,
    });
    void dispatchWebhookEvent({
      event: 'competition.updated',
      payload: { competition_id: lb.id, slug: lb.slug, name: lb.name },
      ownerId: lb.owner_id,
    });

    const responseData = {
      message: 'Score submitted successfully.',
      result: resultPayload,
    };

    // 7. Save Idempotency response if key provided
    if (idempotency.hasKey && idempotency.idempotencyKey && idempotency.requestHash) {
      void saveIdempotencyResponse(
        apiKey.id,
        idempotency.idempotencyKey,
        `/api/v1/competitions/${idOrSlug}/scores`,
        idempotency.requestHash,
        201,
        { success: true, data: responseData }
      );
    }

    // 8. Audit log
    void DatabaseService.saveApiAuditLog({
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      key_id: keyIdForAudit,
      owner_id: ownerIdForAudit,
      endpoint: `/api/v1/competitions/${idOrSlug}/scores`,
      method: 'POST',
      status_code: 201,
      duration_ms: Date.now() - startTime,
      idempotency_key: idempotencyKeyHeader,
      created_at: new Date().toISOString(),
    });

    return apiSuccess(responseData, undefined, 201, rateLimitHeaders);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return apiError('SERVER_ERROR', message, 500);
  }
}
