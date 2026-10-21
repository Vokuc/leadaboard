import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseService, mockDb } from '@/lib/db';
import { CompetitionPassportService } from '@/lib/competition/passport/service';
import {
  Leaderboard,
  LeaderboardMember,
  Team,
  CompetitionFixture,
} from '@/types';

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

describe('Participant Profiles and Competition Passport (Era 3 Prompt 1)', () => {
  const USER_ALICE = 'user-alice-1';
  const ALICE_EMAIL = 'alice@example.com';

  const USER_BOB = 'user-bob-2';
  const BOB_EMAIL = 'bob@example.com';

  const ORGANIZER_ID = 'creator-user-id';

  const VERIFIED_LB_ID = 'lb-verified-tournament';
  const UNVERIFIED_LB_ID = 'lb-casual-ladder';

  beforeEach(() => {
    localStorage.clear();
    DatabaseService.initialize();

    mockDb.setProfile({
      id: ORGANIZER_ID,
      email: 'organizer@example.com',
      full_name: 'Tournament Organizer',
      role: 'admin',
      avatar_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // 1. Seed two competitions: one official/verified, one casual/unverified
    const leaderboards: Leaderboard[] = [
      {
        id: VERIFIED_LB_ID,
        owner_id: ORGANIZER_ID,
        name: 'Apex Grand Championship 2026',
        slug: 'apex-grand-championship-2026',
        visibility: 'public',
        competition_type: 'gaming',
        cover_image_url: null,
        status: 'active',
        created_at: '2026-06-01T10:00:00Z',
        updated_at: '2026-06-01T10:00:00Z',
        is_verified: true, // Official verified tournament
      },
      {
        id: UNVERIFIED_LB_ID,
        owner_id: ORGANIZER_ID,
        name: 'Weekend Casual Scrims',
        slug: 'weekend-casual-scrims',
        visibility: 'public',
        competition_type: 'gaming',
        cover_image_url: null,
        status: 'active',
        created_at: '2026-07-01T10:00:00Z',
        updated_at: '2026-07-01T10:00:00Z',
        is_verified: false, // Casual unverified
      },
    ];
    mockDb.set('leaderboards', leaderboards);

    // 2. Seed members
    const members: LeaderboardMember[] = [
      {
        id: 'member-alice-verified',
        leaderboard_id: VERIFIED_LB_ID,
        name: 'Alice_Sniper',
        points: 450,
        rank: 1,
        user_id: USER_ALICE, // already linked
        metadata: { email: ALICE_EMAIL },
        created_at: '2026-06-02T10:00:00Z',
        updated_at: '2026-06-02T10:00:00Z',
      },
      {
        id: 'member-alice-casual',
        leaderboard_id: UNVERIFIED_LB_ID,
        name: 'Alice_Casual',
        points: 120,
        rank: 3,
        user_id: USER_ALICE,
        metadata: { email: ALICE_EMAIL },
        created_at: '2026-07-02T10:00:00Z',
        updated_at: '2026-07-02T10:00:00Z',
      },
      {
        id: 'member-unclaimed-legacy',
        leaderboard_id: VERIFIED_LB_ID,
        name: 'LegacyPlayer_A',
        points: 300,
        rank: 2,
        user_id: undefined, // Unclaimed participant
        metadata: { email: 'legacy_alice@example.com' },
        created_at: '2026-06-02T11:00:00Z',
        updated_at: '2026-06-02T11:00:00Z',
      },
      {
        id: 'member-bob-verified',
        leaderboard_id: VERIFIED_LB_ID,
        name: 'Bob_The_Tank',
        points: 200,
        rank: 4,
        user_id: USER_BOB,
        metadata: { email: BOB_EMAIL },
        created_at: '2026-06-02T12:00:00Z',
        updated_at: '2026-06-02T12:00:00Z',
      },
    ];
    mockDb.set('members', members);

    // 3. Seed fixtures / matches
    const fixtures: CompetitionFixture[] = [
      {
        id: 'fixture-v-1',
        leaderboard_id: VERIFIED_LB_ID,
        stage_id: 'stage-finals',
        participant1_id: 'member-alice-verified',
        participant2_id: 'member-bob-verified',
        participant1_score: 3,
        participant2_score: 1,
        status: 'completed',
        winner_id: 'member-alice-verified',
        scheduled_at: '2026-06-15T18:00:00Z',
        completed_at: '2026-06-15T19:00:00Z',
        created_at: '2026-06-10T10:00:00Z',
        updated_at: '2026-06-15T19:00:00Z',
      },
      {
        id: 'fixture-u-1',
        leaderboard_id: UNVERIFIED_LB_ID,
        participant1_id: 'member-alice-casual',
        participant2_id: 'member-bob-verified',
        participant1_score: 1,
        participant2_score: 2,
        status: 'completed',
        winner_id: 'member-bob-verified',
        scheduled_at: '2026-07-15T18:00:00Z',
        completed_at: '2026-07-15T19:00:00Z',
        created_at: '2026-07-10T10:00:00Z',
        updated_at: '2026-07-15T19:00:00Z',
      },
    ];
    mockDb.set('competition_fixtures', fixtures);

    // 4. Seed teams
    const teams: Team[] = [
      {
        id: 'team-alpha',
        leaderboard_id: VERIFIED_LB_ID,
        name: 'Team Alpha Wolves',
        created_at: '2026-06-01T08:00:00Z',
        updated_at: '2026-06-01T08:00:00Z',
      },
      {
        id: 'team-omega',
        leaderboard_id: VERIFIED_LB_ID,
        name: 'Team Omega Titans',
        created_at: '2026-06-01T08:00:00Z',
        updated_at: '2026-06-01T08:00:00Z',
      },
    ];
    mockDb.set('teams', teams);
  });

  describe('1. Identity Separation & Safe Profile Provisioning', () => {
    it('creates a persistent participant profile with unique handle', async () => {
      const profile = await CompetitionPassportService.getOrCreateProfile(
        USER_ALICE,
        ALICE_EMAIL,
        'Alice Sniper'
      );

      expect(profile).toBeDefined();
      expect(profile.user_id).toBe(USER_ALICE);
      expect(profile.username).toBe('alicesniper');
      expect(profile.display_name).toBe('Alice Sniper');
      expect(profile.privacy_settings.is_public).toBe(true);
      expect(profile.privacy_settings.show_unverified_results).toBe(true);

      // Calling again returns existing profile
      const cached = await CompetitionPassportService.getOrCreateProfile(
        USER_ALICE,
        ALICE_EMAIL,
        'Alice Sniper'
      );
      expect(cached.id).toBe(profile.id);
    });

    it('retrieves profile by handle with or without @ prefix', async () => {
      await CompetitionPassportService.getOrCreateProfile(
        USER_ALICE,
        ALICE_EMAIL,
        'Alice Sniper'
      );

      const p1 = await CompetitionPassportService.getProfileByUsername('@alicesniper');
      expect(p1?.user_id).toBe(USER_ALICE);

      const p2 = await CompetitionPassportService.getProfileByUsername('alicesniper');
      expect(p2?.user_id).toBe(USER_ALICE);
    });

    it('rejects unauthorized profile updates from other users', async () => {
      await CompetitionPassportService.getOrCreateProfile(
        USER_ALICE,
        ALICE_EMAIL,
        'Alice Sniper'
      );

      // Bob tries to update Alice's profile
      await expect(
        CompetitionPassportService.updateProfile(
          USER_ALICE,
          { display_name: 'Hacked by Bob' },
          USER_BOB
        )
      ).rejects.toThrow(/Unauthorized/i);
    });

    it('prevents username collision when competitor changes handle', async () => {
      await CompetitionPassportService.getOrCreateProfile(
        USER_ALICE,
        ALICE_EMAIL,
        'Alice Sniper'
      );
      await CompetitionPassportService.getOrCreateProfile(
        USER_BOB,
        BOB_EMAIL,
        'Bob Tank'
      );

      // Alice tries to rename her username to Bob's handle
      await expect(
        CompetitionPassportService.updateProfile(USER_ALICE, {
          username: 'bobtank',
        })
      ).rejects.toThrow(/already taken/i);
    });
  });

  describe('2. Participant Record Claims & Duplicate Prevention', () => {
    it('allows claiming eligible record via matching verified email', async () => {
      // Create user Charlie with email legacy_alice@example.com
      const CHARLIE_ID = 'user-charlie-3';
      const CHARLIE_EMAIL = 'legacy_alice@example.com';

      await CompetitionPassportService.getOrCreateProfile(CHARLIE_ID, CHARLIE_EMAIL, 'Charlie');

      const claim = await CompetitionPassportService.claimParticipantRecord(
        CHARLIE_ID,
        CHARLIE_EMAIL,
        'member-unclaimed-legacy',
        { verification_method: 'email_match' }
      );

      expect(claim.status).toBe('approved');
      expect(claim.user_id).toBe(CHARLIE_ID);
      expect(claim.member_id).toBe('member-unclaimed-legacy');

      // Verify member record was updated with user_id
      const members = await DatabaseService.getMembers(VERIFIED_LB_ID);
      const claimedMember = members.find((m) => m.id === 'member-unclaimed-legacy');
      expect(claimedMember?.user_id).toBe(CHARLIE_ID);
    });

    it('allows claiming record via valid organizer-issued claim token', async () => {
      // Organizer generates a claim token for unclaimed legacy record
      const token = await CompetitionPassportService.generateMemberClaimToken(
        VERIFIED_LB_ID,
        'member-unclaimed-legacy',
        ORGANIZER_ID
      );

      expect(token).toBeTruthy();

      // Bob claims with valid token even though his email differs
      const claim = await CompetitionPassportService.claimParticipantRecord(
        USER_BOB,
        BOB_EMAIL,
        'member-unclaimed-legacy',
        {
          verification_method: 'token',
          claim_token: token,
        }
      );

      expect(claim.status).toBe('approved');
      expect(claim.user_id).toBe(USER_BOB);

      const members = await DatabaseService.getMembers(VERIFIED_LB_ID);
      const claimedMember = members.find((m) => m.id === 'member-unclaimed-legacy');
      expect(claimedMember?.user_id).toBe(USER_BOB);
    });

    it('rejects claim with invalid token', async () => {
      await expect(
        CompetitionPassportService.claimParticipantRecord(
          USER_BOB,
          BOB_EMAIL,
          'member-unclaimed-legacy',
          {
            verification_method: 'token',
            claim_token: 'invalid-token-12345',
          }
        )
      ).rejects.toThrow(/Invalid claim token/i);
    });

    it('strictly prevents duplicate claims on records already claimed by another user', async () => {
      // Alice already owns 'member-alice-verified'. Bob attempts to claim it.
      await expect(
        CompetitionPassportService.claimParticipantRecord(
          USER_BOB,
          BOB_EMAIL,
          'member-alice-verified',
          { verification_method: 'email_match' }
        )
      ).rejects.toThrow(/already.*claimed.*another user/i);
    });

    it('does not auto-merge identities merely on similar names; requires explicit claim', async () => {
      // Find candidate matches for legacy_alice@example.com
      const candidates = await CompetitionPassportService.findUnclaimedMatchingMembers(
        'legacy_alice@example.com'
      );

      expect(candidates.length).toBe(1);
      expect(candidates[0].id).toBe('member-unclaimed-legacy');

      // The record is NOT automatically linked until explicit claim is submitted
      const members = await DatabaseService.getMembers(VERIFIED_LB_ID);
      const unclaimed = members.find((m) => m.id === 'member-unclaimed-legacy');
      expect(unclaimed?.user_id).toBeUndefined();
    });
  });

  describe('3. Verified vs Unverified Results Distinction', () => {
    it('distinctly categorizes verified and unverified competitions in passport', async () => {
      await CompetitionPassportService.getOrCreateProfile(
        USER_ALICE,
        ALICE_EMAIL,
        'Alice Sniper'
      );

      const passport = await CompetitionPassportService.getPassport('@alicesniper');

      expect(passport).not.toBeNull();
      // Overview stats
      expect(passport?.overview.total_competitions).toBe(2);
      expect(passport?.overview.verified_competitions).toBe(1);
      expect(passport?.overview.unverified_competitions).toBe(1);

      // Verified competition list has verified flag true
      const verifiedEntry = passport?.competitions.find((c) => c.competition_id === VERIFIED_LB_ID);
      expect(verifiedEntry?.is_verified).toBe(true);
      expect(verifiedEntry?.verification_badge).toBe('Official Tournament');

      // Unverified competition list has verified flag false
      const unverifiedEntry = passport?.competitions.find((c) => c.competition_id === UNVERIFIED_LB_ID);
      expect(unverifiedEntry?.is_verified).toBe(false);
      expect(unverifiedEntry?.verification_badge).toBe('Unverified / Community Scrim');

      // Match records also preserve verification flag
      const verifiedMatch = passport?.matches.find((m) => m.fixture_id === 'fixture-v-1');
      expect(verifiedMatch?.is_verified).toBe(true);

      const unverifiedMatch = passport?.matches.find((m) => m.fixture_id === 'fixture-u-1');
      expect(unverifiedMatch?.is_verified).toBe(false);
    });

    it('never misrepresents casual match wins as verified titles', async () => {
      await CompetitionPassportService.getOrCreateProfile(
        USER_ALICE,
        ALICE_EMAIL,
        'Alice Sniper'
      );

      const passport = await CompetitionPassportService.getPassport('alicesniper');

      // Alice won 1 verified match (fixture-v-1) and 0 unverified match wins
      expect(passport?.overview.total_matches).toBe(2);
      expect(passport?.overview.total_wins).toBe(1); // Only won fixture-v-1
      expect(passport?.overview.verified_wins).toBe(1);
      expect(passport?.overview.gold_finishes).toBe(1); // Rank 1 in Apex Grand Championship
    });
  });

  describe('4. Privacy Controls & Selective Display', () => {
    it('hides unverified results from public view when show_unverified_results is false', async () => {
      await CompetitionPassportService.getOrCreateProfile(
        USER_ALICE,
        ALICE_EMAIL,
        'Alice Sniper'
      );

      // Alice turns off unverified results
      await CompetitionPassportService.updateProfile(USER_ALICE, {
        privacy_settings: {
          is_public: true,
          show_email: false,
          show_unverified_results: false,
          show_career_stats: true,
          allow_public_lookup: true,
        },
      });

      // Public viewer inspects Alice's passport
      const passport = await CompetitionPassportService.getPassport('alicesniper', USER_BOB);

      expect(passport?.competitions.length).toBe(1);
      expect(passport?.competitions[0].competition_id).toBe(VERIFIED_LB_ID);
      expect(passport?.matches.length).toBe(1);
      expect(passport?.matches[0].fixture_id).toBe('fixture-v-1');
    });

    it('enforces private profile locking when is_public is false for non-owners', async () => {
      await CompetitionPassportService.getOrCreateProfile(
        USER_ALICE,
        ALICE_EMAIL,
        'Alice Sniper'
      );

      // Alice sets profile to private
      await CompetitionPassportService.updateProfile(USER_ALICE, {
        privacy_settings: {
          is_public: false,
          show_email: false,
          show_unverified_results: true,
          show_career_stats: true,
          allow_public_lookup: false,
        },
      });

      // Bob views Alice's profile -> gets locked passport payload with empty competition history
      const bobView = await CompetitionPassportService.getPassport('alicesniper', USER_BOB);
      expect(bobView?.profile.privacy_settings.is_public).toBe(false);
      expect(bobView?.competitions).toEqual([]);
      expect(bobView?.matches).toEqual([]);
      expect(bobView?.overview.total_competitions).toBe(0);

      // Alice views her own profile -> sees everything
      const aliceView = await CompetitionPassportService.getPassport('alicesniper', USER_ALICE);
      expect(aliceView?.competitions.length).toBe(2);
    });

    it('allows participant to hide specific records from passport', async () => {
      await CompetitionPassportService.getOrCreateProfile(
        USER_ALICE,
        ALICE_EMAIL,
        'Alice Sniper'
      );

      // Alice hides her casual member record
      await CompetitionPassportService.hideEntityFromPassport(USER_ALICE, 'member-alice-casual');

      const passport = await CompetitionPassportService.getPassport('alicesniper');
      const hasCasual = passport?.competitions.some((c) => c.member_id === 'member-alice-casual');
      expect(hasCasual).toBe(false);

      // Unhiding restores it
      await CompetitionPassportService.unhideEntityFromPassport(USER_ALICE, 'member-alice-casual');
      const restoredPassport = await CompetitionPassportService.getPassport('alicesniper');
      const hasCasualRestored = restoredPassport?.competitions.some(
        (c) => c.member_id === 'member-alice-casual'
      );
      expect(hasCasualRestored).toBe(true);
    });
  });

  describe('5. Team Lineage & Historical Participation', () => {
    it('preserves historical team affiliation when participant transfers teams', async () => {
      // 1. Alice joins Team Alpha Wolves on 2026-06-01
      await DatabaseService.addTeamMember(
        'team-alpha',
        'member-alice-verified',
        'player',
        10
      );

      // Check team history
      let history = await DatabaseService.getParticipantTeamHistory('member-alice-verified');
      expect(history.length).toBe(1);
      expect(history[0].team_id).toBe('team-alpha');
      expect(history[0].left_at).toBeFalsy();

      // 2. Alice transfers to Team Omega Titans on 2026-07-01
      await DatabaseService.removeTeamMember(
        'team-alpha',
        'member-alice-verified'
      );

      // History now records departure from Team Alpha
      history = await DatabaseService.getParticipantTeamHistory('member-alice-verified');
      const pastStint = history.find((h) => h.team_id === 'team-alpha');
      expect(pastStint?.left_at).toBeTruthy();

      // Alice joins Team Omega
      await DatabaseService.addTeamMember(
        'team-omega',
        'member-alice-verified',
        'captain',
        7
      );

      history = await DatabaseService.getParticipantTeamHistory('member-alice-verified');
      expect(history.length).toBe(2);

      const activeStint = history.find((h) => h.team_id === 'team-omega');
      expect(activeStint?.left_at).toBeFalsy();

      // 3. Past fixture (fixture-v-1) played during the tournament retains integrity
      const fixtures = await DatabaseService.getFixtures(VERIFIED_LB_ID);
      const match = fixtures.find((f) => f.id === 'fixture-v-1');
      expect(match?.participant1_score).toBe(3);
      expect(match?.winner_id).toBe('member-alice-verified');
    });
  });

  describe('6. Dispute & Correction Requests', () => {
    it('allows participants to file a correction request for wrongly linked results', async () => {
      await CompetitionPassportService.getOrCreateProfile(
        USER_ALICE,
        ALICE_EMAIL,
        'Alice Sniper'
      );

      const correction = await CompetitionPassportService.requestCorrection(USER_ALICE, {
        member_id: 'member-alice-casual',
        competition_id: UNVERIFIED_LB_ID,
        correction_type: 'wrongly_linked',
        reason: 'This score belongs to another local player with the same alias.',
      });

      expect(correction).toBeDefined();
      expect(correction.id).toBeTruthy();
      expect(correction.status).toBe('pending');
      expect(correction.correction_type).toBe('wrongly_linked');
      expect(correction.user_id).toBe(USER_ALICE);

      // Verify correction was stored
      const disputes = await DatabaseService.getParticipantCorrections(USER_ALICE);
      expect(disputes.length).toBe(1);
      expect(disputes[0].correction_type).toBe('wrongly_linked');
    });
  });
});
