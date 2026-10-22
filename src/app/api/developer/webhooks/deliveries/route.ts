import { NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/db';
import { createSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server';

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
 * GET /api/developer/webhooks/deliveries
 * List recent deliveries for dashboard webhooks monitor.
 */
export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subscriptions = await DatabaseService.getWebhookSubscriptions(user.id);
    const subIds = new Set(subscriptions.map((s) => s.id));

    const allDeliveries = await DatabaseService.getWebhookDeliveries();
    const userDeliveries = allDeliveries.filter((d) => subIds.has(d.subscription_id)).slice(0, 30);

    return NextResponse.json({ deliveries: userDeliveries });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
