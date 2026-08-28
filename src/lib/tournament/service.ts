'use client';

import { DatabaseService, isSupabaseConfigured, supabase } from '@/lib/db';
import {
  CompetitionConfig,
  CompetitionTemplateKey,
  Leaderboard,
  LeaderboardMember,
  Tournament,
  TournamentAdvancement,
  TournamentBracketView,
  TournamentMatch,
  TournamentMatchResult,
  TournamentRound,
  TournamentSeedingMode,
  TournamentState,
  VisibilityType,
} from '@/types';
import {
  generateSingleEliminationBracket,
  processSingleEliminationMatchResult,
} from '@/services/tournamentAdvancement';

interface CreateTournamentCompetitionInput {
  name: string;
  description: string | null;
  visibility: VisibilityType;
  competitionType: Leaderboard['competition_type'];
  coverImageUrl: string | null;
  slug: string;
  templateKey: CompetitionTemplateKey;
  seasonName: string;
  startDate: string;
  endDate: string | null;
  bracketSize: number;
  seedingMode: TournamentSeedingMode;
  participantMemberIds?: string[];
}

interface GenerateBracketInput {
  leaderboardId: string;
  bracketSize: number;
  seedingMode: TournamentSeedingMode;
  manualSeedMemberIds?: string[];
}

interface SaveTournamentMatchResultInput {
  matchId: string;
  homeScore: number;
  awayScore: number;
}

interface LocalTournamentState {
  tournaments: Tournament[];
  rounds: TournamentRound[];
  matches: TournamentMatch[];
  results: TournamentMatchResult[];
  advancements: TournamentAdvancement[];
}

const STORAGE_KEYS = {
  tournaments: 'tournaments',
  rounds: 'tournament_rounds',
  matches: 'tournament_matches',
  results: 'tournament_match_results',
  advancements: 'tournament_advancements',
} as const;

function nowIso(): string {
  return new Date().toISOString();
}

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

function getLocalTournamentState(): LocalTournamentState {
  return {
    tournaments: localGet<Tournament[]>(STORAGE_KEYS.tournaments, []),
    rounds: localGet<TournamentRound[]>(STORAGE_KEYS.rounds, []),
    matches: localGet<TournamentMatch[]>(STORAGE_KEYS.matches, []),
    results: localGet<TournamentMatchResult[]>(STORAGE_KEYS.results, []),
    advancements: localGet<TournamentAdvancement[]>(STORAGE_KEYS.advancements, []),
  };
}

function setLocalTournamentState(state: LocalTournamentState): void {
  localSet(STORAGE_KEYS.tournaments, state.tournaments);
  localSet(STORAGE_KEYS.rounds, state.rounds);
  localSet(STORAGE_KEYS.matches, state.matches);
  localSet(STORAGE_KEYS.results, state.results);
  localSet(STORAGE_KEYS.advancements, state.advancements);
}

async function getTournamentPieces(leaderboardId: string) {
  const [tournament, rounds, matches, results, advancements, members] = await Promise.all([
    TournamentService.getTournament(leaderboardId),
    TournamentService.getRounds(leaderboardId),
    TournamentService.getMatches(leaderboardId),
    TournamentService.getMatchResults(leaderboardId),
    TournamentService.getAdvancements(leaderboardId),
    DatabaseService.getMembers(leaderboardId),
  ]);

  return {
    tournament,
    rounds,
    matches,
    results,
    advancements,
    members,
  };
}

async function upsertTournamentConfig(leaderboardId: string, templateKey: CompetitionTemplateKey): Promise<void> {
  const config: CompetitionConfig = {
    leaderboard_id: leaderboardId,
    engine_type: 'tournament',
    template_key: templateKey,
    entity_type: 'team',
    created_at: nowIso(),
    updated_at: nowIso(),
  };

  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from('competition_configs').upsert(config);
    if (error) {
      throw error;
    }
    return;
  }

  // Local demo mode stores competition config via league storage key to preserve compatibility.
  const raw = localGet<CompetitionConfig[]>('competition_configs', []);
  const existingIndex = raw.findIndex((item) => item.leaderboard_id === leaderboardId);
  if (existingIndex >= 0) {
    raw[existingIndex] = { ...raw[existingIndex], ...config, updated_at: nowIso() };
  } else {
    raw.push(config);
  }
  localSet('competition_configs', raw);
}

