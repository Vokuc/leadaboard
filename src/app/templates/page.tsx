import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import { Trophy, ArrowRight, LayoutTemplate } from 'lucide-react';
import { getMarketplaceCategories } from '@/lib/templates/marketplace';

export const metadata: Metadata = {
  title: 'Free Leaderboard Templates | LeaderboardOS',
  description: 'Browse ready-to-use leaderboard templates for sports, fitness, sales, education, and communities. Launch a live tracking board in under 60 seconds.',
};

export default function TemplatesIndexPage() {
  const categories = getMarketplaceCategories();

  return (
    <div className="min-h-screen bg-black text-white selection:bg-violet-500/30 flex flex-col">
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

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-12 md:py-20 space-y-16">
        <section className="text-center max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-semibold mb-2">
            <LayoutTemplate className="w-3.5 h-3.5" /> Template Marketplace
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight glow-text">
            Start with a Template
          </h1>
          <p className="text-lg text-neutral-400 leading-relaxed">
            Choose a ready-to-use template designed for your specific use case. From sales races to Sunday league football, launch a live scoreboard in 60 seconds.
          </p>
        </section>

        <div className="space-y-16 pt-8">
          {categories.map((group) => (
            <section key={group.category} className="space-y-6">
              <h2 className="text-3xl font-bold tracking-tight border-b border-white/10 pb-4">
                {group.category}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {group.templates.map((template) => (
                  <Link
                    key={template.slug}
                    href={`/templates/${template.slug}`}
                    className="group glass p-6 rounded-2xl border border-white/5 hover:border-violet-500/30 hover:bg-neutral-900/40 transition-all flex flex-col h-full"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20 flex items-center justify-center">
                        <LayoutTemplate className="w-5 h-5" />
                      </div>
                      <ArrowRight className="w-5 h-5 text-neutral-600 group-hover:text-violet-400 group-hover:translate-x-1 transition-all" />
                    </div>
                    <h3 className="text-xl font-bold text-white group-hover:text-violet-300 transition-colors mb-2">
                      {template.h1}
                    </h3>
                    <p className="text-sm text-neutral-400 leading-relaxed flex-1 line-clamp-3">
                      {template.description}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>

      <footer className="border-t border-white/5 py-12 mt-auto bg-black text-center text-neutral-500 text-sm">
        <p>© {new Date().getFullYear()} LeaderboardOS. All rights reserved.</p>
      </footer>
    </div>
  );
}
