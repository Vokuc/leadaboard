import Link from 'next/link';
import { createSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server';

interface StatRow {
  total_subscriptions: number;
  active_subscriptions: number;
  past_due_subscriptions: number;
  month_revenue_cents: number;
  total_revenue_cents: number;
}

export default async function AdminBillingPage() {
  if (!isSupabaseServerConfigured) {
    return (
      <div className="min-h-screen bg-black text-white p-8">
        <h1 className="text-2xl font-bold">Admin Billing</h1>
        <p className="mt-2 text-neutral-400">Supabase server is not configured.</p>
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="min-h-screen bg-black text-white p-8">
        <h1 className="text-2xl font-bold">Admin Billing</h1>
        <p className="mt-2 text-neutral-400">Please log in.</p>
      </div>
    );
  }

  const [subscriptionsRes, paymentsRes, webhookRes] = await Promise.all([
    supabase.from('subscriptions').select('status, created_at'),
    supabase.from('payments').select('status, amount, created_at').eq('status', 'succeeded'),
    supabase.from('webhook_events').select('provider, processed, retry_count, created_at').order('created_at', { ascending: false }).limit(50),
  ]);

  const subscriptions = subscriptionsRes.data || [];
  const payments = paymentsRes.data || [];
  const webhooks = webhookRes.data || [];

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const totalSubscriptions = subscriptions.length;
  const activeSubscriptions = subscriptions.filter((item) => item.status === 'active' || item.status === 'trialing').length;
  const pastDueSubscriptions = subscriptions.filter((item) => item.status === 'past_due' || item.status === 'unpaid').length;

  const totalRevenueCents = payments.reduce((acc, item) => acc + Number(item.amount || 0), 0);
  const monthRevenueCents = payments
    .filter((item) => {
      if (!item.created_at) return false;
      return new Date(item.created_at) >= monthStart;
    })
    .reduce((acc, item) => acc + Number(item.amount || 0), 0);

  const stats: StatRow = {
    total_subscriptions: totalSubscriptions,
    active_subscriptions: activeSubscriptions,
    past_due_subscriptions: pastDueSubscriptions,
    month_revenue_cents: monthRevenueCents,
    total_revenue_cents: totalRevenueCents,
  };

  return (
    <div className="min-h-screen bg-black text-white pb-16">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-8">
          <Link href="/dashboard" className="text-sm text-neutral-400 hover:text-white">Back to Dashboard</Link>
          <h1 className="text-3xl font-bold mt-2">Admin Billing Console</h1>
          <p className="text-sm text-neutral-400 mt-1">Operational metrics for subscriptions, revenue, and webhook processing.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="rounded-2xl border border-white/10 bg-neutral-950 p-4">
            <div className="text-xs uppercase tracking-wider text-neutral-400">Subscriptions</div>
            <div className="text-2xl font-bold mt-2">{stats.total_subscriptions}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-neutral-950 p-4">
            <div className="text-xs uppercase tracking-wider text-neutral-400">Active / Trialing</div>
            <div className="text-2xl font-bold mt-2 text-emerald-300">{stats.active_subscriptions}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-neutral-950 p-4">
            <div className="text-xs uppercase tracking-wider text-neutral-400">Past Due / Unpaid</div>
            <div className="text-2xl font-bold mt-2 text-amber-300">{stats.past_due_subscriptions}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-neutral-950 p-4">
            <div className="text-xs uppercase tracking-wider text-neutral-400">MRR (This Month)</div>
            <div className="text-2xl font-bold mt-2">${(stats.month_revenue_cents / 100).toFixed(2)}</div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-neutral-950 p-5 mb-8">
          <h2 className="text-lg font-semibold">Total Revenue</h2>
          <p className="mt-2 text-3xl font-bold">${(stats.total_revenue_cents / 100).toFixed(2)}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-neutral-950 p-5">
          <h2 className="text-lg font-semibold mb-3">Recent Webhook Events</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-neutral-400 border-b border-white/10">
                  <th className="py-2 pr-4">Provider</th>
                  <th className="py-2 pr-4">Processed</th>
                  <th className="py-2 pr-4">Retry Count</th>
                  <th className="py-2 pr-4">Created</th>
                </tr>
              </thead>
              <tbody>
                {webhooks.map((event, idx) => (
                  <tr key={`${event.provider}-${idx}`} className="border-b border-white/5">
                    <td className="py-2 pr-4 capitalize">{event.provider}</td>
                    <td className="py-2 pr-4">{event.processed ? 'Yes' : 'No'}</td>
                    <td className="py-2 pr-4">{event.retry_count}</td>
                    <td className="py-2 pr-4">{event.created_at ? new Date(event.created_at).toLocaleString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
