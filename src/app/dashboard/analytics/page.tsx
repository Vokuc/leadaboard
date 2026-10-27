'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { CrossCompetitionAnalyticsView } from '@/components/analytics/CrossCompetitionAnalyticsView';
import { ArrowLeft, Trophy } from 'lucide-react';

export default function DashboardAnalyticsPage() {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-slate-400 text-sm animate-pulse">Loading analytics workspace...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Top Bar */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur sticky top-0 z-30 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white hover:border-slate-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-indigo-400" />
            <h1 className="text-base font-bold text-white tracking-tight">Cross-Competition Analytics</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 hidden sm:inline">Organizer:</span>
          <span className="text-xs font-semibold text-slate-200 bg-slate-800 px-2.5 py-1 rounded-md border border-slate-700">
            {profile?.full_name || profile?.email || 'Organizer'}
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <CrossCompetitionAnalyticsView actorUserId={profile?.id} />
      </main>
    </div>
  );
}
