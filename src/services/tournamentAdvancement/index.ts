import {
  LeaderboardMember,
  TournamentAdvancement,
  TournamentMatch,
  TournamentMatchResult,
  TournamentRound,
  TournamentSeedingMode,
} from '@/types';

interface GenerateBracketParams {
  leaderboardId: string;
  participants: LeaderboardMember[];
  bracketSize: number;
  seedingMode: TournamentSeedingMode;
  manualSeedMemberIds?: string[];
}

interface GenerateBracketResult {
  rounds: TournamentRound[];
  matches: TournamentMatch[];
  advancements: TournamentAdvancement[];
}

interface ProcessMatchResultParams {
  leaderboardId: string;
  matchId: string;
  homeScore: number;
  awayScore: number;
  matches: TournamentMatch[];
}

interface ProcessMatchResultResult {
  matches: TournamentMatch[];
  advancements: TournamentAdvancement[];
  result: TournamentMatchResult;
}

const ALLOWED_BRACKET_SIZES = new Set([2, 4, 8, 16, 32, 64, 128]);

function nowIso(): string {
  return new Date().toISOString();
}

function makeUuid(): string {
  return crypto.randomUUID();
}

function shuffle<T>(items: T[]): T[] {
  const clone = [...items];
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
}

function seededParticipants(
  participants: LeaderboardMember[],
  seedingMode: TournamentSeedingMode,
  manualSeedMemberIds?: string[]
): Array<LeaderboardMember | null> {
  if (seedingMode === 'manual' && manualSeedMemberIds?.length) {
    const byId = new Map(participants.map((member) => [member.id, member]));
    const ordered = manualSeedMemberIds.map((memberId) => byId.get(memberId) || null).filter(Boolean) as LeaderboardMember[];
    const seen = new Set(ordered.map((member) => member.id));
    const remainder = participants.filter((member) => !seen.has(member.id));
    return [...ordered, ...remainder];
  }

  if (seedingMode === 'league_standings') {
    return [...participants];
  }

  return shuffle(participants);
}

function ensureValidBracketSize(bracketSize: number): void {
  if (!ALLOWED_BRACKET_SIZES.has(bracketSize)) {
    throw new Error('Invalid bracket size.');
  }
}

function ensureParticipantCapacity(participantsCount: number, bracketSize: number): void {
  if (participantsCount > bracketSize) {
    throw new Error('Participant count exceeds bracket size.');
  }
}

function cloneMatch(match: TournamentMatch): TournamentMatch {
  return { ...match };
}

