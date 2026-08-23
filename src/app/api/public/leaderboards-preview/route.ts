import { NextResponse } from 'next/server';
import { createSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server';

type PreviewTab = 'gaming' | 'sports' | 'workplace';
type LifecycleBucket = 'created' | 'upcoming' | 'completed';

interface LeaderboardRow {
  id: string;
  name: string;
  slug: string;
  competition_type: string;
  status: 'active' | 'archived';
  created_at: string;
}

interface SeasonRow {
  leaderboard_id: string;
  name: string;
  start_date: string;
  end_date: string | null;
}

interface RankingRow {
  leaderboard_id: string;
  player_name: string;
  avatar_url: string | null;
  team: string | null;
  total_points: number | null;
}

interface RuleRow {
  leaderboard_id: string;
  event_name: string;
  points: number;
}

const TAB_TYPES: Record<PreviewTab, string[]> = {
  gaming: ['gaming'],
  sports: ['sports', 'fitness'],
  workplace: ['workplace', 'education', 'reading', 'custom'],
};

function getLifecycle(leaderboard: LeaderboardRow, season: SeasonRow | null, now: Date): LifecycleBucket {
  if (leaderboard.status === 'archived') {
    return 'completed';
  }

  if (season?.end_date && new Date(season.end_date) < now) {
    return 'completed';
  }

  if (season?.start_date && new Date(season.start_date) > now) {
    return 'upcoming';
  }

  return 'created';
}

function getScoreSuffix(tab: PreviewTab): string {
  if (tab === 'gaming') {
    return 'XP';
  }
  if (tab === 'sports') {
    return 'pts';
  }
  return 'pts';
}

function ruleSummary(rules: RuleRow[]): string {
  if (rules.length === 0) {
    return 'Scoring rules can be customized per leaderboard.';
  }

  const topTwo = rules.slice(0, 2).map((item) => {
    const points = item.points > 0 ? `+${item.points}` : `${item.points}`;
    return `${item.event_name} (${points})`;
  });

  return topTwo.join(' | ');
}

export async function GET() {
  try {
    if (!isSupabaseServerConfigured) {
      return NextResponse.json({ tabs: {} });
    }

    const supabase = await createSupabaseServerClient();
    const allTypes = Array.from(new Set(Object.values(TAB_TYPES).flat()));

    const { data: boards, error: boardsError } = await supabase
      .from('leaderboards')
      .select('id,name,slug,competition_type,status,created_at')
      .eq('visibility', 'public')
      .in('competition_type', allTypes)
      .order('updated_at', { ascending: false })
      .limit(90);

    if (boardsError) {
      throw boardsError;
    }

    const leaderboardRows = (boards || []) as LeaderboardRow[];
    if (leaderboardRows.length === 0) {
      return NextResponse.json({ tabs: {} });
    }

    const leaderboardIds = leaderboardRows.map((row) => row.id);

    const [{ data: seasons }, { data: rankings }, { data: rules }] = await Promise.all([
      supabase
        .from('seasons')
        .select('leaderboard_id,name,start_date,end_date')
        .in('leaderboard_id', leaderboardIds)
        .order('start_date', { ascending: false }),
      supabase
        .from('leaderboard_rankings')
        .select('leaderboard_id,player_name,avatar_url,team,total_points')
        .in('leaderboard_id', leaderboardIds),
      supabase
        .from('scoring_rules')
        .select('leaderboard_id,event_name,points')
        .in('leaderboard_id', leaderboardIds)
        .order('created_at', { ascending: false }),
    ]);

    const seasonByBoard = new Map<string, SeasonRow>();
    for (const season of (seasons || []) as SeasonRow[]) {
      if (!seasonByBoard.has(season.leaderboard_id)) {
        seasonByBoard.set(season.leaderboard_id, season);
      }
    }

    const rankingsByBoard = new Map<string, RankingRow[]>();
    for (const ranking of (rankings || []) as RankingRow[]) {
      const existing = rankingsByBoard.get(ranking.leaderboard_id) || [];
      existing.push(ranking);
      rankingsByBoard.set(ranking.leaderboard_id, existing);
    }

    const rulesByBoard = new Map<string, RuleRow[]>();
    for (const rule of (rules || []) as RuleRow[]) {
      const existing = rulesByBoard.get(rule.leaderboard_id) || [];
      existing.push(rule);
      rulesByBoard.set(rule.leaderboard_id, existing);
    }

    const now = new Date();
    const tabs: Partial<Record<PreviewTab, unknown>> = {};

    (Object.keys(TAB_TYPES) as PreviewTab[]).forEach((tab) => {
      const tabBoards = leaderboardRows.filter((board) => TAB_TYPES[tab].includes(board.competition_type));

      const grouped: Record<LifecycleBucket, LeaderboardRow[]> = {
        upcoming: [],
        created: [],
        completed: [],
      };

      for (const board of tabBoards) {
        const lifecycle = getLifecycle(board, seasonByBoard.get(board.id) || null, now);
        grouped[lifecycle].push(board);
      }

      const selected = grouped.upcoming[0] || grouped.created[0] || grouped.completed[0] || null;
      if (!selected) {
        return;
      }

      const lifecycle = getLifecycle(selected, seasonByBoard.get(selected.id) || null, now);
      const boardRankings = (rankingsByBoard.get(selected.id) || [])
        .sort((a, b) => Number(b.total_points || 0) - Number(a.total_points || 0))
        .slice(0, 3);

      const players = boardRankings.map((row, index) => ({
        rank: index + 1,
        name: row.player_name,
        score: Number(row.total_points || 0),
        details: row.team || 'Active competitor',
        avatar: row.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(row.player_name)}`,
        team: row.team,
      }));

      const season = seasonByBoard.get(selected.id);
      const lifecycleLabel = lifecycle;

      tabs[tab] = {
        title: selected.name,
        rule: ruleSummary(rulesByBoard.get(selected.id) || []),
        scoreSuffix: getScoreSuffix(tab),
        players,
        lifecycleLabel,
        seasonLabel: season?.name || 'Season not set',
      };
    });

    return NextResponse.json({ tabs });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load public leaderboard previews.';
    return NextResponse.json({ error: message, tabs: {} }, { status: 200 });
  }
}
