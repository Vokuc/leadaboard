import React from 'react';
import Link from 'next/link';

export default function SeoFooter() {
  return (
    <footer className="w-full border-t border-white/5 bg-black py-16 mt-auto">
      <div className="max-w-5xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-12 text-sm text-neutral-400">
        <div>
          <h3 className="font-bold text-white mb-4 text-base">LeaderboardOS</h3>
          <p className="mb-4">The ultimate platform for generating live, API-driven leaderboards, league tables, and tournament brackets.</p>
          <p className="text-neutral-500">
            &copy; {new Date().getFullYear()} LeaderboardOS. All rights reserved.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="font-bold text-white mb-1 text-base">Platform</h3>
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <Link href="/blog" className="hover:text-white transition-colors">Blog</Link>
          <Link href="/directory" className="hover:text-white transition-colors">Discover Public Boards</Link>
          <Link href="/how-to-play" className="hover:text-white transition-colors">How it Works</Link>
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="font-bold text-white mb-1 text-base">Free Resources</h3>
          <Link href="/resources" className="hover:text-white transition-colors">Templates Hub</Link>
          <Link href="/resources/excel-league-table-template" className="hover:text-white transition-colors">Excel League Template</Link>
          <Link href="/resources/printable-tournament-brackets" className="hover:text-white transition-colors">Printable Brackets</Link>
          <Link href="/tools/elo-calculator" className="hover:text-white transition-colors">Elo Rating Calculator</Link>
          <Link href="/tools/football-league-table" className="hover:text-white transition-colors">Live Table Generator</Link>
        </div>
      </div>
    </footer>
  );
}
