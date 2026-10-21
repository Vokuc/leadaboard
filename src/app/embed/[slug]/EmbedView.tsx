'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { DatabaseService, isSupabaseConfigured, supabase } from '@/lib/db';
import { LeagueService } from '@/lib/league/service';
import { TournamentService } from '@/lib/tournament/service';
import {
  CompetitionConfig,
  Leaderboard,
  Season,
  Ranking,
  LeagueStandingRow,
  TournamentBracketView,
} from '@/types';
import { Trophy } from 'lucide-react';
import SafeImage from '@/components/SafeImage';
import { useSearchParams } from 'next/navigation';

export interface EmbedViewInitialData {
  leaderboard: Leaderboard;
  season: Season | null;
  rankings: Ranking[];
  competitionConfig: CompetitionConfig | null;
}

interface EmbedViewProps {
  slug: string;
  initialData: EmbedViewInitialData | null;
}

export default function EmbedView({ slug, initialData }: EmbedViewProps) {
  const searchParams = useSearchParams();
  const theme = searchParams.get('theme') || 'dark';

  const [leaderboard, setLeaderboard] = useState<Leaderboard | null>(
    initialData?.leaderboard ?? null,
  );
  const [season, setSeason] = useState<Season | null>(initialData?.season ?? null);
  const [rankings, setRankings] = useState<Ranking[]>(initialData?.rankings ?? []);
  const [competitionConfig, setCompetitionConfig] = useState<CompetitionConfig | null>(
    initialData?.competitionConfig ?? null,
  );
  const [leagueStandings, setLeagueStandings] = useState<LeagueStandingRow[]>([]);
  const [tournamentBracket, setTournamentBracket] = useState<TournamentBracketView | null>(null);
  const [loading, setLoading] = useState(!initialData);

  const loadData = useCallback(
    async (isSilent = false) => {
      if (!slug) return;
      if (!isSilent) setLoading(true);
      try {
        const lb = await DatabaseService.getLeaderboardBySlug(slug);
        if (!lb) {
          setLoading(false);
          return;
        }
        setLeaderboard(lb);

        const config = await LeagueService.getCompetitionConfig(lb.id);
        setCompetitionConfig(config);

        const seas = await DatabaseService.getSeasons(lb.id);
        if (seas.length > 0) setSeason(seas[0]);

        if (config?.engine_type === 'league_table') {
          const standings = await LeagueService.getLeagueStandings(lb.id);
          setLeagueStandings(standings);
        } else if (config?.engine_type === 'tournament') {
          const bracket = await TournamentService.getBracketView(lb.id);
          setTournamentBracket(bracket);
        } else {
          const ranks = await DatabaseService.getRankings(lb.id);
          setRankings(ranks);
        }
      } catch (err) {
        console.error('Error loading embed data:', err);
      } finally {
        if (!isSilent) setLoading(false);
      }
    },
    [slug],
  );

  useEffect(() => {
    queueMicrotask(() => {
      // If we have initial data, we still need to load engine-specific state (league standings or tournament bracket)
      if (initialData?.competitionConfig?.engine_type === 'league_table' || initialData?.competitionConfig?.engine_type === 'tournament') {
        void loadData(true);
      } else if (!initialData) {
        void loadData();
      }
    });
  }, [initialData, loadData]);

  // Real-time subscriptions
  useEffect(() => {
    if (!leaderboard) return;

    if (isSupabaseConfigured && supabase) {
      const channel = supabase.channel(`public:embed:${leaderboard.id}`);

      if (competitionConfig?.engine_type === 'tournament') {
        channel
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'tournament_matches', filter: `leaderboard_id=eq.${leaderboard.id}` },
            () => { void loadData(true); }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'tournament_match_results' },
            () => { void loadData(true); }
          );
      } else if (competitionConfig?.engine_type === 'league_table') {
        channel
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'fixtures', filter: `leaderboard_id=eq.${leaderboard.id}` },
            () => { void loadData(true); }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'fixture_results' },
            () => { void loadData(true); }
          );
      } else {
        channel.on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'score_events', filter: `leaderboard_id=eq.${leaderboard.id}` },
          () => { void loadData(true); }
        );
      }

      channel.subscribe();

      return () => {
        channel.unsubscribe();
      };
    } else {
      // Demo Mode: Binds to storage updates across browser tabs
      const handleStorageUpdate = (e: StorageEvent) => {
        if (e.key && e.key.startsWith('leaderboardos_')) {
          void loadData(true);
        }
      };
      window.addEventListener('storage', handleStorageUpdate);
      const interval = setInterval(() => {
        void loadData(true);
      }, 4000);

      return () => {
        window.removeEventListener('storage', handleStorageUpdate);
        clearInterval(interval);
      };
    }
  }, [leaderboard, competitionConfig, loadData]);

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme === 'light' ? 'bg-white text-neutral-400' : 'bg-transparent text-neutral-400'}`}>
        <Trophy className="w-6 h-6 text-violet-500 animate-bounce" />
      </div>
    );
  }

  if (!leaderboard) {
    return (
      <div className={`min-h-screen flex items-center justify-center text-center p-4 ${theme === 'light' ? 'bg-white text-neutral-800' : 'bg-transparent text-white'}`}>
        <p className="text-sm font-medium">Leaderboard not found or private.</p>
      </div>
    );
  }

  const isLight = theme === 'light';

  return (
    <div className={`flex flex-col min-h-screen ${isLight ? 'bg-white text-neutral-900' : 'bg-black/40 backdrop-blur-md text-white'} overflow-hidden text-xs`}>
      {/* Header */}
      <header className={`p-3 sm:p-4 border-b ${isLight ? 'border-neutral-200 bg-neutral-50/50' : 'border-white/10 bg-neutral-950/40'} flex flex-col gap-1 shrink-0`}>
        <div className="flex justify-between items-center gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="font-bold text-sm sm:text-base truncate">{leaderboard.name}</h1>
            {competitionConfig?.engine_type === 'league_table' ? (
              <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-widest bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20 shrink-0">
                League
              </span>
            ) : competitionConfig?.engine_type === 'tournament' ? (
              <span className="text-[9px] font-bold text-violet-400 uppercase tracking-widest bg-violet-500/10 px-1.5 py-0.5 rounded border border-violet-500/20 shrink-0">
                Bracket
              </span>
            ) : null}
          </div>
          {season && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider shrink-0 ${isLight ? 'bg-neutral-100 text-neutral-600' : 'bg-white/10 text-neutral-300'}`}>
              {season.name}
            </span>
          )}
        </div>
        {leaderboard.description && (
          <p className={`text-[11px] truncate ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
            {leaderboard.description}
          </p>
        )}
      </header>

      {/* Main Content Branch by Engine Type */}
      <main className="flex-1 overflow-y-auto p-0 flex flex-col">
        {competitionConfig?.engine_type === 'league_table' ? (
          /* ─── League Standings Table ────────────────────────────────────── */
          <div className="w-full overflow-x-auto">
            <table className="min-w-full text-xs text-left">
              <thead className={`sticky top-0 ${isLight ? 'bg-neutral-100 text-neutral-600 border-b border-neutral-200' : 'bg-neutral-900/90 text-neutral-400 border-b border-white/5'} uppercase font-bold tracking-wider text-[9px]`}>
                <tr>
                  <th scope="col" className="px-2.5 py-2 w-8 text-center">#</th>
                  <th scope="col" className="px-3 py-2">Club / Competitor</th>
                  <th scope="col" className="px-2 py-2 text-center" title="Matches Played">P</th>
                  <th scope="col" className="px-2 py-2 text-center" title="Won">W</th>
                  <th scope="col" className="px-2 py-2 text-center" title="Drawn">D</th>
                  <th scope="col" className="px-2 py-2 text-center" title="Lost">L</th>
                  <th scope="col" className="px-2 py-2 text-center" title="Goal/Point Difference">GD</th>
                  <th scope="col" className="px-3 py-2 text-right font-black" title="Total Points">Pts</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isLight ? 'divide-neutral-100' : 'divide-white/5'}`}>
                {leagueStandings.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-neutral-500">
                      No league standings recorded yet.
                    </td>
                  </tr>
                ) : (
                  leagueStandings.map((row) => {
                    const played = row.stats.played ?? ((row.stats.wins || 0) + (row.stats.draws || 0) + (row.stats.losses || 0));
                    const gd = row.stats.goal_difference ?? row.stats.point_difference ?? row.stats.set_difference ?? 0;
                    const points = row.stats.points ?? 0;

                    return (
                      <tr key={row.member_id} className={`transition-colors ${isLight ? 'hover:bg-neutral-50' : 'hover:bg-white/5'}`}>
                        <td className="px-2.5 py-2 text-center font-bold">
                          <span className={`${
                            row.position === 1 ? 'text-amber-500' :
                            row.position === 2 ? 'text-neutral-400' :
                            row.position === 3 ? 'text-amber-700' :
                            isLight ? 'text-neutral-400' : 'text-neutral-500'
                          }`}>
                            {row.position}
                          </span>
                        </td>
                        <td className="px-3 py-2 flex items-center gap-2">
                          <SafeImage
                            src={row.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(row.name)}`}
                            alt={row.name}
                            width={20}
                            height={20}
                            className="h-5 w-5 rounded border border-white/10 object-cover shrink-0"
                          />
                          <span className="font-semibold truncate max-w-[130px] sm:max-w-[200px]">
                            {row.name}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-center text-neutral-400">{played}</td>
                        <td className="px-2 py-2 text-center text-emerald-400 font-semibold">{row.stats.wins || 0}</td>
                        <td className="px-2 py-2 text-center text-neutral-400">{row.stats.draws || 0}</td>
                        <td className="px-2 py-2 text-center text-rose-400">{row.stats.losses || 0}</td>
                        <td className="px-2 py-2 text-center text-neutral-400">
                          {gd > 0 ? `+${gd}` : gd}
                        </td>
                        <td className={`px-3 py-2 text-right font-black ${isLight ? 'text-neutral-900' : 'text-white'}`}>
                          {points}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : competitionConfig?.engine_type === 'tournament' ? (
          /* ─── Compact Tournament Bracket View (Horizontally Scrollable) ─── */
          <div className="flex-1 flex flex-col p-3 overflow-hidden">
            {tournamentBracket?.champion && (
              <div className={`mb-3 px-3 py-2 rounded-xl flex items-center gap-2 border text-xs font-semibold ${
                isLight
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              }`}>
                <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="truncate">Champion: <strong>{tournamentBracket.champion.name}</strong></span>
              </div>
            )}

            {!tournamentBracket || tournamentBracket.rounds.length === 0 ? (
              <div className="flex-1 flex items-center justify-center p-6 text-center text-neutral-500 text-xs">
                Tournament bracket not yet generated.
              </div>
            ) : (
              <div className="flex-1 overflow-x-auto pb-3">
                <div className="flex gap-4 min-w-max h-full py-1">
                  {tournamentBracket.rounds.map((roundView) => (
                    <div
                      key={roundView.round.id}
                      className="w-48 sm:w-56 shrink-0 flex flex-col"
                    >
                      <div className={`text-[10px] uppercase font-bold tracking-wider px-2 py-1 mb-2 rounded border ${
                        isLight
                          ? 'bg-neutral-100 text-neutral-600 border-neutral-200'
                          : 'bg-neutral-900 text-neutral-400 border-white/5'
                      }`}>
                        {roundView.round.round_name}
                      </div>

                      <div className="flex-1 flex flex-col justify-around gap-2.5">
                        {roundView.matches.map((node) => {
                          const isCompleted = node.match.state === 'completed';
                          const isHomeWinner = isCompleted && node.match.winner_member_id === node.homeMember?.id;
                          const isAwayWinner = isCompleted && node.match.winner_member_id === node.awayMember?.id;

                          return (
                            <div
                              key={node.match.id}
                              className={`p-2 rounded-xl border text-[11px] flex flex-col gap-1 transition-all ${
                                isLight
                                  ? 'bg-neutral-50 border-neutral-200 shadow-sm'
                                  : 'bg-neutral-950/70 border-white/10'
                              }`}
                            >
                              {/* Home Participant */}
                              <div className={`flex justify-between items-center gap-1.5 ${isHomeWinner ? 'font-bold text-emerald-400' : ''}`}>
                                <span className="truncate max-w-[120px]">
                                  {node.homeMember?.name || 'TBD'}
                                </span>
                                <span className="font-mono text-[10px] shrink-0 font-bold">
                                  {node.result ? node.result.home_score : '-'}
                                </span>
                              </div>

                              <div className={`border-t ${isLight ? 'border-neutral-200' : 'border-white/5'}`} />

                              {/* Away Participant */}
                              <div className={`flex justify-between items-center gap-1.5 ${isAwayWinner ? 'font-bold text-emerald-400' : ''}`}>
                                <span className="truncate max-w-[120px]">
                                  {node.awayMember?.name || 'TBD'}
                                </span>
                                <span className="font-mono text-[10px] shrink-0 font-bold">
                                  {node.result ? node.result.away_score : '-'}
                                </span>
                              </div>

                              {node.match.state === 'live' && (
                                <div className="mt-1 flex items-center gap-1 text-[9px] text-rose-400 font-bold uppercase tracking-wider">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" /> Live
                                </div>
                              )}

                              {node.match.scheduled_at && node.match.state === 'scheduled' && (
                                <div className="mt-1 flex items-center justify-between text-[9px] text-neutral-400">
                                  <span>{new Date(node.match.scheduled_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                  {node.match.venue_name && <span className="text-emerald-400 font-medium truncate max-w-[80px]">{node.match.venue_name}</span>}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ─── Simple Points Leaderboard Table ───────────────────────────── */
          <div className="w-full overflow-x-auto">
            <table className="min-w-full text-xs text-left">
              <thead className={`sticky top-0 ${isLight ? 'bg-neutral-50 text-neutral-500 border-b border-neutral-200' : 'bg-neutral-900/90 text-neutral-400 border-b border-white/5'} uppercase font-bold tracking-wider text-[9px]`}>
                <tr>
                  <th scope="col" className="px-3 py-2 w-10 text-center">#</th>
                  <th scope="col" className="px-3 py-2">Competitor</th>
                  <th scope="col" className="px-3 py-2 text-right">Pts</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isLight ? 'divide-neutral-100' : 'divide-white/5'}`}>
                {rankings.filter((r) => r.is_active).length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-neutral-500">
                      No active competitors.
                    </td>
                  </tr>
                ) : (
                  rankings.filter((r) => r.is_active).slice(0, 15).map((r, idx) => {
                    const rank = idx + 1;
                    return (
                      <tr key={r.member_id} className={`transition-colors ${isLight ? 'hover:bg-neutral-50' : 'hover:bg-white/5'}`}>
                        <td className="px-3 py-2.5 text-center font-bold">
                          <span className={`${
                            rank === 1 ? 'text-amber-500' :
                            rank === 2 ? 'text-neutral-400' :
                            rank === 3 ? 'text-amber-700' :
                            isLight ? 'text-neutral-400' : 'text-neutral-500'
                          }`}>
                            {rank}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 flex items-center gap-2">
                          <SafeImage
                            src={r.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(r.player_name)}`}
                            alt={r.player_name}
                            width={20}
                            height={20}
                            className="h-5 w-5 rounded border border-white/10 object-cover shrink-0"
                          />
                          <span className="font-semibold truncate max-w-[140px] sm:max-w-[200px]">
                            {r.player_name}
                          </span>
                        </td>
                        <td className={`px-3 py-2.5 text-right font-extrabold ${isLight ? 'text-neutral-800' : 'text-neutral-200'}`}>
                          {r.total_points.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className={`p-2.5 text-center border-t ${isLight ? 'border-neutral-200 bg-neutral-50' : 'border-white/10 bg-black/60'} shrink-0`}>
        <a
          href={`/leaderboards/${leaderboard.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`text-[9px] font-semibold flex items-center justify-center gap-1.5 transition-colors ${isLight ? 'text-neutral-500 hover:text-violet-600' : 'text-neutral-500 hover:text-white'}`}
        >
          <Trophy className="w-3 h-3 text-violet-500" />
          Powered by LeaderboardOS
        </a>
      </footer>
    </div>
  );
}

