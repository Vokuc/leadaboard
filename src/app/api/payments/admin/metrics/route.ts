import { NextResponse } from 'next/server';
import { createSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';

export async function GET() {
  try {
    if (!isSupabaseServerConfigured) {
      return NextResponse.json({ error: 'Server is not configured for payments.' }, { status: 500 });
    }

    if (!isSupabaseAdminConfigured) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is missing.' }, { status: 500 });
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const billingAdmin = createSupabaseAdminClient();

    const [subscriptionsRes, paymentsRes, webhooksRes] = await Promise.all([
      billingAdmin.from('subscriptions').select('status, created_at'),
      billingAdmin.from('payments').select('status, amount, created_at').eq('status', 'succeeded'),
      billingAdmin.from('webhook_events').select('provider, processed, retry_count, created_at').order('created_at', { ascending: false }).limit(100),
    ]);

    if (subscriptionsRes.error) {
      throw subscriptionsRes.error;
    }
    if (paymentsRes.error) {
      throw paymentsRes.error;
    }
    if (webhooksRes.error) {
      throw webhooksRes.error;
    }

    const subscriptions = subscriptionsRes.data || [];
    const payments = paymentsRes.data || [];
    const webhooks = webhooksRes.data || [];

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthRevenueCents = payments
      .filter((row) => row.created_at && new Date(row.created_at) >= monthStart)
      .reduce((acc, row) => acc + Number(row.amount || 0), 0);

    const totalRevenueCents = payments.reduce((acc, row) => acc + Number(row.amount || 0), 0);

    return NextResponse.json({
      totalSubscriptions: subscriptions.length,
      activeSubscriptions: subscriptions.filter((row) => row.status === 'active' || row.status === 'trialing').length,
      pastDueSubscriptions: subscriptions.filter((row) => row.status === 'past_due' || row.status === 'unpaid').length,
      monthRevenueCents,
      totalRevenueCents,
      recentWebhooks: webhooks,
      now: now.toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load admin billing metrics.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
