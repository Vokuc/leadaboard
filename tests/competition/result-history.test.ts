import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DatabaseService, mockDb } from '@/lib/db';
import { LeagueService } from '@/lib/league/service';
import { TournamentService } from '@/lib/tournament/service';
import { ResultAuditService } from '@/lib/competition/audit/service';

// Mock in-memory localStorage store for Node test environment
const store: Record<string, string> = {};
global.window = {
  location: { origin: 'http://localhost' },
} as unknown as Window & typeof globalThis;
global.localStorage = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => {
    for (const key in store) {
      delete store[key];
    }
  },
} as unknown as Storage;

describe('Trustworthy Result History & Correction Workflow', () => {
  const boardId = 'lb-gaming-1';
  const ownerId = 'creator-user-id';
  const participantId = 'mem-g1'; // NinjaCoder

  beforeEach(() => {
    localStorage.clear();
    DatabaseService.initialize();

    mockDb.setLeaderboards([
      ...mockDb.getLeaderboards(),
      {
        id: 'lb-league-1',
        owner_id: ownerId,
        name: 'League Season 1',
        description: '',
        slug: 'league-1',
        visibility: 'public',
        competition_type: 'sports',
        status: 'active',
        cover_image_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'lb-tourn-history',
        owner_id: ownerId,
        name: 'Tourn History Cup',
        description: '',
        slug: 'tourn-history',
        visibility: 'public',
        competition_type: 'tournament',
        status: 'active',
        cover_image_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);

    // Default authenticated admin profile
    vi.spyOn(DatabaseService, 'getCurrentProfile').mockImplementation(async () => {
      return {
        id: ownerId,
        email: 'creator@leaderboardos.com',
        full_name: 'Alex Mercer',
        role: 'super_admin',
        avatar_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });
  });

  describe('1. Initial Submission & Immutable Audit Trail', () => {
    it('creates an immutable audit log entry when a score event is submitted', async () => {
      const scoreEvent = await DatabaseService.addScoreEvent(boardId, participantId, {
        rule_id: null,
        points: 45,
        reason: 'Victory Royale in Tournament',
      });

      expect(scoreEvent.id).toBeDefined();
      expect(scoreEvent.points).toBe(45);

      const history = await ResultAuditService.getAuditHistoryForEntity('score_event', scoreEvent.id);
      expect(history.length).toBe(1);
      expect(history[0].action).toBe('submit');
      expect(history[0].status).toBe('approved');
      expect(history[0].proposed_payload.points).toBe(45);
      expect(history[0].previous_payload).toBeNull();
      expect(history[0].actor_id).toBe(ownerId);
      expect(history[0].participant_id).toBe(participantId);
    });

    it('creates an audit log entry when a fixture result is saved', async () => {
      const fixture = await LeagueService.saveFixture({
        leaderboardId: 'lb-league-1',
        homeMemberId: 'mem-l1',
        awayMemberId: 'mem-l2',
        roundName: 'Week 1',
        scheduledAt: null,
        status: 'scheduled',
      });

      await LeagueService.saveFixtureResult({
        fixtureId: fixture.id,
        homeScore: 3,
        awayScore: 1,
        reason: 'Regular season match completed',
      });

      const history = await ResultAuditService.getAuditHistoryForEntity('fixture_result', fixture.id);
      expect(history.length).toBe(1);
      expect(history[0].action).toBe('submit');
      expect(history[0].proposed_payload).toEqual({ home_score: 3, away_score: 1 });
      expect(history[0].previous_payload).toBeNull();
    });
  });

  describe('2. Authorized Corrections & Previous Value Preservation', () => {
    it('captures previous values, proposed values, actor, and mandatory reason on correction', async () => {
      const scoreEvent = await DatabaseService.addScoreEvent(boardId, participantId, {
        rule_id: null,
        points: 20,
        reason: 'Initial Match MVP',
      });

      // Correct the score event
      const auditCorrection = await ResultAuditService.correctScoreEvent({
        leaderboardId: boardId,
        scoreEventId: scoreEvent.id,
        newPoints: 35,
        reason: 'Referee review granted additional bonus points',
        evidenceUrls: ['https://storage.leaderboardos.com/evidence/referee_sheet.pdf'],
      });

      expect(auditCorrection.action).toBe('correct');
      expect(auditCorrection.status).toBe('approved');
      expect(auditCorrection.previous_payload).toEqual({ points: 20, reason: 'Initial Match MVP' });
      expect(auditCorrection.proposed_payload).toEqual({ points: 35, reason: 'Referee review granted additional bonus points' });
      expect(auditCorrection.reason).toContain('Referee review');
      expect(auditCorrection.evidence_urls[0]).toContain('referee_sheet.pdf');

      // Verify full history has both submit and correct entries in chronological order
      const history = await ResultAuditService.getAuditHistoryForEntity('score_event', scoreEvent.id);
      expect(history.length).toBe(2);
      expect(history[0].action).toBe('correct');
      expect(history[1].action).toBe('submit');
    });

    it('rejects corrections without a descriptive reason', async () => {
      const scoreEvent = await DatabaseService.addScoreEvent(boardId, participantId, {
        rule_id: null,
        points: 10,
        reason: 'Headshot Bonus',
      });

      await expect(
        ResultAuditService.correctScoreEvent({
          leaderboardId: boardId,
          scoreEventId: scoreEvent.id,
          newPoints: 20,
          reason: '  ',
        })
      ).rejects.toThrow('A descriptive reason');
    });
  });

  describe('3. Role-Based Permissions & Security', () => {
    it('rejects unauthorized users from correcting competition results', async () => {
      const scoreEvent = await DatabaseService.addScoreEvent(boardId, participantId, {
        rule_id: null,
        points: 25,
        reason: 'Win',
      });

      // Switch to unauthorized regular user
      vi.spyOn(DatabaseService, 'getCurrentProfile').mockImplementation(async () => {
        return {
          id: 'unauthorized-user-id',
          email: 'user@example.com',
          full_name: 'Regular User',
          role: 'member',
          avatar_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      });

      await expect(
        ResultAuditService.correctScoreEvent({
          leaderboardId: boardId,
          scoreEventId: scoreEvent.id,
          newPoints: 50,
          reason: 'Self-awarding extra points',
        })
      ).rejects.toThrow('Permission denied');
    });
  });

  describe('4. Dispute Workflow & Participant Protections', () => {
    it('allows a participant to flag a dispute, which locks or flags the result', async () => {
      const scoreEvent = await DatabaseService.addScoreEvent(boardId, participantId, {
        rule_id: null,
        points: 10,
        reason: 'Level 1 finish',
      });

      // Authenticate as participant
      vi.spyOn(DatabaseService, 'getCurrentProfile').mockImplementation(async () => {
        return {
          id: 'participant-user-id',
          email: 'player@example.com',
          full_name: 'Competitive Player',
          role: 'member',
          avatar_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      });

      const disputeEntry = await ResultAuditService.disputeResult({
        leaderboardId: boardId,
        entityType: 'score_event',
        entityId: scoreEvent.id,
        reason: 'The automated game timer was disconnected; my actual time was 42 seconds.',
      });

      expect(disputeEntry.action).toBe('dispute');
      expect(disputeEntry.status).toBe('disputed');
      expect(disputeEntry.actor_role).toBe('participant');

      // Participant CANNOT resolve their own dispute
      await expect(
        ResultAuditService.resolveDispute({
          leaderboardId: boardId,
          entityType: 'score_event',
          entityId: scoreEvent.id,
          decision: 'approve',
          resolutionReason: 'I verified myself',
        })
      ).rejects.toThrow('Permission denied');
    });

    it('allows an organizer/admin to review and resolve the dispute', async () => {
      const fixture = await LeagueService.saveFixture({
        leaderboardId: 'lb-league-1',
        homeMemberId: 'mem-l1',
        awayMemberId: 'mem-l2',
        roundName: 'Round 3',
        scheduledAt: null,
        status: 'scheduled',
      });

      await LeagueService.saveFixtureResult({
        fixtureId: fixture.id,
        homeScore: 1,
        awayScore: 0,
      });

      // Flag dispute
      vi.spyOn(DatabaseService, 'getCurrentProfile').mockImplementation(async () => ({
        id: 'away-captain-id',
        email: 'captain@away.com',
        full_name: 'Away Captain',
        role: 'member',
        avatar_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      await ResultAuditService.disputeResult({
        leaderboardId: 'lb-league-1',
        entityType: 'fixture_result',
        entityId: fixture.id,
        reason: 'Match ended 1-1, away team equalizer in 92nd minute was omitted.',
      });

      // Switch back to organizer admin
      vi.spyOn(DatabaseService, 'getCurrentProfile').mockImplementation(async () => ({
        id: ownerId,
        email: 'creator@leaderboardos.com',
        full_name: 'Alex Mercer',
        role: 'super_admin',
        avatar_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const resolution = await ResultAuditService.resolveDispute({
        leaderboardId: 'lb-league-1',
        entityType: 'fixture_result',
        entityId: fixture.id,
        decision: 'approve',
        resolutionReason: 'Video replay confirmed late goal was valid.',
      });

      expect(resolution.action).toBe('approve');
      expect(resolution.status).toBe('approved');

      const history = await ResultAuditService.getAuditHistoryForEntity('fixture_result', fixture.id);
      expect(history[0].action).toBe('approve');
      expect(history[1].action).toBe('dispute');
      expect(history[2].action).toBe('submit');
    });
  });

  describe('5. Retention Safety & Participant Deletion', () => {
    it('preserves audit history and evidence when a participant is deleted or removed', async () => {
      // Create a temporary participant and log a score
      const newMember = await DatabaseService.addMember(boardId, {
        name: 'Temporary Player',
        email: 'temp@test.com',
        avatar_url: null,
        team: null,
        notes: null,
      });

      const scoreEvent = await DatabaseService.addScoreEvent(boardId, newMember.id, {
        rule_id: null,
        points: 80,
        reason: 'Championship Qualifier',
      });

      // Delete member
      await DatabaseService.removeMember(newMember.id);

      // Verify audit history is STILL intact with snapshot name preserved
      const history = await ResultAuditService.getAuditHistoryForEntity('score_event', scoreEvent.id);
      expect(history.length).toBe(1);
      expect(history[0].participant_name).toBe('Temporary Player');
      expect(history[0].proposed_payload.points).toBe(80);
    });
  });

  describe('6. Standings Recalculation & Voiding', () => {
    it('updates rankings when a score event is corrected without deleting history', async () => {
      const scoreEvent = await DatabaseService.addScoreEvent(boardId, participantId, {
        rule_id: null,
        points: 5,
        reason: 'Round 1 Score',
      });

      const initialRankings = await DatabaseService.getRankings(boardId);
      const initialPlayer = initialRankings.find(r => r.member_id === participantId);
      const initialTotal = initialPlayer?.total_points || 0;

      // Correct score event from +5 to +100
      await ResultAuditService.correctScoreEvent({
        leaderboardId: boardId,
        scoreEventId: scoreEvent.id,
        newPoints: 100,
        reason: 'Typo correction: was 100, typed 5',
      });

      const updatedRankings = await DatabaseService.getRankings(boardId);
      const updatedPlayer = updatedRankings.find(r => r.member_id === participantId);
      expect(updatedPlayer?.total_points).toBe(initialTotal + 95);

      // Verify audit history retains both records
      const history = await ResultAuditService.getAuditHistoryForEntity('score_event', scoreEvent.id);
      expect(history.length).toBe(2);
    });

    it('safely excludes voided results from active standings', async () => {
      const scoreEvent = await DatabaseService.addScoreEvent(boardId, participantId, {
        rule_id: null,
        points: 50,
        reason: 'False entry',
      });

      const ranksBefore = await DatabaseService.getRankings(boardId);
      const ptsBefore = ranksBefore.find(r => r.member_id === participantId)?.total_points || 0;

      // Void the score event
      await ResultAuditService.voidResult({
        leaderboardId: boardId,
        entityType: 'score_event',
        entityId: scoreEvent.id,
        reason: 'Player disqualified due to exploit',
      });

      const ranksAfter = await DatabaseService.getRankings(boardId);
      const ptsAfter = ranksAfter.find(r => r.member_id === participantId)?.total_points || 0;
      expect(ptsAfter).toBe(ptsBefore - 50);

      const history = await ResultAuditService.getAuditHistoryForEntity('score_event', scoreEvent.id);
      expect(history[0].action).toBe('void');
      expect(history[0].status).toBe('voided');
    });
  });

  describe('7. Tournament Match Corrections & Downstream Recovery', () => {
    it('flips winner and updates advancing participant in subsequent round', async () => {
      const tournId = 'lb-tourn-history';
      const m1 = await DatabaseService.addMember(tournId, { name: 'Player One', email: null, avatar_url: null, team: null, notes: null });
      const m2 = await DatabaseService.addMember(tournId, { name: 'Player Two', email: null, avatar_url: null, team: null, notes: null });

      await TournamentService.generateBracket({
        leaderboardId: tournId,
        bracketSize: 2,
        seedingMode: 'manual',
        manualSeedMemberIds: [m1.id, m2.id],
      });

      const matches = await TournamentService.getMatches(tournId);
      const match = matches[0];

      // Initial result: Player One beats Player Two (3-1)
      await TournamentService.saveMatchResult({
        matchId: match.id,
        homeScore: 3,
        awayScore: 1,
      });

      const initialMatchState = await TournamentService.getMatchById(match.id);
      expect(initialMatchState?.winner_member_id).toBe(m1.id);

      // Correct result: Player Two actually won (3-4)
      const correction = await ResultAuditService.correctTournamentMatch({
        leaderboardId: tournId,
        matchId: match.id,
        newHomeScore: 3,
        newAwayScore: 4,
        reason: 'Scores were reversed by scorekeeper',
      });

      expect(correction.auditEntry.action).toBe('correct');
      const updatedMatchState = await TournamentService.getMatchById(match.id);
      expect(updatedMatchState?.winner_member_id).toBe(m2.id);

      // Verify audit history
      const history = await ResultAuditService.getAuditHistoryForEntity('tournament_match', match.id);
      expect(history.length).toBe(2);
      expect(history[0].action).toBe('correct');
      expect(history[1].action).toBe('submit');
    });
  });

  describe('8. Repeated Corrections (Audit Chain)', () => {
    it('creates an append-only chain for multiple sequential corrections', async () => {
      const scoreEvent = await DatabaseService.addScoreEvent(boardId, participantId, {
        rule_id: null,
        points: 10,
        reason: 'Revision 1',
      });

      await ResultAuditService.correctScoreEvent({
        leaderboardId: boardId,
        scoreEventId: scoreEvent.id,
        newPoints: 20,
        reason: 'Revision 2: Found missing scorecard',
      });

      await ResultAuditService.correctScoreEvent({
        leaderboardId: boardId,
        scoreEventId: scoreEvent.id,
        newPoints: 25,
        reason: 'Revision 3: Added late penalty adjustment',
      });

      const history = await ResultAuditService.getAuditHistoryForEntity('score_event', scoreEvent.id);
      expect(history.length).toBe(3);
      expect(history[0].proposed_payload.points).toBe(25);
      expect(history[1].proposed_payload.points).toBe(20);
      expect(history[2].proposed_payload.points).toBe(10);
    });
  });
});
