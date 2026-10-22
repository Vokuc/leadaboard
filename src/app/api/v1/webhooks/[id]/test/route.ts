import { NextRequest } from 'next/server';
import { DatabaseService } from '@/lib/db';
import { authenticateApiKey } from '@/lib/api/auth';
import { apiError, apiSuccess } from '@/lib/api/response';
import { executeWebhookDelivery } from '@/lib/api/webhooks';

export const runtime = 'nodejs';

/**
 * POST /api/v1/webhooks/[id]/test
 * Trigger a test ping event delivery for a webhook subscription.
 * Requires scope: "webhooks:manage" or "admin".
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const auth = await authenticateApiKey(request, 'webhooks:manage');
    if (!auth.success) return auth.response;

    const subscription = await DatabaseService.getWebhookSubscriptionById(id);
    if (!subscription) {
      return apiError('NOT_FOUND', `Webhook subscription "${id}" not found.`, 404, undefined, auth.rateLimitHeaders);
    }

    if (subscription.owner_id !== auth.ownerId && !auth.apiKey.scopes.includes('admin')) {
      return apiError('FORBIDDEN', 'You do not have permission to test this webhook.', 403, undefined, auth.rateLimitHeaders);
    }

    const testPayload = {
      message: 'Ping test from LeaderboardOS Developer Platform',
      subscription_id: subscription.id,
      timestamp: new Date().toISOString(),
      sample_data: {
        competition_name: 'Summer Invitational 2026',
        event: 'ping',
      },
    };

    const delivery = await executeWebhookDelivery(subscription, 'ping', testPayload);

    return apiSuccess(
      {
        message: delivery.status === 'success' ? 'Test ping delivered successfully.' : 'Test ping delivery attempted.',
        delivery: {
          id: delivery.id,
          status: delivery.status,
          status_code: delivery.status_code,
          error_message: delivery.error_message,
          delivered_at: delivery.delivered_at,
          created_at: delivery.created_at,
        },
      },
      undefined,
      delivery.status === 'success' ? 200 : 502,
      auth.rateLimitHeaders
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return apiError('SERVER_ERROR', message, 500);
  }
}
