import { describe, expect, it } from 'vitest';
import { getPublicLeaderboards } from '@/lib/discovery/queries';
import { DISCOVERY_CATEGORIES } from '@/lib/discovery/registry';

describe('Discovery Directory Demo-Mode Parity', () => {
  it('returns public leaderboards in demo mode when Supabase is not configured', async () => {
    const result = await getPublicLeaderboards(1);
    expect(result.totalCount).toBeGreaterThanOrEqual(3);
    expect(result.data.length).toBeGreaterThanOrEqual(3);

    for (const lb of result.data) {
      expect(lb.id).toBeDefined();
      expect(lb.slug).toBeDefined();
      expect(lb.name).toBeDefined();
      expect(lb.rankings_count).toBeGreaterThan(0);
    }
  });

  it('filters by category correctly in demo mode', async () => {
    const gamingCategory = DISCOVERY_CATEGORIES.find((c) => c.slug === 'gaming');
    expect(gamingCategory).toBeDefined();

    const result = await getPublicLeaderboards(1, gamingCategory);
    expect(result.totalCount).toBeGreaterThanOrEqual(1);

    for (const lb of result.data) {
      expect(lb.competition_type).toBe('gaming');
    }
  });

  it('filters by search query case-insensitively in demo mode', async () => {
    const result = await getPublicLeaderboards(1, undefined, 'cyber');
    expect(result.totalCount).toBe(1);
    expect(result.data[0].slug).toBe('cyber-arena');

    const noMatches = await getPublicLeaderboards(1, undefined, 'nonexistentxyz123');
    expect(noMatches.totalCount).toBe(0);
    expect(noMatches.data.length).toBe(0);
  });
});
