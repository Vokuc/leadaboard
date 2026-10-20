import { 
  CompetitionRules, 
  CompetitionStatistic, 
  Fixture, 
  FixtureResult, 
  LeaderboardMember, 
  LeagueStandingRow, 
  Ranking, 
  ScoreEvent 
} from '@/types';

function roundValue(value: number): number {
  return Number.isFinite(value) ? Number(value.toFixed(3)) : 0;
}

function createBaseLeagueRow(member: LeaderboardMember): LeagueStandingRow {
  return {
    member_id: member.id,
    name: member.name,
    avatar_url: member.avatar_url,
    team: member.team,
    notes: member.notes,
    is_active: member.is_active,
    position: 0,
    stats: {},
  };
}

function getStat(row: LeagueStandingRow, key: string): number {
  return row.stats[key] || 0;
}

function setStat(row: LeagueStandingRow, key: string, value: number): void {
  row.stats[key] = roundValue(value);
}

function addStat(row: LeagueStandingRow, key: string, delta: number): void {
  setStat(row, key, getStat(row, key) + delta);
}

function calculateDerivedStatistic(row: LeagueStandingRow, statisticKey: string): number {
  const wins = getStat(row, 'wins');
  const draws = getStat(row, 'draws');
  const losses = getStat(row, 'losses');
  const played = wins + draws + losses;

  switch (statisticKey) {
    case 'played':
      return played;
    case 'goal_difference':
      return getStat(row, 'goals_for') - getStat(row, 'goals_against');
    case 'point_difference':
      return getStat(row, 'points_scored') - getStat(row, 'points_allowed');
    case 'set_difference':
      return getStat(row, 'sets_won') - getStat(row, 'sets_lost');
    case 'win_percentage':
      return played === 0 ? 0 : wins / played;
    case 'average_points':
      return played === 0 ? 0 : getStat(row, 'points') / played;
    case 'kill_death_ratio':
      return getStat(row, 'deaths') === 0 ? getStat(row, 'kills') : getStat(row, 'kills') / getStat(row, 'deaths');
    default:
      return getStat(row, statisticKey);
  }
}

interface HeadToHeadRecord {
  memberId: string;
  points: number;
  goalDiff: number;
  goalsFor: number;
}

/**
 * Calculates mini-table head-to-head records among a group of tied members
 */
function calculateHeadToHead(
  tiedMemberIds: Set<string>,
  fixtures: Fixture[],
  resultsByFixtureId: Map<string, FixtureResult>,
  pointsForWin: number,
  pointsForDraw: number,
  pointsForLoss: number
): Map<string, HeadToHeadRecord> {
  const records = new Map<string, HeadToHeadRecord>();
  for (const id of tiedMemberIds) {
    records.set(id, { memberId: id, points: 0, goalDiff: 0, goalsFor: 0 });
  }

  for (const fixture of fixtures) {
    if (fixture.status !== 'completed') continue;
    if (!tiedMemberIds.has(fixture.home_member_id) || !tiedMemberIds.has(fixture.away_member_id)) {
      continue;
    }

    const res = resultsByFixtureId.get(fixture.id);
    if (!res) continue;

    const homeRec = records.get(fixture.home_member_id)!;
    const awayRec = records.get(fixture.away_member_id)!;

    homeRec.goalsFor += res.home_score;
    homeRec.goalDiff += (res.home_score - res.away_score);
    awayRec.goalsFor += res.away_score;
    awayRec.goalDiff += (res.away_score - res.home_score);

    if (res.home_score > res.away_score) {
      homeRec.points += pointsForWin;
      awayRec.points += pointsForLoss;
    } else if (res.away_score > res.home_score) {
      awayRec.points += pointsForWin;
      homeRec.points += pointsForLoss;
    } else {
      homeRec.points += pointsForDraw;
      awayRec.points += pointsForDraw;
    }
  }

  return records;
}

/**
 * Evaluates full league standings with configurable win/draw/loss points,
 * derived statistics, ordered tie-breakers, and Head-to-Head tie-breaking.
 */
