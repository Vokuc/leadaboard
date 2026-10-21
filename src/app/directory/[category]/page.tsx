import React from 'react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { DISCOVERY_CATEGORIES, getDiscoveryCategory } from '@/lib/discovery/registry';
import { CompetitionMarketplaceService } from '@/lib/competition/marketplace/service';
import MarketplaceView from '@/components/discovery/MarketplaceView';
import {
  CompetitionEngine,
  CompetitionType,
  MarketplaceDateRangeFilter,
  MarketplaceParticipationType,
  MarketplacePricingFilter,
  MarketplaceQueryOptions,
  MarketplaceRegistrationStatusFilter,
  MarketplaceSortOption,
} from '@/types';
import { ChevronRight, LayoutTemplate, Zap } from 'lucide-react';
import { BASE_URL } from '@/lib/seo/metadata';

interface Props {
  params: Promise<{
    category: string;
  }>;
  searchParams: Promise<{
    q?: string;
    engine?: string;
    type?: string;
    reg?: string;
    pricing?: string;
    dates?: string;
    sort?: string;
    page?: string;
  }>;
}

export const revalidate = 60;

export async function generateStaticParams() {
  return DISCOVERY_CATEGORIES.map((cat) => ({
    category: cat.slug,
  }));
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { category: slug } = await params;
  const { page, q, engine, reg, type, pricing } = await searchParams;
  const category = getDiscoveryCategory(slug);

  if (!category) {
    return { title: 'Category Not Found | LeaderboardOS' };
  }

  const hasActiveFilters = !!(q || engine || reg || type || pricing);
  const currentPage = Math.max(1, parseInt(page || '1', 10));
  const url = `${BASE_URL}/directory/${category.slug}`;
  const paginatedUrl = currentPage > 1 ? `${url}?page=${currentPage}` : url;

  if (hasActiveFilters) {
    return {
      title: `${category.h1} Competitions | LeaderboardOS Marketplace`,
      robots: { index: false, follow: true },
    };
  }

  return {
    title: currentPage > 1 ? `${category.title} - Page ${currentPage}` : category.title,
    description: category.description,
    alternates: {
      canonical: paginatedUrl,
    },
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      title: category.title,
      description: category.description,
      url: paginatedUrl,
      type: 'website',
    },
  };
}

export default async function DiscoveryCategoryPage({ params, searchParams }: Props) {
  const { category: slug } = await params;
  const search = await searchParams;
  const category = getDiscoveryCategory(slug);

  if (!category) {
    notFound();
  }

  const currentPage = Math.max(1, parseInt(search.page || '1', 10));
  const query = search.q?.trim() || '';
  const engine = (search.engine as CompetitionEngine) || 'all';
  const participationType = (search.type as MarketplaceParticipationType) || 'all';
  const registrationStatus = (search.reg as MarketplaceRegistrationStatusFilter) || 'all';
  const pricing = (search.pricing as MarketplacePricingFilter) || 'all';
  const dateRange = (search.dates as MarketplaceDateRangeFilter) || 'all';
  const sort = (search.sort as MarketplaceSortOption) || 'recently_updated';

  const categoryType = category.filter.value as CompetitionType;

  const initialFilters: MarketplaceQueryOptions = {
    query,
    category: categoryType,
    engine,
    participation_type: participationType,
    registration_status: registrationStatus,
    pricing,
    date_range: dateRange,
    sort,
    page: currentPage,
    pageSize: 12,
  };

  const results = await CompetitionMarketplaceService.queryCompetitions(initialFilters);

  return (
    <main className="max-w-6xl w-full mx-auto px-6 py-12 md:py-20 space-y-16">
      {/* Breadcrumb & Header */}
      <section className="space-y-6 text-center max-w-3xl mx-auto">
        <div className="flex items-center justify-center gap-2 text-sm text-neutral-500 mb-4">
          <Link href="/directory" className="hover:text-white transition-colors">
            Marketplace
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-violet-400 font-medium">{category.h1}</span>
        </div>

        <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight glow-text">
          {category.h1}
        </h1>
        <p className="text-lg text-neutral-400 leading-relaxed max-w-2xl mx-auto">
          {category.intro}
        </p>
      </section>

      {/* Interactive Marketplace Interface filtered to this category */}
      <MarketplaceView
        initialResult={results}
        initialFilters={initialFilters}
        basePath={`/directory/${category.slug}`}
      />

      {/* Internal SEO Linking to Templates & Tools */}
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
                {category.relatedTemplates.map((relSlug) => (
                  <li key={relSlug}>
                    <Link
                      href={`/templates/${relSlug}`}
                      className="text-neutral-400 hover:text-violet-400 transition-colors"
                    >
                      {relSlug.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())} Template
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
                <h3 className="text-lg font-bold text-white">Free Generators</h3>
              </div>
              <ul className="space-y-2">
                {category.relatedTools.map((toolSlug) => (
                  <li key={toolSlug}>
                    <Link
                      href={`/tools/${toolSlug}`}
                      className="text-neutral-400 hover:text-fuchsia-400 transition-colors"
                    >
                      {toolSlug.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
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
