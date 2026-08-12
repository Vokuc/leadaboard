import { isSupabaseServerConfigured } from '@/lib/supabase/server';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { PaymentProviderKey } from '@/lib/payments/core/types';
import { getPaymentProvider } from '@/lib/payments/providers';

function assertServerConfigured(): void {
  if (!isSupabaseServerConfigured) {
    throw new Error('Supabase server environment is not configured.');
  }

  if (!isSupabaseAdminConfigured) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing. Billing webhook processing requires the service role key.');
  }
}

function mapProviderSubscriptionStatus(eventType: string): string {
  if (eventType.includes('cancel')) {
    return 'cancelled';
  }
  if (eventType.includes('past_due') || eventType.includes('payment_failed')) {
    return 'past_due';
  }
  if (eventType.includes('expired')) {
    return 'expired';
  }
  if (eventType.includes('incomplete')) {
    return 'incomplete';
  }
  return 'active';
}

function mapPaymentStatus(eventType: string): 'pending' | 'succeeded' | 'failed' | 'cancelled' | 'refunded' | 'partially_refunded' {
  const normalized = eventType.toLowerCase();

  if (normalized.includes('partial_refund') || normalized.includes('partially_refunded')) {
    return 'partially_refunded';
  }
  if (normalized.includes('refund')) {
    return 'refunded';
  }
  if (normalized.includes('cancel')) {
    return 'cancelled';
  }
  if (normalized.includes('fail') || normalized.includes('declin') || normalized.includes('chargeback')) {
    return 'failed';
  }
  if (normalized.includes('pending') || normalized.includes('processing')) {
    return 'pending';
  }
  return 'succeeded';
}

