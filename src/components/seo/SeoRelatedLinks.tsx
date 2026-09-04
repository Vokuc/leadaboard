import React from 'react';
import Link from 'next/link';
import { SeoPageContent, seoContent } from '@/lib/seo/content';
import { ArrowRight, LayoutTemplate, Settings2 } from 'lucide-react';

interface SeoRelatedLinksProps {
  content: SeoPageContent;
}

export default function SeoRelatedLinks({ content }: SeoRelatedLinksProps) {
  // Grab a few other random SEO pages to link to for strong internal linking
  const allSlugs = Object.keys(seoContent).filter(s => s !== content.slug);
  // Pick up to 4 related pages
  const relatedSlugs = allSlugs.slice(0, 4);

  return (
    <section className="py-20 px-6 bg-neutral-950 border-t border-white/5">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12">
          
          {/* Related Tools */}
          <div>
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-violet-400" />
              Related Tools
            </h3>
            <div className="space-y-3">
              {relatedSlugs.map(slug => (
                <Link 
                  key={slug} 
                  href={`/${slug}`}
                  className="block p-4 rounded-xl border border-white/5 bg-black/50 hover:bg-white/5 hover:border-white/10 transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-300 group-hover:text-white transition-colors capitalize">
                      {slug.replace(/-/g, ' ')}
                    </span>
                    <ArrowRight className="w-4 h-4 text-neutral-600 group-hover:text-violet-400 transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Related Templates */}
          <div>
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <LayoutTemplate className="w-5 h-5 text-cyan-400" />
              Popular Templates
            </h3>
            <div className="space-y-3">
              <Link href="/templates/sales-leaderboard" className="block p-4 rounded-xl border border-white/5 bg-black/50 hover:bg-white/5 hover:border-white/10 transition-colors group">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-300 group-hover:text-white transition-colors">Sales Leaderboard Template</span>
                  <ArrowRight className="w-4 h-4 text-neutral-600 group-hover:text-cyan-400 transition-colors" />
                </div>
              </Link>
              <Link href="/templates/football-league-table" className="block p-4 rounded-xl border border-white/5 bg-black/50 hover:bg-white/5 hover:border-white/10 transition-colors group">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-300 group-hover:text-white transition-colors">Football League Table Template</span>
                  <ArrowRight className="w-4 h-4 text-neutral-600 group-hover:text-cyan-400 transition-colors" />
                </div>
              </Link>
              <Link href="/templates/fitness-challenge" className="block p-4 rounded-xl border border-white/5 bg-black/50 hover:bg-white/5 hover:border-white/10 transition-colors group">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-300 group-hover:text-white transition-colors">Fitness Challenge Template</span>
                  <ArrowRight className="w-4 h-4 text-neutral-600 group-hover:text-cyan-400 transition-colors" />
                </div>
              </Link>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
