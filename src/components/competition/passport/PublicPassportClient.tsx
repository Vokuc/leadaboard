'use client';

import React, { useEffect, useState } from 'react';
import { CompetitionPassportData } from '@/types';
import { CompetitionPassportService } from '@/lib/competition/passport/service';
import { CompetitionPassportView } from '@/components/competition/passport/CompetitionPassportView';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { Trophy, ArrowLeft, Lock, UserX } from 'lucide-react';
import { SharedResultHighlightBanner } from '@/components/sharing/SharedResultHighlightBanner';

interface PublicPassportClientProps {
  handle: string;
}

export const PublicPassportClient: React.FC<PublicPassportClientProps> = ({ handle }) => {
  const { profile: authProfile, loading: authLoading } = useAuth();
  const [passport, setPassport] = useState<CompetitionPassportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchPassport() {
      if (authLoading) return;
      setLoading(true);
      setError(null);
      try {
        const data = await CompetitionPassportService.getPassport(handle, authProfile?.id || null);
        if (isMounted) {
          setPassport(data);
        }
      } catch (err: unknown) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : 'Could not load passport.';
          setError(msg);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchPassport();

    return () => {
      isMounted = false;
    };
  }, [handle, authProfile, authLoading]);

  return (
    <div className="min-h-screen bg-black bg-grid text-white flex flex-col">
      {/* Top Navigation Bar */}
      <header className="glass border-b border-white/5 py-4 px-6 md:px-12 flex justify-between items-center sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-violet-500" />
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
              LeaderboardOS
            </span>
          </Link>
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border bg-neutral-900 border-neutral-800 text-neutral-400">
            Competition Passport
          </span>
        </div>

        <div className="flex items-center gap-3">
          {authProfile ? (
            <Link
              href="/dashboard/passport"
              className="text-xs font-semibold text-neutral-300 hover:text-white px-3 py-1.5 rounded-xl border border-white/10 hover:bg-white/5 transition"
            >
              My Passport
            </Link>
          ) : (
            <Link
              href="/login"
              className="text-xs font-bold text-white px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 transition shadow-lg shadow-violet-900/30"
            >
              Sign In
            </Link>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <Link href="/directory" className="hover:text-white inline-flex items-center gap-1 transition">
            <ArrowLeft className="w-3.5 h-3.5" /> Directory
          </Link>
          <span>/</span>
          <span className="text-neutral-200">Passport</span>
          <span>/</span>
          <span className="font-mono text-violet-300">@{handle}</span>
        </div>

        <SharedResultHighlightBanner handle={handle} />

        {loading ? (
          <div className="py-24 text-center space-y-3">
            <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-neutral-400 font-medium">
              Verifying credentials and loading competition history...
            </p>
          </div>
        ) : error ? (
          <div className="py-20 max-w-md mx-auto text-center space-y-4 p-8 rounded-3xl border border-white/10 bg-neutral-900/60">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
              {error.toLowerCase().includes('private') ? (
                <Lock className="w-6 h-6" />
              ) : (
                <UserX className="w-6 h-6" />
              )}
            </div>
            <h2 className="text-lg font-bold text-white">
              {error.toLowerCase().includes('private') ? 'Passport is Private' : 'Passport Unavailable'}
            </h2>
            <p className="text-xs text-neutral-400 leading-relaxed">
              {error}
            </p>
            <div className="pt-2">
              <Link
                href="/directory"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold transition"
              >
                Browse Competitions
              </Link>
            </div>
          </div>
        ) : passport ? (
          <CompetitionPassportView passport={passport} isOwner={passport.is_owner} />
        ) : null}
      </main>
    </div>
  );
};
