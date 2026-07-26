'use client';

import {
  CompetitionConfig,
  CompetitionEntityType,
  CompetitionRankingRule,
  CompetitionStatistic,
  CompetitionTemplateKey,
  Fixture,
  FixtureResult,
  Leaderboard,
  LeagueSettings,
  LeagueStandingRow,
  VisibilityType,
} from '@/types';
import { DatabaseService, isSupabaseConfigured, supabase } from '@/lib/db';
import { COMPETITION_TEMPLATES, getCompetitionTemplate, getStatisticDefinition } from '@/lib/competition/templates';
import { buildLeagueStandings } from '@/lib/league/standings';

interface CreateLeagueCompetitionInput {
  name: string;
  description: string | null;
  visibility: VisibilityType;
  competitionType: Leaderboard['competition_type'];
  coverImageUrl: string | null;
  slug: string;
  templateKey: CompetitionTemplateKey;
  entityType: CompetitionEntityType;
  seasonName: string;
  startDate: string;
  endDate: string | null;
  pointsForWin: number;
  pointsForDraw: number;
  pointsForLoss: number;
  selectedStatisticKeys: string[];
  standingsColumnKeys: string[];
  rankingRules: Array<{
    criterion_type: CompetitionRankingRule['criterion_type'];
    statistic_key: string | null;
    label: string;
    direction: CompetitionRankingRule['direction'];
  }>;
}

interface SaveFixtureInput {
  fixtureId?: string;
  leaderboardId: string;
  homeMemberId: string;
  awayMemberId: string;
  roundName: string | null;
  scheduledAt: string | null;
  status: Fixture['status'];
}

interface SaveFixtureResultInput {
  fixtureId: string;
  homeScore: number;
  awayScore: number;
}

interface LocalLeagueState {
  competitionConfigs: CompetitionConfig[];
  competitionStatistics: CompetitionStatistic[];
  competitionRankingRules: CompetitionRankingRule[];
  leagueSettings: LeagueSettings[];
  fixtures: Fixture[];
  fixtureResults: FixtureResult[];
}

const STORAGE_KEYS = {
  competitionConfigs: 'competition_configs',
  competitionStatistics: 'competition_statistics',
  competitionRankingRules: 'competition_ranking_rules',
  leagueSettings: 'league_settings',
  fixtures: 'fixtures',
  fixtureResults: 'fixture_results',
} as const;

