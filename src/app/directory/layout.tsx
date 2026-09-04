import React, { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, Trophy } from 'lucide-react';

export default function LeaderboardsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-violet-500/30 flex flex-col">
      {/* Background glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-violet-600/10 rounded-full blur-[120px] pointer-events-none -z-10" />

      {/* Header/Nav */}
      <header className="border-b border-white/5 bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-500/20 group-hover:shadow-violet-500/40 transition-all">
              <Trophy className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold tracking-tight text-white group-hover:text-violet-400 transition-colors">
              LeaderboardOS
            </span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/directory" className="text-sm text-neutral-400 hover:text-white transition-colors hidden sm:block">
              Discover
            </Link>
            <Link href="/templates" className="text-sm text-neutral-400 hover:text-white transition-colors hidden sm:block">
              Templates
            </Link>
            <Link
              href="/dashboard/create"
              className="px-4 py-2 bg-white text-black text-sm font-bold rounded-lg hover:bg-neutral-200 transition-colors flex items-center gap-1.5"
            >
              Create <ArrowRight className="w-4 h-4" />
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1">
        {children}
      </div>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 mt-auto bg-black text-center text-neutral-500 text-sm">
        <p>© {new Date().getFullYear()} LeaderboardOS. All rights reserved.</p>
      </footer>
    </div>
  );
}
