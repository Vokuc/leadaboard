'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { DatabaseService } from '@/lib/db';
import { CompetitionConfig, Leaderboard } from '@/types';
import { EventDayControlPanel } from '@/components/competition/event-day/EventDayControlPanel';
import { ArrowLeft, Loader2, Play } from 'lucide-react';
import { NotificationBell } from '@/components/notifications/NotificationBell';

export default function EventDayPage() {
  const params = useParams();
  const router = useRouter();
  const leaderboardId = params.id as string;

  const [leaderboard, setLeaderboard] = useState<Leaderboard | null>(null);
  const [competitionConfig, setCompetitionConfig] = useState<CompetitionConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [lb, config] = await Promise.all([
          DatabaseService.getLeaderboard(leaderboardId),
          DatabaseService.getCompetitionConfig(leaderboardId),
        ]);
        if (!lb) {
          setError('Competition not found.');
          return;
        }
        setLeaderboard(lb);
        setCompetitionConfig(config);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load competition');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [leaderboardId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
        <p className="text-sm text-neutral-400">Loading Event-Day arena...</p>
      </div>
    );
  }

  if (error || !leaderboard) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-6 space-y-4">
        <div className="p-4 rounded-2xl bg-neutral-900 border border-white/10 max-w-md w-full text-center space-y-3">
          <p className="text-rose-400 font-semibold">{error || 'Competition not found'}</p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-sm font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      {/* Top Mobile Bar */}
      <header className="sticky top-0 z-30 bg-neutral-900/90 backdrop-blur-md border-b border-white/10 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/dashboard/leaderboards/${leaderboard.id}`}
              className="p-2 rounded-xl text-neutral-400 hover:text-white bg-neutral-800/80 hover:bg-neutral-800 transition-colors"
              title="Return to Competition Console"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Play className="w-3.5 h-3.5 fill-rose-500 text-rose-500" /> Event-Day Arena
              </h1>
              <p className="text-[11px] text-neutral-400 truncate max-w-[200px] sm:max-w-xs">
                {leaderboard.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <NotificationBell />
            <Link
              href={`/leaderboards/${leaderboard.slug}`}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-neutral-300 hover:text-white transition-all hidden sm:block"
            >
              Public View &rarr;
            </Link>
          </div>
        </div>
      </header>

      {/* Main Event-Day Control Screen */}
      <main className="max-w-4xl mx-auto p-4 sm:p-6">
        <EventDayControlPanel leaderboard={leaderboard} competitionConfig={competitionConfig} />
      </main>
    </div>
  );
}
