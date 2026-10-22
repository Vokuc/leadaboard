import { NextRequest } from 'next/server';
import { DatabaseService } from '@/lib/db';
import { authenticateApiKey } from '@/lib/api/auth';
import { apiError, apiSuccess } from '@/lib/api/response';

export const runtime = 'nodejs';

/**
 * DELETE /api/v1/webhooks/[id]
 * Delete a webhook subscription.
 * Requires scope: "webhooks:manage" or "admin".
 */
export async function DELETE(
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
      return apiError('FORBIDDEN', 'You do not have permission to delete this webhook.', 403, undefined, auth.rateLimitHeaders);
    }

    await DatabaseService.deleteWebhookSubscription(id);

    return apiSuccess({ message: 'Webhook subscription deleted successfully.' }, undefined, 200, auth.rateLimitHeaders);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return apiError('SERVER_ERROR', message, 500);
  }
}
