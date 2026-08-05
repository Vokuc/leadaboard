import { createSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server';

function assertConfigured() {
  if (!isSupabaseServerConfigured) {
    throw new Error('Supabase server environment is not configured.');
  }
}

async function readFlag(userId: string, featureKey: string): Promise<boolean> {
  assertConfigured();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('plans')
    .select('features')
    .eq(
      'id',
      (
        await supabase.rpc('get_effective_plan_id', {
          auth_user: userId,
        })
      ).data
    )
    .maybeSingle();

  if (error) {
    throw error;
  }

  const features = Array.isArray(data?.features) ? (data?.features as string[]) : [];
  return features.includes(featureKey);
}

async function canCreate(userId: string, resourceKey: string, leaderboardId: string | null = null): Promise<boolean> {
  assertConfigured();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc('can_create_resource', {
    auth_user: userId,
    resource_key: resourceKey,
    target_leaderboard: leaderboardId,
  });

  if (error) {
    throw error;
  }

  return Boolean(data);
}

export async function canCreateLeaderboard(userId: string): Promise<boolean> {
  return canCreate(userId, 'leaderboards');
}

export async function canCreateTournament(userId: string): Promise<boolean> {
  return canCreate(userId, 'tournaments');
}

export async function canAddParticipant(userId: string, leaderboardId: string): Promise<boolean> {
  return canCreate(userId, 'participants_per_leaderboard', leaderboardId);
}

export async function canUseAnalytics(userId: string): Promise<boolean> {
  return readFlag(userId, 'analytics');
}

export async function canUseBranding(userId: string): Promise<boolean> {
  return readFlag(userId, 'custom_branding');
}

export async function canUseAPI(userId: string): Promise<boolean> {
  return readFlag(userId, 'api_access');
}
