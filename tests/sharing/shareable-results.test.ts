import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildOgImageUrl,
  buildShareUrl,
  buildSocialShareIntents,
  getAuthoritativeShareData,
} from '@/lib/sharing/service';
import { DatabaseService, mockDb } from '@/lib/db';
import { AchievementService } from '@/lib/competition/achievements/service';
import { CompetitionPassportService } from '@/lib/competition/passport/service';
import { Leaderboard, TournamentMatchResult } from '@/types';

// Mock localStorage and window in node test environment
const store: Record<string, string> = {};
global.window = {
  location: { origin: 'http://localhost' },
} as unknown as Window & typeof globalThis;
global.localStorage = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => {
    store[key] = value;
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    for (const key in store) {
      delete store[key];
    }
  },
} as unknown as Storage;

describe('Competition Shareable Results & Growth System (Era 4 Prompt 2)', () => {
  const LB_PUBLIC_SLUG = 'summer-championship-2026';
  const LB_PRIVATE_SLUG = 'secret-internal-tournament';
  const USER_HANDLE = 'ace_striker';
  const USER_ID = 'user-share-001';

  beforeEach(async () => {
    localStorage.clear();

    // Seed a public leaderboard
    const publicLb: Leaderboard = {
      id: 'lb-public-001',
      name: 'Summer Championship 2026',
      slug: LB_PUBLIC_SLUG,
      description: 'Official annual summer tournament.',
      visibility: 'public',
      competition_type: 'gaming',
      owner_id: 'admin-001',
      status: 'active',
      cover_image_url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e',
      created_at: '2026-06-01T10:00:00Z',
      updated_at: '2026-06-01T10:00:00Z',
    };

    // Seed a private leaderboard
    const privateLb: Leaderboard = {
      id: 'lb-private-001',
      name: 'Executive Boardroom League',
      slug: LB_PRIVATE_SLUG,
      description: 'Strictly confidential private event.',
      visibility: 'private',
      competition_type: 'workplace',
      owner_id: 'admin-002',
      status: 'active',
      cover_image_url: null,
      created_at: '2026-06-01T10:00:00Z',
      updated_at: '2026-06-01T10:00:00Z',
    };

    mockDb.setProfile({
      id: 'admin-001',
      email: 'admin@leaderboardos.com',
      full_name: 'Platform Admin',
      role: 'admin',
      avatar_url: null,
      created_at: '2026-06-01T10:00:00Z',
      updated_at: '2026-06-01T10:00:00Z',
    });

    mockDb.setLeaderboards([publicLb, privateLb]);

    // Seed members on public board
    const mem1 = {
      id: 'mem-alpha-001',
      leaderboard_id: publicLb.id,
      name: 'Alpha Team',
      team: 'Alpha',
      avatar_url: 'https://api.dicebear.com/7.x/identicon/svg?seed=Alpha',
      total_points: 100,
      is_active: true,
      created_at: '2026-06-01T10:00:00Z',
      updated_at: '2026-06-01T10:00:00Z',
    };
    const mem2 = {
      id: 'mem-omega-002',
      leaderboard_id: publicLb.id,
      name: 'Omega Squad',
      team: 'Omega',
      avatar_url: 'https://api.dicebear.com/7.x/identicon/svg?seed=Omega',
      total_points: 60,
      is_active: true,
      created_at: '2026-06-01T10:00:00Z',
      updated_at: '2026-06-01T10:00:00Z',
    };
    mockDb.setMembers([mem1, mem2]);

    // Seed competition configs
    mockDb.set('competition_configs', [
      {
        leaderboard_id: publicLb.id,
        template_key: 'esports_tournament',
        engine_type: 'tournament',
        entity_type: 'team',
        participation_type: 'online',
        operational_status: 'completed',
        created_at: '2026-06-01T10:00:00Z',
        updated_at: '2026-06-01T10:00:00Z',
      },
      {
        leaderboard_id: privateLb.id,
        template_key: 'sales_kpi',
        engine_type: 'simple_points',
        entity_type: 'individual',
        participation_type: 'online',
        operational_status: 'in_progress',
        created_at: '2026-06-01T10:00:00Z',
        updated_at: '2026-06-01T10:00:00Z',
      },
    ]);

    // Seed tournament data
    const members = await DatabaseService.getMembers(publicLb.id);
    mockDb.set('tournaments', [
      {
        leaderboard_id: publicLb.id,
        format: 'single_elimination',
        bracket_size: 2,
        seeding_mode: 'manual',
        state: 'completed',
        season_name: 'Summer 2026',
        template_key: 'esports_tournament',
        champion_member_id: members[0].id,
        created_at: '2026-06-01T10:00:00Z',
        updated_at: '2026-06-01T12:00:00Z',
      },
    ]);

    // Seed tournament round & match
    const roundId = 'round-final-001';
    mockDb.set('tournament_rounds', [
      {
        id: roundId,
        leaderboard_id: publicLb.id,
        round_index: 1,
        round_name: 'Grand Finals',
        match_count: 1,
        created_at: '2026-06-01T10:00:00Z',
      },
    ]);

    const matchId = 'match-final-001';
    mockDb.set('tournament_matches', [
      {
        id: matchId,
        leaderboard_id: publicLb.id,
        round_id: roundId,
        round_index: 1,
        match_index: 1,
        home_member_id: members[0].id,
        away_member_id: members[1].id,
        winner_member_id: members[0].id,
        loser_member_id: members[1].id,
        scheduled_at: '2026-06-01T11:00:00Z',
        state: 'completed',
        next_match_id: null,
        next_match_slot: null,
        created_at: '2026-06-01T10:00:00Z',
        updated_at: '2026-06-01T11:30:00Z',
      },
    ]);

    mockDb.set('tournament_match_results', [
      {
        match_id: matchId,
        home_score: 3,
        away_score: 1,
        status: 'approved',
        created_at: '2026-06-01T11:30:00Z',
        updated_at: '2026-06-01T11:30:00Z',
      },
    ]);

    // Seed user passport profile and achievements
    await CompetitionPassportService.getOrCreateProfile(USER_ID, {
      username: USER_HANDLE,
      display_name: 'Ace Striker',
      privacy_settings: {
        is_public: true,
        show_stats: true,
        show_match_history: true,
        show_ratings: true,
        show_passport_badge: true,
      },
    });

    await AchievementService.awardAchievement({
      achievementId: 'first_win',
      userId: USER_ID,
      leaderboardId: publicLb.id,
      provenance: {
        competition_name: 'Summer Championship 2026',
        score_summary: '3 - 1',
        opponent_name: 'Omega Squad',
      },
    });
  });

  describe('1. Public vs Private Visibility Enforcement', () => {
    it('rejects exposing private competitions via share data', async () => {
      const data = await getAuthoritativeShareData({
        type: 'competition',
        slug: LB_PRIVATE_SLUG,
      });

      expect(data).not.toBeNull();
      expect(data?.isPrivate).toBe(true);
      expect(data?.title).toBe('Private Competition');
      expect(data?.actorName).toBe('Private');
      // Must not leak private names or scores
      expect(data?.title).not.toContain('Executive Boardroom');
    });

    it('rejects exposing private member standings', async () => {
      const data = await getAuthoritativeShareData({
        type: 'placement',
        slug: LB_PRIVATE_SLUG,
        memberId: 'some-member',
      });

      expect(data?.isPrivate).toBe(true);
      expect(data?.title).toBe('Private Competition');
    });

    it('resolves public competition data authoritatively', async () => {
      const data = await getAuthoritativeShareData({
        type: 'competition',
        slug: LB_PUBLIC_SLUG,
      });

      expect(data).not.toBeNull();
      expect(data?.isPrivate).toBe(false);
      expect(data?.title).toBe('Summer Championship 2026');
      expect(data?.isVerified).toBe(true);
      expect(data?.totalParticipants).toBe(2);
    });
  });

  describe('2. Canonical URL & Open Graph Link Generation', () => {
    it('builds canonical share URLs for competitions and placements', () => {
      const compUrl = buildShareUrl({
        type: 'competition',
        slug: LB_PUBLIC_SLUG,
      });
      expect(compUrl).toContain(`/leaderboards/${LB_PUBLIC_SLUG}`);
      expect(compUrl).toContain('share=competition');

      const placementUrl = buildShareUrl({
        type: 'placement',
        slug: LB_PUBLIC_SLUG,
        memberId: 'mem-123',
        version: '171000000',
      });
      expect(placementUrl).toContain('share=placement');
      expect(placementUrl).toContain('member=mem-123');
      expect(placementUrl).toContain('v=171000000');
    });

    it('builds canonical share URLs for participant achievements', () => {
      const achUrl = buildShareUrl({
        type: 'achievement',
        handle: USER_HANDLE,
        achievementId: 'award-456',
        version: '171000000',
      });
      expect(achUrl).toContain(`/passport/${USER_HANDLE}`);
      expect(achUrl).toContain('share=achievement');
      expect(achUrl).toContain('id=award-456');
    });

    it('builds dynamic OG image endpoint URLs with correct parameters', () => {
      const ogUrl = buildOgImageUrl({
        type: 'match',
        slug: LB_PUBLIC_SLUG,
        matchId: 'match-final-001',
        version: '171000000',
      });
      expect(ogUrl).toContain('/api/og/share');
      expect(ogUrl).toContain('type=match');
      expect(ogUrl).toContain(`slug=${LB_PUBLIC_SLUG}`);
      expect(ogUrl).toContain('match=match-final-001');
      expect(ogUrl).toContain('v=171000000');
    });
  });

  describe('3. Social Intent Links & Copy Generation', () => {
    it('generates preformatted web intents for WhatsApp, X, LinkedIn, Facebook, and Telegram', async () => {
      const payload = await getAuthoritativeShareData({
        type: 'champion',
        slug: LB_PUBLIC_SLUG,
      });

      expect(payload).not.toBeNull();
      const intents = buildSocialShareIntents(payload!);

      expect(intents.canonicalUrl).toContain(`/leaderboards/${LB_PUBLIC_SLUG}`);
      expect(intents.whatsapp).toContain('https://api.whatsapp.com/send?text=');
      expect(intents.twitter).toContain('https://x.com/intent/tweet?text=');
      expect(intents.linkedin).toContain('https://www.linkedin.com/sharing/share-offsite/?url=');
      expect(intents.facebook).toContain('https://www.facebook.com/sharer/sharer.php?u=');
      expect(intents.telegram).toContain('https://t.me/share/url?url=');

      // Decoded text contains champion details and LeaderboardOS branding
      const decodedWa = decodeURIComponent(intents.whatsapp);
      expect(decodedWa).toContain('Alpha Team');
      expect(decodedWa).toContain('LeaderboardOS');
      expect(decodedWa).toContain(LB_PUBLIC_SLUG);
    });

    it('formats achievement social share copy cleanly', async () => {
      const payload = await getAuthoritativeShareData({
        type: 'achievement',
        handle: USER_HANDLE,
      });

      expect(payload).not.toBeNull();
      const intents = buildSocialShareIntents(payload!);
      const decodedTwitter = decodeURIComponent(intents.twitter);

      expect(decodedTwitter).toContain(`@${USER_HANDLE}`);
      expect(decodedTwitter).toContain('First Blood');
      expect(decodedTwitter).toContain('LeaderboardOS');
    });
  });

  describe('4. Authoritative Results Resolution (Matches & Champions)', () => {
    it('resolves tournament match score and winner from authoritative database', async () => {
      const data = await getAuthoritativeShareData({
        type: 'match',
        slug: LB_PUBLIC_SLUG,
        matchId: 'match-final-001',
      });

      expect(data).not.toBeNull();
      expect(data?.type).toBe('match');
      expect(data?.title).toBe('Alpha Team 3 - 1 Omega Squad');
      expect(data?.detailScore).toBe('Final: 3 - 1');
      expect(data?.actorName).toContain('Alpha Team');
      expect(data?.isVerified).toBe(true);
      expect(data?.verificationBadgeText).toBe('Verified Match Result');
    });

    it('resolves crowned champion for concluded tournament', async () => {
      const data = await getAuthoritativeShareData({
        type: 'champion',
        slug: LB_PUBLIC_SLUG,
      });

      expect(data).not.toBeNull();
      expect(data?.type).toBe('champion');
      expect(data?.actorName).toBe('Alpha Team');
      expect(data?.title).toContain('Alpha Team — Champion');
      expect(data?.verificationBadgeText).toBe('Official Champion');
    });
  });

  describe('5. Stale Data Handling, Corrected Results & Revocation', () => {
    it('updates share version hash when competition is updated to bust CDN caches', async () => {
      const initialData = await getAuthoritativeShareData({
        type: 'competition',
        slug: LB_PUBLIC_SLUG,
      });
      const initialVersion = initialData?.versionHash;

      // Update leaderboard timestamp
      const lbs = mockDb.getLeaderboards();
      lbs[0].updated_at = '2026-06-02T15:00:00Z';
      mockDb.setLeaderboards(lbs);

      const updatedData = await getAuthoritativeShareData({
        type: 'competition',
        slug: LB_PUBLIC_SLUG,
      });
      const updatedVersion = updatedData?.versionHash;

      expect(updatedVersion).not.toBe(initialVersion);
      expect(updatedData?.canonicalUrl).toContain(`v=${updatedVersion}`);
    });

    it('reflects corrected match score authoritatively', async () => {
      // Admin corrects score from 3-1 to 3-2 in overtime
      const results = mockDb.get<TournamentMatchResult[]>('tournament_match_results', []);
      results[0].home_score = 3;
      results[0].away_score = 2;
      results[0].updated_at = '2026-06-01T12:05:00Z';
      mockDb.set('tournament_match_results', results);

      const data = await getAuthoritativeShareData({
        type: 'match',
        slug: LB_PUBLIC_SLUG,
        matchId: 'match-final-001',
      });

      expect(data?.title).toBe('Alpha Team 3 - 2 Omega Squad');
      expect(data?.detailScore).toBe('Final: 3 - 2');
    });

    it('reflects revoked achievements transparently without claiming verified status', async () => {
      // Revoke the achievement
      const awards = await DatabaseService.getParticipantAchievements(USER_ID, true);
      const award = awards[0];
      await AchievementService.revokeAchievement(award.id, 'Rule violation detected on review');

      const data = await getAuthoritativeShareData({
        type: 'achievement',
        handle: USER_HANDLE,
        achievementId: award.id,
      });

      expect(data).not.toBeNull();
      expect(data?.isRevoked).toBe(true);
      expect(data?.isVerified).toBe(false);
      expect(data?.verificationBadgeText).toBe('Award Revoked');
      expect(data?.revocationReason).toBe('Rule violation detected on review');
    });
  });
});
