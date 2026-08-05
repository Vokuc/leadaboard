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
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}
