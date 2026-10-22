import { DatabaseService } from '@/lib/db';
import { WebhookDelivery, WebhookEventType, WebhookSubscription } from '@/types';
import { signWebhookPayload } from './crypto';

export interface DispatchEventOptions {
  event: WebhookEventType;
  payload: Record<string, unknown>;
  ownerId: string;
}

export interface WebhookSendResult {
  subscriptionId: string;
  url: string;
  success: boolean;
  statusCode?: number;
  error?: string;
}

/**
 * Dispatch an event to all matching active webhook subscriptions for a given owner.
 */
export async function dispatchWebhookEvent(
  options: DispatchEventOptions
): Promise<WebhookDelivery[]> {
  const { event, payload, ownerId } = options;

  const subscriptions = await DatabaseService.getWebhookSubscriptions(ownerId);
  const activeSubs = subscriptions.filter(
    (s) => s.status === 'active' && s.events.includes(event)
  );

  const deliveries: WebhookDelivery[] = [];

  for (const sub of activeSubs) {
    const delivery = await executeWebhookDelivery(sub, event, payload);
    deliveries.push(delivery);
  }

  return deliveries;
}

/**
 * Deliver payload to an individual subscription endpoint, record delivery, and sign the payload.
 */
export async function executeWebhookDelivery(
  subscription: WebhookSubscription,
  event: WebhookEventType,
  data: Record<string, unknown>,
  attempts = 1
): Promise<WebhookDelivery> {
  const timestamp = Math.floor(Date.now() / 1000);
  const eventId = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const webhookBody = {
    id: eventId,
    event,
    timestamp,
    data,
  };

  const rawJson = JSON.stringify(webhookBody);
  const { signatureHeader } = signWebhookPayload(subscription.secret, rawJson, timestamp);

  let statusCode: number | null = null;
  let status: 'success' | 'failed' = 'failed';
  let errorMessage: string | null = null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(subscription.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'LeaderboardOS-Webhook/1.0',
        'X-LeaderboardOS-Signature': signatureHeader,
        'X-LeaderboardOS-Event': event,
        'X-LeaderboardOS-Delivery': eventId,
      },
      body: rawJson,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    statusCode = response.status;

    if (response.ok) {
      status = 'success';
    } else {
      errorMessage = `Destination returned HTTP ${response.status}: ${response.statusText}`;
    }
  } catch (err: unknown) {
    errorMessage = err instanceof Error ? err.message : 'Network request failed';
  }

  const deliveryRecord: WebhookDelivery = {
    id: `del_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    subscription_id: subscription.id,
    event,
    payload: webhookBody,
    status,
    status_code: statusCode,
    attempts,
    error_message: errorMessage,
    delivered_at: status === 'success' ? new Date().toISOString() : null,
    created_at: new Date().toISOString(),
  };

  await DatabaseService.saveWebhookDelivery(deliveryRecord);
  return deliveryRecord;
}

/**
 * Manually retry a failed delivery.
 */
export async function retryWebhookDelivery(deliveryId: string): Promise<WebhookDelivery | null> {
  const deliveries = await DatabaseService.getWebhookDeliveries();
  const delivery = deliveries.find((d) => d.id === deliveryId);
  if (!delivery) return null;

  const subscription = await DatabaseService.getWebhookSubscriptionById(delivery.subscription_id);
  if (!subscription) return null;

  const retried = await executeWebhookDelivery(
    subscription,
    delivery.event,
    (delivery.payload as { data: Record<string, unknown> })?.data || delivery.payload,
    delivery.attempts + 1
  );

  return retried;
}
