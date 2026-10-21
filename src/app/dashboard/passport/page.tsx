'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Shield, Sparkles } from 'lucide-react';
import { PassportManagementPanel } from '@/components/competition/passport/PassportManagementPanel';

export default function DashboardPassportPage() {
  return (
    <div className="min-h-screen bg-black bg-grid text-white pb-20">
      {/* Top Navigation Bar */}
      <header className="glass border-b border-white/5 py-4 px-6 md:px-12 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-xs font-semibold text-neutral-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Link>
          <span className="text-neutral-700">/</span>
          <div className="flex items-center gap-1.5 text-xs text-neutral-300 font-medium">
            <Shield className="w-3.5 h-3.5 text-violet-400" />
            <span>Competition Passport</span>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border border-violet-500/30 bg-violet-500/10 text-violet-300">
            <Sparkles className="w-3 h-3" />
            Era 3 Identity
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-8">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <span>Competition Passport &amp; Participant Profile</span>
          </h1>
          <p className="text-sm text-neutral-400 mt-2 max-w-2xl leading-relaxed">
            Your portable, verified competitive track record across all eligible LeaderboardOS tournaments and leagues.
            Claim past records, customize your public card, manage privacy toggles, and submit dispute corrections.
          </p>
        </div>

        <PassportManagementPanel />
      </main>
    </div>
  );
}
