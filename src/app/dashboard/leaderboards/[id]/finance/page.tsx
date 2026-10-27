'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { DatabaseService } from '@/lib/db';
import { Leaderboard, LeaderboardMember } from '@/types';
import { FinanceManagementPanel } from '@/components/competition/finance/FinanceManagementPanel';
import { ArrowLeft, Loader2, Trophy, Coins } from 'lucide-react';
import { NotificationBell } from '@/components/notifications/NotificationBell';

export default function CompetitionFinancePage() {
  const params = useParams();
  const leaderboardId = params.id as string;

  const [leaderboard, setLeaderboard] = useState<Leaderboard | null>(null);
  const [members, setMembers] = useState<LeaderboardMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [lb, mems] = await Promise.all([
          DatabaseService.getLeaderboard(leaderboardId),
          DatabaseService.getMembers(leaderboardId),
        ]);
        if (!lb) {
          setError('Competition not found.');
          return;
        }
        setLeaderboard(lb);
        setMembers(mems);
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
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
        <p className="text-sm text-neutral-400">Loading financial records...</p>
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
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col">
      {/* Top Header */}
      <header className="glass border-b border-white/5 py-4 px-6 md:px-12 flex justify-between items-center sticky top-0 z-40 bg-neutral-950/80 backdrop-blur-md">
        <Link
          href={`/dashboard/leaderboards/${leaderboard.id}`}
          className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Competition Console
        </Link>

        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-violet-500" />
          <span className="font-bold text-sm tracking-tight text-white">
            {leaderboard.name}
          </span>
          <span className="text-neutral-500">•</span>
          <span className="text-xs font-semibold text-violet-400 flex items-center gap-1">
            <Coins className="w-3.5 h-3.5" /> Finance & Ledger
          </span>
        </div>

        <div className="flex items-center gap-3">
          <NotificationBell />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8">
        <FinanceManagementPanel leaderboard={leaderboard} members={members} />
      </main>
    </div>
  );
}
