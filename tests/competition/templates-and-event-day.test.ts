import { describe, it, expect, beforeEach } from 'vitest';
import { CompetitionTemplateRegistry } from '@/lib/competition/templates/registry';
import { EventDayService } from '@/lib/competition/event-day/service';
import { DatabaseService, mockDb } from '@/lib/db';
import { ResultAuditService } from '@/lib/competition/audit/service';

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

describe('Templates and Event-Day Operations (Era 2 Prompt 3)', () => {
  const LEADERBOARD_ID = 'test-event-day-lb-1';
  const OWNER_ID = 'user-owner-1';
  const REFEREE_ID = 'user-referee-1';
  const VIEWER_ID = 'user-viewer-1';

  beforeEach(() => {
    localStorage.clear();
    DatabaseService.initialize();

    // Seed mock database state
    mockDb.set('leaderboards', [
      {
        id: LEADERBOARD_ID,
        owner_id: OWNER_ID,
        name: 'Premier Summer League',
        slug: 'premier-summer-league',
        visibility: 'public',
        competition_type: 'sports',
        cover_image_url: null,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);

    const configs = [
      {
        id: 'cfg-1',
        leaderboard_id: LEADERBOARD_ID,
        engine_type: 'league_table' as const,
        template_key: 'football' as const,
        entity_type: 'team' as const,
        season_name: 'Summer 2026',
        start_date: new Date().toISOString(),
        end_date: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    mockDb.set('competition_configs', configs);
    localStorage.setItem('leaderboardos_competition_configs', JSON.stringify(configs));

    mockDb.set('leaderboard_admins', [
      {
        leaderboard_id: LEADERBOARD_ID,
        user_id: REFEREE_ID,
        role: 'referee',
        created_at: new Date().toISOString(),
      },
    ]);

    const members = [
      {
        id: 'mem-1',
        leaderboard_id: LEADERBOARD_ID,
        name: 'Arsenal FC',
        email: null,
        avatar_url: null,
        team: null,
        team_id: null,
        notes: null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'mem-2',
        leaderboard_id: LEADERBOARD_ID,
        name: 'Chelsea FC',
        email: null,
        avatar_url: null,
        team: null,
        team_id: null,
        notes: null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    mockDb.setMembers(members);
    mockDb.set('members', members);

    const fixtures = [
      {
        id: 'fix-1',
        leaderboard_id: LEADERBOARD_ID,
        home_member_id: 'mem-1',
        away_member_id: 'mem-2',
        round_name: 'Matchday 1',
        scheduled_at: new Date().toISOString(),
        venue_name: 'Stadium Arena',
        court_field: 'Pitch 1',
        status: 'scheduled',
        scheduling_status: 'scheduled',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    mockDb.set('fixtures', fixtures);
    localStorage.setItem('leaderboardos_fixtures', JSON.stringify(fixtures));

    mockDb.set('fixture_results', []);
    localStorage.setItem('leaderboardos_fixture_results', JSON.stringify([]));
  });

  describe('Part 1: Reusable Versioned Templates', () => {
    it('registers all 7 required competition formats with explicit versions', () => {
      const templates = CompetitionTemplateRegistry.getAllTemplates();
      expect(templates.length).toBeGreaterThanOrEqual(7);

      const expectedKeys = [
        'football_league',
        'knockout_tournament',
        'round_robin_tournament',
        'points_leaderboard',
        'fitness_challenge',
        'quiz_academic',
        'custom_competition',
      ];

      for (const key of expectedKeys) {
        const found = CompetitionTemplateRegistry.getTemplateByKey(key);
        expect(found, `Template ${key} should exist`).toBeDefined();
        expect(found?.version).toBe('1.0.0');
        expect(found?.description.length).toBeGreaterThan(10);
      }
    });

    it('filters templates by engine cleanly', () => {
      const leagues = CompetitionTemplateRegistry.getTemplatesByEngine('league_table');
      const tournaments = CompetitionTemplateRegistry.getTemplatesByEngine('tournament');
      const points = CompetitionTemplateRegistry.getTemplatesByEngine('simple_points');

      expect(leagues.some((t) => t.key === 'football_league')).toBe(true);
      expect(tournaments.some((t) => t.key === 'knockout_tournament')).toBe(true);
      expect(points.some((t) => t.key === 'fitness_challenge')).toBe(true);
      expect(points.some((t) => t.key === 'quiz_academic')).toBe(true);
    });

    it('validates rules and detects illegal configurations', () => {
      // League: win points must be >= draw points
      const invalidLeague = CompetitionTemplateRegistry.validateTemplateApplication('football_league', {
        pointsForWin: 1,
        pointsForDraw: 3,
      });
      expect(invalidLeague.valid).toBe(false);
      expect(invalidLeague.errors[0]).toContain('Points for a win must be greater than');

      // Tournament: invalid bracket size
      const invalidBracket = CompetitionTemplateRegistry.validateTemplateApplication('knockout_tournament', {
        bracketSize: 7,
      });
      expect(invalidBracket.valid).toBe(false);
      expect(invalidBracket.errors[0]).toContain('Invalid tournament bracket size');

      // Points: empty scoring rules
      const invalidPoints = CompetitionTemplateRegistry.validateTemplateApplication('points_leaderboard', {
        scoringRules: [],
      });
      expect(invalidPoints.valid).toBe(false);
      expect(invalidPoints.errors[0]).toContain('must configure at least one scoring rule');
    });

    it('applies a template to produce a new competition configuration without mutating existing ones', () => {
      const applied = CompetitionTemplateRegistry.applyTemplate('football_league', {
        name: 'Champions League 2026',
        pointsForWin: 3,
        pointsForDraw: 1,
        pointsForLoss: 0,
      });

      expect(applied.name).toBe('Champions League 2026');
      expect(applied.engine).toBe('league_table');
      expect(applied.templateVersion).toBe('1.0.0');
      expect(applied.pointsForWin).toBe(3);
      expect(applied.tieBreakers).toContain('goal_difference');
      expect(applied.fixtureSettings.matchDurationMinutes).toBe(90);

      // Verify the template definition itself remains unchanged
      const raw = CompetitionTemplateRegistry.getTemplateByKey('football_league');
      expect(raw?.name).toBe('Football League');
    });
  });

  describe('Part 2: Role-Based Permissions for Event-Day Mode', () => {
    it('grants organizer role to leaderboard owner', async () => {
      const role = await EventDayService.getUserRole(LEADERBOARD_ID, OWNER_ID);
      expect(role).toBe('organizer');
    });

    it('grants referee role to designated referee in leaderboard_admins', async () => {
      const role = await EventDayService.getUserRole(LEADERBOARD_ID, REFEREE_ID);
      expect(role).toBe('referee');
    });

    it('defaults unassigned or anonymous users to viewer role', async () => {
      const viewerRole = await EventDayService.getUserRole(LEADERBOARD_ID, VIEWER_ID);
      expect(viewerRole).toBe('viewer');

      const anonRole = await EventDayService.getUserRole(LEADERBOARD_ID, null);
      expect(anonRole).toBe('viewer');
    });

    it('blocks viewers from starting matches or submitting scores', async () => {
      await expect(
        EventDayService.startMatch(LEADERBOARD_ID, 'fix-1', 'league_table', VIEWER_ID)
      ).rejects.toThrow('Permission denied');

      await expect(
        EventDayService.updateLiveScore(LEADERBOARD_ID, 'fix-1', 'league_table', 2, 1, VIEWER_ID)
      ).rejects.toThrow('Permission denied');

      await expect(
        EventDayService.finalizeMatchResult(LEADERBOARD_ID, 'fix-1', 'league_table', 2, 1, 'Final whistle', VIEWER_ID)
      ).rejects.toThrow('Permission denied');
    });
  });

  describe('Part 3: Event-Day Match Operations and Workflow', () => {
    it('retrieves scheduled and live matches with participant details and next actions', async () => {
      const matches = await EventDayService.getTodayMatches(LEADERBOARD_ID);
      expect(matches.length).toBe(1);

      const match = matches[0];
      expect(match.id).toBe('fix-1');
      expect(match.home_participant.name).toBe('Arsenal FC');
      expect(match.away_participant.name).toBe('Chelsea FC');
      expect(match.status).toBe('scheduled');
      expect(match.venue_name).toBe('Stadium Arena');
      expect(match.next_actions).toContain('start');
    });

    it('allows referee to start match transitioning state to live', async () => {
      await EventDayService.startMatch(LEADERBOARD_ID, 'fix-1', 'league_table', REFEREE_ID);

      const matches = await EventDayService.getTodayMatches(LEADERBOARD_ID);
      const match = matches.find((m) => m.id === 'fix-1');
      expect(match?.status).toBe('live');
      expect(match?.is_live).toBe(true);
      expect(match?.next_actions).toContain('update_score');
      expect(match?.next_actions).toContain('finalize');
    });

    it('allows referee to update live score with non-negative validation', async () => {
      await expect(
        EventDayService.updateLiveScore(LEADERBOARD_ID, 'fix-1', 'league_table', -1, 0, REFEREE_ID)
      ).rejects.toThrow('Match scores cannot be negative');

      await EventDayService.updateLiveScore(LEADERBOARD_ID, 'fix-1', 'league_table', 2, 1, REFEREE_ID);

      const matches = await EventDayService.getTodayMatches(LEADERBOARD_ID);
      const match = matches.find((m) => m.id === 'fix-1');
      expect(match?.home_score).toBe(2);
      expect(match?.away_score).toBe(1);
    });

    it('finalizes consequential match result, updating standings and audit history', async () => {
      await EventDayService.finalizeMatchResult(
        LEADERBOARD_ID,
        'fix-1',
        'league_table',
        3,
        1,
        'Full time whistle by referee',
        REFEREE_ID
      );

      const matches = await EventDayService.getTodayMatches(LEADERBOARD_ID);
      const match = matches.find((m) => m.id === 'fix-1');
      expect(match?.status).toBe('completed');

      // Verify audit entry was recorded
      const auditLog = await ResultAuditService.getAuditHistoryForLeaderboard(LEADERBOARD_ID);
      const entry = auditLog.find((e) => e.entity_id === 'fix-1');
      expect(entry).toBeDefined();
      expect(entry?.actor_role).toBe('referee');
      expect(entry?.proposed_payload).toEqual({ home_score: 3, away_score: 1 });
      expect(entry?.reason).toContain('Full time whistle');
    });
  });

  describe('Part 4: Offline Queue & Resilience', () => {
    it('queues offline actions locally and tracks pending count', () => {
      EventDayService.clearOfflineQueue();
      expect(EventDayService.getOfflineQueue().length).toBe(0);

      const queued = EventDayService.queueOfflineAction({
        matchId: 'fix-1',
        leaderboardId: LEADERBOARD_ID,
        engine: 'league_table',
        actionType: 'score_update',
        homeScore: 1,
        awayScore: 0,
      });

      expect(queued.id).toContain('offline-');
      expect(EventDayService.getOfflineQueue().length).toBe(1);
    });

    it('flushes offline queue successfully when connection is restored', async () => {
      EventDayService.clearOfflineQueue();

      EventDayService.queueOfflineAction({
        matchId: 'fix-1',
        leaderboardId: LEADERBOARD_ID,
        engine: 'league_table',
        actionType: 'start',
      });

      EventDayService.queueOfflineAction({
        matchId: 'fix-1',
        leaderboardId: LEADERBOARD_ID,
        engine: 'league_table',
        actionType: 'score_update',
        homeScore: 2,
        awayScore: 2,
      });

      expect(EventDayService.getOfflineQueue().length).toBe(2);

      const { processed, errors } = await EventDayService.flushOfflineQueue();
      expect(processed).toBe(2);
      expect(errors.length).toBe(0);
      expect(EventDayService.getOfflineQueue().length).toBe(0);

      const matches = await EventDayService.getTodayMatches(LEADERBOARD_ID);
      const match = matches.find((m) => m.id === 'fix-1');
      expect(match?.status).toBe('live');
      expect(match?.home_score).toBe(2);
      expect(match?.away_score).toBe(2);
    });
  });
});