export function evaluateLeagueStandings(params: {
  members: LeaderboardMember[];
  fixtures: Fixture[];
  results: FixtureResult[];
  rules: CompetitionRules;
  competitionStatistics: CompetitionStatistic[];
  scoredStatKey: string;
  allowedStatKey: string;
}): LeagueStandingRow[] {
  const {
    members,
    fixtures,
    results,
    rules,
    competitionStatistics,
    scoredStatKey,
    allowedStatKey,
  } = params;

  const rows = new Map<string, LeagueStandingRow>();
  const enabledStatisticKeys = competitionStatistics
    .filter((statistic) => statistic.is_enabled)
    .sort((left, right) => left.display_order - right.display_order)
    .map((statistic) => statistic.statistic_key);

  for (const member of members) {
    rows.set(member.id, createBaseLeagueRow(member));
  }

  const resultsByFixtureId = new Map(results.map((result) => [result.fixture_id, result]));

  // Calculate base fixture outcomes
  for (const fixture of fixtures) {
    if (fixture.status !== 'completed') continue;
    const result = resultsByFixtureId.get(fixture.id);
    if (!result) continue;

    const homeRow = rows.get(fixture.home_member_id);
    const awayRow = rows.get(fixture.away_member_id);
    if (!homeRow || !awayRow) continue;

    addStat(homeRow, scoredStatKey, result.home_score);
    addStat(homeRow, allowedStatKey, result.away_score);
    addStat(awayRow, scoredStatKey, result.away_score);
    addStat(awayRow, allowedStatKey, result.home_score);

    const { points_for_win, points_for_draw, points_for_loss } = rules.points_config;

    if (result.home_score > result.away_score) {
      addStat(homeRow, 'wins', 1);
      addStat(homeRow, 'points', points_for_win);
      addStat(awayRow, 'losses', 1);
      addStat(awayRow, 'points', points_for_loss);
    } else if (result.away_score > result.home_score) {
      addStat(awayRow, 'wins', 1);
      addStat(awayRow, 'points', points_for_win);
      addStat(homeRow, 'losses', 1);
      addStat(homeRow, 'points', points_for_loss);
    } else {
      addStat(homeRow, 'draws', 1);
      addStat(awayRow, 'draws', 1);
      addStat(homeRow, 'points', points_for_draw);
      addStat(awayRow, 'points', points_for_draw);
    }
  }

  // Calculate derived statistics for each row
  const standings = Array.from(rows.values()).map((row) => {
    for (const statisticKey of enabledStatisticKeys) {
      if (!(statisticKey in row.stats)) {
        setStat(row, statisticKey, calculateDerivedStatistic(row, statisticKey));
      } else {
        setStat(row, statisticKey, row.stats[statisticKey]);
      }
    }

    for (const statistic of competitionStatistics) {
      if (statistic.category === 'derived') {
        setStat(row, statistic.statistic_key, calculateDerivedStatistic(row, statistic.statistic_key));
      }
    }

    return row;
  });

  // Multi-pass comparison with Head-to-Head tie-breaking
  const tieBreakers = rules.tie_breakers && rules.tie_breakers.length > 0
    ? rules.tie_breakers
    : [
        { type: 'points' as const, label: 'Points', direction: rules.ranking_order },
        { type: 'goal_difference' as const, label: 'Goal Difference', direction: 'desc' as const },
        { type: 'goals_for' as const, label: 'Goals For', direction: 'desc' as const },
        { type: 'head_to_head' as const, label: 'Head-to-Head', direction: 'desc' as const },
        { type: 'alphabetical' as const, label: 'Alphabetical', direction: 'asc' as const },
      ];

  // Pre-compute head-to-head records across all participants
  const allMemberIds = new Set(members.map(m => m.id));
  const h2hMap = calculateHeadToHead(
    allMemberIds,
    fixtures,
    resultsByFixtureId,
    rules.points_config.points_for_win,
    rules.points_config.points_for_draw,
    rules.points_config.points_for_loss
  );

  const compareTwoRows = (a: LeagueStandingRow, b: LeagueStandingRow): { diff: number; reason?: string } => {
    for (const rule of tieBreakers) {
      if (rule.type === 'alphabetical') {
        const comp = a.name.localeCompare(b.name);
        if (comp !== 0) {
          const diff = rule.direction === 'desc' ? -comp : comp;
          return { diff, reason: 'Alphabetical order' };
        }
        continue;
      }

      if (rule.type === 'head_to_head') {
        const h2hA = h2hMap.get(a.member_id);
        const h2hB = h2hMap.get(b.member_id);
        if (h2hA && h2hB) {
          // Compare H2H points
          if (h2hA.points !== h2hB.points) {
            return {
              diff: rule.direction === 'asc' ? h2hA.points - h2hB.points : h2hB.points - h2hA.points,
              reason: `Head-to-head points (${h2hA.points} vs ${h2hB.points})`,
            };
          }
          // Compare H2H goal difference
          if (h2hA.goalDiff !== h2hB.goalDiff) {
            return {
              diff: rule.direction === 'asc' ? h2hA.goalDiff - h2hB.goalDiff : h2hB.goalDiff - h2hA.goalDiff,
              reason: `Head-to-head goal difference (${h2hA.goalDiff > 0 ? '+' : ''}${h2hA.goalDiff} vs ${h2hB.goalDiff > 0 ? '+' : ''}${h2hB.goalDiff})`,
            };
          }
          // Compare H2H goals for
          if (h2hA.goalsFor !== h2hB.goalsFor) {
            return {
              diff: rule.direction === 'asc' ? h2hA.goalsFor - h2hB.goalsFor : h2hB.goalsFor - h2hA.goalsFor,
              reason: `Head-to-head goals scored (${h2hA.goalsFor} vs ${h2hB.goalsFor})`,
            };
          }
        }
        continue;
      }

      // Statistic / metric check
      const statKey = rule.statistic_key || (
        rule.type === 'points' ? 'points' :
        rule.type === 'goal_difference' ? 'goal_difference' :
        rule.type === 'goals_for' ? 'goals_for' :
        rule.type === 'goals_against' ? 'goals_against' : rule.type
      );

      const valA = getStat(a, statKey);
      const valB = getStat(b, statKey);

      if (valA !== valB) {
        const dir = rule.direction || 'desc';
        const diff = dir === 'asc' ? valA - valB : valB - valA;
        return {
          diff,
          reason: `${rule.label} (${valA} vs ${valB})`,
        };
      }
    }

    // Ultimate deterministic fallback
    return { diff: a.name.localeCompare(b.name), reason: 'Alphabetical fallback' };
  };

  standings.sort((a, b) => compareTwoRows(a, b).diff);

  standings.forEach((row, index) => {
    row.position = index + 1;
    if (index > 0) {
      const prevRow = standings[index - 1];
      const comparison = compareTwoRows(prevRow, row);
      row.tie_break_explanation = comparison.reason;
    } else {
      row.tie_break_explanation = 'Table leader';
    }
  });

  return standings;
}

