import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { DISCOVERY_CATEGORIES } from '@/lib/discovery/registry';
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
import { Compass, Trophy, Users, ShieldCheck } from 'lucide-react';
import { BASE_URL } from '@/lib/seo/metadata';

export const revalidate = 60; // ISR revalidate every 60 seconds

interface PageProps {
  searchParams: Promise<{
    q?: string;
    category?: string;
    engine?: string;
    type?: string;
    reg?: string;
    pricing?: string;
    dates?: string;
    sort?: string;
    page?: string;
  }>;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { q, engine, reg, type, pricing } = await searchParams;

  // Apply noindex to active search and multi-filtered results to prevent crawl budget waste
  const hasActiveFilters = !!(q || engine || reg || type || pricing);

  if (hasActiveFilters) {
    return {
      title: q ? `Competitions matching "${q}" | LeaderboardOS Marketplace` : 'Filtered Competitions | LeaderboardOS',
      robots: { index: false, follow: true },
    };
  }

  return {
    title: 'Public Competition Marketplace — Discover Tournaments & Leagues | LeaderboardOS',
    description:
      'Discover active tournaments, leagues, and public leaderboards. Compare competition formats, view live brackets and standings, and register in open events.',
    alternates: {
      canonical: `${BASE_URL}/directory`,
    },
    openGraph: {
      title: 'Public Competition Marketplace — Tournaments & Leagues | LeaderboardOS',
      description: 'Discover active public competitions, check registration eligibility, and follow live standings.',
      url: `${BASE_URL}/directory`,
      type: 'website',
    },
  };
}

export default async function LeaderboardsDirectoryPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const query = params.q?.trim() || '';
  const category = (params.category as CompetitionType) || 'all';
  const engine = (params.engine as CompetitionEngine) || 'all';
  const participationType = (params.type as MarketplaceParticipationType) || 'all';
  const registrationStatus = (params.reg as MarketplaceRegistrationStatusFilter) || 'all';
  const pricing = (params.pricing as MarketplacePricingFilter) || 'all';
  const dateRange = (params.dates as MarketplaceDateRangeFilter) || 'all';
  const sort = (params.sort as MarketplaceSortOption) || 'recently_updated';
  const currentPage = Math.max(1, parseInt(params.page || '1', 10));

  const initialFilters: MarketplaceQueryOptions = {
    query,
    category,
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

  // Structured Data (JSON-LD ItemList for search engines)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'LeaderboardOS Public Competitions Marketplace',
    description: 'Explore live tournaments, sports leagues, and competitive leaderboards.',
    numberOfItems: results.totalCount,
    itemListElement: results.items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      description: item.description,
      url: `${BASE_URL}/leaderboards/${item.slug}`,
    })),
  };

  return (
    <main className="max-w-6xl w-full mx-auto px-6 py-12 md:py-20 space-y-14">
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero Header */}
      <section className="text-center max-w-3xl mx-auto space-y-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-semibold mb-2 shadow-sm">
          <Compass className="w-4 h-4 animate-pulse" />
          <span>Competition Discovery Marketplace</span>
        </div>

        <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight glow-text">
          Explore Tournaments, Leagues & Leaderboards
        </h1>

        <p className="text-lg text-neutral-400 leading-relaxed max-w-2xl mx-auto">
          Discover active competitions you are eligible to join. Check rules, view live tournament brackets, inspect round-robin tables, and enter official registration flows.
        </p>

        {/* Feature Highlights Pills */}
        <div className="flex flex-wrap justify-center items-center gap-4 pt-2 text-xs text-neutral-400">
          <div className="flex items-center gap-1.5 bg-neutral-900/60 px-3 py-1.5 rounded-full border border-neutral-800">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>Tournaments & Knockouts</span>
          </div>
          <div className="flex items-center gap-1.5 bg-neutral-900/60 px-3 py-1.5 rounded-full border border-neutral-800">
            <Users className="w-3.5 h-3.5 text-cyan-400" />
            <span>Round-Robin Leagues</span>
          </div>
          <div className="flex items-center gap-1.5 bg-neutral-900/60 px-3 py-1.5 rounded-full border border-neutral-800">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Open & Verified Registration</span>
          </div>
        </div>
      </section>

      {/* Interactive Marketplace Interface */}
      <MarketplaceView
        initialResult={results}
        initialFilters={initialFilters}
        basePath="/directory"
      />

      {/* Browse by Category SEO Section */}
      <section className="space-y-6 pt-12 border-t border-white/5">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Browse by Domain Category
          </h2>
          <span className="text-xs text-neutral-500">Dedicated landing pages</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {DISCOVERY_CATEGORIES.map((cat) => (
            <Link
              key={cat.slug}
              href={`/directory/${cat.slug}`}
              className="p-4 rounded-xl border border-neutral-850 bg-neutral-900/40 hover:bg-neutral-850 hover:border-violet-500/30 text-center transition-all group"
            >
              <h3 className="text-sm font-bold text-neutral-200 group-hover:text-violet-300 transition-colors">
                {cat.h1}
              </h3>
              <span className="text-[11px] text-neutral-500 mt-1 block">Explore &rarr;</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
