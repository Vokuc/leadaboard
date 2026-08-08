import { createSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server';

export interface PlanRow {
  id: string;
  name: string;
  slug: string;
  price: number;
  yearly_price: number | null;
  currency: string;
  limits: Record<string, unknown>;
  features: unknown[];
  active: boolean;
}

function ensureServerConfigured(): void {
  if (!isSupabaseServerConfigured) {
    throw new Error('Supabase server client is not configured.');
  }
}

export async function getActivePlans(): Promise<PlanRow[]> {
  ensureServerConfigured();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('active', true)
    .order('price', { ascending: true });

  if (error) {
    throw error;
  }

  return (data || []) as PlanRow[];
}

export async function getPlanBySlug(slug: string): Promise<PlanRow | null> {
  ensureServerConfigured();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as PlanRow | null;
}

export async function getSubscriptionByProviderRef(provider: string, providerSubscriptionId: string) {
  ensureServerConfigured();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('provider', provider)
    .eq('provider_subscription_id', providerSubscriptionId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function getUserSubscription(userId: string) {
  ensureServerConfigured();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('subscriptions')
    .select('*, plans(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  const rows = (data || []) as Array<Record<string, unknown>>;
  if (rows.length === 0) {
    return null;
  }

  const prioritized = rows.find((row) => {
    const status = String(row.status || '');
    return status === 'trialing' || status === 'active' || status === 'past_due' || status === 'unpaid';
  });

  return (prioritized || rows[0]) as typeof data extends Array<infer T> ? T | null : null;
}