/**
 * Evaluates simple points rankings, applying configurable ranking direction
 * (higher-is-better or lower-is-better) and configurable tie-breakers.
 */
export function evaluatePointsRankings(
  members: LeaderboardMember[],
  events: ScoreEvent[],
  rules: CompetitionRules
): Ranking[] {
  const rankingOrder = rules.ranking_order || 'desc';
  const tieBreakers = rules.tie_breakers && rules.tie_breakers.length > 0
    ? rules.tie_breakers
    : [
        { type: 'points' as const, label: 'Points', direction: rankingOrder },
        { type: 'earliest_score' as const, label: 'Earliest Achieved', direction: 'asc' as const },
        { type: 'alphabetical' as const, label: 'Alphabetical', direction: 'asc' as const },
      ];

  const rankings: Ranking[] = members.map((m) => {
    const playerEvents = events.filter((e) => e.member_id === m.id);
    const total_points = playerEvents.reduce((sum, e) => sum + e.points, 0);

    let last_score_at = m.created_at;
    if (playerEvents.length > 0) {
      const times = playerEvents.map((e) => new Date(e.created_at).getTime());
      last_score_at = new Date(Math.max(...times)).toISOString();
    }

    return {
      member_id: m.id,
      leaderboard_id: m.leaderboard_id,
      player_name: m.name,
      player_email: m.email,
      avatar_url: m.avatar_url,
      team: m.team,
      notes: m.notes,
      is_active: m.is_active,
      total_points,
      last_score_at,
      joined_at: m.created_at,
    };
  });

  const compareTwoPointsRankings = (a: Ranking, b: Ranking): { diff: number; reason?: string } => {
    for (const rule of tieBreakers) {
      if (rule.type === 'points') {
        if (a.total_points !== b.total_points) {
          const dir = rules.ranking_order || rule.direction || 'desc';
          const diff = dir === 'asc' ? a.total_points - b.total_points : b.total_points - a.total_points;
          return { diff, reason: `Points (${a.total_points} vs ${b.total_points})` };
        }
        continue;
      }

      if (rule.type === 'earliest_score') {
        const timeA = new Date(a.last_score_at).getTime();
        const timeB = new Date(b.last_score_at).getTime();
        if (timeA !== timeB) {
          const dir = rule.direction || 'asc';
          const diff = dir === 'asc' ? timeA - timeB : timeB - timeA;
          return { diff, reason: 'Earlier score achievement' };
        }
        continue;
      }

      if (rule.type === 'latest_score') {
        const timeA = new Date(a.last_score_at).getTime();
        const timeB = new Date(b.last_score_at).getTime();
        if (timeA !== timeB) {
          const dir = rule.direction || 'desc';
          const diff = dir === 'desc' ? timeB - timeA : timeA - timeB;
          return { diff, reason: 'Latest score achievement' };
        }
        continue;
      }

      if (rule.type === 'alphabetical') {
        const comp = a.player_name.localeCompare(b.player_name);
        if (comp !== 0) {
          const dir = rule.direction || 'asc';
          const diff = dir === 'desc' ? -comp : comp;
          return { diff, reason: 'Alphabetical order' };
        }
        continue;
      }
    }

    // Default fallback to join date then name
    const joinDiff = new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime();
    if (joinDiff !== 0) {
      return { diff: joinDiff, reason: 'Earliest join date' };
    }
    return { diff: a.player_name.localeCompare(b.player_name), reason: 'Alphabetical order' };
  };

  rankings.sort((a, b) => compareTwoPointsRankings(a, b).diff);

  rankings.forEach((r, idx) => {
    r.position = idx + 1;
    if (idx > 0) {
      const prev = rankings[idx - 1];
      r.tie_break_explanation = compareTwoPointsRankings(prev, r).reason;
    } else {
      r.tie_break_explanation = 'Leader';
    }
  });

  return rankings;
}