export const TournamentService = {
  async createTournamentCompetition(input: CreateTournamentCompetitionInput): Promise<Leaderboard> {
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

    const timestamp = nowIso();
    const tournament: Tournament = {
      leaderboard_id: leaderboard.id,
      format: 'single_elimination',
      bracket_size: input.bracketSize,
      seeding_mode: input.seedingMode,
      state: 'draft',
      season_name: input.seasonName,
      template_key: input.templateKey,
      champion_member_id: null,
      created_at: timestamp,
      updated_at: timestamp,
    };

    try {
      await upsertTournamentConfig(leaderboard.id, input.templateKey);

      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from('tournaments').upsert(tournament);
        if (error) {
          throw error;
        }
      } else {
        const state = getLocalTournamentState();
        state.tournaments.push(tournament);
        setLocalTournamentState(state);
      }

      return leaderboard;
    } catch (error) {
      await DatabaseService.deleteLeaderboard(leaderboard.id);
      throw error;
    }
  },

  async getTournament(leaderboardId: string): Promise<Tournament | null> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .eq('leaderboard_id', leaderboardId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data;
    }

    const state = getLocalTournamentState();
    return state.tournaments.find((item) => item.leaderboard_id === leaderboardId) || null;
  },

  async getRounds(leaderboardId: string): Promise<TournamentRound[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('tournament_rounds')
        .select('*')
        .eq('leaderboard_id', leaderboardId)
        .order('round_index', { ascending: true });

      if (error) {
        throw error;
      }

      return data || [];
    }

    const state = getLocalTournamentState();
    return state.rounds
      .filter((item) => item.leaderboard_id === leaderboardId)
      .sort((left, right) => left.round_index - right.round_index);
  },

  async getMatches(leaderboardId: string): Promise<TournamentMatch[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('tournament_matches')
        .select('*')
        .eq('leaderboard_id', leaderboardId)
        .order('round_index', { ascending: true })
        .order('match_index', { ascending: true });

      if (error) {
        throw error;
      }

      return data || [];
    }

    const state = getLocalTournamentState();
    return state.matches
      .filter((item) => item.leaderboard_id === leaderboardId)
      .sort((left, right) => left.round_index - right.round_index || left.match_index - right.match_index);
  },

  async getMatchResults(leaderboardId: string): Promise<TournamentMatchResult[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('tournament_match_results')
        .select('*, tournament_matches!inner(leaderboard_id)')
        .eq('tournament_matches.leaderboard_id', leaderboardId);

      if (error) {
        throw error;
      }

      return (data || []).map((item) => ({
        match_id: item.match_id,
        home_score: item.home_score,
        away_score: item.away_score,
        created_at: item.created_at,
        updated_at: item.updated_at,
      } satisfies TournamentMatchResult));
    }

    const state = getLocalTournamentState();
    const matchIds = new Set(state.matches.filter((item) => item.leaderboard_id === leaderboardId).map((item) => item.id));
    return state.results.filter((item) => matchIds.has(item.match_id));
  },

  async getAdvancements(leaderboardId: string): Promise<TournamentAdvancement[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('tournament_advancements')
        .select('*')
        .eq('leaderboard_id', leaderboardId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    }

    const state = getLocalTournamentState();
    return state.advancements
      .filter((item) => item.leaderboard_id === leaderboardId)
      .sort((left, right) => right.created_at.localeCompare(left.created_at));
  },

  async generateBracket(input: GenerateBracketInput): Promise<void> {
    await DatabaseService.requireAdminPermission(input.leaderboardId);
    const members = await DatabaseService.getMembers(input.leaderboardId);
    const activeMembers = members.filter((member) => member.is_active);

    const { rounds, matches, advancements } = generateSingleEliminationBracket({
      leaderboardId: input.leaderboardId,
      participants: activeMembers,
      bracketSize: input.bracketSize,
      seedingMode: input.seedingMode,
      manualSeedMemberIds: input.manualSeedMemberIds,
    });

    const timestamp = nowIso();

    if (isSupabaseConfigured && supabase) {
      const { error: roundsDeleteError } = await supabase.from('tournament_rounds').delete().eq('leaderboard_id', input.leaderboardId);
      if (roundsDeleteError) {
        throw roundsDeleteError;
      }

      const { error: roundsError } = await supabase.from('tournament_rounds').insert(rounds);
      if (roundsError) {
        throw roundsError;
      }

      const { error: matchesError } = await supabase.from('tournament_matches').insert(matches);
      if (matchesError) {
        throw matchesError;
      }

      if (advancements.length > 0) {
        const { error: advError } = await supabase.from('tournament_advancements').insert(advancements);
        if (advError) {
          throw advError;
        }
      }

      const { error: tournamentUpdateError } = await supabase
        .from('tournaments')
        .update({
          bracket_size: input.bracketSize,
          seeding_mode: input.seedingMode,
          state: 'in_progress',
          champion_member_id: null,
          updated_at: timestamp,
        })
        .eq('leaderboard_id', input.leaderboardId);

      if (tournamentUpdateError) {
        throw tournamentUpdateError;
      }

      return;
    }

    const state = getLocalTournamentState();
    const previousMatchIds = new Set(state.matches.filter((item) => item.leaderboard_id === input.leaderboardId).map((item) => item.id));
    state.rounds = state.rounds.filter((item) => item.leaderboard_id !== input.leaderboardId);
    state.matches = state.matches.filter((item) => item.leaderboard_id !== input.leaderboardId);
    state.results = state.results.filter((item) => !previousMatchIds.has(item.match_id));
    state.advancements = state.advancements.filter((item) => item.leaderboard_id !== input.leaderboardId);

    state.rounds.push(...rounds);
    state.matches.push(...matches);
    state.advancements.push(...advancements);

    const tournamentIndex = state.tournaments.findIndex((item) => item.leaderboard_id === input.leaderboardId);
    if (tournamentIndex >= 0) {
      state.tournaments[tournamentIndex] = {
        ...state.tournaments[tournamentIndex],
        bracket_size: input.bracketSize,
        seeding_mode: input.seedingMode,
        state: 'in_progress',
        champion_member_id: null,
        updated_at: timestamp,
      };
    }

    setLocalTournamentState(state);
  },

  async saveMatchResult(input: SaveTournamentMatchResultInput): Promise<void> {
    const allPieces = await Promise.all([
      this.getMatchesByMatchId(input.matchId),
      this.getMatchById(input.matchId),
    ]);

    const leaderboardId = allPieces[0];
    const currentMatch = allPieces[1];

    if (!leaderboardId || !currentMatch) {
      throw new Error('Match not found.');
    }

    await DatabaseService.requireAdminPermission(leaderboardId);

    const matches = await this.getMatches(leaderboardId);
    const processed = processSingleEliminationMatchResult({
      leaderboardId,
      matchId: input.matchId,
      homeScore: input.homeScore,
      awayScore: input.awayScore,
      matches,
    });

    const finalMatch = processed.matches.reduce((candidate, item) => {
      if (!candidate) {
        return item;
      }
      return item.round_index > candidate.round_index ? item : candidate;
    }, null as TournamentMatch | null);

    const champion = finalMatch?.state === 'completed' ? finalMatch.winner_member_id : null;
    const timestamp = nowIso();

    if (isSupabaseConfigured && supabase) {
      const { error: resultError } = await supabase.from('tournament_match_results').upsert({
        match_id: processed.result.match_id,
        home_score: processed.result.home_score,
        away_score: processed.result.away_score,
        updated_at: timestamp,
      });

      if (resultError) {
        throw resultError;
      }

      for (const match of processed.matches) {
        const { error } = await supabase
          .from('tournament_matches')
          .update({
            home_member_id: match.home_member_id,
            away_member_id: match.away_member_id,
            winner_member_id: match.winner_member_id,
            loser_member_id: match.loser_member_id,
            state: match.state,
            updated_at: match.updated_at,
          })
          .eq('id', match.id);

        if (error) {
          throw error;
        }
      }

      if (processed.advancements.length > 0) {
        const { error: advError } = await supabase.from('tournament_advancements').insert(processed.advancements);
        if (advError) {
          throw advError;
        }
      }

      const { error: tournamentError } = await supabase
        .from('tournaments')
        .update({
          champion_member_id: champion,
          state: champion ? 'completed' : 'in_progress',
          updated_at: timestamp,
        })
        .eq('leaderboard_id', leaderboardId);

      if (tournamentError) {
        throw tournamentError;
      }

      return;
    }

    const state = getLocalTournamentState();
    const resultIndex = state.results.findIndex((item) => item.match_id === processed.result.match_id);
    if (resultIndex >= 0) {
      state.results[resultIndex] = {
        ...state.results[resultIndex],
        home_score: processed.result.home_score,
        away_score: processed.result.away_score,
        updated_at: timestamp,
      };
    } else {
      state.results.push(processed.result);
    }

    state.matches = state.matches.map((match) => {
      const updated = processed.matches.find((candidate) => candidate.id === match.id);
      return updated || match;
    });

    if (processed.advancements.length > 0) {
      state.advancements.push(...processed.advancements);
    }

    const tournamentIndex = state.tournaments.findIndex((item) => item.leaderboard_id === leaderboardId);
    if (tournamentIndex >= 0) {
      state.tournaments[tournamentIndex] = {
        ...state.tournaments[tournamentIndex],
        champion_member_id: champion,
        state: champion ? 'completed' : 'in_progress',
        updated_at: timestamp,
      };
    }

    setLocalTournamentState(state);
  },

  async getBracketView(leaderboardId: string): Promise<TournamentBracketView | null> {
    const { tournament, rounds, matches, results, members } = await getTournamentPieces(leaderboardId);
    if (!tournament) {
      return null;
    }

    const membersById = new Map(members.map((member) => [member.id, member]));
    const resultsByMatch = new Map(results.map((result) => [result.match_id, result]));

    return {
      tournament,
      rounds: rounds.map((round) => ({
        round,
        matches: matches
          .filter((match) => match.round_id === round.id)
          .sort((left, right) => left.match_index - right.match_index)
          .map((match) => ({
            match,
            result: resultsByMatch.get(match.id) || null,
            homeMember: match.home_member_id ? membersById.get(match.home_member_id) || null : null,
            awayMember: match.away_member_id ? membersById.get(match.away_member_id) || null : null,
          })),
      })),
      champion: tournament.champion_member_id ? membersById.get(tournament.champion_member_id) || null : null,
    };
  },

  async updateTournamentState(leaderboardId: string, stateValue: TournamentState): Promise<void> {
    await DatabaseService.requireAdminPermission(leaderboardId);
    const timestamp = nowIso();

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('tournaments')
        .update({ state: stateValue, updated_at: timestamp })
        .eq('leaderboard_id', leaderboardId);

      if (error) {
        throw error;
      }

      return;
    }

    const state = getLocalTournamentState();
    const index = state.tournaments.findIndex((item) => item.leaderboard_id === leaderboardId);
    if (index === -1) {
      throw new Error('Tournament not found.');
    }

    state.tournaments[index] = {
      ...state.tournaments[index],
      state: stateValue,
      updated_at: timestamp,
    };
    setLocalTournamentState(state);
  },

  async getMatchesByMatchId(matchId: string): Promise<string | null> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('tournament_matches')
        .select('leaderboard_id')
        .eq('id', matchId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data?.leaderboard_id || null;
    }

    const state = getLocalTournamentState();
    return state.matches.find((item) => item.id === matchId)?.leaderboard_id || null;
  },

  async getMatchById(matchId: string): Promise<TournamentMatch | null> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('tournament_matches')
        .select('*')
        .eq('id', matchId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data;
    }

    const state = getLocalTournamentState();
    return state.matches.find((item) => item.id === matchId) || null;
  },

  async getRecentResults(leaderboardId: string): Promise<Array<{
    match: TournamentMatch;
    result: TournamentMatchResult;
    homeMember: LeaderboardMember | null;
    awayMember: LeaderboardMember | null;
  }>> {
    const [matches, results, members] = await Promise.all([
      this.getMatches(leaderboardId),
      this.getMatchResults(leaderboardId),
      DatabaseService.getMembers(leaderboardId),
    ]);

    const membersById = new Map(members.map((member) => [member.id, member]));
    const resultsByMatch = new Map(results.map((result) => [result.match_id, result]));

    return matches
      .filter((match) => match.state === 'completed' && resultsByMatch.has(match.id))
      .map((match) => ({
        match,
        result: resultsByMatch.get(match.id) as TournamentMatchResult,
        homeMember: match.home_member_id ? membersById.get(match.home_member_id) || null : null,
        awayMember: match.away_member_id ? membersById.get(match.away_member_id) || null : null,
      }))
      .sort((left, right) => right.match.updated_at.localeCompare(left.match.updated_at));
  },
};