export function generateSingleEliminationBracket(params: GenerateBracketParams): GenerateBracketResult {
  const { leaderboardId, participants, bracketSize, seedingMode, manualSeedMemberIds } = params;
  ensureValidBracketSize(bracketSize);
  ensureParticipantCapacity(participants.length, bracketSize);

  const timestamp = nowIso();
  const roundsCount = Math.log2(bracketSize);
  const participantSlots = seededParticipants(participants, seedingMode, manualSeedMemberIds);
  while (participantSlots.length < bracketSize) {
    participantSlots.push(null);
  }

  const rounds: TournamentRound[] = [];
  const roundMatchIds: string[][] = [];

  for (let roundIndex = 1; roundIndex <= roundsCount; roundIndex += 1) {
    const matchCount = bracketSize / Math.pow(2, roundIndex);
    const roundId = makeUuid();
    rounds.push({
      id: roundId,
      leaderboard_id: leaderboardId,
      round_index: roundIndex,
      round_name: roundIndex === roundsCount ? 'Final' : `Round ${roundIndex}`,
      match_count: matchCount,
      created_at: timestamp,
    });

    roundMatchIds.push(Array.from({ length: matchCount }, () => makeUuid()));
  }

  const matches: TournamentMatch[] = [];
  const advancements: TournamentAdvancement[] = [];

  for (let roundIndex = 1; roundIndex <= roundsCount; roundIndex += 1) {
    const round = rounds[roundIndex - 1];
    const matchIds = roundMatchIds[roundIndex - 1];

    for (let matchIndex = 1; matchIndex <= matchIds.length; matchIndex += 1) {
      const id = matchIds[matchIndex - 1];
      const nextRoundIds = roundMatchIds[roundIndex] || null;
      const nextMatchIndex = Math.ceil(matchIndex / 2);
      const nextMatchId = nextRoundIds ? nextRoundIds[nextMatchIndex - 1] : null;
      const nextMatchSlot = nextRoundIds ? (matchIndex % 2 === 1 ? 'home' : 'away') : null;

      let homeMemberId: string | null = null;
      let awayMemberId: string | null = null;
      let winnerMemberId: string | null = null;
      const loserMemberId: string | null = null;
      let state: TournamentMatch['state'] = 'scheduled';

      if (roundIndex === 1) {
        const home = participantSlots[(matchIndex - 1) * 2] || null;
        const away = participantSlots[(matchIndex - 1) * 2 + 1] || null;
        homeMemberId = home?.id || null;
        awayMemberId = away?.id || null;

        if (home && !away) {
          state = 'bye';
          winnerMemberId = home.id;
        } else if (!home && away) {
          state = 'bye';
          winnerMemberId = away.id;
        } else if (!home && !away) {
          state = 'cancelled';
        }
      }

      const match: TournamentMatch = {
        id,
        leaderboard_id: leaderboardId,
        round_id: round.id,
        round_index: roundIndex,
        match_index: matchIndex,
        home_member_id: homeMemberId,
        away_member_id: awayMemberId,
        winner_member_id: winnerMemberId,
        loser_member_id: loserMemberId,
        scheduled_at: null,
        state,
        next_match_id: nextMatchId,
        next_match_slot: nextMatchSlot,
        created_at: timestamp,
        updated_at: timestamp,
      };

      matches.push(match);
    }
  }

  const byId = new Map(matches.map((match) => [match.id, match]));
  for (const match of matches) {
    if (match.state !== 'bye' || !match.winner_member_id || !match.next_match_id || !match.next_match_slot) {
      continue;
    }

    const next = byId.get(match.next_match_id);
    if (!next) {
      continue;
    }

    if (match.next_match_slot === 'home') {
      next.home_member_id = match.winner_member_id;
    } else {
      next.away_member_id = match.winner_member_id;
    }

    next.updated_at = timestamp;
    advancements.push({
      id: makeUuid(),
      leaderboard_id: leaderboardId,
      from_match_id: match.id,
      to_match_id: next.id,
      to_slot: match.next_match_slot,
      advanced_member_id: match.winner_member_id,
      reason: 'bye',
      created_at: timestamp,
    });
  }

  return { rounds, matches, advancements };
}

export function processSingleEliminationMatchResult(params: ProcessMatchResultParams): ProcessMatchResultResult {
  const { leaderboardId, matchId, homeScore, awayScore, matches } = params;

  if (homeScore === awayScore) {
    throw new Error('Draws are not supported in single elimination.');
  }

  const timestamp = nowIso();
  const nextMatches = matches.map(cloneMatch);
  const byId = new Map(nextMatches.map((match) => [match.id, match]));

  const match = byId.get(matchId);
  if (!match) {
    throw new Error('Match not found.');
  }

  if (!match.home_member_id || !match.away_member_id) {
    throw new Error('Both participants must be assigned before recording a result.');
  }

  const winnerMemberId = homeScore > awayScore ? match.home_member_id : match.away_member_id;
  const loserMemberId = winnerMemberId === match.home_member_id ? match.away_member_id : match.home_member_id;

  match.winner_member_id = winnerMemberId;
  match.loser_member_id = loserMemberId;
  match.state = 'completed';
  match.updated_at = timestamp;

  const advancements: TournamentAdvancement[] = [];
  if (match.next_match_id && match.next_match_slot) {
    const next = byId.get(match.next_match_id);
    if (next) {
      if (match.next_match_slot === 'home') {
        next.home_member_id = winnerMemberId;
      } else {
        next.away_member_id = winnerMemberId;
      }
      next.updated_at = timestamp;

      advancements.push({
        id: makeUuid(),
        leaderboard_id: leaderboardId,
        from_match_id: match.id,
        to_match_id: next.id,
        to_slot: match.next_match_slot,
        advanced_member_id: winnerMemberId,
        reason: 'win',
        created_at: timestamp,
      });
    }
  }

  const result: TournamentMatchResult = {
    match_id: match.id,
    home_score: homeScore,
    away_score: awayScore,
    created_at: timestamp,
    updated_at: timestamp,
  };

  return {
    matches: nextMatches,
    advancements,
    result,
  };
}