export const PaymentWebhookService = {
  async process(providerKey: PaymentProviderKey, payload: string, headers: Headers) {
    assertServerConfigured();
    const supabase = createSupabaseAdminClient();
    const provider = getPaymentProvider(providerKey);

    const signature =
      headers.get('stripe-signature') ||
      headers.get('x-paystack-signature') ||
      headers.get('verif-hash') ||
      headers.get('x-pi-signature');

    const normalized = await provider.verifyWebhook({
      signature,
      payload,
      headers: Object.fromEntries(headers.entries()),
    });

    const { data: existingEvent, error: existingError } = await supabase
      .from('webhook_events')
      .select('*')
      .eq('provider', providerKey)
      .eq('event_id', normalized.eventId)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existingEvent?.processed) {
      return { duplicate: true, eventId: normalized.eventId };
    }

    if (!existingEvent) {
      const { error: insertWebhookError } = await supabase
        .from('webhook_events')
        .insert({
          provider: providerKey,
          event_id: normalized.eventId,
          event_type: normalized.eventType,
          payload: normalized.data,
          processed: false,
          retry_count: 0,
        });

      if (insertWebhookError) {
        // Unique collisions are possible during concurrent retries.
        if (!String(insertWebhookError.message).toLowerCase().includes('duplicate')) {
          throw insertWebhookError;
        }
      }
    }

    const data = normalized.data;
    const paymentReference = String(data.payment_reference || data.reference || data.paymentReference || '');
    const providerSubscriptionId = String(data.provider_subscription_id || data.subscription_id || data.subscriptionId || '');

    if (paymentReference) {
      const paymentStatus = mapPaymentStatus(normalized.eventType);

      const { error: paymentUpdateError } = await supabase
        .from('payments')
        .update({
          status: paymentStatus,
        })
        .eq('provider', providerKey)
        .eq('payment_reference', paymentReference);

      if (paymentUpdateError) {
        throw paymentUpdateError;
      }

      const { data: paymentRows } = await supabase
        .from('payments')
        .select('id,user_id,amount,currency,subscription_id')
        .eq('provider', providerKey)
        .eq('payment_reference', paymentReference)
        .limit(1);

      const payment = paymentRows?.[0];
      if (payment) {
        const invoiceStatus = paymentStatus === 'failed' || paymentStatus === 'cancelled' ? 'open' : 'paid';

        const { error: invoiceError } = await supabase
          .from('invoices')
          .update({
            status: invoiceStatus,
            metadata: {
              webhook_event_id: normalized.eventId,
              webhook_event_type: normalized.eventType,
            },
          })
          .eq('payment_id', payment.id);

        if (invoiceError) {
          throw invoiceError;
        }

        const notificationType = paymentStatus === 'failed' || paymentStatus === 'cancelled' ? 'payment_failed' : 'payment_succeeded';
        const { error: notifyError } = await supabase
          .from('billing_notifications')
          .insert({
            user_id: payment.user_id,
            notification_type: notificationType,
            payload: {
              payment_reference: paymentReference,
              amount: payment.amount,
              currency: payment.currency,
            },
            sent_at: new Date().toISOString(),
          });

        if (notifyError) {
          throw notifyError;
        }

        if (payment.subscription_id) {
          const { data: subs, error: subError } = await supabase
            .from('subscriptions')
            .select('id,status,metadata,current_period_start,current_period_end')
            .eq('id', payment.subscription_id)
            .limit(1);

          if (subError) {
            throw subError;
          }

          const sub = subs?.[0];
          if (sub) {
            if (paymentStatus === 'succeeded') {
              const now = new Date();
              const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

              const { error: subUpdateError } = await supabase
                .from('subscriptions')
                .update({
                  status: 'active',
                  grace_period_end: null,
                  current_period_start: sub.current_period_start || now.toISOString(),
                  current_period_end: sub.current_period_end || periodEnd.toISOString(),
                  metadata: {
                    ...(sub.metadata || {}),
                    activated_via: 'webhook_payment',
                    last_successful_payment_event: normalized.eventType,
                    last_successful_payment_at: new Date().toISOString(),
                  },
                })
                .eq('id', sub.id);

              if (subUpdateError) {
                throw subUpdateError;
              }
            }

            if (paymentStatus === 'failed' || paymentStatus === 'cancelled') {
              const gracePeriodEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
              const { error: subUpdateError } = await supabase
                .from('subscriptions')
                .update({
                  status: 'past_due',
                  grace_period_end: gracePeriodEnd,
                  metadata: {
                    ...(sub.metadata || {}),
                    payment_issue_via: 'webhook_payment',
                    payment_issue_event: normalized.eventType,
                    payment_issue_at: new Date().toISOString(),
                  },
                })
                .eq('id', sub.id);

              if (subUpdateError) {
                throw subUpdateError;
              }
            }
          }
        }
      }
    }

    if (providerSubscriptionId) {
      const nextStatus = mapProviderSubscriptionStatus(normalized.eventType);

      const { data: subs, error: subError } = await supabase
        .from('subscriptions')
        .select('id,user_id,status')
        .eq('provider', providerKey)
        .eq('provider_subscription_id', providerSubscriptionId)
        .limit(1);

      if (subError) {
        throw subError;
      }

      const sub = subs?.[0];
      if (sub) {
        const gracePeriodEnd =
          nextStatus === 'past_due' || nextStatus === 'unpaid'
            ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
            : null;

        const { error: updateSubError } = await supabase
          .from('subscriptions')
          .update({
            status: nextStatus,
            grace_period_end: gracePeriodEnd,
            cancelled_at: nextStatus === 'cancelled' ? new Date().toISOString() : null,
            metadata: {
              webhook_event_id: normalized.eventId,
              webhook_event_type: normalized.eventType,
            },
          })
          .eq('id', sub.id);

        if (updateSubError) {
          throw updateSubError;
        }

        const { error: subNotifyError } = await supabase
          .from('billing_notifications')
          .insert({
            user_id: sub.user_id,
            notification_type: 'subscription_status_changed',
            payload: {
              previous_status: sub.status,
              next_status: nextStatus,
              grace_period_end: gracePeriodEnd,
            },
            sent_at: new Date().toISOString(),
          });

        if (subNotifyError) {
          throw subNotifyError;
        }
      }
    }

    const { error: doneError } = await supabase
      .from('webhook_events')
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
      })
      .eq('provider', providerKey)
      .eq('event_id', normalized.eventId);

    if (doneError) {
      throw doneError;
    }

    return { duplicate: false, eventId: normalized.eventId };
  },
};
