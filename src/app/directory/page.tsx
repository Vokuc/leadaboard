import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { DISCOVERY_CATEGORIES } from '@/lib/discovery/registry';
import { getPublicLeaderboards, DISCOVERY_PAGE_SIZE } from '@/lib/discovery/queries';
import LeaderboardCard from '@/components/discovery/LeaderboardCard';
import DiscoverySearch from '@/components/discovery/DiscoverySearch';
import { Compass, ChevronLeft, ChevronRight } from 'lucide-react';

export const revalidate = 60; // ISR revalidate every 60 seconds

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }): Promise<Metadata> {
  const { q } = await searchParams;
  
  // Apply noindex to search results to prevent infinite crawl space
  if (q) {
    return {
      title: `Search: ${q} | LeaderboardOS`,
      robots: { index: false, follow: true },
    };
  }

  return {
    title: 'Public Leaderboards Directory | LeaderboardOS',
    description: 'Discover active public leaderboards, tournaments, and leagues. Explore how organizers track scores across gaming, sports, fitness, and business.',
  };
}

export default async function LeaderboardsDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page } = await searchParams;
  
  const currentPage = Math.max(1, parseInt(page || '1', 10));
  const query = q?.trim();

  // Fetch paginated public leaderboards
  const { data: leaderboards, totalCount } = await getPublicLeaderboards(currentPage, undefined, query);
  
  const totalPages = Math.ceil(totalCount / DISCOVERY_PAGE_SIZE);

  return (
    <main className="max-w-6xl w-full mx-auto px-6 py-12 md:py-20 space-y-16">
      <section className="text-center max-w-3xl mx-auto space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-semibold mb-2">
          <Compass className="w-3.5 h-3.5" /> Explore Tournaments & Leagues
        </div>
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight glow-text">
          {query ? `Search: ${query}` : 'Public Leaderboards'}
        </h1>
        <p className="text-lg text-neutral-400 leading-relaxed max-w-2xl mx-auto">
          Discover how communities around the world are tracking their scores, ranking members, and gamifying their competitions.
        </p>

        <div className="flex justify-center pt-4">
          <DiscoverySearch basePath="/directory" />
        </div>
      </section>

      {!query && (
        <section className="space-y-6">
          <h2 className="text-2xl font-bold tracking-tight border-b border-white/10 pb-4">
            Browse by Category
          </h2>
          <div className="flex flex-wrap gap-3">
            {DISCOVERY_CATEGORIES.map((cat) => (
              <Link
                key={cat.slug}
                href={`/directory/${cat.slug}`}
                className="px-4 py-2 rounded-full border border-neutral-800 bg-neutral-900/50 hover:bg-neutral-800 hover:border-neutral-700 text-sm font-medium text-neutral-300 hover:text-white transition-colors"
              >
                {cat.h1}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-8">
        <h2 className="text-2xl font-bold tracking-tight">
          {query ? 'Search Results' : 'Recently Updated'}
        </h2>
        
        {leaderboards.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {leaderboards.map((lb) => (
                <LeaderboardCard key={lb.id} leaderboard={lb} />
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 pt-12">
                {currentPage > 1 ? (
                  <Link
                    href={`/directory?${new URLSearchParams({ ...(query ? { q: query } : {}), page: (currentPage - 1).toString() }).toString()}`}
                    className="flex items-center gap-1.5 px-4 py-2 border border-neutral-800 rounded-lg hover:bg-neutral-800 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" /> Previous
                  </Link>
                ) : (
                  <div className="flex items-center gap-1.5 px-4 py-2 border border-neutral-800 rounded-lg opacity-50 cursor-not-allowed">
                    <ChevronLeft className="w-4 h-4" /> Previous
                  </div>
                )}
                
                <span className="text-sm text-neutral-400">
                  Page {currentPage} of {totalPages}
                </span>

                {currentPage < totalPages ? (
                  <Link
                    href={`/directory?${new URLSearchParams({ ...(query ? { q: query } : {}), page: (currentPage + 1).toString() }).toString()}`}
                    className="flex items-center gap-1.5 px-4 py-2 border border-neutral-800 rounded-lg hover:bg-neutral-800 transition-colors"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </Link>
                ) : (
                  <div className="flex items-center gap-1.5 px-4 py-2 border border-neutral-800 rounded-lg opacity-50 cursor-not-allowed">
                    Next <ChevronRight className="w-4 h-4" />
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-24 bg-neutral-900/30 border border-neutral-800 border-dashed rounded-2xl">
            <Compass className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">No leaderboards found</h3>
            <p className="text-neutral-400 max-w-md mx-auto">
              {query 
                ? `We couldn't find any public leaderboards matching "${query}".`
                : 'There are currently no active public leaderboards available.'}
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
