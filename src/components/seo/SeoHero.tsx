import React from 'react';
import Link from 'next/link';
import { ArrowRight, PlayCircle } from 'lucide-react';
import { SeoPageContent } from '@/lib/seo/content';

interface SeoHeroProps {
  content: SeoPageContent;
}

export default function SeoHero({ content }: SeoHeroProps) {
  return (
    <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden px-6 text-center">
      {/* Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-[500px] rounded-full blur-[140px] pointer-events-none opacity-40 bg-violet-900/20" />
      
      <div className="max-w-4xl mx-auto relative z-10">
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white mb-6 leading-tight">
          {content.h1}
        </h1>
        <p className="text-lg md:text-xl text-neutral-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          {content.subtitle}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/dashboard/create"
            className="w-full sm:w-auto px-8 py-4 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl transition-all glow-primary flex items-center justify-center gap-2"
          >
            Create your leaderboard <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            href={`/directory/${content.relatedCategory === 'all' ? '' : content.relatedCategory}`}
            className="w-full sm:w-auto px-8 py-4 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <PlayCircle className="w-5 h-5 text-neutral-400" /> Explore examples
          </Link>
        </div>
      </div>
    </section>
  );
}
