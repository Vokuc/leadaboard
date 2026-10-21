'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { CompetitionPassportService } from '@/lib/competition/passport/service';
import {
  Trophy,
  Shield,
  Search,
  ArrowRight,
  Sparkles,
  Award,
  Users2,
  Lock,
  ExternalLink,
} from 'lucide-react';

export default function PassportLandingPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const [searchHandle, setSearchHandle] = useState('');
  const [myHandle, setMyHandle] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (profile?.id) {
      queueMicrotask(() => {
        if (!isMounted) return;
        CompetitionPassportService.getOrCreateProfile(
          profile.id,
          profile.email || '',
          profile.full_name || profile.email?.split('@')[0] || 'Competitor'
        )
          .then((p) => {
            if (isMounted && p) {
              setMyHandle(p.username);
            }
          })
          .catch((err) => {
            console.error('Error fetching passport profile:', err);
          });
      });
    }
    return () => {
      isMounted = false;
    };
  }, [profile]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = searchHandle.trim().replace(/^@/, '');
    if (clean) {
      router.push(`/passport/@${clean}`);
    }
  };

  return (
    <div className="min-h-screen bg-black bg-grid text-white flex flex-col justify-between">
      {/* Top Bar */}
      <header className="glass border-b border-white/5 py-4 px-6 md:px-12 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-violet-500" />
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
              LeaderboardOS
            </span>
          </Link>
          <span className="text-neutral-700">/</span>
          <span className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-violet-400" />
            Passport Directory
          </span>
        </div>

        <div className="flex items-center gap-3">
          {profile ? (
            <Link
              href="/dashboard/passport"
              className="px-3.5 py-1.5 rounded-xl border border-violet-500/30 bg-violet-500/10 text-violet-200 text-xs font-semibold hover:bg-violet-500/20 transition-all flex items-center gap-1.5"
            >
              <span>Manage My Passport</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          ) : (
            <Link
              href="/login?next=/dashboard/passport"
              className="px-3.5 py-1.5 rounded-xl border border-white/10 bg-white/5 text-white text-xs font-semibold hover:bg-white/10 transition-all"
            >
              Sign In to Claim
            </Link>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-4xl mx-auto px-6 py-16 w-full flex-1 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300 text-xs font-semibold mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Universal Participant Identity &amp; Passport</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-b from-white via-neutral-100 to-neutral-400 bg-clip-text text-transparent mb-4 max-w-2xl">
          A credible, portable record of your competitive achievements.
        </h1>
        <p className="text-neutral-400 text-sm sm:text-base max-w-xl mb-8 leading-relaxed">
          Search for competitor passports, inspect audited match histories, and verify official competition finishes across gaming, sports, and workplace leagues.
        </p>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="w-full max-w-md relative mb-10">
          <div className="relative">
            <Search className="w-5 h-5 text-neutral-500 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search competitor handle (e.g. @pro_striker)..."
              value={searchHandle}
              onChange={(e) => setSearchHandle(e.target.value)}
              className="w-full pl-12 pr-28 py-3.5 rounded-2xl bg-neutral-900/80 border border-neutral-800 text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all shadow-xl"
            />
            <button
              type="submit"
              disabled={!searchHandle.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:hover:bg-violet-600 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 shadow-md"
            >
              <span>View</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>

        {/* Quick User Actions */}
        {profile && myHandle && (
          <div className="mb-12 p-4 rounded-2xl border border-violet-500/20 bg-violet-950/20 max-w-md w-full flex items-center justify-between text-left">
            <div>
              <div className="text-xs text-violet-300 font-semibold uppercase tracking-wider">Your Passport</div>
              <div className="text-sm font-bold text-white mt-0.5">@{myHandle}</div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/passport/@${myHandle}`}
                className="px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-semibold text-white transition-all flex items-center gap-1"
              >
                <span>View</span>
                <ExternalLink className="w-3 h-3 text-neutral-400" />
              </Link>
              <Link
                href="/dashboard/passport"
                className="px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white transition-all"
              >
                Manage
              </Link>
            </div>
          </div>
        )}

        {/* Core Principles */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full text-left mt-4">
          <div className="glass p-5 rounded-2xl border border-white/5 flex flex-col gap-2">
            <div className="w-8 h-8 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 mb-1">
              <Award className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-white">Distinct Verification</h2>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Official finishes and event-day results are distinguished from unverified entries. Never misrepresent casual matches as tournament titles.
            </p>
          </div>

          <div className="glass p-5 rounded-2xl border border-white/5 flex flex-col gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-1">
              <Users2 className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-white">Historical Team Lineage</h2>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Moving to a new roster or club preserves past wins under your previous badge. Past match context is permanently protected.
            </p>
          </div>

          <div className="glass p-5 rounded-2xl border border-white/5 flex flex-col gap-2">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-1">
              <Lock className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-bold text-white">Granular Privacy &amp; Claims</h2>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Claim records securely with tokens or verified emails. Hide personal data or dispute wrongly linked finishes with one click.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-6 px-6 text-center text-xs text-neutral-500">
        LeaderboardOS Competition Passport — Verified Competitor Identity System
      </footer>
    </div>
  );
}
