'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Calendar, Crown, Swords, Trophy } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '@/lib/db';
import { TournamentService } from '@/lib/tournament/service';
import { CompetitionConfig, Leaderboard, TournamentBracketView } from '@/types';
import { ShareTriggerButton } from '@/components/sharing/ShareTriggerButton';

interface TournamentPublicViewProps {
  leaderboard: Leaderboard;
  competitionConfig: CompetitionConfig;
}

export default function TournamentPublicView({ leaderboard, competitionConfig }: TournamentPublicViewProps) {
  const [loading, setLoading] = useState(true);
  const [bracketView, setBracketView] = useState<TournamentBracketView | null>(null);
  const [recentResults, setRecentResults] = useState<Array<Awaited<ReturnType<typeof TournamentService.getRecentResults>>[number]>>([]);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }

    try {
      const [nextBracketView, nextRecentResults] = await Promise.all([
        TournamentService.getBracketView(leaderboard.id),
        TournamentService.getRecentResults(leaderboard.id),
      ]);

      setBracketView(nextBracketView);
      setRecentResults(nextRecentResults);
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

  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      const channel = supabase
        .channel(`public:tournament:${leaderboard.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'tournament_matches', filter: `leaderboard_id=eq.${leaderboard.id}` },
          () => {
            void loadData(true);
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'tournament_match_results' },
          () => {
            void loadData(true);
          }
        )
        .subscribe();

      return () => {
        channel.unsubscribe();
      };
    }

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

  const rounds = useMemo(() => bracketView?.rounds || [], [bracketView]);
  const currentRound = useMemo(() => {
    return rounds.find((round) => round.matches.some((item) => item.match.state !== 'completed' && item.match.state !== 'cancelled')) || rounds[0] || null;
  }, [rounds]);

  const allMatches = useMemo(() => rounds.flatMap((round) => round.matches), [rounds]);
  const upcomingMatches = allMatches.filter((item) => item.match.state === 'scheduled' || item.match.state === 'live').slice(0, 8);

  if (loading) {
    return <div className="glass rounded-2xl p-6 text-sm text-neutral-400">Loading tournament bracket...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="glass rounded-2xl p-5">
          <div className="text-[10px] uppercase tracking-widest text-neutral-500">Engine</div>
          <div className="mt-2 text-lg font-bold text-white">Tournament</div>
          <div className="mt-1 text-xs text-neutral-400">Single elimination</div>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="text-[10px] uppercase tracking-widest text-neutral-500">Current Round</div>
          <div className="mt-2 text-lg font-bold text-white">{currentRound?.round.round_name || 'TBD'}</div>
          <div className="mt-1 text-xs text-neutral-400">Live progression</div>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="text-[10px] uppercase tracking-widest text-neutral-500">Status & Champion</div>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider border ${
                bracketView?.tournament.state === 'registration_open'
                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                  : bracketView?.tournament.state === 'scheduled'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    : bracketView?.tournament.state === 'in_progress'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : bracketView?.tournament.state === 'under_review'
                        ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                        : bracketView?.tournament.state === 'completed'
                          ? 'bg-neutral-800 text-neutral-300 border-neutral-700'
                          : bracketView?.tournament.state === 'cancelled'
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            : 'bg-neutral-800 text-neutral-400 border-neutral-700'
              }`}
            >
              {(bracketView?.tournament.state || 'draft').replace('_', ' ')}
            </span>
          </div>
          <div className="mt-2 text-xs text-neutral-400">
            {bracketView?.champion?.name ? `Champion: ${bracketView.champion.name}` : 'Champion: TBD'}
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-2 text-sm font-bold text-white">
          <Trophy className="h-4 w-4 text-violet-400" /> Interactive Bracket
        </div>
        {rounds.length === 0 ? (
          <div className="mt-4 text-sm text-neutral-500">Bracket not generated yet.</div>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {rounds.map((round) => (
              <div key={round.round.id} className="rounded-xl border border-white/5 bg-black/20 p-4">
                <div className="mb-3 text-sm font-semibold text-white">{round.round.round_name}</div>
                <div className="space-y-3 text-xs">
                  {round.matches.map((node) => (
                    <div key={node.match.id} className="rounded-lg border border-white/5 bg-neutral-950/60 px-3 py-2 flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-neutral-100 truncate">{node.homeMember?.name || 'TBD'} vs {node.awayMember?.name || 'TBD'}</div>
                        <div className="mt-1 text-neutral-400">{node.result ? `${node.result.home_score} - ${node.result.away_score}` : 'Awaiting result'}</div>
                        <div className="mt-1 text-[11px] uppercase tracking-wider text-neutral-500">{node.match.state}</div>
                      </div>
                      {node.result && (
                        <ShareTriggerButton
                          options={{
                            type: 'match',
                            slug: leaderboard.slug,
                            matchId: node.match.id,
                          }}
                          size="icon"
                          variant="ghost"
                          title="Share match result"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Swords className="h-4 w-4 text-cyan-400" /> Upcoming Matches
          </div>
          <div className="mt-4 space-y-3 text-xs">
            {upcomingMatches.length === 0 ? (
              <div className="text-neutral-500">No upcoming matches.</div>
            ) : (
              upcomingMatches.map((item) => (
                <div key={item.match.id} className="rounded-xl border border-white/5 bg-black/20 px-3 py-3">
                  <div className="font-semibold text-white">{item.homeMember?.name || 'TBD'} vs {item.awayMember?.name || 'TBD'}</div>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-neutral-500">
                    <Calendar className="h-3.5 w-3.5" />
                    {item.match.scheduled_at ? new Date(item.match.scheduled_at).toLocaleString() : 'Schedule pending'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="glass rounded-2xl p-6">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Activity className="h-4 w-4 text-emerald-400" /> Recent Results
          </div>
          <div className="mt-4 space-y-3 text-xs">
            {recentResults.length === 0 ? (
              <div className="text-neutral-500">No results recorded yet.</div>
            ) : (
              recentResults.slice(0, 8).map((item) => (
                <div key={item.match.id} className="rounded-xl border border-white/5 bg-black/20 px-3 py-3 flex items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold text-white">{item.homeMember?.name} {item.result.home_score} - {item.result.away_score} {item.awayMember?.name}</div>
                    <div className="mt-1 text-[11px] text-neutral-500">Round {item.match.round_index}</div>
                  </div>
                  <ShareTriggerButton
                    options={{
                      type: 'match',
                      slug: leaderboard.slug,
                      matchId: item.match.id,
                    }}
                    size="icon"
                    variant="subtle"
                    title="Share match result"
                  />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {bracketView?.champion && (
        <div className="glass rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-amber-200">
              <Crown className="h-4 w-4" /> Champion: {bracketView.champion.name}
            </div>
            <div className="mt-1 text-xs text-amber-100/80">Tournament template: {competitionConfig.template_key}</div>
          </div>
          <ShareTriggerButton
            options={{
              type: 'champion',
              slug: leaderboard.slug,
            }}
            variant="solid"
            size="sm"
            label="Share Champion"
          />
        </div>
      )}
    </div>
  );
}
