import {
  CompetitionRankingRule,
  CompetitionStatistic,
  Fixture,
  FixtureResult,
  LeaderboardMember,
  LeagueSettings,
  LeagueStandingRow,
} from '@/types';

function roundValue(value: number): number {
  return Number.isFinite(value) ? Number(value.toFixed(3)) : 0;
}

function createBaseRow(member: LeaderboardMember): LeagueStandingRow {
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

function compareRows(a: LeagueStandingRow, b: LeagueStandingRow, rankingRules: CompetitionRankingRule[]): number {
  for (const rule of rankingRules.sort((left, right) => left.priority - right.priority)) {
    if (rule.criterion_type === 'alphabetical') {
      const comparison = a.name.localeCompare(b.name);
      if (comparison !== 0) {
        return rule.direction === 'asc' ? comparison : -comparison;
      }
      continue;
    }

    const key = rule.statistic_key;
    if (!key) {
      continue;
    }

    const aValue = getStat(a, key);
    const bValue = getStat(b, key);
    if (aValue !== bValue) {
      return rule.direction === 'asc' ? aValue - bValue : bValue - aValue;
    }
  }

  return a.name.localeCompare(b.name);
}

export function buildLeagueStandings(params: {
  members: LeaderboardMember[];
  fixtures: Fixture[];
  results: FixtureResult[];
  leagueSettings: LeagueSettings;
  competitionStatistics: CompetitionStatistic[];
  rankingRules: CompetitionRankingRule[];
  scoredStatKey: string;
  allowedStatKey: string;
}): LeagueStandingRow[] {
  const {
    members,
    fixtures,
    results,
    leagueSettings,
    competitionStatistics,
    rankingRules,
    scoredStatKey,
    allowedStatKey,
  } = params;

  const rows = new Map<string, LeagueStandingRow>();
  const enabledStatisticKeys = competitionStatistics
    .filter((statistic) => statistic.is_enabled)
    .sort((left, right) => left.display_order - right.display_order)
    .map((statistic) => statistic.statistic_key);

  for (const member of members) {
    rows.set(member.id, createBaseRow(member));
  }

  const resultsByFixtureId = new Map(results.map((result) => [result.fixture_id, result]));

  for (const fixture of fixtures) {
    if (fixture.status !== 'completed') {
      continue;
    }

    const result = resultsByFixtureId.get(fixture.id);
    if (!result) {
      continue;
    }

    const homeRow = rows.get(fixture.home_member_id);
    const awayRow = rows.get(fixture.away_member_id);
    if (!homeRow || !awayRow) {
      continue;
    }

    addStat(homeRow, scoredStatKey, result.home_score);
    addStat(homeRow, allowedStatKey, result.away_score);
    addStat(awayRow, scoredStatKey, result.away_score);
    addStat(awayRow, allowedStatKey, result.home_score);

    if (result.home_score > result.away_score) {
      addStat(homeRow, 'wins', 1);
      addStat(homeRow, 'points', leagueSettings.points_for_win);
      addStat(awayRow, 'losses', 1);
      addStat(awayRow, 'points', leagueSettings.points_for_loss);
    } else if (result.away_score > result.home_score) {
      addStat(awayRow, 'wins', 1);
      addStat(awayRow, 'points', leagueSettings.points_for_win);
      addStat(homeRow, 'losses', 1);
      addStat(homeRow, 'points', leagueSettings.points_for_loss);
    } else {
      addStat(homeRow, 'draws', 1);
      addStat(awayRow, 'draws', 1);
      addStat(homeRow, 'points', leagueSettings.points_for_draw);
      addStat(awayRow, 'points', leagueSettings.points_for_draw);
    }
  }

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

  standings.sort((left, right) => compareRows(left, right, rankingRules));
  standings.forEach((row, index) => {
    row.position = index + 1;
  });

  return standings;
}