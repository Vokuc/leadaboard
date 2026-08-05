import { describe, expect, it } from 'vitest';

// Access checks are DB-backed (RPC + RLS); this smoke test protects key function wiring.
describe('billing access module', () => {
  it('exports async access check functions', async () => {
    const mod = await import('@/lib/billing/access');

    expect(typeof mod.canCreateLeaderboard).toBe('function');
    expect(typeof mod.canCreateTournament).toBe('function');
    expect(typeof mod.canAddParticipant).toBe('function');
    expect(typeof mod.canUseAnalytics).toBe('function');
    expect(typeof mod.canUseBranding).toBe('function');
    expect(typeof mod.canUseAPI).toBe('function');
  });
});
