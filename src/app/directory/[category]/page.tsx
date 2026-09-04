import React from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { DISCOVERY_CATEGORIES, getDiscoveryCategory } from '@/lib/discovery/registry';
import { getPublicLeaderboards, DISCOVERY_PAGE_SIZE } from '@/lib/discovery/queries';
import LeaderboardCard from '@/components/discovery/LeaderboardCard';
import { Compass, ChevronLeft, ChevronRight, LayoutTemplate, Zap } from 'lucide-react';
import { BASE_URL } from '@/lib/seo/metadata';

interface Props {
  params: Promise<{
    category: string;
  }>;
  searchParams: Promise<{ page?: string }>;
}

export const revalidate = 60;

export async function generateStaticParams() {
  return DISCOVERY_CATEGORIES.map((cat) => ({
    category: cat.slug,
  }));
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { category: slug } = await params;
  const { page } = await searchParams;
  const category = getDiscoveryCategory(slug);
  
  if (!category) {
    return { title: 'Category Not Found | LeaderboardOS' };
  }

  const currentPage = Math.max(1, parseInt(page || '1', 10));
  const url = `${BASE_URL}/directory/${category.slug}`;
  const paginatedUrl = currentPage > 1 ? `${url}?page=${currentPage}` : url;

  return {
    title: currentPage > 1 ? `${category.title} - Page ${currentPage}` : category.title,
    description: category.description,
    alternates: {
      canonical: paginatedUrl, // Canonical points to paginated URL to prevent index dropping
    },
    robots: {
      index: true,
      follow: true,
    }
  };
}

export default async function DiscoveryCategoryPage({ params, searchParams }: Props) {
  const { category: slug } = await params;
  const { page } = await searchParams;
  const category = getDiscoveryCategory(slug);

  if (!category) {
    notFound();
  }

  const currentPage = Math.max(1, parseInt(page || '1', 10));
  const { data: leaderboards, totalCount } = await getPublicLeaderboards(currentPage, category);
  const totalPages = Math.ceil(totalCount / DISCOVERY_PAGE_SIZE);

  return (
    <main className="max-w-6xl w-full mx-auto px-6 py-12 md:py-20 space-y-16">
      
      {/* Breadcrumb & Header */}
      <section className="space-y-6 text-center max-w-3xl mx-auto">
        <div className="flex items-center justify-center gap-2 text-sm text-neutral-500 mb-6">
          <Link href="/directory" className="hover:text-white transition-colors">Directory</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-violet-400">{category.h1}</span>
        </div>
        
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight glow-text">
          {category.h1}
        </h1>
        <p className="text-lg text-neutral-400 leading-relaxed">
          {category.intro}
        </p>
      </section>

      {/* Leaderboards Grid */}
      <section className="space-y-8 pt-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <h2 className="text-2xl font-bold tracking-tight">Public Boards</h2>
          <span className="text-neutral-500 text-sm">{totalCount} available</span>
        </div>
        
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
                    href={`/directory/${category.slug}?page=${currentPage - 1}`}
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
                    href={`/directory/${category.slug}?page=${currentPage + 1}`}
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
            <h3 className="text-xl font-bold text-white mb-2">No active leaderboards</h3>
            <p className="text-neutral-400 max-w-md mx-auto">
              There are currently no public {category.h1.toLowerCase()} to display.
            </p>
          </div>
        )}
      </section>

      {/* Internal SEO Linking */}
      {(category.relatedTemplates.length > 0 || category.relatedTools.length > 0) && (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-12 border-t border-white/5">
          {category.relatedTemplates.length > 0 && (
            <div className="space-y-4 p-6 bg-neutral-900/40 rounded-2xl border border-neutral-800">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400">
                  <LayoutTemplate className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-white">Related Templates</h3>
              </div>
              <ul className="space-y-2">
                {category.relatedTemplates.map(slug => (
                  <li key={slug}>
                    <Link href={`/templates/${slug}`} className="text-neutral-400 hover:text-violet-400 transition-colors">
                      {slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} Template
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {category.relatedTools.length > 0 && (
            <div className="space-y-4 p-6 bg-neutral-900/40 rounded-2xl border border-neutral-800">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-fuchsia-500/10 text-fuchsia-400">
                  <Zap className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-white">Free Tools</h3>
              </div>
              <ul className="space-y-2">
                {category.relatedTools.map(slug => (
                  <li key={slug}>
                    <Link href={`/tools/${slug}`} className="text-neutral-400 hover:text-fuchsia-400 transition-colors">
                      {slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
