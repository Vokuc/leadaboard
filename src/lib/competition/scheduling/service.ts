'use client';

import { DatabaseService, isSupabaseConfigured, supabase } from '@/lib/db';
import { LeagueService } from '@/lib/league/service';
import { TournamentService } from '@/lib/tournament/service';
import {
  CompetitionScheduleConfig,
  CompetitionVenue,
  Fixture,
  ScheduleConflictExplanation,
  SchedulePreviewResult,
  TournamentMatch,
} from '@/types';
import {
  detectManualScheduleConflict,
  generateRoundRobinPairings,
  SchedulerInputMatch,
  scheduleMatches,
} from './engine';

const VENUES_STORAGE_KEY = 'competition_venues';
const CONFIGS_STORAGE_KEY = 'competition_schedule_configs';

const inMemoryStore = new Map<string, string>();

function localGet<T>(key: string, defaults: T): T {
  let value: string | null = null;
  if (typeof window !== 'undefined' && window.localStorage) {
    value = window.localStorage.getItem(`leaderboardos_${key}`);
  } else if (typeof localStorage !== 'undefined') {
    value = localStorage.getItem(`leaderboardos_${key}`);
  } else {
    value = inMemoryStore.get(`leaderboardos_${key}`) || null;
  }

  if (!value) {
    localSet(key, defaults);
    return defaults;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return defaults;
  }
}

