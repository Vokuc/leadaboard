import { describe, it, expect, beforeEach } from 'vitest';
import {
  detectDuplicateRegistration,
  evaluateCapacityStatus,
  validateEligibility,
  validateRegistrationWindow,
  validateStatusTransition,
} from '@/lib/competition/registration/validation';
import { CompetitionRegistrationService } from '@/lib/competition/registration/service';
import { CompetitionNotificationService } from '@/lib/competition/notifications/service';
import { DatabaseService } from '@/lib/db';
import {
  CompetitionRegistration,
  CompetitionRegistrationConfig,
} from '@/types';

describe('Registration & Competition Notifications', () => {
  const MOCK_LEADERBOARD_ID = 'test-lb-reg-1';

  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  describe('1. Access Control & Registration Windows', () => {
    it('rejects registration when registration is disabled', () => {
      const config: CompetitionRegistrationConfig = {
        id: 'cfg-1',
        leaderboard_id: MOCK_LEADERBOARD_ID,
        is_enabled: false,
        capacity: 10,
        opens_at: null,
        closes_at: null,
        require_approval: true,
        allow_waitlist: true,
        allow_team_registration: false,
        eligibility_rules: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const result = validateRegistrationWindow(config);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('closed');
    });

    it('rejects registration before the opening window date', () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const config: CompetitionRegistrationConfig = {
        id: 'cfg-1',
        leaderboard_id: MOCK_LEADERBOARD_ID,
        is_enabled: true,
        capacity: 10,
        opens_at: futureDate,
        closes_at: null,
        require_approval: true,
        allow_waitlist: true,
        allow_team_registration: false,
        eligibility_rules: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const result = validateRegistrationWindow(config);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('opens on');
    });

    it('rejects registration after the closing window date', () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString();
      const config: CompetitionRegistrationConfig = {
        id: 'cfg-1',
        leaderboard_id: MOCK_LEADERBOARD_ID,
        is_enabled: true,
        capacity: 10,
        opens_at: null,
        closes_at: pastDate,
        require_approval: true,
        allow_waitlist: true,
        allow_team_registration: false,
        eligibility_rules: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const result = validateRegistrationWindow(config);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('closed on');
    });

    it('enforces email domain restrictions in eligibility rules', () => {
      const config: CompetitionRegistrationConfig = {
        id: 'cfg-1',
        leaderboard_id: MOCK_LEADERBOARD_ID,
        is_enabled: true,
        capacity: 10,
        opens_at: null,
        closes_at: null,
        require_approval: true,
        allow_waitlist: true,
        allow_team_registration: false,
        eligibility_rules: {
          allowed_domains: ['university.edu', 'acme.org'],
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const validResult = validateEligibility(config, 'student@university.edu');
      expect(validResult.valid).toBe(true);

      const invalidResult = validateEligibility(config, 'outsider@gmail.com');
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.error).toContain('restricted to domains');
    });
  });

  describe('2. Capacity Limits & Waitlist Auto-Overflow', () => {
    it('allows entry when capacity is not reached', () => {
      const config: CompetitionRegistrationConfig = {
        id: 'cfg-1',
        leaderboard_id: MOCK_LEADERBOARD_ID,
        is_enabled: true,
        capacity: 8,
        opens_at: null,
        closes_at: null,
        require_approval: true,
        allow_waitlist: true,
        allow_team_registration: false,
        eligibility_rules: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const result = evaluateCapacityStatus(config, 5);
      expect(result.isFull).toBe(false);
      expect(result.targetStatus).toBe('pending');
    });

    it('auto-overflows to waitlist when capacity is reached and waitlist is enabled', () => {
      const config: CompetitionRegistrationConfig = {
        id: 'cfg-1',
        leaderboard_id: MOCK_LEADERBOARD_ID,
        is_enabled: true,
        capacity: 4,
        opens_at: null,
        closes_at: null,
        require_approval: true,
        allow_waitlist: true,
        allow_team_registration: false,
        eligibility_rules: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const result = evaluateCapacityStatus(config, 4);
      expect(result.isFull).toBe(true);
      expect(result.targetStatus).toBe('waitlisted');
      expect(result.error).toBeUndefined();
    });

    it('rejects registration when capacity is reached and waitlist is disabled', () => {
      const config: CompetitionRegistrationConfig = {
        id: 'cfg-1',
        leaderboard_id: MOCK_LEADERBOARD_ID,
        is_enabled: true,
        capacity: 4,
        opens_at: null,
        closes_at: null,
        require_approval: true,
        allow_waitlist: false,
        allow_team_registration: false,
        eligibility_rules: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const result = evaluateCapacityStatus(config, 4);
      expect(result.isFull).toBe(true);
      expect(result.targetStatus).toBe('rejected');
      expect(result.error).toContain('capacity has been reached');
    });
  });

  describe('3. Duplicate Prevention & Re-registration', () => {
    const existing: CompetitionRegistration[] = [
      {
        id: 'reg-1',
        leaderboard_id: MOCK_LEADERBOARD_ID,
        user_id: 'user-123',
        member_id: 'mem-1',
        team_id: null,
        participant_name: 'Alex Mercer',
        participant_email: 'alex@example.com',
        status: 'approved',
        claim_token: null,
        claimed_at: null,
        rejection_reason: null,
        notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'reg-2',
        leaderboard_id: MOCK_LEADERBOARD_ID,
        user_id: 'user-456',
        member_id: null,
        team_id: null,
        participant_name: 'Jordan Vance',
        participant_email: 'jordan@example.com',
        status: 'withdrawn',
        claim_token: null,
        claimed_at: null,
        rejection_reason: null,
        notes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    it('detects duplicate email case-insensitively for active registrations', () => {
      const dup = detectDuplicateRegistration(existing, 'ALEX@EXAMPLE.COM', 'user-other');
      expect(dup.isDuplicate).toBe(true);
      expect(dup.error).toContain('already have an active registration');
    });

    it('detects duplicate authenticated user id', () => {
      const dup = detectDuplicateRegistration(existing, 'different@example.com', 'user-123');
      expect(dup.isDuplicate).toBe(true);
    });

    it('allows participant who previously withdrew to re-register cleanly', () => {
      const dup = detectDuplicateRegistration(existing, 'jordan@example.com', 'user-456');
      expect(dup.isDuplicate).toBe(false);
    });
  });

  describe('4. Status Transitions & Validation', () => {
    it('allows valid lifecycle transitions', () => {
      expect(validateStatusTransition('pending', 'approved').valid).toBe(true);
      expect(validateStatusTransition('approved', 'confirmed').valid).toBe(true);
      expect(validateStatusTransition('approved', 'withdrawn').valid).toBe(true);
      expect(validateStatusTransition('waitlisted', 'approved').valid).toBe(true);
      expect(validateStatusTransition('rejected', 'pending').valid).toBe(true);
    });

    it('blocks illegal status transitions', () => {
      const invalid = validateStatusTransition('confirmed', 'pending');
      expect(invalid.valid).toBe(false);
      expect(invalid.error).toContain('Cannot transition registration');
    });
  });

  describe('5. Invite & Claim Workflow (Preventing Duplicate Member Identities)', () => {
    it('creates an invite with a unique claim token and claims it safely', async () => {
      // Setup config
      await CompetitionRegistrationService.saveConfig(MOCK_LEADERBOARD_ID, {
        is_enabled: true,
        capacity: 10,
        require_approval: false,
      });

      const { registration, claimToken } = await CompetitionRegistrationService.createInvite(
        MOCK_LEADERBOARD_ID,
        {
          participantName: 'Morgan Chase',
          participantEmail: 'morgan@example.com',
        }
      );

      expect(claimToken).toBeDefined();
      expect(registration.claim_token).toBe(claimToken);
      expect(registration.status).toBe('pending');

      // User claims token
      const claimed = await CompetitionRegistrationService.claimRegistration(
        claimToken,
        'user-morgan-uuid',
        'morgan@example.com',
        'Morgan Chase'
      );

      expect(claimed.status).toBe('confirmed');
      expect(claimed.claimed_at).toBeDefined();
      expect(claimed.user_id).toBe('user-morgan-uuid');
      expect(claimed.member_id).toBeDefined();

      // Attempting to claim again fails
      await expect(
        CompetitionRegistrationService.claimRegistration(
          claimToken,
          'user-impostor-uuid',
          'impostor@example.com',
          'Impostor'
        )
      ).rejects.toThrow('already been claimed');
    });
  });

  describe('6. Notification Deduplication & User Opt-Outs', () => {
    const TEST_USER = 'user-notify-123';

    it('stores notification delivery status and prevents duplicate sends with idempotency keys', async () => {
      const notif1 = await CompetitionNotificationService.sendNotification({
        leaderboard_id: MOCK_LEADERBOARD_ID,
        user_id: TEST_USER,
        recipient_email: 'competitor@example.com',
        notification_type: 'fixture_scheduled',
        title: 'New Match Scheduled',
        message: 'You have a match against Team Beta at 14:00.',
        action_url: `/leaderboards/test-slug`,
        idempotency_key: 'fixture-match-101-user-123',
      });

      expect(notif1).not.toBeNull();
      expect(notif1?.delivery_status).toBe('delivered');
      expect(notif1?.idempotency_key).toBe('fixture-match-101-user-123');

      // Second send with same idempotency key should return original notification without creating duplicate
      const notif2 = await CompetitionNotificationService.sendNotification({
        leaderboard_id: MOCK_LEADERBOARD_ID,
        user_id: TEST_USER,
        notification_type: 'fixture_scheduled',
        title: 'New Match Scheduled (Duplicate Attempt)',
        message: 'Duplicate send attempt.',
        idempotency_key: 'fixture-match-101-user-123',
      });

      expect(notif2?.id).toBe(notif1?.id);

      const userNotifications = await CompetitionNotificationService.getUserNotifications(TEST_USER);
      expect(userNotifications.length).toBe(1);
    });

    it('marks notifications as read and updates unread count', async () => {
      const notif = await CompetitionNotificationService.sendNotification({
        user_id: 'user-read-test',
        notification_type: 'result_updated',
        title: 'Score Confirmed',
        message: 'Match result 2 - 1 was confirmed.',
      });

      expect(notif).not.toBeNull();
      let unread = await CompetitionNotificationService.getUnreadCount('user-read-test');
      expect(unread).toBe(1);

      await CompetitionNotificationService.markAsRead(notif!.id, 'user-read-test');
      unread = await CompetitionNotificationService.getUnreadCount('user-read-test');
      expect(unread).toBe(0);
    });

    it('respects user opt-outs and suppresses opted-out notifications', async () => {
      const optOutUser = 'user-optout-test';

      // User opts out of match reminders
      await CompetitionNotificationService.updatePreferences(optOutUser, {
        match_reminders: false,
        result_updates: true,
      });

      // Match reminder should be suppressed (returns null)
      const suppressed = await CompetitionNotificationService.sendNotification({
        user_id: optOutUser,
        notification_type: 'match_reminder',
        title: 'Match Reminder',
        message: 'Your match starts in 1 hour.',
      });

      expect(suppressed).toBeNull();

      // Result update should still be delivered
      const allowed = await CompetitionNotificationService.sendNotification({
        user_id: optOutUser,
        notification_type: 'result_updated',
        title: 'Result Posted',
        message: 'Result posted: 3 - 0.',
      });

      expect(allowed).not.toBeNull();
      expect(allowed?.title).toBe('Result Posted');
    });
  });

  describe('7. Legacy Competitions Compatibility', () => {
    it('defaults to registration disabled for competitions without configuration', async () => {
      const legacyId = 'legacy-competition-1999';
      const config = await CompetitionRegistrationService.getConfig(legacyId);

      expect(config.is_enabled).toBe(false);
      expect(config.capacity).toBeNull();
      expect(config.require_approval).toBe(true);
      expect(config.allow_waitlist).toBe(true);
    });

    it('keeps existing manual organizer member creation working', async () => {
      // Existing organizer-managed creation through DatabaseService.addMember
      const member = await DatabaseService.addMember('lb-gaming-1', {
        name: `Manual Player ${Date.now()}`,
        email: 'manual@example.com',
        team: null,
        notes: 'Manually added by organizer',
        avatar_url: null,
      });

      expect(member).toBeDefined();
      expect(member.name).toContain('Manual Player');
      expect(member.is_active).toBe(true);
    });
  });
});
