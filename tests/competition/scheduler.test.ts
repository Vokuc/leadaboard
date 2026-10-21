import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  createIsoTimestamp,
  detectManualScheduleConflict,
  generatePlayableSlots,
  generateRoundRobinPairings,
  isParticipantBlackedOut,
  SchedulerInputMatch,
  scheduleMatches,
  timeStringToMinutes,
  minutesToTimeString,
} from '@/lib/competition/scheduling/engine';
import { CompetitionScheduleConfig, CompetitionVenue, LeaderboardMember } from '@/types';
import { DatabaseService } from '@/lib/db';
import { LeagueService } from '@/lib/league/service';

// Mock in-memory localStorage store for Node test environment
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

describe('Competition Scheduler Engine', () => {
  const dummyMembers: LeaderboardMember[] = [
    { id: 'm1', leaderboard_id: 'lb1', name: 'Alpha FC', email: null, avatar_url: null, team: null, notes: null, is_active: true, created_at: '' },
    { id: 'm2', leaderboard_id: 'lb1', name: 'Beta United', email: null, avatar_url: null, team: null, notes: null, is_active: true, created_at: '' },
    { id: 'm3', leaderboard_id: 'lb1', name: 'Gamma City', email: null, avatar_url: null, team: null, notes: null, is_active: true, created_at: '' },
    { id: 'm4', leaderboard_id: 'lb1', name: 'Delta Rovers', email: null, avatar_url: null, team: null, notes: null, is_active: true, created_at: '' },
    { id: 'm5', leaderboard_id: 'lb1', name: 'Epsilon Athletic', email: null, avatar_url: null, team: null, notes: null, is_active: true, created_at: '' },
    { id: 'm6', leaderboard_id: 'lb1', name: 'Zeta Wanderers', email: null, avatar_url: null, team: null, notes: null, is_active: true, created_at: '' },
  ];

  const defaultConfig: CompetitionScheduleConfig = {
    id: 'cfg-1',
    leaderboard_id: 'lb1',
    start_date: '2026-11-01',
    end_date: '2026-11-15',
    timezone: 'UTC',
    playable_days: [1, 2, 3, 4, 5, 6, 0], // all days
    daily_start_time: '09:00',
    daily_end_time: '18:00',
    match_duration_minutes: 60,
    buffer_minutes: 15,
    rest_interval_minutes: 120,
    participant_availability: [],
    auto_assign_venues: true,
    created_at: '2026-10-21T00:00:00Z',
    updated_at: '2026-10-21T00:00:00Z',
  };

  const defaultVenues: CompetitionVenue[] = [
    {
      id: 'v1',
      leaderboard_id: 'lb1',
      name: 'Main Stadium',
      court_field: 'Pitch 1',
      location: 'Sports Complex',
      capacity: 5000,
      is_active: true,
      created_at: '',
      updated_at: '',
    },
    {
      id: 'v2',
      leaderboard_id: 'lb1',
      name: 'Secondary Arena',
      court_field: 'Pitch 2',
      location: 'Sports Complex',
      capacity: 2000,
      is_active: true,
      created_at: '',
      updated_at: '',
    },
  ];

  describe('Round-Robin Pairings (Berger method)', () => {
    it('generates symmetric round-robin schedule for even participant count (4 teams)', () => {
      const teams = ['m1', 'm2', 'm3', 'm4'];
      const pairings = generateRoundRobinPairings(teams);

      // 4 teams -> 3 rounds, 2 matches per round = 6 matches total
      expect(pairings.length).toBe(6);
      expect(pairings.every((p) => !p.isBye)).toBe(true);

      const rounds = new Set(pairings.map((p) => p.roundIndex));
      expect(rounds.size).toBe(3);

      // Verify each team plays once per round
      for (let r = 1; r <= 3; r += 1) {
        const roundMatches = pairings.filter((p) => p.roundIndex === r);
        expect(roundMatches.length).toBe(2);
        const playedInRound = new Set([
          ...roundMatches.map((m) => m.homeMemberId),
          ...roundMatches.map((m) => m.awayMemberId),
        ]);
        expect(playedInRound.size).toBe(4);
      }

      // Verify each pair meets exactly once
      const matchPairs = new Set(
        pairings.map((p) => [p.homeMemberId, p.awayMemberId].sort().join('-'))
      );
      expect(matchPairs.size).toBe(6);
    });

    it('generates correct rounds with BYEs for odd participant count (5 teams)', () => {
      const teams = ['m1', 'm2', 'm3', 'm4', 'm5'];
      const pairings = generateRoundRobinPairings(teams);

      // 5 teams + 1 dummy = 6 slots -> 5 rounds, 3 pairings per round (2 real matches + 1 BYE)
      expect(pairings.length).toBe(15);

      const byes = pairings.filter((p) => p.isBye);
      expect(byes.length).toBe(5);

      // Every team should have exactly one BYE
      const byeTeams = new Set(byes.map((p) => p.homeMemberId));
      expect(byeTeams.size).toBe(5);
      for (const t of teams) {
        expect(byeTeams.has(t)).toBe(true);
      }

      const activeMatches = pairings.filter((p) => !p.isBye);
      expect(activeMatches.length).toBe(10); // 5 * 4 / 2 = 10 matches
    });

    it('supports double round-robin with reversed home/away fixtures', () => {
      const teams = ['m1', 'm2', 'm3', 'm4'];
      const pairings = generateRoundRobinPairings(teams, { doubleRoundRobin: true });

      // 6 * 2 = 12 matches across 6 rounds
      expect(pairings.length).toBe(12);
      const rounds = new Set(pairings.map((p) => p.roundIndex));
      expect(rounds.size).toBe(6);

      // Check first half (rounds 1-3) vs second half (rounds 4-6)
      const firstLeg = pairings.filter((p) => p.roundIndex <= 3);
      const secondLeg = pairings.filter((p) => p.roundIndex > 3);

      expect(firstLeg.length).toBe(6);
      expect(secondLeg.length).toBe(6);

      for (const m1 of firstLeg) {
        const reversed = secondLeg.find(
          (m2) => m2.homeMemberId === m1.awayMemberId && m2.awayMemberId === m1.homeMemberId
        );
        expect(reversed).toBeDefined();
      }
    });
  });

  describe('Time and Slot Calculations', () => {
    it('converts HH:mm to minutes and back accurately', () => {
      expect(timeStringToMinutes('09:00')).toBe(540);
      expect(timeStringToMinutes('18:30')).toBe(1110);
      expect(minutesToTimeString(540)).toBe('09:00');
      expect(minutesToTimeString(1110)).toBe('18:30');
    });

    it('generates discrete playable slots across days and venues', () => {
      const config: CompetitionScheduleConfig = {
        ...defaultConfig,
        start_date: '2026-11-02', // Monday
        end_date: '2026-11-02',   // 1 day
        daily_start_time: '09:00',
        daily_end_time: '12:00',  // 3 hours
        match_duration_minutes: 60,
        buffer_minutes: 30,       // slots at 09:00-10:00, 10:30-11:30 (next would end at 13:00, exceeds 12:00)
      };

      const slots = generatePlayableSlots(config, defaultVenues);
      // 2 time windows * 2 venues = 4 slots
      expect(slots.length).toBe(4);
      expect(slots[0].venueName).toBe('Main Stadium');
      expect(slots[1].venueName).toBe('Secondary Arena');
    });

    it('respects timezone offset properly', () => {
      const nyIso = createIsoTimestamp('2026-11-01', '10:00', 'America/New_York');
      const utcIso = createIsoTimestamp('2026-11-01', '10:00', 'UTC');

      // America/New_York is behind UTC, so its UTC time will be later
      expect(new Date(nyIso).getTime()).toBeGreaterThan(new Date(utcIso).getTime());
    });
  });

  describe('Limited Venues & Slot Bottlenecks', () => {
    it('queues matches across limited venues and respects buffer turnaround', () => {
      // 1 single venue
      const singleVenue: CompetitionVenue[] = [
        {
          id: 'v1',
          leaderboard_id: 'lb1',
          name: 'Solo Court',
          court_field: 'Court 1',
          is_active: true,
          created_at: '',
          updated_at: '',
        },
      ];

      const config: CompetitionScheduleConfig = {
        ...defaultConfig,
        start_date: '2026-11-01',
        end_date: '2026-11-01',
        daily_start_time: '09:00',
        daily_end_time: '18:00',
        match_duration_minutes: 60,
        buffer_minutes: 15,
        rest_interval_minutes: 60,
      };

      const matches: SchedulerInputMatch[] = [
        { id: 'match-1', entityType: 'fixture', homeMemberId: 'm1', awayMemberId: 'm2', roundName: 'Round 1', roundIndex: 1 },
        { id: 'match-2', entityType: 'fixture', homeMemberId: 'm3', awayMemberId: 'm4', roundName: 'Round 1', roundIndex: 1 },
        { id: 'match-3', entityType: 'fixture', homeMemberId: 'm5', awayMemberId: 'm6', roundName: 'Round 1', roundIndex: 1 },
      ];

      const result = scheduleMatches(matches, config, singleVenue, dummyMembers);
      expect(result.scheduled_items.length).toBe(3);
      expect(result.conflicts.length).toBe(0);

      // Verify no overlaps and buffer respected
      for (let i = 0; i < result.scheduled_items.length - 1; i += 1) {
        const itemA = result.scheduled_items[i];
        const itemB = result.scheduled_items[i + 1];
        const endA = new Date(itemA.scheduled_end_at).getTime();
        const startB = new Date(itemB.scheduled_at).getTime();

        expect(startB).toBeGreaterThanOrEqual(endA + 15 * 60 * 1000);
      }
    });

    it('reports unscheduled fixtures with clear reason if venues/dates are insufficient', () => {
      // Only 1 hour window with 1 venue = can only fit 1 match!
      const constrainedConfig: CompetitionScheduleConfig = {
        ...defaultConfig,
        start_date: '2026-11-01',
        end_date: '2026-11-01',
        daily_start_time: '09:00',
        daily_end_time: '10:00', // only 60 minutes
        match_duration_minutes: 60,
      };

      const singleVenue = [defaultVenues[0]];
      const matches: SchedulerInputMatch[] = [
        { id: 'm-1', entityType: 'fixture', homeMemberId: 'm1', awayMemberId: 'm2', roundName: 'Round 1', roundIndex: 1 },
        { id: 'm-2', entityType: 'fixture', homeMemberId: 'm3', awayMemberId: 'm4', roundName: 'Round 1', roundIndex: 1 },
      ];

      const result = scheduleMatches(matches, constrainedConfig, singleVenue, dummyMembers);
      expect(result.scheduled_items.length).toBe(1);
      expect(result.unscheduled_items.length).toBe(1);
      expect(result.has_conflicts).toBe(true);
      expect(result.unscheduled_items[0].reason).toMatch(/occupied|insufficient|Exceeded/i);
    });
  });

  describe('Participant Availability & Rest Intervals', () => {
    it('avoids scheduling during participant blackout window', () => {
      // m1 is blacked out on the morning of 2026-11-01
      const configWithBlackout: CompetitionScheduleConfig = {
        ...defaultConfig,
        start_date: '2026-11-01',
        end_date: '2026-11-02',
        daily_start_time: '09:00',
        daily_end_time: '18:00',
        participant_availability: [
          {
            member_id: 'm1',
            start_date: '2026-11-01T00:00:00.000Z',
            end_date: '2026-11-01T12:00:00.000Z',
            reason: 'Team travel flight',
          },
        ],
      };

      const blackoutCheck = isParticipantBlackedOut(
        'm1',
        '2026-11-01T09:00:00.000Z',
        '2026-11-01T10:00:00.000Z',
        configWithBlackout.participant_availability
      );
      expect(blackoutCheck.blackedOut).toBe(true);
      expect(blackoutCheck.reason).toBe('Team travel flight');

      const matches: SchedulerInputMatch[] = [
        { id: 'm-1', entityType: 'fixture', homeMemberId: 'm1', awayMemberId: 'm2', roundName: 'Round 1', roundIndex: 1 },
      ];

      const result = scheduleMatches(matches, configWithBlackout, defaultVenues, dummyMembers);
      expect(result.scheduled_items.length).toBe(1);
      const scheduledTime = new Date(result.scheduled_items[0].scheduled_at);
      // Must be scheduled at or after 12:00 on 2026-11-01
      expect(scheduledTime.getUTCHours()).toBeGreaterThanOrEqual(12);
    });

    it('enforces rest interval between consecutive matches for the same participant', () => {
      const config: CompetitionScheduleConfig = {
        ...defaultConfig,
        match_duration_minutes: 60,
        rest_interval_minutes: 180, // 3 hours rest
        buffer_minutes: 0,
      };

      // m1 plays in both matches
      const matches: SchedulerInputMatch[] = [
        { id: 'm-1', entityType: 'fixture', homeMemberId: 'm1', awayMemberId: 'm2', roundName: 'Round 1', roundIndex: 1 },
        { id: 'm-2', entityType: 'fixture', homeMemberId: 'm1', awayMemberId: 'm3', roundName: 'Round 2', roundIndex: 2 },
      ];

      const result = scheduleMatches(matches, config, defaultVenues, dummyMembers);
      expect(result.scheduled_items.length).toBe(2);

      const endMatch1 = new Date(result.scheduled_items[0].scheduled_end_at).getTime();
      const startMatch2 = new Date(result.scheduled_items[1].scheduled_at).getTime();

      expect(startMatch2 - endMatch1).toBeGreaterThanOrEqual(180 * 60 * 1000);
    });

    it('schedules knockout rounds sequentially with turnaround rest interval', () => {
      const matches: SchedulerInputMatch[] = [
        { id: 'semi-1', entityType: 'tournament_match', homeMemberId: 'm1', awayMemberId: 'm2', roundName: 'Semi-Final 1', roundIndex: 1, matchIndex: 1 },
        { id: 'semi-2', entityType: 'tournament_match', homeMemberId: 'm3', awayMemberId: 'm4', roundName: 'Semi-Final 2', roundIndex: 1, matchIndex: 2 },
        { id: 'final', entityType: 'tournament_match', homeMemberId: null, awayMemberId: null, roundName: 'Final', roundIndex: 2, matchIndex: 1 },
      ];

      const result = scheduleMatches(matches, defaultConfig, defaultVenues, dummyMembers);
      expect(result.scheduled_items.length).toBe(3);

      const semi1End = new Date(result.scheduled_items.find((s) => s.entity_id === 'semi-1')!.scheduled_end_at).getTime();
      const semi2End = new Date(result.scheduled_items.find((s) => s.entity_id === 'semi-2')!.scheduled_end_at).getTime();
      const finalStart = new Date(result.scheduled_items.find((s) => s.entity_id === 'final')!.scheduled_at).getTime();

      const maxSemiEnd = Math.max(semi1End, semi2End);
      expect(finalStart).toBeGreaterThanOrEqual(maxSemiEnd + defaultConfig.rest_interval_minutes * 60 * 1000);
    });
  });

  describe('Manual Edits & Conflict Detection', () => {
    it('detects venue conflict when two matches are scheduled concurrently at the same venue', () => {
      const allMatches = [
        {
          id: 'f-1',
          home_member_id: 'm1',
          away_member_id: 'm2',
          scheduled_at: '2026-11-01T10:00:00.000Z',
          scheduled_end_at: '2026-11-01T11:00:00.000Z',
          venue_id: 'v1',
          venue_name: 'Main Stadium',
          scheduling_status: 'scheduled',
        },
        {
          id: 'f-2',
          home_member_id: 'm3',
          away_member_id: 'm4',
          scheduled_at: '2026-11-01T14:00:00.000Z',
          scheduled_end_at: '2026-11-01T15:00:00.000Z',
          venue_id: 'v1',
          venue_name: 'Main Stadium',
          scheduling_status: 'scheduled',
        },
      ];

      // Propose moving f-2 to overlap f-1 on v1
      const conflicts = detectManualScheduleConflict(
        'f-2',
        '2026-11-01T10:30:00.000Z',
        '2026-11-01T11:30:00.000Z',
        'v1',
        'Main Stadium',
        allMatches,
        defaultConfig,
        dummyMembers
      );

      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts.some((c) => c.type === 'venue_overlap')).toBe(true);
    });

    it('detects participant double-booking on manual reschedule', () => {
      const allMatches = [
        {
          id: 'f-1',
          home_member_id: 'm1',
          away_member_id: 'm2',
          scheduled_at: '2026-11-01T10:00:00.000Z',
          scheduled_end_at: '2026-11-01T11:00:00.000Z',
          venue_id: 'v1',
          venue_name: 'Main Stadium',
          scheduling_status: 'scheduled',
        },
        {
          id: 'f-2',
          home_member_id: 'm1', // m1 again
          away_member_id: 'm3',
          scheduled_at: '2026-11-01T14:00:00.000Z',
          scheduled_end_at: '2026-11-01T15:00:00.000Z',
          venue_id: 'v2', // different venue
          venue_name: 'Secondary Arena',
          scheduling_status: 'scheduled',
        },
      ];

      // Move f-2 to exactly 10:00 (different venue, but participant m1 cannot be in two places)
      const conflicts = detectManualScheduleConflict(
        'f-2',
        '2026-11-01T10:00:00.000Z',
        '2026-11-01T11:00:00.000Z',
        'v2',
        'Secondary Arena',
        allMatches,
        defaultConfig,
        dummyMembers
      );

      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts.some((c) => c.type === 'participant_overlap')).toBe(true);
    });
  });

  describe('Non-Destructive Schedule Regeneration', () => {
    it('preserves completed matches during regeneration without altering their slots', () => {
      const matches: SchedulerInputMatch[] = [
        {
          id: 'comp-1',
          entityType: 'fixture',
          homeMemberId: 'm1',
          awayMemberId: 'm2',
          roundName: 'Round 1',
          roundIndex: 1,
          isCompleted: true,
          scheduledAt: '2026-11-01T09:00:00.000Z',
          scheduledEndAt: '2026-11-01T10:00:00.000Z',
          venueId: 'v1',
          venueName: 'Main Stadium',
        },
        {
          id: 'pending-2',
          entityType: 'fixture',
          homeMemberId: 'm3',
          awayMemberId: 'm4',
          roundName: 'Round 1',
          roundIndex: 1,
          isCompleted: false,
        },
      ];

      const result = scheduleMatches(matches, defaultConfig, defaultVenues, dummyMembers);
      expect(result.scheduled_items.length).toBe(2);

      const preserved = result.scheduled_items.find((item) => item.entity_id === 'comp-1');
      expect(preserved).toBeDefined();
      expect(preserved!.scheduled_at).toBe('2026-11-01T09:00:00.000Z');
      expect(preserved!.scheduled_end_at).toBe('2026-11-01T10:00:00.000Z');
      expect(preserved!.venue_id).toBe('v1');
    });
  });

  describe('CompetitionSchedulingService API & Demo Mode Flow', () => {
    const adminId = 'admin-user-id';

    beforeEach(async () => {
      vi.restoreAllMocks();
      localStorage.clear();
      DatabaseService.initialize();

      vi.spyOn(DatabaseService, 'getCurrentProfile').mockImplementation(async () => ({
        id: adminId,
        email: 'organizer@leaderboardos.com',
        full_name: 'Head Organizer',
        role: 'admin',
        avatar_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
    });

    it('manages venues and schedule configuration for a competition', async () => {
      const { CompetitionSchedulingService } = await import('@/lib/competition/scheduling/service');

      // Create a leaderboard owned by admin
      const lb = await DatabaseService.createLeaderboard({
        name: 'Championship League',
        slug: 'champ-league',
        description: 'League with scheduling',
        visibility: 'public',
        competition_type: 'sports',
      });

      // 1. Create venue
      const venue1 = await CompetitionSchedulingService.createVenue({
        leaderboardId: lb.id,
        name: 'Center Court',
        courtField: 'Court A',
        capacity: 1500,
      });

      expect(venue1.id).toBeDefined();
      expect(venue1.name).toBe('Center Court');

      // 2. Get venues
      const venues = await CompetitionSchedulingService.getVenues(lb.id);
      expect(venues.some((v) => v.id === venue1.id)).toBe(true);

      // 3. Update venue
      const updatedVenue = await CompetitionSchedulingService.updateVenue(venue1.id, {
        capacity: 2000,
      });
      expect(updatedVenue.capacity).toBe(2000);

      // 4. Save and get schedule config
      const savedConfig = await CompetitionSchedulingService.saveScheduleConfig({
        leaderboard_id: lb.id,
        start_date: '2026-11-01',
        end_date: '2026-11-10',
        timezone: 'UTC',
        playable_days: [0, 1, 2, 3, 4, 5, 6],
        daily_start_time: '10:00',
        daily_end_time: '18:00',
        match_duration_minutes: 60,
        buffer_minutes: 15,
        rest_interval_minutes: 90,
        participant_availability: [],
        auto_assign_venues: true,
      });

      expect(savedConfig.daily_start_time).toBe('10:00');

      const fetchedConfig = await CompetitionSchedulingService.getScheduleConfig(lb.id);
      expect(fetchedConfig).toBeDefined();
      expect(fetchedConfig?.match_duration_minutes).toBe(60);

      // 5. Delete venue
      await CompetitionSchedulingService.deleteVenue(venue1.id);
      const remainingVenues = await CompetitionSchedulingService.getVenues(lb.id);
      expect(remainingVenues.some((v) => v.id === venue1.id)).toBe(false);
    });

    it('generates, commits, and reschedules league fixtures in demo mode', async () => {
      const { CompetitionSchedulingService } = await import('@/lib/competition/scheduling/service');

      const league = await LeagueService.createLeagueCompetition({
        name: 'Weekend Soccer League',
        description: 'League scheduling test',
        visibility: 'public',
        competitionType: 'sports',
        coverImageUrl: null,
        slug: 'weekend-soccer-league',
        templateKey: 'football-league-table',
        entityType: 'team',
        seasonName: 'Fall 2026',
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        pointsForWin: 3,
        pointsForDraw: 1,
        pointsForLoss: 0,
        selectedStatisticKeys: ['points', 'matches_played'],
        standingsColumnKeys: ['points', 'matches_played'],
        rankingRules: [{ criterion_type: 'points', statistic_key: 'points', label: 'Points', direction: 'desc' }],
      });

      // Add 4 teams
      await DatabaseService.addMember(league.id, { name: 'Arsenal' });
      await DatabaseService.addMember(league.id, { name: 'Chelsea' });
      await DatabaseService.addMember(league.id, { name: 'Liverpool' });
      await DatabaseService.addMember(league.id, { name: 'Man City' });

      // Add 2 venues
      await CompetitionSchedulingService.createVenue({
        leaderboardId: league.id,
        name: 'Stadium 1',
        courtField: 'Pitch A',
      });
      await CompetitionSchedulingService.createVenue({
        leaderboardId: league.id,
        name: 'Stadium 2',
        courtField: 'Pitch B',
      });

      // Save schedule config
      await CompetitionSchedulingService.saveScheduleConfig({
        leaderboard_id: league.id,
        start_date: '2026-11-01',
        end_date: '2026-11-05',
        timezone: 'UTC',
        playable_days: [0, 1, 2, 3, 4, 5, 6],
        daily_start_time: '14:00',
        daily_end_time: '18:00',
        match_duration_minutes: 90,
        buffer_minutes: 15,
        rest_interval_minutes: 120,
        participant_availability: [],
        auto_assign_venues: true,
      });

      // 1. Preview schedule
      const preview = await CompetitionSchedulingService.previewLeagueSchedule(league.id);
      expect(preview.scheduled_items.length).toBe(6); // 4 teams -> 6 matches
      expect(preview.can_commit).toBe(true);
      expect(preview.has_conflicts).toBe(false);

      // 2. Commit schedule
      const committed = await CompetitionSchedulingService.commitLeagueSchedule(league.id, preview);
      expect(committed.length).toBe(6);
      expect(committed.every((f) => f.scheduling_status === 'scheduled')).toBe(true);
      expect(committed.every((f) => f.scheduled_at && f.scheduled_end_at)).toBe(true);

      // 3. Reschedule one fixture with conflict check
      const firstFixture = committed[0];
      const secondFixture = committed[1];

      // Move secondFixture to exactly overlap firstFixture on the same venue
      const conflictReschedule = await CompetitionSchedulingService.rescheduleFixture({
        fixtureId: secondFixture.id,
        scheduledAt: firstFixture.scheduled_at!,
        scheduledEndAt: firstFixture.scheduled_end_at!,
        venueId: firstFixture.venue_id,
        venueName: firstFixture.venue_name,
      });

      expect(conflictReschedule.conflicts.length).toBeGreaterThan(0);
      expect(conflictReschedule.fixture.scheduling_status).toBe('conflict');
      expect(conflictReschedule.fixture.conflict_reason).toBeDefined();

      // 4. Cancel fixture
      const cancelled = await CompetitionSchedulingService.cancelFixture(firstFixture.id);
      expect(cancelled.scheduling_status).toBe('cancelled');
    });
  });
});
