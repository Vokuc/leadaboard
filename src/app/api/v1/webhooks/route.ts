import { NextRequest } from 'next/server';
import { DatabaseService } from '@/lib/db';
import { authenticateApiKey } from '@/lib/api/auth';
import { apiError, apiSuccess } from '@/lib/api/response';
import { generateWebhookSecret } from '@/lib/api/crypto';
import { WebhookEventType, WebhookSubscription } from '@/types';

export const runtime = 'nodejs';

const VALID_WEBHOOK_EVENTS: WebhookEventType[] = [
  'competition.created',
  'competition.updated',
  'competition.completed',
  'result.submitted',
  'result.approved',
  'participant.registered',
  'ping',
];

/**
 * GET /api/v1/webhooks
 * List all webhook subscriptions owned by the authenticated key owner.
 * Requires scope: "webhooks:manage" or "admin".
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiKey(request, 'webhooks:manage');
    if (!auth.success) return auth.response;

    const subscriptions = await DatabaseService.getWebhookSubscriptions(auth.ownerId);

    const safeSubs = subscriptions.map((s) => ({
      id: s.id,
      url: s.url,
      events: s.events,
      description: s.description,
      status: s.status,
      secret_preview: `${s.secret.slice(0, 10)}...`,
      created_at: s.created_at,
      updated_at: s.updated_at,
    }));

    return apiSuccess(safeSubs, undefined, 200, auth.rateLimitHeaders);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return apiError('SERVER_ERROR', message, 500);
  }
}

/**
 * POST /api/v1/webhooks
 * Register a new webhook destination.
 * Requires scope: "webhooks:manage" or "admin".
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateApiKey(request, 'webhooks:manage');
    if (!auth.success) return auth.response;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return apiError('VALIDATION_ERROR', 'Invalid JSON body.', 400, undefined, auth.rateLimitHeaders);
    }

    const url = String(body.url || '').trim();
    if (!url || (!url.startsWith('https://') && !url.startsWith('http://localhost'))) {
      return apiError(
        'VALIDATION_ERROR',
        'A valid HTTPS webhook URL is required (or http://localhost for local development).',
        400,
        undefined,
        auth.rateLimitHeaders
      );
    }

    const events = (Array.isArray(body.events) ? body.events : ['competition.updated']) as WebhookEventType[];
    const validEvents = events.filter((e) => VALID_WEBHOOK_EVENTS.includes(e));

    if (validEvents.length === 0) {
      return apiError(
        'VALIDATION_ERROR',
        `At least one valid event must be specified. Valid options: ${VALID_WEBHOOK_EVENTS.join(', ')}`,
        400,
        undefined,
        auth.rateLimitHeaders
      );
    }

    const secret = generateWebhookSecret();
    const timestamp = new Date().toISOString();

    const subscription: WebhookSubscription = {
      id: `wh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      owner_id: auth.ownerId,
      url,
      secret,
      events: validEvents,
      description: body.description ? String(body.description).trim() : null,
      status: 'active',
      created_at: timestamp,
      updated_at: timestamp,
    };

    const saved = await DatabaseService.saveWebhookSubscription(subscription);

    return apiSuccess(
      {
        message: 'Webhook subscription created successfully. Store the secret securely.',
        subscription: {
          id: saved.id,
          url: saved.url,
          events: saved.events,
          description: saved.description,
          secret: saved.secret, // Plaintext secret displayed on creation only
          status: saved.status,
          created_at: saved.created_at,
        },
      },
      undefined,
      201,
      auth.rateLimitHeaders
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return apiError('SERVER_ERROR', message, 500);
  }
}
