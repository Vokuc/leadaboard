import { isSupabaseConfigured, mockDb, supabase } from '@/lib/db';
import { AiUsageLog } from './types';

export interface RateLimitCheckResult {
  allowed: boolean;
  remainingDaily: number;
  resetAt: string;
  error?: string;
}

// In-memory bucket for minute-based burst protection
const minuteRequests = new Map<string, number[]>();

export async function checkAiRateLimits(
  userId: string,
  leaderboardId: string,
  userPlanTier: 'free' | 'pro' | 'business' | 'enterprise' = 'free'
): Promise<RateLimitCheckResult> {
  const now = Date.now();
  const key = `${userId || 'anon'}_${leaderboardId}`;

  // 1. Burst protection: Max 10 requests per minute
  const minuteTimestamps = (minuteRequests.get(key) || []).filter((t) => now - t < 60000);
  if (minuteTimestamps.length >= 10) {
    return {
      allowed: false,
      remainingDaily: 0,
      resetAt: new Date(minuteTimestamps[0] + 60000).toISOString(),
      error: 'Rate limit exceeded: You can make at most 10 AI queries per minute. Please wait a moment.',
    };
  }
  minuteTimestamps.push(now);
  minuteRequests.set(key, minuteTimestamps);

  // 2. Daily limits by plan tier
  let dailyCap = 25; // Free
  if (userPlanTier === 'pro') dailyCap = 100;
  if (userPlanTier === 'business' || userPlanTier === 'enterprise') dailyCap = 500;

  const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  let usageCount = 0;

  if (isSupabaseConfigured && supabase) {
    const { count, error } = await supabase
      .from('ai_usage_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', oneDayAgo);

    if (!error && typeof count === 'number') {
      usageCount = count;
    }
  } else {
    const logs = mockDb.getAiUsageLogs();
    usageCount = logs.filter(
      (l) => l.user_id === userId && l.created_at >= oneDayAgo
    ).length;
  }

  if (usageCount >= dailyCap) {
    return {
      allowed: false,
      remainingDaily: 0,
      resetAt: new Date(now + 3600000).toISOString(),
      error: `Daily AI query limit reached (${usageCount}/${dailyCap}). Upgrade your plan to increase daily AI Assistant capacity.`,
    };
  }

  return {
    allowed: true,
    remainingDaily: dailyCap - usageCount,
    resetAt: new Date(now + 86400000).toISOString(),
  };
}

export async function logAiUsage(log: Omit<AiUsageLog, 'id' | 'created_at'>): Promise<void> {
  const record: AiUsageLog = {
    id: `ai_log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    ...log,
    created_at: new Date().toISOString(),
  };

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('ai_usage_logs').insert(record);
    } catch (err) {
      console.warn('Failed to insert AI usage log:', err);
    }
  } else {
    const logs = mockDb.getAiUsageLogs();
    logs.push(record);
    mockDb.setAiUsageLogs(logs);
  }
}
