import React, { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronRight, Trophy, Zap, Share2 } from 'lucide-react';

export interface FAQ {
  q: string;
  a: string | ReactNode;
}

export interface RelatedTool {
  name: string;
  href: string;
  desc: string;
}

interface ToolPageWrapperProps {
  title: ReactNode;
  description: ReactNode;
  children: ReactNode;
  faqs?: FAQ[];
  relatedTools?: RelatedTool[];
}

export default function ToolPageWrapper({
  title,
  description,
  children,
  faqs = [],
  relatedTools = [],
}: ToolPageWrapperProps) {
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
            <Link href="/tools" className="text-sm text-neutral-400 hover:text-white transition-colors hidden sm:block">
              Free Tools
            </Link>
            <Link
              href="/dashboard/create"
              className="px-4 py-2 bg-white text-black text-sm font-bold rounded-lg hover:bg-neutral-200 transition-colors flex items-center gap-1.5"
            >
              Get Started <ArrowRight className="w-4 h-4" />
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12 md:py-20 space-y-20">
        {/* Tool Header */}
        <section className="text-center max-w-3xl mx-auto space-y-6">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight glow-text">
            {title}
          </h1>
          <p className="text-lg text-neutral-400 leading-relaxed">
            {description}
          </p>
        </section>

        {/* Interactive Tool Area */}
        <section className="relative z-10">
          <div className="glass rounded-2xl border border-white/10 p-2 sm:p-6 shadow-2xl bg-neutral-950/50">
            {children}
          </div>
        </section>

        {/* Conversion CTA */}
        <section className="glass rounded-2xl border border-violet-500/20 bg-violet-950/20 p-8 md:p-12 text-center max-w-4xl mx-auto relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <Zap className="w-64 h-64 text-violet-400" />
          </div>
          <div className="relative z-10 space-y-6">
            <h2 className="text-3xl font-bold tracking-tight text-white">
              Want to track this live?
            </h2>
            <p className="text-neutral-300 max-w-xl mx-auto">
              Save your table to LeaderboardOS to get a real-time, shareable public page. Invite participants, track activity, and host official seasons.
            </p>
            <Link
              href="/dashboard/create"
              className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-violet-600/20"
            >
              Create Free Leaderboard <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 pt-8 border-t border-white/5">
          {/* FAQs */}
          <section className="md:col-span-2 space-y-8">
            {faqs.length > 0 && (
              <>
                <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                  Frequently Asked Questions
                </h2>
                <div className="space-y-4">
                  {faqs.map((faq, idx) => (
                    <details
                      key={idx}
                      className="group bg-neutral-900/50 border border-neutral-800 rounded-xl overflow-hidden open:bg-neutral-900/80 transition-colors"
                    >
                      <summary className="flex items-center justify-between p-5 font-semibold cursor-pointer select-none">
                        {faq.q}
                        <ChevronRight className="w-5 h-5 text-neutral-500 transition-transform group-open:rotate-90" />
                      </summary>
                      <div className="px-5 pb-5 text-neutral-400 text-sm leading-relaxed border-t border-neutral-800/50 pt-4 mt-1">
                        {faq.a}
                      </div>
                    </details>
                  ))}
                </div>
              </>
            )}
          </section>

          {/* Related Tools */}
          <section className="space-y-6">
            {relatedTools.length > 0 && (
              <>
                <h3 className="text-lg font-bold tracking-tight text-neutral-300">
                  Related Free Tools
                </h3>
                <div className="flex flex-col gap-3">
                  {relatedTools.map((tool, idx) => (
                    <Link
                      key={idx}
                      href={tool.href}
                      className="group p-4 rounded-xl border border-neutral-800 bg-neutral-900/30 hover:bg-neutral-900/80 hover:border-neutral-700 transition-all block"
                    >
                      <h4 className="font-semibold text-sm text-violet-400 group-hover:text-violet-300 mb-1 flex items-center gap-1.5">
                        {tool.name} <ArrowRight className="w-3 h-3 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                      </h4>
                      <p className="text-xs text-neutral-500 line-clamp-2">
                        {tool.desc}
                      </p>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 mt-20 text-center text-neutral-500 text-sm">
        <p>© {new Date().getFullYear()} LeaderboardOS. All rights reserved.</p>
      </footer>
    </div>
  );
}
