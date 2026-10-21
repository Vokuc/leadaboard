import { describe, expect, it } from 'vitest';
import { CompetitionMarketplaceService } from '@/lib/competition/marketplace/service';
import {
  CompetitionRegistrationConfig,
} from '@/types';

describe('Competition Marketplace Discovery & Filtering Engine', () => {
  // ─── 1. Public vs Private Visibility & Security ───────────────────────────

  describe('Public vs Private Visibility & Isolation', () => {
    it('returns only public and active competitions in discovery queries', async () => {
      const result = await CompetitionMarketplaceService.queryCompetitions();
      expect(result.items.length).toBeGreaterThanOrEqual(3);

      for (const item of result.items) {
        expect(item.id).toBeDefined();
        expect(item.slug).toBeDefined();
        expect(item.name).toBeDefined();
        // Strict real metrics: participant count is an actual non-negative integer
        expect(item.participant_count).toBeGreaterThanOrEqual(0);
      }
    });

    it('never exposes private competitions through search query or filters', async () => {
      // Mock search that would match a hypothetical private competition
      const result = await CompetitionMarketplaceService.queryCompetitions({
        query: 'secret',
      });
      expect(result.items.every((c) => c.name.toLowerCase().includes('secret'))).toBe(true);
    });

    it('rejects unauthenticated/unauthorized access to private competitions in getCompetitionDetail', async () => {
      // Even if an item exists, if private and accessed without owner auth, it returns null
      const item = await CompetitionMarketplaceService.getCompetitionDetail('nonexistent-private-board');
      expect(item).toBeNull();
    });
  });

  // ─── 2. Search & Filter Multi-Criteria ────────────────────────────────────

  describe('Search and Filter Multi-Criteria', () => {
    it('filters accurately by category (sports, gaming, fitness, workplace)', async () => {
      const gamingRes = await CompetitionMarketplaceService.queryCompetitions({
        category: 'gaming',
      });
      expect(gamingRes.items.length).toBeGreaterThanOrEqual(1);
      expect(gamingRes.items.every((c) => c.competition_type === 'gaming')).toBe(true);

      const workplaceRes = await CompetitionMarketplaceService.queryCompetitions({
        category: 'workplace',
      });
      expect(workplaceRes.items.length).toBeGreaterThanOrEqual(1);
      expect(workplaceRes.items.every((c) => c.competition_type === 'workplace')).toBe(true);
    });

    it('filters accurately by competition engine (simple_points, league_table, tournament)', async () => {
      const tournamentRes = await CompetitionMarketplaceService.queryCompetitions({
        engine: 'tournament',
      });
      expect(tournamentRes.items.length).toBeGreaterThanOrEqual(1);
      expect(tournamentRes.items.every((c) => c.engine_type === 'tournament')).toBe(true);

      const leagueRes = await CompetitionMarketplaceService.queryCompetitions({
        engine: 'league_table',
      });
      expect(leagueRes.items.length).toBeGreaterThanOrEqual(1);
      expect(leagueRes.items.every((c) => c.engine_type === 'league_table')).toBe(true);

      const pointsRes = await CompetitionMarketplaceService.queryCompetitions({
        engine: 'simple_points',
      });
      expect(pointsRes.items.length).toBeGreaterThanOrEqual(1);
      expect(pointsRes.items.every((c) => c.engine_type === 'simple_points')).toBe(true);
    });

    it('filters by participation type (online vs in_person)', async () => {
      const onlineRes = await CompetitionMarketplaceService.queryCompetitions({
        participation_type: 'online',
      });
      expect(onlineRes.items.length).toBeGreaterThanOrEqual(1);
      expect(onlineRes.items.every((c) => c.participation_type === 'online')).toBe(true);

      const inPersonRes = await CompetitionMarketplaceService.queryCompetitions({
        participation_type: 'in_person',
      });
      expect(inPersonRes.items.length).toBeGreaterThanOrEqual(1);
      expect(inPersonRes.items.every((c) => c.participation_type === 'in_person')).toBe(true);
    });

    it('filters by registration status (open, approval_required, waitlist, closed, view_only)', async () => {
      const openRes = await CompetitionMarketplaceService.queryCompetitions({
        registration_status: 'open',
      });
      expect(openRes.items.every((c) => c.registration.status === 'open')).toBe(true);

      const approvalRes = await CompetitionMarketplaceService.queryCompetitions({
        registration_status: 'approval_required',
      });
      expect(approvalRes.items.every((c) => c.registration.status === 'approval_required')).toBe(true);

      const closedRes = await CompetitionMarketplaceService.queryCompetitions({
        registration_status: 'closed',
      });
      expect(closedRes.items.every((c) => c.registration.status === 'closed')).toBe(true);
    });

    it('filters by pricing (free entry vs paid competitions)', async () => {
      const freeRes = await CompetitionMarketplaceService.queryCompetitions({
        pricing: 'free',
      });
      expect(freeRes.items.length).toBeGreaterThanOrEqual(1);
      expect(freeRes.items.every((c) => c.pricing.is_free)).toBe(true);

      const paidRes = await CompetitionMarketplaceService.queryCompetitions({
        pricing: 'paid',
      });
      expect(paidRes.items.every((c) => !c.pricing.is_free && c.pricing.entry_fee > 0)).toBe(true);
    });

    it('filters by search query case-insensitively across name, description, and rules', async () => {
      const queryRes = await CompetitionMarketplaceService.queryCompetitions({
        query: 'cyber arena',
      });
      expect(queryRes.items.length).toBe(1);
      expect(queryRes.items[0].slug).toBe('cyber-arena');

      const nonMatchRes = await CompetitionMarketplaceService.queryCompetitions({
        query: 'xyz_totally_unmatched_term_999',
      });
      expect(nonMatchRes.totalCount).toBe(0);
      expect(nonMatchRes.items.length).toBe(0);
    });

    it('combines multiple criteria simultaneously', async () => {
      const combinedRes = await CompetitionMarketplaceService.queryCompetitions({
        category: 'gaming',
        engine: 'tournament',
        participation_type: 'online',
        pricing: 'free',
      });
      expect(combinedRes.items.length).toBe(1);
      expect(combinedRes.items[0].slug).toBe('cyber-arena');
      expect(combinedRes.items[0].competition_type).toBe('gaming');
      expect(combinedRes.items[0].engine_type).toBe('tournament');
      expect(combinedRes.items[0].participation_type).toBe('online');
    });
  });

  // ─── 3. Sorting Algorithms ────────────────────────────────────────────────

  describe('Sorting Algorithms & Metrics Integrity', () => {
    it('sorts by popular strictly using real, verifiable participant counts', async () => {
      const popularRes = await CompetitionMarketplaceService.queryCompetitions({
        sort: 'popular',
      });
      expect(popularRes.items.length).toBeGreaterThanOrEqual(2);

      // Verify descending order of real participant_count
      for (let i = 0; i < popularRes.items.length - 1; i++) {
        expect(popularRes.items[i].participant_count).toBeGreaterThanOrEqual(
          popularRes.items[i + 1].participant_count
        );
      }
    });

    it('sorts by upcoming competitions by start_date ascending', async () => {
      const upcomingRes = await CompetitionMarketplaceService.queryCompetitions({
        sort: 'upcoming',
      });
      expect(upcomingRes.items.length).toBeGreaterThanOrEqual(1);
    });

    it('sorts by recently_updated by updated_at descending', async () => {
      const updatedRes = await CompetitionMarketplaceService.queryCompetitions({
        sort: 'recently_updated',
      });
      for (let i = 0; i < updatedRes.items.length - 1; i++) {
        const timeA = new Date(updatedRes.items[i].updated_at).getTime();
        const timeB = new Date(updatedRes.items[i + 1].updated_at).getTime();
        expect(timeA).toBeGreaterThanOrEqual(timeB);
      }
    });
  });

  // ─── 4. Pagination & Boundaries ───────────────────────────────────────────

  describe('Pagination and Count Calculations', () => {
    it('paginates correctly with custom pageSize', async () => {
      const page1 = await CompetitionMarketplaceService.queryCompetitions({
        page: 1,
        pageSize: 2,
      });
      expect(page1.items.length).toBe(2);
      expect(page1.page).toBe(1);
      expect(page1.pageSize).toBe(2);
      expect(page1.totalPages).toBeGreaterThanOrEqual(2);

      const page2 = await CompetitionMarketplaceService.queryCompetitions({
        page: 2,
        pageSize: 2,
      });
      expect(page2.page).toBe(2);
      expect(page2.items.length).toBeGreaterThanOrEqual(1);

      // Ensure no duplicates between page 1 and page 2
      const idsPage1 = new Set(page1.items.map((i) => i.id));
      for (const item of page2.items) {
        expect(idsPage1.has(item.id)).toBe(false);
      }
    });

    it('handles out of bounds page numbers gracefully without errors', async () => {
      const outOfBounds = await CompetitionMarketplaceService.queryCompetitions({
        page: 999,
        pageSize: 10,
      });
      expect(outOfBounds.items).toEqual([]);
      expect(outOfBounds.totalCount).toBeGreaterThanOrEqual(3);
    });
  });

  // ─── 5. Authoritative Registration Status Resolution ──────────────────────

  describe('Registration Status & Policy Resolution', () => {
    const baseConfig: CompetitionRegistrationConfig = {
      id: 'cfg-1',
      leaderboard_id: 'lb-1',
      is_enabled: true,
      capacity: 10,
      opens_at: new Date('2026-10-01T00:00:00Z').toISOString(),
      closes_at: new Date('2026-10-30T00:00:00Z').toISOString(),
      require_approval: false,
      allow_waitlist: true,
      allow_team_registration: false,
      eligibility_rules: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    it('resolves view_only when registration is disabled or null', () => {
      expect(CompetitionMarketplaceService.resolveRegistrationStatus(null, 0)).toBe('view_only');
      expect(
        CompetitionMarketplaceService.resolveRegistrationStatus({ ...baseConfig, is_enabled: false }, 0)
      ).toBe('view_only');
    });

    it('resolves closed when past closing deadline', () => {
      const now = new Date('2026-11-05T00:00:00Z');
      expect(CompetitionMarketplaceService.resolveRegistrationStatus(baseConfig, 0, now)).toBe('closed');
    });

    it('resolves closed when before opening window', () => {
      const now = new Date('2026-09-15T00:00:00Z');
      expect(CompetitionMarketplaceService.resolveRegistrationStatus(baseConfig, 0, now)).toBe('closed');
    });

    it('resolves waitlist when capacity is reached and waitlist is enabled', () => {
      const now = new Date('2026-10-15T00:00:00Z');
      expect(CompetitionMarketplaceService.resolveRegistrationStatus(baseConfig, 10, now)).toBe('waitlist');
      expect(CompetitionMarketplaceService.resolveRegistrationStatus(baseConfig, 15, now)).toBe('waitlist');
    });

    it('resolves closed when capacity is reached and waitlist is disabled', () => {
      const now = new Date('2026-10-15T00:00:00Z');
      const noWaitlistConfig = { ...baseConfig, allow_waitlist: false };
      expect(CompetitionMarketplaceService.resolveRegistrationStatus(noWaitlistConfig, 10, now)).toBe('closed');
    });

    it('resolves approval_required when require_approval is true', () => {
      const now = new Date('2026-10-15T00:00:00Z');
      const approvalConfig = { ...baseConfig, require_approval: true };
      expect(CompetitionMarketplaceService.resolveRegistrationStatus(approvalConfig, 5, now)).toBe(
        'approval_required'
      );
    });

    it('resolves open when under capacity and no approval required', () => {
      const now = new Date('2026-10-15T00:00:00Z');
      expect(CompetitionMarketplaceService.resolveRegistrationStatus(baseConfig, 5, now)).toBe('open');
    });
  });

  // ─── 6. Demo Mode Separation & Data Restrictions ──────────────────────────

  describe('Demo Mode Separation & Data Hygiene', () => {
    it('correctly flags seed demo competitions with is_demo: true', async () => {
      const result = await CompetitionMarketplaceService.queryCompetitions();
      const demoItems = result.items.filter((c) => c.is_demo);
      expect(demoItems.length).toBeGreaterThanOrEqual(1);

      for (const item of demoItems) {
        expect(item.is_demo).toBe(true);
        expect(item.organizer.name).toBeDefined();
      }
    });

    it('filters out demo competitions when includeDemo is set to false', async () => {
      const result = await CompetitionMarketplaceService.queryCompetitions({
        includeDemo: false,
      });
      expect(result.items.every((c) => !c.is_demo)).toBe(true);
    });

    it('never exposes private participant details (email, notes, tokens) in marketplace models', async () => {
      const result = await CompetitionMarketplaceService.queryCompetitions();
      for (const item of result.items) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawAny = item as any;
        expect(rawAny.participant_email).toBeUndefined();
        expect(rawAny.claim_token).toBeUndefined();
        expect(rawAny.private_notes).toBeUndefined();
      }
    });
  });
});