function localGet<T>(key: string, defaults: T): T {
  if (typeof window === 'undefined') {
    return defaults;
  }

  const value = localStorage.getItem(`leagueboard_${key}`);
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

function localSet(key: string, value: unknown): void {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.setItem(`leagueboard_${key}`, JSON.stringify(value));
}

function getLocalLeagueState(): LocalLeagueState {
  return {
    competitionConfigs: localGet<CompetitionConfig[]>(STORAGE_KEYS.competitionConfigs, []),
    competitionStatistics: localGet<CompetitionStatistic[]>(STORAGE_KEYS.competitionStatistics, []),
    competitionRankingRules: localGet<CompetitionRankingRule[]>(STORAGE_KEYS.competitionRankingRules, []),
    leagueSettings: localGet<LeagueSettings[]>(STORAGE_KEYS.leagueSettings, []),
    fixtures: localGet<Fixture[]>(STORAGE_KEYS.fixtures, []),
    fixtureResults: localGet<FixtureResult[]>(STORAGE_KEYS.fixtureResults, []),
  };
}

function setLocalLeagueState(state: LocalLeagueState): void {
  localSet(STORAGE_KEYS.competitionConfigs, state.competitionConfigs);
  localSet(STORAGE_KEYS.competitionStatistics, state.competitionStatistics);
  localSet(STORAGE_KEYS.competitionRankingRules, state.competitionRankingRules);
  localSet(STORAGE_KEYS.leagueSettings, state.leagueSettings);
  localSet(STORAGE_KEYS.fixtures, state.fixtures);
  localSet(STORAGE_KEYS.fixtureResults, state.fixtureResults);
}

function makeUuid(): string {
  return crypto.randomUUID();
}

function mapCompetitionStatistics(leaderboardId: string, statisticKeys: string[], standingsColumnKeys: string[]): CompetitionStatistic[] {
  const combined = Array.from(new Set([...standingsColumnKeys, ...statisticKeys]));

  return combined.map((statisticKey, index) => {
    const definition = getStatisticDefinition(statisticKey);
    return {
      id: makeUuid(),
      leaderboard_id: leaderboardId,
      statistic_key: statisticKey,
      label: definition?.label || statisticKey,
      category: definition?.category || 'input',
      calculation_type: definition?.calculation_type || null,
      is_enabled: true,
      display_order: index,
      created_at: new Date().toISOString(),
    };
  });
}

function mapRankingRules(leaderboardId: string, rankingRules: CreateLeagueCompetitionInput['rankingRules']): CompetitionRankingRule[] {
  return rankingRules.map((rule, index) => ({
    id: makeUuid(),
    leaderboard_id: leaderboardId,
    criterion_type: rule.criterion_type,
    statistic_key: rule.statistic_key,
    label: rule.label,
    direction: rule.direction,
    priority: index,
    created_at: new Date().toISOString(),
  }));
}

async function getLeaguePieces(leaderboardId: string) {
  const [leaderboard, members, config, settings, statistics, rankingRules, fixtures, results] = await Promise.all([
    DatabaseService.getLeaderboardById(leaderboardId),
    DatabaseService.getMembers(leaderboardId),
    LeagueService.getCompetitionConfig(leaderboardId),
    LeagueService.getLeagueSettings(leaderboardId),
    LeagueService.getCompetitionStatistics(leaderboardId),
    LeagueService.getCompetitionRankingRules(leaderboardId),
    LeagueService.getFixtures(leaderboardId),
    LeagueService.getFixtureResults(leaderboardId),
  ]);

  return {
    leaderboard,
    members,
    config,
    settings,
    statistics,
    rankingRules,
    fixtures,
    results,
  };
}

export const LeagueService = {
  getTemplates() {
    return COMPETITION_TEMPLATES;
  },

  getTemplate(templateKey: CompetitionTemplateKey) {
    return getCompetitionTemplate(templateKey);
  },

  async getCompetitionConfig(leaderboardId: string): Promise<CompetitionConfig | null> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('competition_configs')
        .select('*')
        .eq('leaderboard_id', leaderboardId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data;
    }

    const state = getLocalLeagueState();
    return state.competitionConfigs.find((item) => item.leaderboard_id === leaderboardId) || null;
  },

  async getLeagueSettings(leaderboardId: string): Promise<LeagueSettings | null> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('league_settings')
        .select('*')
        .eq('leaderboard_id', leaderboardId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data;
    }

    const state = getLocalLeagueState();
    return state.leagueSettings.find((item) => item.leaderboard_id === leaderboardId) || null;
  },

  async getCompetitionStatistics(leaderboardId: string): Promise<CompetitionStatistic[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('competition_statistics')
        .select('*')
        .eq('leaderboard_id', leaderboardId)
        .order('display_order', { ascending: true });

      if (error) {
        throw error;
      }

      return data || [];
    }

    const state = getLocalLeagueState();
    return state.competitionStatistics
      .filter((item) => item.leaderboard_id === leaderboardId)
      .sort((left, right) => left.display_order - right.display_order);
  },

  async getCompetitionRankingRules(leaderboardId: string): Promise<CompetitionRankingRule[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('competition_ranking_rules')
        .select('*')
        .eq('leaderboard_id', leaderboardId)
        .order('priority', { ascending: true });

      if (error) {
        throw error;
      }

      return data || [];
    }

    const state = getLocalLeagueState();
    return state.competitionRankingRules
      .filter((item) => item.leaderboard_id === leaderboardId)
      .sort((left, right) => left.priority - right.priority);
  },

  async getFixtures(leaderboardId: string): Promise<Fixture[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('fixtures')
        .select('*')
        .eq('leaderboard_id', leaderboardId)
        .order('scheduled_at', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      return data || [];
    }

    const state = getLocalLeagueState();
    return state.fixtures
      .filter((item) => item.leaderboard_id === leaderboardId)
      .sort((left, right) => (left.scheduled_at || '').localeCompare(right.scheduled_at || '') || left.created_at.localeCompare(right.created_at));
  },

  async getFixtureResults(leaderboardId: string): Promise<FixtureResult[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('fixture_results')
        .select('*, fixtures!inner(leaderboard_id)')
        .eq('fixtures.leaderboard_id', leaderboardId);

      if (error) {
        throw error;
      }

      return (data || []).map((item) => ({
        fixture_id: item.fixture_id,
        home_score: item.home_score,
        away_score: item.away_score,
        created_at: item.created_at,
        updated_at: item.updated_at,
      } satisfies FixtureResult));
    }

    const state = getLocalLeagueState();
    const fixtureIds = new Set(state.fixtures.filter((item) => item.leaderboard_id === leaderboardId).map((item) => item.id));
    return state.fixtureResults.filter((item) => fixtureIds.has(item.fixture_id));
  },

  async createLeagueCompetition(input: CreateLeagueCompetitionInput): Promise<Leaderboard> {
    const leaderboard = await DatabaseService.createLeaderboard(
      {
        name: input.name,
        description: input.description,
        slug: input.slug,
        visibility: input.visibility,
        competition_type: input.competitionType,
        cover_image_url: input.coverImageUrl,
      },
      [],
      {
        name: input.seasonName,
        start_date: new Date(input.startDate).toISOString(),
        end_date: input.endDate ? new Date(input.endDate).toISOString() : null,
      }
    );

    const competitionConfig: CompetitionConfig = {
      leaderboard_id: leaderboard.id,
      engine_type: 'league_table',
      template_key: input.templateKey,
      entity_type: input.entityType,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const leagueSettings: LeagueSettings = {
      leaderboard_id: leaderboard.id,
      season_name: input.seasonName,
      points_for_win: input.pointsForWin,
      points_for_draw: input.pointsForDraw,
      points_for_loss: input.pointsForLoss,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const competitionStatistics = mapCompetitionStatistics(leaderboard.id, input.selectedStatisticKeys, input.standingsColumnKeys);
    const rankingRules = mapRankingRules(leaderboard.id, input.rankingRules);

    try {
      if (isSupabaseConfigured && supabase) {
        const { error: configError } = await supabase.from('competition_configs').upsert(competitionConfig);
        if (configError) {
          throw configError;
        }

        const { error: settingsError } = await supabase.from('league_settings').upsert(leagueSettings);
        if (settingsError) {
          throw settingsError;
        }

        const { error: statisticsError } = await supabase.from('competition_statistics').insert(competitionStatistics);
        if (statisticsError) {
          throw statisticsError;
        }

        const { error: rankingError } = await supabase.from('competition_ranking_rules').insert(rankingRules);
        if (rankingError) {
          throw rankingError;
        }

        return leaderboard;
      }

      const state = getLocalLeagueState();
      state.competitionConfigs.push(competitionConfig);
      state.leagueSettings.push(leagueSettings);
      state.competitionStatistics.push(...competitionStatistics);
      state.competitionRankingRules.push(...rankingRules);
      setLocalLeagueState(state);

      return leaderboard;
    } catch (error) {
      await DatabaseService.deleteLeaderboard(leaderboard.id);
      throw error;
    }
  },

  async saveFixture(input: SaveFixtureInput): Promise<Fixture> {
    const timestamp = new Date().toISOString();

    if (isSupabaseConfigured && supabase) {
      if (input.fixtureId) {
        const { data, error } = await supabase
          .from('fixtures')
          .update({
            home_member_id: input.homeMemberId,
            away_member_id: input.awayMemberId,
            round_name: input.roundName,
            scheduled_at: input.scheduledAt,
            status: input.status,
            updated_at: timestamp,
          })
          .eq('id', input.fixtureId)
          .select()
          .single();

        if (error) {
          throw error;
        }

        return data;
      }

      const { data, error } = await supabase
        .from('fixtures')
        .insert({
          leaderboard_id: input.leaderboardId,
          home_member_id: input.homeMemberId,
          away_member_id: input.awayMemberId,
          round_name: input.roundName,
          scheduled_at: input.scheduledAt,
          status: input.status,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    }

    const state = getLocalLeagueState();

    if (input.fixtureId) {
      const fixtureIndex = state.fixtures.findIndex((item) => item.id === input.fixtureId);
      if (fixtureIndex === -1) {
        throw new Error('Fixture not found.');
      }

      const updatedFixture: Fixture = {
        ...state.fixtures[fixtureIndex],
        home_member_id: input.homeMemberId,
        away_member_id: input.awayMemberId,
        round_name: input.roundName,
        scheduled_at: input.scheduledAt,
        status: input.status,
        updated_at: timestamp,
      };

      state.fixtures[fixtureIndex] = updatedFixture;
      setLocalLeagueState(state);
      return updatedFixture;
    }

    const fixture: Fixture = {
      id: makeUuid(),
      leaderboard_id: input.leaderboardId,
      home_member_id: input.homeMemberId,
      away_member_id: input.awayMemberId,
      round_name: input.roundName,
      scheduled_at: input.scheduledAt,
      status: input.status,
      created_at: timestamp,
      updated_at: timestamp,
    };

    state.fixtures.push(fixture);
    setLocalLeagueState(state);
    return fixture;
  },

  async saveFixtureResult(input: SaveFixtureResultInput): Promise<void> {
    const timestamp = new Date().toISOString();

    if (isSupabaseConfigured && supabase) {
      const { error: resultError } = await supabase.from('fixture_results').upsert({
        fixture_id: input.fixtureId,
        home_score: input.homeScore,
        away_score: input.awayScore,
        updated_at: timestamp,
      });

      if (resultError) {
        throw resultError;
      }

      const { error: fixtureError } = await supabase
        .from('fixtures')
        .update({ status: 'completed', updated_at: timestamp })
        .eq('id', input.fixtureId);

      if (fixtureError) {
        throw fixtureError;
      }

      return;
    }

    const state = getLocalLeagueState();
    const fixtureIndex = state.fixtures.findIndex((item) => item.id === input.fixtureId);
    if (fixtureIndex === -1) {
      throw new Error('Fixture not found.');
    }

    state.fixtures[fixtureIndex] = {
      ...state.fixtures[fixtureIndex],
      status: 'completed',
      updated_at: timestamp,
    };

    const resultIndex = state.fixtureResults.findIndex((item) => item.fixture_id === input.fixtureId);
    if (resultIndex >= 0) {
      state.fixtureResults[resultIndex] = {
        ...state.fixtureResults[resultIndex],
        home_score: input.homeScore,
        away_score: input.awayScore,
        updated_at: timestamp,
      };
    } else {
      state.fixtureResults.push({
        fixture_id: input.fixtureId,
        home_score: input.homeScore,
        away_score: input.awayScore,
        created_at: timestamp,
        updated_at: timestamp,
      });
    }

    setLocalLeagueState(state);
  },

  async getLeagueStandings(leaderboardId: string): Promise<LeagueStandingRow[]> {
    const { members, config, settings, statistics, rankingRules, fixtures, results } = await getLeaguePieces(leaderboardId);
    if (!config || !settings) {
      return [];
    }

    const template = getCompetitionTemplate(config.template_key);
    return buildLeagueStandings({
      members: members.filter((member) => member.is_active),
      fixtures,
      results,
      leagueSettings: settings,
      competitionStatistics: statistics,
      rankingRules,
      scoredStatKey: template.scored_stat_key,
      allowedStatKey: template.allowed_stat_key,
    });
  },

  async getRecentResults(leaderboardId: string) {
    const [fixtures, results, members] = await Promise.all([
      this.getFixtures(leaderboardId),
      this.getFixtureResults(leaderboardId),
      DatabaseService.getMembers(leaderboardId),
    ]);

    const membersById = new Map(members.map((member) => [member.id, member]));
    const resultsByFixtureId = new Map(results.map((result) => [result.fixture_id, result]));

    return fixtures
      .filter((fixture) => fixture.status === 'completed')
      .map((fixture) => ({
        fixture,
        result: resultsByFixtureId.get(fixture.id) || null,
        homeMember: membersById.get(fixture.home_member_id) || null,
        awayMember: membersById.get(fixture.away_member_id) || null,
      }))
      .filter((item) => item.result)
      .sort((left, right) => (right.fixture.updated_at || '').localeCompare(left.fixture.updated_at || ''));
  },

  async updateLeagueSettings(leaderboardId: string, updates: Partial<LeagueSettings>): Promise<LeagueSettings> {
    const timestamp = new Date().toISOString();

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('league_settings')
        .update({ ...updates, updated_at: timestamp })
        .eq('leaderboard_id', leaderboardId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    }

    const state = getLocalLeagueState();
    const index = state.leagueSettings.findIndex((item) => item.leaderboard_id === leaderboardId);
    if (index === -1) {
      throw new Error('League settings not found.');
    }

    const updated: LeagueSettings = {
      ...state.leagueSettings[index],
      ...updates,
      updated_at: timestamp,
    };

    state.leagueSettings[index] = updated;
    setLocalLeagueState(state);
    return updated;
  },
};