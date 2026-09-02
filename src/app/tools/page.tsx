import React from 'react';
import Link from 'next/link';
import { ArrowRight, Trophy, Zap, Calendar, ListOrdered, Hash } from 'lucide-react';
import { buildMetadata, BASE_URL } from '@/lib/seo/metadata';

export const metadata = buildMetadata({
  title: 'Free Leaderboard & League Table Tools',
  description: 'A suite of free online tools for creating leaderboards, generating league tables, calculating points, and building tournament brackets.',
  canonical: `${BASE_URL}/tools`,
});

const tools = [
  {
    name: 'Online Leaderboard Maker',
    href: '/tools/leaderboard-maker',
    desc: 'Create, rank, and share a custom leaderboard online instantly.',
    icon: <ListOrdered className="w-8 h-8 text-violet-400" />,
  },
  {
    name: 'League Table Generator',
    href: '/tools/league-table-generator',
    desc: 'Generate a league standings table with automated points, goal difference, and win percentage.',
    icon: <Trophy className="w-8 h-8 text-amber-400" />,
  },
  {
    name: 'Football League Table Generator',
    href: '/tools/football-league-table',
    desc: 'Create a custom football/soccer standings table with the standard 3-points-for-a-win system.',
    icon: <Trophy className="w-8 h-8 text-emerald-400" />,
  },
  {
    name: 'Tournament Bracket Generator',
    href: '/tools/tournament-generator',
    desc: 'Build and track a single-elimination tournament bracket for up to 32 players or teams.',
    icon: <Calendar className="w-8 h-8 text-blue-400" />,
  },
  {
    name: 'Points Calculator',
    href: '/tools/points-calculator',
    desc: 'Calculate sports league points based on wins, draws, and losses.',
    icon: <Hash className="w-8 h-8 text-fuchsia-400" />,
  },
];

export default function ToolsIndexPage() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-violet-500/30">
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
            <Link
              href="/dashboard/create"
              className="px-4 py-2 bg-white text-black text-sm font-bold rounded-lg hover:bg-neutral-200 transition-colors flex items-center gap-1.5"
            >
              Get Started <ArrowRight className="w-4 h-4" />
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-16 md:py-24 space-y-16">
        <section className="text-center max-w-3xl mx-auto space-y-6">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight glow-text">
            Free Leaderboard & League Tools
          </h1>
          <p className="text-lg text-neutral-400 leading-relaxed">
            No signup required. Build, calculate, and generate your standings instantly using our suite of free online utilities powered by LeaderboardOS.
          </p>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tools.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="group glass p-6 rounded-2xl border border-white/10 hover:border-violet-500/50 hover:bg-neutral-900/80 transition-all block shadow-xl"
            >
              <div className="mb-4 p-3 bg-neutral-900 rounded-xl inline-block border border-white/5">
                {tool.icon}
              </div>
              <h2 className="text-xl font-bold tracking-tight text-white mb-2 group-hover:text-violet-300 transition-colors">
                {tool.name}
              </h2>
              <p className="text-sm text-neutral-400 leading-relaxed">
                {tool.desc}
              </p>
            </Link>
          ))}
        </section>

        {/* Conversion CTA */}
        <section className="glass rounded-2xl border border-violet-500/20 bg-violet-950/20 p-8 md:p-12 text-center max-w-4xl mx-auto relative overflow-hidden mt-20">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <Zap className="w-64 h-64 text-violet-400" />
          </div>
          <div className="relative z-10 space-y-6">
            <h2 className="text-3xl font-bold tracking-tight text-white">
              Want to track results over time?
            </h2>
            <p className="text-neutral-300 max-w-xl mx-auto">
              LeaderboardOS is the ultimate platform for hosting live, real-time leaderboards, league tables, and tournament brackets.
            </p>
            <Link
              href="/dashboard/create"
              className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-violet-600/20"
            >
              Create Official Leaderboard <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 mt-20 text-center text-neutral-500 text-sm">
        <p>© {new Date().getFullYear()} LeaderboardOS. All rights reserved.</p>
      </footer>
    </div>
  );
}
