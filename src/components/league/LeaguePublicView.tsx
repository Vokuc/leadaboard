'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Calendar, Trophy } from 'lucide-react';
import SafeImage from '@/components/SafeImage';
import { isSupabaseConfigured, supabase } from '@/lib/db';
import { LeagueService } from '@/lib/league/service';
import { CompetitionConfig, CompetitionRules, CompetitionStatistic, Leaderboard, LeagueStandingRow } from '@/types';
import { CompetitionRulesService } from '@/lib/competition/rules/service';
import { RulesExplainerCard } from '@/components/competition/RulesExplainerCard';

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
  const [rules, setRules] = useState<CompetitionRules | null>(null);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }
    try {
      const [nextStatistics, nextStandings, nextRecentResults, nextRules] = await Promise.all([
        LeagueService.getCompetitionStatistics(leaderboard.id),
        LeagueService.getLeagueStandings(leaderboard.id),
        LeagueService.getRecentResults(leaderboard.id),
        CompetitionRulesService.getRules(leaderboard.id),
      ]);

      setStatistics(nextStatistics.filter((item) => item.is_enabled).sort((a, b) => a.display_order - b.display_order));
      setStandings(nextStandings);
      setRecentResults(nextRecentResults);
      setRules(nextRules);
    } catch (err) {
      console.error('Error loading league data:', err);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [leaderboard.id]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadData();
    });
  }, [loadData]);

  // Real-time updates for live fixtures & results
  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      const channel = supabase
        .channel(`public:league:${leaderboard.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'fixtures', filter: `leaderboard_id=eq.${leaderboard.id}` },
          () => {
            void loadData(true);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'fixture_results' },
          () => {
            void loadData(true);
          }
        )
        .subscribe();

      return () => {
        channel.unsubscribe();
      };
    }

    // Demo Mode: Binds to storage updates across browser tabs
    const handleStorageUpdate = (event: StorageEvent) => {
      if (event.key && event.key.startsWith('leaderboardos_')) {
        void loadData(true);
      }
    };

    window.addEventListener('storage', handleStorageUpdate);
    const interval = window.setInterval(() => {
      void loadData(true);
    }, 3000);

    return () => {
      window.removeEventListener('storage', handleStorageUpdate);
      window.clearInterval(interval);
    };
  }, [leaderboard.id, loadData]);

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
                      <div className="flex flex-wrap items-center gap-2">
                        {row.team && <span className="text-[11px] text-neutral-500">{row.team}</span>}
                        {row.tie_break_explanation && row.position > 1 && (
                          <span className="text-[10px] text-violet-400 font-mono bg-violet-500/10 border border-violet-500/20 px-1.5 py-0.2 rounded" title={`Tie-break explanation: ${row.tie_break_explanation}`}>
                            {row.tie_break_explanation}
                          </span>
                        )}
                      </div>
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

      {rules && (
        <RulesExplainerCard rules={rules} />
      )}

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
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-white">{item.homeMember?.name} {item.result?.home_score} - {item.result?.away_score} {item.awayMember?.name}</div>
                    {item.result?.status === 'disputed' && (
                      <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/20">Under Dispute</span>
                    )}
                    {item.result?.status === 'voided' && (
                      <span className="rounded bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-400 border border-red-500/20">Voided</span>
                    )}
                  </div>
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