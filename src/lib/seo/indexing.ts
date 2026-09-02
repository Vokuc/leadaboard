import { Leaderboard } from '@/types';

/**
 * Determines if a leaderboard is eligible to be indexed by search engines.
 * This prevents empty, thin, or spam leaderboards from polluting the search index
 * and wasting crawl budget.
 */
export function canIndexLeaderboard(
  leaderboard: Partial<Leaderboard>,
  rankingsCount: number,
): boolean {
  // 1. Must be explicitly public
  if (leaderboard.visibility !== 'public') {
    return false;
  }

  // 2. Must be active
  if (leaderboard.status && leaderboard.status !== 'active') {
    return false;
  }

  // 3. Must have meaningful content (at least 3 participants/rankings)
  if (rankingsCount < 3) {
    return false;
  }

  return true;
}