/**
 * Returns a human-readable list explaining the scoring system and tie-breaker order.
 */
export function explainRankingRules(rules: CompetitionRules): string[] {
  const explanations: string[] = [];

  if (rules.engine === 'league_table') {
    const { points_for_win, points_for_draw, points_for_loss, allow_draws } = rules.points_config;
    if (allow_draws) {
      explanations.push(`Points System: Win = ${points_for_win} pts, Draw = ${points_for_draw} pts, Loss = ${points_for_loss} pts.`);
    } else {
      explanations.push(`Points System: Win = ${points_for_win} pts, Loss = ${points_for_loss} pts (Draws disabled).`);
    }
  } else if (rules.engine === 'simple_points') {
    if (rules.ranking_order === 'asc') {
      explanations.push('Ranking Criteria: Lower score is better (e.g. Golf / Race times).');
    } else {
      explanations.push('Ranking Criteria: Higher score is better.');
    }
    if (!rules.points_config.allow_negative_points) {
      explanations.push('Points Rules: Negative score adjustments are disabled.');
    }
  }

  if (rules.tie_breakers && rules.tie_breakers.length > 0) {
    const steps = rules.tie_breakers.map((tb, idx) => `${idx + 1}. ${tb.label}`);
    explanations.push(`Tie-break Hierarchy: ${steps.join(' → ')}`);
  }

  return explanations;
}
