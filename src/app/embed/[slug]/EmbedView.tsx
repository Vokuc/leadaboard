'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { DatabaseService, isSupabaseConfigured, supabase } from '@/lib/db';
import { LeagueService } from '@/lib/league/service';
import {
  CompetitionConfig,
  Leaderboard,
  Season,
  Ranking,
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
  initialData: any | null; // using any to match the server fetch payload easily
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

        const ranks = await DatabaseService.getRankings(lb.id);
        setRankings(ranks);
      } catch (err) {
        console.error(err);
      } finally {
        if (!isSilent) setLoading(false);
      }
    },
    [slug],
  );

  useEffect(() => {
    if (!initialData) {
      void loadData();
    }
  }, [initialData, loadData]);

  // Real-time subscriptions
  useEffect(() => {
    if (!leaderboard) return;

    if (isSupabaseConfigured && supabase) {
      const scoreChannel = supabase
        .channel(`public:score_events:embed_${leaderboard.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'score_events',
            filter: `leaderboard_id=eq.${leaderboard.id}`,
          },
          () => {
            void loadData(true);
          },
        )
        .subscribe();

      return () => {
        scoreChannel.unsubscribe();
      };
    } else {
      const handleStorageUpdate = (e: StorageEvent) => {
        if (e.key && e.key.startsWith('leaderboardos_')) {
          void loadData(true);
        }
      };
      window.addEventListener('storage', handleStorageUpdate);
      const interval = setInterval(() => {
        void loadData(true);
      }, 5000);

      return () => {
        window.removeEventListener('storage', handleStorageUpdate);
        clearInterval(interval);
      };
    }
  }, [leaderboard, loadData]);

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
  
  // Condense rankings for the embed
  const displayRankings = rankings.filter(r => r.is_active).slice(0, 10);

  return (
    <div className={`flex flex-col min-h-screen ${isLight ? 'bg-white text-neutral-900' : 'bg-black/40 backdrop-blur-md text-white'} overflow-hidden`}>
      <header className={`p-4 border-b ${isLight ? 'border-neutral-200' : 'border-white/10'} flex flex-col gap-1`}>
        <div className="flex justify-between items-center">
          <h1 className="font-bold text-base truncate pr-2">{leaderboard.name}</h1>
          {season && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider ${isLight ? 'bg-neutral-100 text-neutral-500' : 'bg-white/10 text-neutral-300'}`}>
              {season.name}
            </span>
          )}
        </div>
        {leaderboard.description && (
          <p className={`text-xs truncate ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
            {leaderboard.description}
          </p>
        )}
      </header>

      <main className="flex-1 overflow-y-auto p-0">
        <table className="min-w-full text-xs text-left">
          <thead className={`sticky top-0 ${isLight ? 'bg-neutral-50 text-neutral-500 border-b border-neutral-200' : 'bg-neutral-900/90 text-neutral-400 border-b border-white/5'} uppercase font-bold tracking-wider text-[9px]`}>
            <tr>
              <th scope="col" className="px-3 py-2 w-10 text-center">#</th>
              <th scope="col" className="px-3 py-2">Competitor</th>
              <th scope="col" className="px-3 py-2 text-right">Pts</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isLight ? 'divide-neutral-100' : 'divide-white/5'}`}>
            {displayRankings.length === 0 ? (
              <tr>
                <td colSpan={3} className={`px-3 py-6 text-center ${isLight ? 'text-neutral-500' : 'text-neutral-500'}`}>
                  No active competitors.
                </td>
              </tr>
            ) : (
              displayRankings.map((r, idx) => {
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
                        className="h-5 w-5 rounded border border-white/10 object-cover"
                      />
                      <span className="font-semibold truncate max-w-[120px] sm:max-w-[180px]">
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
      </main>

      <footer className={`p-2.5 text-center border-t ${isLight ? 'border-neutral-200 bg-neutral-50' : 'border-white/10 bg-black/60'} shrink-0`}>
        <a 
          href={`/leaderboards/${leaderboard.slug}`} 
          target="_blank" 
          rel="noopener noreferrer"
          className={`text-[9px] font-semibold flex items-center justify-center gap-1.5 transition-colors ${isLight ? 'text-neutral-500 hover:text-violet-600' : 'text-neutral-500 hover:text-white'}`}
        >
          <Trophy className="w-3 h-3" />
          Powered by LeaderboardOS
        </a>
      </footer>
    </div>
  );
}
