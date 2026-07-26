'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Calendar, Trophy } from 'lucide-react';
import SafeImage from '@/components/SafeImage';
import { LeagueService } from '@/lib/league/service';
import { CompetitionConfig, CompetitionStatistic, Leaderboard, LeagueStandingRow } from '@/types';

interface LeaguePublicViewProps {
  leaderboard: Leaderboard;
  competitionConfig: CompetitionConfig;
}

function formatValue(value: number): string {
  if (Number.isInteger(value)) {
    return value.toString();
  }

  return value.toFixed(2).replace(/\.00$/, '');
}

export default function LeaguePublicView({ leaderboard, competitionConfig }: LeaguePublicViewProps) {
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState<CompetitionStatistic[]>([]);
  const [standings, setStandings] = useState<LeagueStandingRow[]>([]);
  const [recentResults, setRecentResults] = useState<Array<Awaited<ReturnType<typeof LeagueService.getRecentResults>>[number]>>([]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const [nextStatistics, nextStandings, nextRecentResults] = await Promise.all([
          LeagueService.getCompetitionStatistics(leaderboard.id),
          LeagueService.getLeagueStandings(leaderboard.id),
          LeagueService.getRecentResults(leaderboard.id),
        ]);

        if (!mounted) {
          return;
        }

        setStatistics(nextStatistics.filter((item) => item.is_enabled).sort((a, b) => a.display_order - b.display_order));
        setStandings(nextStandings);
        setRecentResults(nextRecentResults);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, [leaderboard.id]);

  const topTeam = standings[0]?.name || 'No standings yet';
  const visibleColumns = useMemo(() => statistics.slice(0, 8), [statistics]);

  if (loading) {
    return <div className="glass rounded-2xl p-6 text-sm text-neutral-400">Loading league table...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="glass rounded-2xl p-5">
          <div className="text-[10px] uppercase tracking-widest text-neutral-500">Engine</div>
          <div className="mt-2 text-lg font-bold text-white">League Table</div>
          <div className="mt-1 text-xs text-neutral-400">{competitionConfig.entity_type === 'team' ? 'Club standings' : 'Individual standings'}</div>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="text-[10px] uppercase tracking-widest text-neutral-500">Leader</div>
          <div className="mt-2 text-lg font-bold text-white">{topTeam}</div>
          <div className="mt-1 text-xs text-neutral-400">Top of the table</div>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="text-[10px] uppercase tracking-widest text-neutral-500">Results</div>
          <div className="mt-2 text-lg font-bold text-white">{recentResults.length}</div>
          <div className="mt-1 text-xs text-neutral-400">Completed fixtures recorded</div>
        </div>
      </div>

      <div className="glass overflow-x-auto rounded-2xl border border-white/5 shadow-xl">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-neutral-950/65 text-neutral-450 uppercase font-bold tracking-wider">
            <tr>
              <th className="px-6 py-3.5">Pos</th>
              <th className="px-6 py-3.5">{competitionConfig.entity_type === 'team' ? 'Team' : 'Competitor'}</th>
              {visibleColumns.map((column) => (
                <th key={column.id} className="px-6 py-3.5">{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 bg-black/20">
            {standings.map((row) => (
              <tr key={row.member_id}>
                <td className="px-6 py-4 font-bold text-violet-300">{row.position}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <SafeImage
                      src={row.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(row.name)}`}
                      alt={row.name}
                      width={32}
                      height={32}
                      className="h-8 w-8 rounded-lg border border-white/5 object-cover"
                    />
                    <div>
                      <div className="font-bold text-white">{row.name}</div>
                      {row.team && <div className="text-[11px] text-neutral-500">{row.team}</div>}
                    </div>
                  </div>
                </td>
                {visibleColumns.map((column) => (
                  <td key={column.id} className="px-6 py-4 text-neutral-300">{formatValue(row.stats[column.statistic_key] || 0)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Trophy className="h-4 w-4 text-violet-400" /> League Notes
          </div>
          <p className="mt-4 text-sm leading-relaxed text-neutral-300">{leaderboard.description || 'This league tracks standings from recorded fixtures. Table order follows the configured ranking criteria for this template.'}</p>
        </div>
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Activity className="h-4 w-4 text-cyan-400" /> Latest Results
          </div>
          <div className="mt-4 space-y-3 text-xs">
            {recentResults.length === 0 ? (
              <div className="text-neutral-500">No completed fixtures yet.</div>
            ) : (
              recentResults.slice(0, 8).map((item) => (
                <div key={item.fixture.id} className="rounded-xl border border-white/5 bg-black/25 px-3 py-3">
                  <div className="font-semibold text-white">{item.homeMember?.name} {item.result?.home_score} - {item.result?.away_score} {item.awayMember?.name}</div>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-neutral-500">
                    <Calendar className="h-3.5 w-3.5" />
                    {item.fixture.round_name || 'Fixture'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}