function localSet<T>(key: string, value: T): void {
  const serialized = JSON.stringify(value);
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(`leaderboardos_${key}`, serialized);
  } else if (typeof localStorage !== 'undefined') {
    localStorage.setItem(`leaderboardos_${key}`, serialized);
  } else {
    inMemoryStore.set(`leaderboardos_${key}`, serialized);
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const CompetitionSchedulingService = {
  // =========================================================================
  // Venues CRUD
  // =========================================================================
  async getVenues(leaderboardId: string): Promise<CompetitionVenue[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('competition_venues')
        .select('*')
        .eq('leaderboard_id', leaderboardId)
        .order('name', { ascending: true });

      if (error) {
        throw error;
      }
      return data || [];
    }

    const venues = localGet<CompetitionVenue[]>(VENUES_STORAGE_KEY, []);
    return venues.filter((v) => v.leaderboard_id === leaderboardId);
  },

  async createVenue(input: {
    leaderboardId: string;
    name: string;
    courtField?: string | null;
    location?: string | null;
    capacity?: number | null;
  }): Promise<CompetitionVenue> {
    await DatabaseService.requireAdminPermission(input.leaderboardId);
    const timestamp = nowIso();
    const venue: CompetitionVenue = {
      id: makeUuid(),
      leaderboard_id: input.leaderboardId,
      name: input.name.trim(),
      court_field: input.courtField ? input.courtField.trim() : null,
      location: input.location ? input.location.trim() : null,
      capacity: input.capacity ?? null,
      is_active: true,
      created_at: timestamp,
      updated_at: timestamp,
    };

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('competition_venues')
        .insert(venue)
        .select()
        .single();

      if (error) {
        throw error;
      }
      return data;
    }

    const venues = localGet<CompetitionVenue[]>(VENUES_STORAGE_KEY, []);
    venues.push(venue);
    localSet(VENUES_STORAGE_KEY, venues);
    return venue;
  },

  async updateVenue(id: string, updates: Partial<CompetitionVenue>): Promise<CompetitionVenue> {
    const timestamp = nowIso();

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('competition_venues')
        .update({
          ...updates,
          updated_at: timestamp,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw error;
      }
      return data;
    }

    const venues = localGet<CompetitionVenue[]>(VENUES_STORAGE_KEY, []);
    const index = venues.findIndex((v) => v.id === id);
    if (index === -1) {
      throw new Error('Venue not found');
    }
    const updated = { ...venues[index], ...updates, updated_at: timestamp };
    venues[index] = updated;
    localSet(VENUES_STORAGE_KEY, venues);
    return updated;
  },

  async deleteVenue(id: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('competition_venues').delete().eq('id', id);
      if (error) {
        throw error;
      }
      return;
    }

    const venues = localGet<CompetitionVenue[]>(VENUES_STORAGE_KEY, []);
    localSet(
      VENUES_STORAGE_KEY,
      venues.filter((v) => v.id !== id)
    );
  },

  // =========================================================================
  // Schedule Configuration
  // =========================================================================
  async getScheduleConfig(leaderboardId: string): Promise<CompetitionScheduleConfig | null> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('competition_schedule_configs')
        .select('*')
        .eq('leaderboard_id', leaderboardId)
        .maybeSingle();

      if (error) {
        throw error;
      }
      return data;
    }

    const configs = localGet<CompetitionScheduleConfig[]>(CONFIGS_STORAGE_KEY, []);
    return configs.find((c) => c.leaderboard_id === leaderboardId) || null;
  },

  async saveScheduleConfig(
    input: Omit<CompetitionScheduleConfig, 'id' | 'created_at' | 'updated_at'>
  ): Promise<CompetitionScheduleConfig> {
    await DatabaseService.requireAdminPermission(input.leaderboard_id);
    const timestamp = nowIso();

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('competition_schedule_configs')
        .upsert(
          {
            ...input,
            updated_at: timestamp,
          },
          { onConflict: 'leaderboard_id' }
        )
        .select()
        .single();

      if (error) {
        throw error;
      }
      return data;
    }

    const configs = localGet<CompetitionScheduleConfig[]>(CONFIGS_STORAGE_KEY, []);
    const existingIndex = configs.findIndex((c) => c.leaderboard_id === input.leaderboard_id);

    if (existingIndex >= 0) {
      const updated: CompetitionScheduleConfig = {
        ...configs[existingIndex],
        ...input,
        updated_at: timestamp,
      };
      configs[existingIndex] = updated;
      localSet(CONFIGS_STORAGE_KEY, configs);
      return updated;
    }

    const created: CompetitionScheduleConfig = {
      id: makeUuid(),
      ...input,
      created_at: timestamp,
      updated_at: timestamp,
    };
    configs.push(created);
    localSet(CONFIGS_STORAGE_KEY, configs);
    return created;
  },

  // =========================================================================
  // League Scheduling: Preview & Commit
  // =========================================================================
  async previewLeagueSchedule(
    leaderboardId: string,
    options?: { doubleRoundRobin?: boolean }
  ): Promise<SchedulePreviewResult> {
    const [config, venues, members, existingFixtures, fixtureResults] = await Promise.all([
      this.getScheduleConfig(leaderboardId),
      this.getVenues(leaderboardId),
      DatabaseService.getMembers(leaderboardId),
      LeagueService.getFixtures(leaderboardId),
      LeagueService.getFixtureResults(leaderboardId),
    ]);

    if (!config) {
      throw new Error('Please configure and save schedule settings before generating a schedule preview.');
    }

    const completedFixtureIds = new Set(
      fixtureResults.map((r) => r.fixture_id).concat(
        existingFixtures.filter((f) => f.status === 'completed').map((f) => f.id)
      )
    );

    let matchInputs: SchedulerInputMatch[] = [];

    // If existing fixtures already exist, schedule uncompleted ones and preserve completed ones
    if (existingFixtures.length > 0) {
      matchInputs = existingFixtures.map((f, idx) => {
        const isCompleted = completedFixtureIds.has(f.id);
        const roundNumberMatch = f.round_name?.match(/\d+/);
        const roundIndex = roundNumberMatch ? parseInt(roundNumberMatch[0], 10) : 1;

        return {
          id: f.id,
          entityType: 'fixture',
          homeMemberId: f.home_member_id,
          awayMemberId: f.away_member_id,
          roundName: f.round_name || `Round ${roundIndex}`,
          roundIndex,
          matchIndex: idx + 1,
          isCompleted,
          scheduledAt: f.scheduled_at,
          scheduledEndAt: f.scheduled_end_at,
          venueId: f.venue_id,
          venueName: f.venue_name,
          courtField: f.court_field,
        };
      });
    } else {
      // Generate new round-robin pairings
      const memberIds = members.filter((m) => m.is_active).map((m) => m.id);
      if (memberIds.length < 2) {
        throw new Error('At least 2 active participants or teams are required to generate a round-robin schedule.');
      }

      const pairings = generateRoundRobinPairings(memberIds, {
        doubleRoundRobin: options?.doubleRoundRobin,
      });

      matchInputs = pairings.map((p, idx) => ({
        id: `preview-fixture-${idx + 1}`,
        entityType: 'fixture',
        homeMemberId: p.homeMemberId,
        awayMemberId: p.awayMemberId,
        roundName: p.roundName,
        roundIndex: p.roundIndex,
        matchIndex: idx + 1,
        isCompleted: false,
      }));
    }

    return scheduleMatches(matchInputs, config, venues, members);
  },

  async commitLeagueSchedule(
    leaderboardId: string,
    previewResult: SchedulePreviewResult
  ): Promise<Fixture[]> {
    await DatabaseService.requireAdminPermission(leaderboardId);

    const existingFixtures = await LeagueService.getFixtures(leaderboardId);
    const existingById = new Map(existingFixtures.map((f) => [f.id, f]));
    const timestamp = nowIso();

    const fixturesToUpsert: Fixture[] = [];

    for (const item of previewResult.scheduled_items) {
      const existing = existingById.get(item.entity_id);
      if (existing && existing.status === 'completed') {
        // Inviolable: completed matches cannot be overwritten
        fixturesToUpsert.push(existing);
        continue;
      }

      const isNew = !existing;
      const fixtureId = isNew ? (item.entity_id.startsWith('preview-') ? makeUuid() : item.entity_id) : existing.id;

      fixturesToUpsert.push({
        id: fixtureId,
        leaderboard_id: leaderboardId,
        home_member_id: item.home_member_id || '',
        away_member_id: item.away_member_id || '',
        round_name: item.round_name,
        scheduled_at: item.scheduled_at,
        scheduled_end_at: item.scheduled_end_at,
        venue_id: item.venue_id,
        venue_name: item.venue_name,
        court_field: item.court_field,
        timezone: item.timezone,
        scheduling_status: 'scheduled',
        conflict_reason: null,
        status: existing?.status || 'scheduled',
        created_at: existing?.created_at || timestamp,
        updated_at: timestamp,
      });
    }

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('fixtures')
        .upsert(fixturesToUpsert, { onConflict: 'id' })
        .select();

      if (error) {
        throw error;
      }
      return data || [];
    }

    // Demo / localStorage mode
    const allFixtures = localGet<Fixture[]>('fixtures', []);
    const otherFixtures = allFixtures.filter((f) => f.leaderboard_id !== leaderboardId);
    const updated = [...otherFixtures, ...fixturesToUpsert];
    localSet('fixtures', updated);

    return fixturesToUpsert;
  },

  // =========================================================================
  // Tournament Scheduling: Preview & Commit
  // =========================================================================
  async previewTournamentSchedule(leaderboardId: string): Promise<SchedulePreviewResult> {
    const [config, venues, members, bracketView] = await Promise.all([
      this.getScheduleConfig(leaderboardId),
      this.getVenues(leaderboardId),
      DatabaseService.getMembers(leaderboardId),
      TournamentService.getBracketView(leaderboardId),
    ]);

    if (!config) {
      throw new Error('Please configure and save schedule settings before generating a tournament schedule preview.');
    }

    if (!bracketView || bracketView.rounds.length === 0) {
      throw new Error('Please generate a tournament bracket before generating match schedules.');
    }

    const matches: SchedulerInputMatch[] = [];
    for (const roundView of bracketView.rounds) {
      for (const node of roundView.matches) {
        const match = node.match;
        const isCompleted = match.state === 'completed' || match.state === 'bye' || match.state === 'cancelled';

        // Omit unplayable BYEs from active slot scheduling
        if (match.state === 'bye' || match.state === 'cancelled') {
          continue;
        }

        matches.push({
          id: match.id,
          entityType: 'tournament_match',
          homeMemberId: match.home_member_id,
          awayMemberId: match.away_member_id,
          roundName: roundView.round.round_name,
          roundIndex: match.round_index,
          matchIndex: match.match_index,
          isCompleted,
          scheduledAt: match.scheduled_at,
          scheduledEndAt: match.scheduled_end_at,
          venueId: match.venue_id,
          venueName: match.venue_name,
          courtField: match.court_field,
        });
      }
    }

    return scheduleMatches(matches, config, venues, members);
  },

  async commitTournamentSchedule(
    leaderboardId: string,
    previewResult: SchedulePreviewResult
  ): Promise<TournamentMatch[]> {
    await DatabaseService.requireAdminPermission(leaderboardId);

    const bracketView = await TournamentService.getBracketView(leaderboardId);
    if (!bracketView) {
      throw new Error('Tournament bracket not found');
    }

    const existingMatches = bracketView.rounds.flatMap((r) => r.matches.map((m) => m.match));
    const existingById = new Map(existingMatches.map((m) => [m.id, m]));
    const timestamp = nowIso();

    const matchesToUpdate: TournamentMatch[] = [];

    for (const item of previewResult.scheduled_items) {
      const existing = existingById.get(item.entity_id);
      if (!existing) continue;

      if (existing.state === 'completed') {
        matchesToUpdate.push(existing);
        continue;
      }

      matchesToUpdate.push({
        ...existing,
        scheduled_at: item.scheduled_at,
        scheduled_end_at: item.scheduled_end_at,
        venue_id: item.venue_id,
        venue_name: item.venue_name,
        court_field: item.court_field,
        timezone: item.timezone,
        scheduling_status: 'scheduled',
        conflict_reason: null,
        updated_at: timestamp,
      });
    }

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('tournament_matches')
        .upsert(matchesToUpdate, { onConflict: 'id' })
        .select();

      if (error) {
        throw error;
      }
      return data || [];
    }

    // Demo / localStorage mode
    const allMatches = localGet<TournamentMatch[]>('tournament_matches', []);
    const matchMap = new Map(matchesToUpdate.map((m) => [m.id, m]));
    const updatedAll = allMatches.map((m) => matchMap.get(m.id) || m);
    localSet('tournament_matches', updatedAll);

    return matchesToUpdate;
  },

  // =========================================================================
  // Manual Rescheduling & Cancellation
  // =========================================================================
  async rescheduleFixture(input: {
    fixtureId: string;
    scheduledAt: string;
    scheduledEndAt: string;
    venueId?: string | null;
    venueName?: string | null;
    courtField?: string | null;
  }): Promise<{ fixture: Fixture; conflicts: ScheduleConflictExplanation[] }> {
    const fixtureLeaderboardId = await LeagueService.getLeaderboardIdFromFixture(input.fixtureId);
    if (!fixtureLeaderboardId) {
      throw new Error('Fixture not found');
    }
    await DatabaseService.requireAdminPermission(fixtureLeaderboardId);

    const [allFixtures, config, members] = await Promise.all([
      LeagueService.getFixtures(fixtureLeaderboardId),
      this.getScheduleConfig(fixtureLeaderboardId),
      DatabaseService.getMembers(fixtureLeaderboardId),
    ]);

    const target = allFixtures.find((f) => f.id === input.fixtureId);
    if (!target) {
      throw new Error('Fixture not found');
    }

    const effectiveConfig = config || {
      id: '',
      leaderboard_id: fixtureLeaderboardId,
      start_date: input.scheduledAt.slice(0, 10),
      end_date: input.scheduledAt.slice(0, 10),
      timezone: 'UTC',
      playable_days: [0, 1, 2, 3, 4, 5, 6],
      daily_start_time: '00:00',
      daily_end_time: '23:59',
      match_duration_minutes: 60,
      buffer_minutes: 15,
      rest_interval_minutes: 60,
      participant_availability: [],
      auto_assign_venues: true,
      created_at: nowIso(),
      updated_at: nowIso(),
    };

    const conflicts = detectManualScheduleConflict(
      input.fixtureId,
      input.scheduledAt,
      input.scheduledEndAt,
      input.venueId || null,
      input.venueName || null,
      allFixtures,
      effectiveConfig,
      members
    );

    const schedulingStatus = conflicts.length > 0 ? 'conflict' : 'rescheduled';
    const conflictReason = conflicts.length > 0 ? conflicts.map((c) => c.reason).join('; ') : null;
    const timestamp = nowIso();

    const updatedFixture: Fixture = {
      ...target,
      scheduled_at: input.scheduledAt,
      scheduled_end_at: input.scheduledEndAt,
      venue_id: input.venueId || null,
      venue_name: input.venueName || null,
      court_field: input.courtField || null,
      timezone: effectiveConfig.timezone,
      scheduling_status: schedulingStatus,
      conflict_reason: conflictReason,
      updated_at: timestamp,
    };

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('fixtures')
        .update({
          scheduled_at: updatedFixture.scheduled_at,
          scheduled_end_at: updatedFixture.scheduled_end_at,
          venue_id: updatedFixture.venue_id,
          venue_name: updatedFixture.venue_name,
          court_field: updatedFixture.court_field,
          timezone: updatedFixture.timezone,
          scheduling_status: updatedFixture.scheduling_status,
          conflict_reason: updatedFixture.conflict_reason,
          updated_at: timestamp,
        })
        .eq('id', input.fixtureId)
        .select()
        .single();

      // Notify participants of reschedule
      try {
        const home = members.find((m) => m.id === target.home_member_id);
        const away = members.find((m) => m.id === target.away_member_id);
        const userIds = [home?.user_id, away?.user_id].filter(Boolean) as string[];
        if (userIds.length > 0) {
          const lb = await DatabaseService.getLeaderboard(fixtureLeaderboardId);
          if (lb) {
            const { CompetitionNotificationService } = await import('@/lib/competition/notifications/service');
            await CompetitionNotificationService.notifyFixtureScheduled({
              leaderboard_id: fixtureLeaderboardId,
              competitionName: lb.name,
              userIds,
              fixtureTitle: `${home?.name || 'Home'} vs ${away?.name || 'Away'}`,
              scheduledAt: input.scheduledAt,
              venueName: input.venueName || null,
              isReschedule: true,
              slug: lb.slug,
            });
          }
        }
      } catch (notifErr) {
        console.warn('Could not dispatch reschedule notification:', notifErr);
      }

      return { fixture: data, conflicts };
    }

    const idx = allFixtures.findIndex((f) => f.id === input.fixtureId);
    if (idx >= 0) {
      allFixtures[idx] = updatedFixture;
      localSet('fixtures', allFixtures);
    }

    // Notify participants of reschedule
    try {
      const home = members.find((m) => m.id === target.home_member_id);
      const away = members.find((m) => m.id === target.away_member_id);
      const userIds = [home?.user_id, away?.user_id].filter(Boolean) as string[];
      if (userIds.length > 0) {
        const lb = await DatabaseService.getLeaderboard(fixtureLeaderboardId);
        if (lb) {
          const { CompetitionNotificationService } = await import('@/lib/competition/notifications/service');
          await CompetitionNotificationService.notifyFixtureScheduled({
            leaderboard_id: fixtureLeaderboardId,
            competitionName: lb.name,
            userIds,
            fixtureTitle: `${home?.name || 'Home'} vs ${away?.name || 'Away'}`,
            scheduledAt: input.scheduledAt,
            venueName: input.venueName || null,
            isReschedule: true,
            slug: lb.slug,
          });
        }
      }
    } catch (notifErr) {
      console.warn('Could not dispatch reschedule notification:', notifErr);
    }

    return { fixture: updatedFixture, conflicts };
  },

  async rescheduleTournamentMatch(input: {
    matchId: string;
    scheduledAt: string;
    scheduledEndAt: string;
    venueId?: string | null;
    venueName?: string | null;
    courtField?: string | null;
  }): Promise<{ match: TournamentMatch; conflicts: ScheduleConflictExplanation[] }> {
    const leaderboardId = await TournamentService.getMatchesByMatchId(input.matchId);
    if (!leaderboardId) {
      throw new Error('Tournament match not found');
    }
    const bracketView = await TournamentService.getBracketView(leaderboardId);
    if (!bracketView) {
      throw new Error('Tournament bracket not found');
    }
    await DatabaseService.requireAdminPermission(leaderboardId);

    const [allMatches, config, members] = await Promise.all([
      bracketView.rounds.flatMap((r) => r.matches.map((m) => m.match)),
      this.getScheduleConfig(leaderboardId),
      DatabaseService.getMembers(leaderboardId),
    ]);

    const target = allMatches.find((m) => m.id === input.matchId);
    if (!target) {
      throw new Error('Match not found');
    }

    const effectiveConfig = config || {
      id: '',
      leaderboard_id: leaderboardId,
      start_date: input.scheduledAt.slice(0, 10),
      end_date: input.scheduledAt.slice(0, 10),
      timezone: 'UTC',
      playable_days: [0, 1, 2, 3, 4, 5, 6],
      daily_start_time: '00:00',
      daily_end_time: '23:59',
      match_duration_minutes: 60,
      buffer_minutes: 15,
      rest_interval_minutes: 60,
      participant_availability: [],
      auto_assign_venues: true,
      created_at: nowIso(),
      updated_at: nowIso(),
    };

    const conflicts = detectManualScheduleConflict(
      input.matchId,
      input.scheduledAt,
      input.scheduledEndAt,
      input.venueId || null,
      input.venueName || null,
      allMatches,
      effectiveConfig,
      members
    );

    const schedulingStatus = conflicts.length > 0 ? 'conflict' : 'rescheduled';
    const conflictReason = conflicts.length > 0 ? conflicts.map((c) => c.reason).join('; ') : null;
    const timestamp = nowIso();

    const updatedMatch: TournamentMatch = {
      ...target,
      scheduled_at: input.scheduledAt,
      scheduled_end_at: input.scheduledEndAt,
      venue_id: input.venueId || null,
      venue_name: input.venueName || null,
      court_field: input.courtField || null,
      timezone: effectiveConfig.timezone,
      scheduling_status: schedulingStatus,
      conflict_reason: conflictReason,
      updated_at: timestamp,
    };

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('tournament_matches')
        .update({
          scheduled_at: updatedMatch.scheduled_at,
          scheduled_end_at: updatedMatch.scheduled_end_at,
          venue_id: updatedMatch.venue_id,
          venue_name: updatedMatch.venue_name,
          court_field: updatedMatch.court_field,
          timezone: updatedMatch.timezone,
          scheduling_status: updatedMatch.scheduling_status,
          conflict_reason: updatedMatch.conflict_reason,
          updated_at: timestamp,
        })
        .eq('id', input.matchId)
        .select()
        .single();

      // Notify participants of match reschedule
      try {
        const home = members.find((m) => m.id === target.home_member_id);
        const away = members.find((m) => m.id === target.away_member_id);
        const userIds = [home?.user_id, away?.user_id].filter(Boolean) as string[];
        if (userIds.length > 0) {
          const lb = await DatabaseService.getLeaderboard(target.leaderboard_id);
          if (lb) {
            const { CompetitionNotificationService } = await import('@/lib/competition/notifications/service');
            await CompetitionNotificationService.notifyFixtureScheduled({
              leaderboard_id: target.leaderboard_id,
              competitionName: lb.name,
              userIds,
              fixtureTitle: `${home?.name || 'Home'} vs ${away?.name || 'Away'}`,
              scheduledAt: input.scheduledAt,
              venueName: input.venueName || null,
              isReschedule: true,
              slug: lb.slug,
            });
          }
        }
      } catch (notifErr) {
        console.warn('Could not dispatch tournament reschedule notification:', notifErr);
      }

      return { match: data, conflicts };
    }

    const allStored = localGet<TournamentMatch[]>('tournament_matches', []);
    const idx = allStored.findIndex((m) => m.id === input.matchId);
    if (idx >= 0) {
      allStored[idx] = updatedMatch;
      localSet('tournament_matches', allStored);
    }

    // Notify participants of match reschedule
    try {
      const home = members.find((m) => m.id === target.home_member_id);
      const away = members.find((m) => m.id === target.away_member_id);
      const userIds = [home?.user_id, away?.user_id].filter(Boolean) as string[];
      if (userIds.length > 0) {
        const lb = await DatabaseService.getLeaderboard(target.leaderboard_id);
        if (lb) {
          const { CompetitionNotificationService } = await import('@/lib/competition/notifications/service');
          await CompetitionNotificationService.notifyFixtureScheduled({
            leaderboard_id: target.leaderboard_id,
            competitionName: lb.name,
            userIds,
            fixtureTitle: `${home?.name || 'Home'} vs ${away?.name || 'Away'}`,
            scheduledAt: input.scheduledAt,
            venueName: input.venueName || null,
            isReschedule: true,
            slug: lb.slug,
          });
        }
      }
    } catch (notifErr) {
      console.warn('Could not dispatch tournament reschedule notification:', notifErr);
    }

    return { match: updatedMatch, conflicts };
  },

  async cancelFixture(fixtureId: string): Promise<Fixture> {
    const fixtureLeaderboardId = await LeagueService.getLeaderboardIdFromFixture(fixtureId);
    if (!fixtureLeaderboardId) {
      throw new Error('Fixture not found');
    }
    await DatabaseService.requireAdminPermission(fixtureLeaderboardId);
    const timestamp = nowIso();

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('fixtures')
        .update({
          scheduling_status: 'cancelled',
          updated_at: timestamp,
        })
        .eq('id', fixtureId)
        .select()
        .single();

      if (error) {
        throw error;
      }
      return data;
    }

    const allFixtures = localGet<Fixture[]>('fixtures', []);
    const fixture = allFixtures.find((f) => f.id === fixtureId);
    if (!fixture) {
      throw new Error('Fixture not found');
    }
    fixture.scheduling_status = 'cancelled';
    fixture.updated_at = timestamp;
    localSet('fixtures', allFixtures);
    return fixture;
  },

  async cancelTournamentMatch(matchId: string): Promise<TournamentMatch> {
    const leaderboardId = await TournamentService.getMatchesByMatchId(matchId);
    if (!leaderboardId) {
      throw new Error('Tournament match not found');
    }
    await DatabaseService.requireAdminPermission(leaderboardId);
    const timestamp = nowIso();

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('tournament_matches')
        .update({
          state: 'cancelled',
          scheduling_status: 'cancelled',
          updated_at: timestamp,
        })
        .eq('id', matchId)
        .select()
        .single();

      if (error) {
        throw error;
      }
      return data;
    }

    const allMatches = localGet<TournamentMatch[]>('tournament_matches', []);
    const match = allMatches.find((m) => m.id === matchId);
    if (!match) {
      throw new Error('Tournament match not found');
    }
    match.state = 'cancelled';
    match.scheduling_status = 'cancelled';
    match.updated_at = timestamp;
    localSet('tournament_matches', allMatches);
    return match;
  },
};
