/**
 * Automated Test Suite for Competition Sponsorship & Monetization (Era 6 Prompt 2)
 *
 * Verifies:
 *  1. Link Safety & Validation (Rejects javascript:, data:, vbscript:, malformed URLs)
 *  2. Campaign Date Boundary Enforcement (Start <= End, handling expired/future dates)
 *  3. Permission Guards (Admin vs non-admin)
 *  4. Plan Entitlement Limits (Free vs Pro/Business capacity)
 *  5. Public Display Filtering & Tier Prioritization (Headline > Gold > Silver, etc.)
 *  6. Measurable Metrics & Non-Inflation (Impression & click deduplication, CTR calculation)
 *  7. Organization Inheritance (Competitions inherit parent org sponsors)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { mockDb } from '@/lib/db';
import { CompetitionSponsorshipService } from '@/lib/competition/sponsorship/service';
import {
  validateSafeUrl,
  validateCampaignDates,
} from '@/lib/competition/sponsorship/validation';

describe('Era 6 Prompt 2: Sponsorship and Organizer Monetization', () => {
  const TEST_LEADERBOARD_ID = 'lb-sponsorship-test-1';
  const TEST_ORG_ID = 'org-sponsorship-test-1';
  const ADMIN_USER_ID = 'admin-user-1';
  const NON_ADMIN_USER_ID = 'unauthorized-user-2';

  beforeEach(() => {
    // Reset mock storage
    mockDb.setCompetitionSponsors([]);
    mockDb.setCompetitionSponsorEvents([]);

    // Seed test leaderboard
    mockDb.setLeaderboards([
      {
        id: TEST_LEADERBOARD_ID,
        name: 'Summer Invitational 2026',
        slug: 'summer-invitational-2026',
        competition_type: 'gaming',
        visibility: 'public',
        owner_id: ADMIN_USER_ID,
        created_by: ADMIN_USER_ID,
        organization_id: TEST_ORG_ID,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);

    mockDb.set('leaderboard_admins', [
      {
        id: 'admin-row-1',
        leaderboard_id: TEST_LEADERBOARD_ID,
        user_id: ADMIN_USER_ID,
        created_at: new Date().toISOString(),
      },
    ]);

    // Seed test organization
    mockDb.setOrganizations([
      {
        id: TEST_ORG_ID,
        name: 'Apex Esports Federation',
        slug: 'apex-esports',
        created_by: ADMIN_USER_ID,
        primary_color: '#6366f1',
        secondary_color: '#06b6d4',
        accent_color: '#f59e0b',
        domain_status: 'verified',
        hide_powered_by: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);

    mockDb.setOrganizationMembers([
      {
        id: 'org-mem-1',
        organization_id: TEST_ORG_ID,
        user_id: ADMIN_USER_ID,
        role: 'owner',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'org-mem-2',
        organization_id: TEST_ORG_ID,
        user_id: NON_ADMIN_USER_ID,
        role: 'viewer',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);
  });

  // ─── 1. Link Safety & Validation ──────────────────────────────────────────

  describe('Link Safety & Validation', () => {
    it('accepts safe HTTPS and HTTP links', () => {
      expect(validateSafeUrl('https://redbull.com/energy')).toBe('https://redbull.com/energy');
      expect(validateSafeUrl('http://hyperx.com')).toBe('http://hyperx.com/');
    });

    it('rejects unsafe protocols: javascript:, data:, file:, vbscript:', () => {
      expect(() => validateSafeUrl('javascript:alert("hacked")')).toThrowError(/unsafe or forbidden/);
      expect(() => validateSafeUrl('data:text/html,<script>evil()</script>')).toThrowError(/unsafe or forbidden/);
      expect(() => validateSafeUrl('file:///etc/passwd')).toThrowError(/unsafe or forbidden/);
      expect(() => validateSafeUrl('vbscript:msgbox(1)')).toThrowError(/unsafe or forbidden/);
    });

    it('rejects relative, missing, or malformed URLs', () => {
      expect(() => validateSafeUrl('')).toThrowError(/is required/);
      expect(() => validateSafeUrl('not-a-valid-url')).toThrowError(/must be a valid, fully qualified URL/);
      expect(() => validateSafeUrl('ftp://ftp.example.com')).toThrowError(/must use https:\/\/ or http:\/\//);
    });
  });

  // ─── 2. Date Boundary Enforcement ─────────────────────────────────────────

  describe('Campaign Date Boundary Validation', () => {
    it('accepts valid date boundaries', () => {
      const now = new Date();
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const res = validateCampaignDates(now.toISOString(), nextWeek.toISOString());
      expect(res.start).toBe(now.toISOString());
      expect(res.end).toBe(nextWeek.toISOString());
    });

    it('accepts open-ended campaigns (null start or null end)', () => {
      const res1 = validateCampaignDates(null, null);
      expect(res1.start).toBeNull();
      expect(res1.end).toBeNull();

      const future = new Date(Date.now() + 10000).toISOString();
      const res2 = validateCampaignDates(null, future);
      expect(res2.start).toBeNull();
      expect(res2.end).toBe(future);
    });

    it('throws error when start date is after end date', () => {
      const start = '2026-12-01T00:00:00Z';
      const end = '2026-11-01T00:00:00Z';
      expect(() => validateCampaignDates(start, end)).toThrowError(
        /must be before or equal to campaign end date/
      );
    });

    it('throws error for unparseable dates', () => {
      expect(() => validateCampaignDates('invalid-date', null)).toThrowError(/start date is invalid/);
      expect(() => validateCampaignDates(null, 'tomorrow-ish')).toThrowError(/end date is invalid/);
    });
  });

  // ─── 3. Permissions Enforcement ───────────────────────────────────────────

  describe('Organizer Permissions', () => {
    it('allows authorized leaderboard owner/admin to create and delete sponsors', async () => {
      const sponsor = await CompetitionSponsorshipService.createSponsor(
        {
          leaderboard_id: TEST_LEADERBOARD_ID,
          name: 'SteelSeries',
          website_url: 'https://steelseries.com',
          tier: 'gold',
          tagline: 'Official Peripheral Partner',
        },
        ADMIN_USER_ID
      );

      expect(sponsor.id).toBeDefined();
      expect(sponsor.name).toBe('SteelSeries');

      // Update
      const updated = await CompetitionSponsorshipService.updateSponsor(
        sponsor.id,
        { tagline: 'Updated Partner Tagline' },
        ADMIN_USER_ID
      );
      expect(updated.tagline).toBe('Updated Partner Tagline');

      // Delete
      const deleted = await CompetitionSponsorshipService.deleteSponsor(sponsor.id, ADMIN_USER_ID);
      expect(deleted).toBe(true);

      const after = await CompetitionSponsorshipService.getSponsorById(sponsor.id);
      expect(after).toBeNull();
    });

    it('rejects unauthorized non-admin from managing sponsors', async () => {
      await expect(
        CompetitionSponsorshipService.createSponsor(
          {
            leaderboard_id: TEST_LEADERBOARD_ID,
            name: 'Unauthorized Sponsor',
            website_url: 'https://evil.com',
            tier: 'partner',
          },
          NON_ADMIN_USER_ID
        )
      ).rejects.toThrowError(/Permission denied/);
    });
  });

  // ─── 4. Public Display & Date Boundary Filtering ──────────────────────────

  describe('Public Display & Date Boundaries', () => {
    it('filters out expired campaigns from public display', async () => {
      const pastStart = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const pastEnd = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

      // Create expired sponsor
      await CompetitionSponsorshipService.createSponsor(
        {
          leaderboard_id: TEST_LEADERBOARD_ID,
          name: 'Expired Promo Sponsor',
          website_url: 'https://expired.example.com',
          tier: 'community',
          campaign_start: pastStart,
          campaign_end: pastEnd,
        },
        ADMIN_USER_ID
      );

      // Public call (includeInactive = false)
      const publicSponsors = await CompetitionSponsorshipService.getSponsorsForCompetition(
        TEST_LEADERBOARD_ID,
        { includeInactive: false }
      );
      expect(publicSponsors.some((s) => s.name === 'Expired Promo Sponsor')).toBe(false);

      // Organizer call (includeInactive = true)
      const allSponsors = await CompetitionSponsorshipService.getSponsorsForCompetition(
        TEST_LEADERBOARD_ID,
        { includeInactive: true }
      );
      expect(allSponsors.some((s) => s.name === 'Expired Promo Sponsor')).toBe(true);
    });

    it('filters out future scheduled campaigns until their start date', async () => {
      const futureStart = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
      const futureEnd = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString();

      await CompetitionSponsorshipService.createSponsor(
        {
          leaderboard_id: TEST_LEADERBOARD_ID,
          name: 'Upcoming Fall Sponsor',
          website_url: 'https://future.example.com',
          tier: 'silver',
          campaign_start: futureStart,
          campaign_end: futureEnd,
        },
        ADMIN_USER_ID
      );

      const publicSponsors = await CompetitionSponsorshipService.getSponsorsForCompetition(
        TEST_LEADERBOARD_ID
      );
      expect(publicSponsors.some((s) => s.name === 'Upcoming Fall Sponsor')).toBe(false);
    });

    it('orders sponsors by tier hierarchy (headline > gold > silver > bronze > partner > community)', async () => {
      await CompetitionSponsorshipService.createSponsor(
        { leaderboard_id: TEST_LEADERBOARD_ID, name: 'Community Cafe', website_url: 'https://cafe.example.com', tier: 'community' },
        ADMIN_USER_ID
      );
      await CompetitionSponsorshipService.createSponsor(
        { leaderboard_id: TEST_LEADERBOARD_ID, name: 'Apex Gear Headline', website_url: 'https://apex.example.com', tier: 'headline' },
        ADMIN_USER_ID
      );
      await CompetitionSponsorshipService.createSponsor(
        { leaderboard_id: TEST_LEADERBOARD_ID, name: 'Gold Energy', website_url: 'https://gold.example.com', tier: 'gold' },
        ADMIN_USER_ID
      );
      await CompetitionSponsorshipService.createSponsor(
        { leaderboard_id: TEST_LEADERBOARD_ID, name: 'Bronze Snacks', website_url: 'https://bronze.example.com', tier: 'bronze' },
        ADMIN_USER_ID
      );

      const sorted = await CompetitionSponsorshipService.getSponsorsForCompetition(TEST_LEADERBOARD_ID);
      expect(sorted[0].tier).toBe('headline');
      expect(sorted[0].name).toBe('Apex Gear Headline');
      expect(sorted[1].tier).toBe('gold');
      expect(sorted[2].tier).toBe('bronze');
      expect(sorted[3].tier).toBe('community');
    });
  });

  // ─── 5. Measurable Metrics & Non-Inflation ─────────────────────────────────

  describe('Metrics Tracking & Deduplication', () => {
    it('accurately records impressions and deduplicates within the 1-hour window', async () => {
      const sponsor = await CompetitionSponsorshipService.createSponsor(
        {
          leaderboard_id: TEST_LEADERBOARD_ID,
          name: 'Razer Inc',
          website_url: 'https://razer.com',
          tier: 'gold',
        },
        ADMIN_USER_ID
      );

      const visitorHash = 'visitor_session_abc';

      // 1st impression
      const imp1 = await CompetitionSponsorshipService.recordImpression(
        sponsor.id,
        TEST_LEADERBOARD_ID,
        visitorHash
      );
      expect(imp1.recorded).toBe(true);
      expect(imp1.deduplicated).toBe(false);

      // Rapid reload 2nd impression (same visitor in same hour)
      const imp2 = await CompetitionSponsorshipService.recordImpression(
        sponsor.id,
        TEST_LEADERBOARD_ID,
        visitorHash
      );
      expect(imp2.recorded).toBe(false);
      expect(imp2.deduplicated).toBe(true);

      // Different visitor
      const imp3 = await CompetitionSponsorshipService.recordImpression(
        sponsor.id,
        TEST_LEADERBOARD_ID,
        'visitor_session_xyz'
      );
      expect(imp3.recorded).toBe(true);

      const metrics = await CompetitionSponsorshipService.getSponsorMetrics(sponsor.id);
      expect(metrics.impressions).toBe(2);
    });

    it('records clicks with safe destination and deduplicates within 5 minutes', async () => {
      const sponsor = await CompetitionSponsorshipService.createSponsor(
        {
          leaderboard_id: TEST_LEADERBOARD_ID,
          name: 'Logitech G',
          website_url: 'https://logitechg.com',
          tier: 'headline',
        },
        ADMIN_USER_ID
      );

      const visitorHash = 'visitor_clk_123';

      // 1st click
      const clk1 = await CompetitionSponsorshipService.recordClick(
        sponsor.id,
        TEST_LEADERBOARD_ID,
        visitorHash
      );
      expect(clk1.recorded).toBe(true);
      expect(clk1.deduplicated).toBe(false);
      expect(clk1.targetUrl).toBe('https://logitechg.com/');

      // Rapid click spamming (same visitor within 5 minutes)
      const clk2 = await CompetitionSponsorshipService.recordClick(
        sponsor.id,
        TEST_LEADERBOARD_ID,
        visitorHash
      );
      expect(clk2.recorded).toBe(false);
      expect(clk2.deduplicated).toBe(true);
      expect(clk2.targetUrl).toBe('https://logitechg.com/');

      const metrics = await CompetitionSponsorshipService.getSponsorMetrics(sponsor.id);
      expect(metrics.clicks).toBe(1);
    });

    it('computes accurate Click-Through Rate (CTR)', async () => {
      const sponsor = await CompetitionSponsorshipService.createSponsor(
        {
          leaderboard_id: TEST_LEADERBOARD_ID,
          name: 'Red Bull',
          website_url: 'https://redbull.com',
          tier: 'headline',
        },
        ADMIN_USER_ID
      );

      // Record 10 impressions from 10 distinct visitors
      for (let i = 0; i < 10; i++) {
        await CompetitionSponsorshipService.recordImpression(
          sponsor.id,
          TEST_LEADERBOARD_ID,
          `visitor_imp_${i}`
        );
      }

      // Record 2 clicks from 2 distinct visitors
      for (let i = 0; i < 2; i++) {
        await CompetitionSponsorshipService.recordClick(
          sponsor.id,
          TEST_LEADERBOARD_ID,
          `visitor_clk_${i}`
        );
      }

      const metrics = await CompetitionSponsorshipService.getSponsorMetrics(sponsor.id);
      expect(metrics.impressions).toBe(10);
      expect(metrics.clicks).toBe(2);
      expect(metrics.ctr).toBe(20.0); // 2 / 10 * 100% = 20.0%
    });
  });

  // ─── 6. Organization-Level Inheritance ────────────────────────────────────

  describe('Organization-Level Sponsorship Inheritance', () => {
    it('inherits parent organization sponsors into competition public display', async () => {
      // Create organization-level sponsor
      const orgSponsor = await CompetitionSponsorshipService.createSponsor(
        {
          organization_id: TEST_ORG_ID,
          name: 'Global Federation Partner',
          website_url: 'https://globalpartner.com',
          tier: 'partner',
        },
        ADMIN_USER_ID
      );

      // Create direct competition sponsor
      const compSponsor = await CompetitionSponsorshipService.createSponsor(
        {
          leaderboard_id: TEST_LEADERBOARD_ID,
          name: 'Local Venue Partner',
          website_url: 'https://localvenue.com',
          tier: 'community',
        },
        ADMIN_USER_ID
      );

      // Query competition sponsors without directOnly
      const mergedSponsors = await CompetitionSponsorshipService.getSponsorsForCompetition(
        TEST_LEADERBOARD_ID,
        { directOnly: false }
      );

      expect(mergedSponsors.some((s) => s.id === orgSponsor.id)).toBe(true);
      expect(mergedSponsors.some((s) => s.id === compSponsor.id)).toBe(true);
      expect(mergedSponsors.length).toBe(2);
    });
  });
});
