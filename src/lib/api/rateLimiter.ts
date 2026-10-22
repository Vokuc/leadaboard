export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
}

interface WindowBucket {
  timestamps: number[];
}

const buckets = new Map<string, WindowBucket>();

/**
 * In-memory sliding window rate limiter.
 * Window: 60 seconds.
 */
export function checkRateLimit(keyId: string, limitPerMinute = 60, nowMs = Date.now()): RateLimitResult {
  const windowDurationMs = 60 * 1000;
  const cutoff = nowMs - windowDurationMs;

  let bucket = buckets.get(keyId);
  if (!bucket) {
    bucket = { timestamps: [] };
    buckets.set(keyId, bucket);
  }

  // Filter timestamps within the current sliding window
  bucket.timestamps = bucket.timestamps.filter((ts) => ts > cutoff);

  const resetSeconds = Math.ceil(
    (bucket.timestamps.length > 0 ? bucket.timestamps[0] + windowDurationMs - nowMs : windowDurationMs) / 1000
  );

  if (bucket.timestamps.length >= limitPerMinute) {
    return {
      allowed: false,
      limit: limitPerMinute,
      remaining: 0,
      resetSeconds: Math.max(1, resetSeconds),
    };
  }

  // Record this hit
  bucket.timestamps.push(nowMs);

  return {
    allowed: true,
    limit: limitPerMinute,
    remaining: Math.max(0, limitPerMinute - bucket.timestamps.length),
    resetSeconds: Math.max(1, resetSeconds),
  };
}

/**
 * Format standard rate limit headers.
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.resetSeconds),
  };
}

/**
 * Clear all rate limit buckets (useful for tests).
 */
export function resetRateLimits(): void {
  buckets.clear();
}
