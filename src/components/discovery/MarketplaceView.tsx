'use client';

import React, { useCallback, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  MarketplaceCompetition,
  MarketplaceQueryOptions,
  MarketplaceQueryResult,
} from '@/types';
import CompetitionMarketplaceCard from './CompetitionMarketplaceCard';
import MarketplaceFilterBar from './MarketplaceFilterBar';
import CompetitionQuickViewModal from './CompetitionQuickViewModal';
import {
  ChevronLeft,
  ChevronRight,
  Compass,
  ShieldAlert,
} from 'lucide-react';
import { CompetitionMarketplaceService } from '@/lib/competition/marketplace/service';

interface MarketplaceViewProps {
  initialResult: MarketplaceQueryResult;
  initialFilters: MarketplaceQueryOptions;
  basePath?: string;
}

export default function MarketplaceView({
  initialResult,
  initialFilters,
  basePath = '/directory',
}: MarketplaceViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [filters, setFilters] = useState<MarketplaceQueryOptions>(initialFilters);
  const [results, setResults] = useState<MarketplaceQueryResult>(initialResult);
  const [loading, setLoading] = useState(false);
  const [quickViewItem, setQuickViewItem] = useState<MarketplaceCompetition | null>(null);

  // Synchronize URL parameters with current filter state
  const syncUrlParams = useCallback(
    (newFilters: MarketplaceQueryOptions) => {
      const params = new URLSearchParams();

      if (newFilters.query) params.set('q', newFilters.query);
      if (newFilters.category && newFilters.category !== 'all') params.set('category', newFilters.category);
      if (newFilters.engine && newFilters.engine !== 'all') params.set('engine', newFilters.engine);
      if (newFilters.participation_type && newFilters.participation_type !== 'all') params.set('type', newFilters.participation_type);
      if (newFilters.registration_status && newFilters.registration_status !== 'all') params.set('reg', newFilters.registration_status);
      if (newFilters.pricing && newFilters.pricing !== 'all') params.set('pricing', newFilters.pricing);
      if (newFilters.date_range && newFilters.date_range !== 'all') params.set('dates', newFilters.date_range);
      if (newFilters.sort && newFilters.sort !== 'recently_updated') params.set('sort', newFilters.sort);
      if (newFilters.page && newFilters.page > 1) params.set('page', newFilters.page.toString());

      const queryString = params.toString();
      const targetUrl = queryString ? `${basePath}?${queryString}` : basePath;

      startTransition(() => {
        router.replace(targetUrl, { scroll: false });
      });
    },
    [basePath, router]
  );

  // Apply filter update and fetch updated results
  const handleFilterChange = useCallback(
    async (updatedPartial: Partial<MarketplaceQueryOptions>) => {
      const mergedFilters: MarketplaceQueryOptions = {
        ...filters,
        ...updatedPartial,
      };

      setFilters(mergedFilters);
      syncUrlParams(mergedFilters);

      setLoading(true);
      try {
        const queryRes = await CompetitionMarketplaceService.queryCompetitions(mergedFilters);
        setResults(queryRes);
      } catch (err) {
        console.error('Failed to query marketplace competitions:', err);
      } finally {
        setLoading(false);
      }
    },
    [filters, syncUrlParams]
  );

  // Reset all filters
  const handleResetFilters = useCallback(async () => {
    const defaultFilters: MarketplaceQueryOptions = {
      page: 1,
      pageSize: 12,
      sort: 'recently_updated',
      category: 'all',
      engine: 'all',
      participation_type: 'all',
      registration_status: 'all',
      pricing: 'all',
      date_range: 'all',
      query: '',
    };

    setFilters(defaultFilters);
    syncUrlParams(defaultFilters);

    setLoading(true);
    try {
      const queryRes = await CompetitionMarketplaceService.queryCompetitions(defaultFilters);
      setResults(queryRes);
    } catch (err) {
      console.error('Failed to reset marketplace filters:', err);
    } finally {
      setLoading(false);
    }
  }, [syncUrlParams]);

  // Handle page pagination change
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > results.totalPages) return;
    void handleFilterChange({ page: newPage });
    window.scrollTo({ top: 300, behavior: 'smooth' });
  };

  const hasDemoItems = results.items.some((c) => c.is_demo);

  return (
    <div className="space-y-8">
      {/* Demo Mode Notice Banner if demo data is present */}
      {hasDemoItems && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3 text-xs text-amber-200">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold text-amber-300">Demo Environment Active:</span>{' '}
            Sample competitions are displayed to demonstrate tournament brackets, league tables, and open registration.
            Registrations made here are simulated locally in your browser.
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <section className="p-5 rounded-2xl glass border border-white/5 space-y-4 shadow-xl">
        <MarketplaceFilterBar
          filters={filters}
          facets={results.facets}
          totalCount={results.totalCount}
          onFilterChange={handleFilterChange}
          onResetFilters={handleResetFilters}
        />
      </section>

      {/* Results Header */}
      <div className="flex items-center justify-between text-sm text-neutral-400 px-1 border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-violet-400" />
          <span className="font-semibold text-white">
            {results.totalCount} {results.totalCount === 1 ? 'Competition' : 'Competitions'} Found
          </span>
          {isPending || loading ? (
            <span className="text-xs text-violet-400 animate-pulse ml-2">Updating results...</span>
          ) : null}
        </div>

        <span className="text-xs text-neutral-500">
          Page {results.page} of {Math.max(1, results.totalPages)}
        </span>
      </div>

      {/* Competitions Grid */}
      {results.items.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {results.items.map((comp) => (
            <CompetitionMarketplaceCard
              key={comp.id}
              competition={comp}
              onQuickView={(c) => setQuickViewItem(c)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-24 bg-neutral-900/30 border border-neutral-800 border-dashed rounded-2xl p-8 space-y-4">
          <Compass className="w-12 h-12 text-neutral-600 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-xl font-bold text-white">No competitions match your criteria</h3>
            <p className="text-neutral-400 text-sm max-w-md mx-auto">
              We could not find any public competitions matching the selected search terms or filters. Try adjusting your parameters.
            </p>
          </div>
          <button
            onClick={handleResetFilters}
            className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            Clear All Filters
          </button>
        </div>
      )}

      {/* Pagination Controls */}
      {results.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-8">
          <button
            onClick={() => handlePageChange(results.page - 1)}
            disabled={results.page <= 1}
            className={`flex items-center gap-1.5 px-4 py-2 border rounded-xl text-xs font-semibold transition-colors ${
              results.page > 1
                ? 'border-neutral-800 hover:bg-neutral-800 text-neutral-300 hover:text-white cursor-pointer'
                : 'border-neutral-900 text-neutral-600 cursor-not-allowed opacity-50'
            }`}
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>

          <span className="text-xs text-neutral-400 font-medium">
            Page {results.page} of {results.totalPages}
          </span>

          <button
            onClick={() => handlePageChange(results.page + 1)}
            disabled={results.page >= results.totalPages}
            className={`flex items-center gap-1.5 px-4 py-2 border rounded-xl text-xs font-semibold transition-colors ${
              results.page < results.totalPages
                ? 'border-neutral-800 hover:bg-neutral-800 text-neutral-300 hover:text-white cursor-pointer'
                : 'border-neutral-900 text-neutral-600 cursor-not-allowed opacity-50'
            }`}
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Quick View Drawer / Modal */}
      {quickViewItem && (
        <CompetitionQuickViewModal
          competition={quickViewItem}
          onClose={() => setQuickViewItem(null)}
        />
      )}
    </div>
  );
}
