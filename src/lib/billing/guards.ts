import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { createSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server';
import {
  canAddParticipant,
  canCreateLeaderboard,
  canCreateTournament,
  canUseAPI,
  canUseAnalytics,
  canUseBranding,
} from '@/lib/billing/access';
import { isProfileRoleBillingAdmin, isUserBillingAdmin } from '@/lib/billing/admin';

type CreateResourceKey = 'leaderboards' | 'tournaments' | 'participants_per_leaderboard';
type FeatureKey = 'analytics' | 'custom_branding' | 'api_access';

export class BillingAccessError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = 'BillingAccessError';
    this.status = status;
  }
}

function ensureServerConfigured(): void {
  if (!isSupabaseServerConfigured) {
    throw new BillingAccessError('Supabase server environment is not configured.', 500);
  }
}

export async function requireAuthenticatedUser(): Promise<User> {
  ensureServerConfigured();
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new BillingAccessError('Unauthorized', 401);
  }

  return user;
}

export async function requireBillingAdminUser(): Promise<User> {
  const user = await requireAuthenticatedUser();

  const supabase = await createSupabaseServerClient();
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (!error && profile && isProfileRoleBillingAdmin(profile.role)) {
    return user;
  }

  // Fallback keeps backward compatibility during role migration rollout.
  if (isUserBillingAdmin(user)) {
    return user;
  }

  throw new BillingAccessError('Forbidden: admin access required.', 403);
}

export async function ensureCreateResourceAccess(
  userId: string,
  resource: CreateResourceKey,
  leaderboardId: string | null = null
): Promise<void> {
  let allowed = false;

  if (resource === 'leaderboards') {
    allowed = await canCreateLeaderboard(userId);
  } else if (resource === 'tournaments') {
    allowed = await canCreateTournament(userId);
  } else {
    if (!leaderboardId) {
      throw new BillingAccessError('Leaderboard id is required for participant limits.', 400);
    }
    allowed = await canAddParticipant(userId, leaderboardId);
  }

  if (!allowed) {
    throw new BillingAccessError('Plan limit reached for this action.', 403);
  }
}

export async function ensureFeatureAccess(userId: string, feature: FeatureKey): Promise<void> {
  const allowed =
    feature === 'analytics'
      ? await canUseAnalytics(userId)
      : feature === 'custom_branding'
        ? await canUseBranding(userId)
        : await canUseAPI(userId);

  if (!allowed) {
    throw new BillingAccessError('Feature not available on your current plan.', 403);
  }
}

export function toBillingErrorResponse(error: unknown, fallbackMessage: string): NextResponse {
  if (error instanceof BillingAccessError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  const message = error instanceof Error ? error.message : fallbackMessage;
  return NextResponse.json({ error: message }, { status: 400 });
}
