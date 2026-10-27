import { describe, it, expect, beforeEach } from 'vitest';
import { mockDb } from '@/lib/db';
import { CompetitionAiService } from '@/lib/ai/service';
import { buildAuthoritativeCompetitionContext } from '@/lib/ai/context';
import { GroundedLocalProvider } from '@/lib/ai/providers/grounded-local';
import { validateProposalPayload } from '@/lib/ai/proposals/schemas';
import { checkAiRateLimits } from '@/lib/ai/limits';
import { Leaderboard, LeaderboardMember, Fixture, FixtureResult } from '@/types';

describe('AI Competition Manager (Era 7 Prompt 1)', () => {
  const testLeaderboard: Leaderboard = {
    id: 'ai-test-lb-1',
    name: 'Premier Gaming League',
    slug: 'premier-gaming-league',
    description: 'Championship esports league season 2026',
    visibility: 'public',
    competition_type: 'gaming',
    owner_id: 'org-admin-1',
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const members: LeaderboardMember[] = [
    {
      id: 'member-1',
      leaderboard_id: testLeaderboard.id,
      name: 'Team Vortex',
      team: 'Vortex Esports',
      email: 'vortex@example.com',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'member-2',
      leaderboard_id: testLeaderboard.id,
      name: 'Team Eclipse',
      team: 'Eclipse Gaming',
      email: 'eclipse@example.com',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const fixtures: Fixture[] = [
    {
      id: 'fix-1',
      leaderboard_id: testLeaderboard.id,
      home_member_id: 'member-1',
      away_member_id: 'member-2',
      round_name: 'Week 1',
      scheduled_at: '2026-11-05T18:00:00Z',
      status: 'completed',
      scheduling_status: 'scheduled',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'fix-2',
      leaderboard_id: testLeaderboard.id,
      home_member_id: 'member-2',
      away_member_id: 'member-1',
      round_name: 'Week 2',
      scheduled_at: '2026-11-12T18:00:00Z',
      status: 'scheduled',
      scheduling_status: 'scheduled',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const results: FixtureResult[] = [
    {
      id: 'res-1',
      fixture_id: 'fix-1',
      home_score: 3,
      away_score: 1,
      submitted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    mockDb.setLeaderboards([testLeaderboard]);
    mockDb.setMembers(members);
    mockDb.set('fixtures', fixtures);
    mockDb.set('fixture_results', results);
    mockDb.set('leaderboard_admins', [
      { leaderboard_id: testLeaderboard.id, user_id: 'org-admin-1', created_at: new Date().toISOString() },
    ]);
    mockDb.setAiProposals([]);
    mockDb.setAiUsageLogs([]);
  });

  describe('Authoritative Grounded Context & Privacy Scrubbing', () => {
    it('builds context using real engine data and scrubs sensitive emails', async () => {
      const context = await buildAuthoritativeCompetitionContext(testLeaderboard.id);

      expect(context.leaderboard.name).toBe('Premier Gaming League');
      expect(context.members_count).toBe(2);

      // Verify PII scrubbing: email is not present in members_sample
      expect(context.members_sample[0].name).toBe('Team Vortex');
      expect((context.members_sample[0] as unknown as Record<string, unknown>).email).toBeUndefined();

      // Verify fixtures breakdown
      expect(context.fixtures_summary?.total).toBe(2);
      expect(context.fixtures_summary?.completed).toBe(1);
      expect(context.fixtures_summary?.outstanding).toBe(1);
      expect(context.fixtures_summary?.recent_results.length).toBe(1);
      expect(context.fixtures_summary?.recent_results[0].home_score).toBe(3);
    });
  });

  describe('Read-Only Natural Language Questions', () => {
    it('explains why a team is ranked in its current position with official metrics', async () => {
      const response = await CompetitionAiService.askAssistant({
        leaderboardId: testLeaderboard.id,
        prompt: 'Why is Team Vortex ranked in its position?',
        actorUserId: 'org-admin-1',
      });

      expect(response.content).toMatch(/Team Vortex/);
      expect(response.content).toMatch(/Official Performance Metrics/i);
      expect(response.content).toMatch(/Rules & Tie-Breaker Logic/i);
      expect(response.dataSources).toContain('standings_snapshot');
    });

    it('summarizes latest match results accurately without inventing scores', async () => {
      const response = await CompetitionAiService.askAssistant({
        leaderboardId: testLeaderboard.id,
        prompt: 'Summarize the latest match results',
        actorUserId: 'org-admin-1',
      });

      expect(response.content).toMatch(/Team Vortex.*3 – 1.*Team Eclipse/);
      expect(response.dataSources).toContain('recent_results');
    });

    it('identifies outstanding fixtures and kickoff details', async () => {
      const response = await CompetitionAiService.askAssistant({
        leaderboardId: testLeaderboard.id,
        prompt: 'What fixtures are outstanding?',
        actorUserId: 'org-admin-1',
      });

      expect(response.content).toMatch(/Outstanding Fixtures/i);
      expect(response.content).toMatch(/Week 2/);
      expect(response.content).toMatch(/Team Eclipse.*vs.*Team Vortex/);
      expect(response.dataSources).toContain('fixtures_table');
    });

    it('provides registration and attendance breakdowns', async () => {
      const response = await CompetitionAiService.askAssistant({
        leaderboardId: testLeaderboard.id,
        prompt: 'Summarize registration and attendance status',
        actorUserId: 'org-admin-1',
      });

      expect(response.content).toMatch(/registration/i);
      expect(response.dataSources).toContain('registration_config');
    });

    it('drafts matchday announcements tailored to real competition metadata', async () => {
      const response = await CompetitionAiService.askAssistant({
        leaderboardId: testLeaderboard.id,
        prompt: 'Draft an announcement for the next matchday',
        actorUserId: 'org-admin-1',
      });

      expect(response.content).toMatch(/Matchday Announcement/i);
      expect(response.content).toMatch(/Premier Gaming League/);
    });
  });

  describe('Structured Proposals & Confirmation Requirements', () => {
    it('generates a structured schedule proposal and does not commit without confirmation', async () => {
      const proposal = await CompetitionAiService.createProposal({
        leaderboardId: testLeaderboard.id,
        taskType: 'schedule_draft',
        actorUserId: 'org-admin-1',
      });

      expect(proposal.id).toBeDefined();
      expect(proposal.status).toBe('pending');
      expect(proposal.task_type).toBe('schedule_draft');
      expect(proposal.payload.start_date).toBeDefined();
      expect(proposal.validation_errors?.length).toBe(0);

      // Verify that the schedule was NOT applied prematurely
      const stored = await CompetitionAiService.getProposal(proposal.id);
      expect(stored?.status).toBe('pending');
      expect(stored?.applied_at).toBeUndefined();
    });

    it('requires explicit confirmation before applying a proposal', async () => {
      const proposal = await CompetitionAiService.createProposal({
        leaderboardId: testLeaderboard.id,
        taskType: 'points_rules_draft',
        actorUserId: 'org-admin-1',
      });

      // Confirm proposal
      const execution = await CompetitionAiService.confirmProposal(proposal.id, 'org-admin-1');
      expect(execution.success).toBe(true);
      expect(execution.message).toMatch(/Updated competition scoring rules/);

      // Verify proposal status updated to approved
      const updated = await CompetitionAiService.getProposal(proposal.id);
      expect(updated?.status).toBe('approved');
      expect(updated?.applied_at).toBeDefined();
    });

    it('allows an organizer to decline/reject a proposal', async () => {
      const proposal = await CompetitionAiService.createProposal({
        leaderboardId: testLeaderboard.id,
        taskType: 'announcement_draft',
        actorUserId: 'org-admin-1',
      });

      const rejected = await CompetitionAiService.rejectProposal(proposal.id, 'org-admin-1');
      expect(rejected.status).toBe('rejected');

      // Attempting to confirm an already rejected proposal must fail
      await expect(
        CompetitionAiService.confirmProposal(proposal.id, 'org-admin-1')
      ).rejects.toThrow(/Cannot apply proposal: current status is "rejected"/);
    });

    it('validates proposal payloads and catches invalid schemas', () => {
      const invalidSchedule = validateProposalPayload('schedule_draft', {
        start_date: 'invalid-date-string',
        match_duration_minutes: -10,
      });

      expect(invalidSchedule.isValid).toBe(false);
      expect(invalidSchedule.errors.length).toBeGreaterThan(0);
      expect(invalidSchedule.errors.some((e) => e.includes('match_duration_minutes'))).toBe(true);

      const invalidAnnouncement = validateProposalPayload('announcement_draft', {
        title: '',
        body: '',
      });
      expect(invalidAnnouncement.isValid).toBe(false);
      expect(invalidAnnouncement.errors.some((e) => e.includes('title'))).toBe(true);
    });
  });

  describe('Authorization & Security Controls', () => {
    it('denies unauthorized users from generating proposals or asking assistant', async () => {
      await expect(
        CompetitionAiService.askAssistant({
          leaderboardId: testLeaderboard.id,
          prompt: 'Draft rules',
          actorUserId: 'unauthorized-stranger',
        })
      ).rejects.toThrow(/Permission denied/i);

      await expect(
        CompetitionAiService.createProposal({
          leaderboardId: testLeaderboard.id,
          taskType: 'venue_setup',
          actorUserId: 'unauthorized-stranger',
        })
      ).rejects.toThrow(/Permission denied/i);
    });

    it('prevents applying proposals to expired records', async () => {
      const proposal = await CompetitionAiService.createProposal({
        leaderboardId: testLeaderboard.id,
        taskType: 'venue_setup',
        actorUserId: 'org-admin-1',
      });

      // Manually set expiration in the past
      proposal.expires_at = new Date(Date.now() - 1000).toISOString();
      mockDb.setAiProposals([proposal]);

      await expect(
        CompetitionAiService.confirmProposal(proposal.id, 'org-admin-1')
      ).rejects.toThrow(/expired/i);
    });
  });

  describe('Rate Limiting & Cost-Aware Controls', () => {
    it('enforces rate limits based on user plan tier', async () => {
      const check = await checkAiRateLimits('org-admin-1', testLeaderboard.id, 'free');
      expect(check.allowed).toBe(true);
      expect(check.remainingDaily).toBeGreaterThan(0);
    });
  });

  describe('Pluggable Provider & Fallback Resiliency', () => {
    it('uses GroundedLocalProvider deterministically when external AI is unconfigured', () => {
      const provider = new GroundedLocalProvider();
      expect(provider.isAvailable()).toBe(true);
      expect(provider.name).toBe('grounded_local');
    });
  });
});
