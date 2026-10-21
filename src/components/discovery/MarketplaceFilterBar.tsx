'use client';

import React from 'react';
import {
  CompetitionEngine,
  CompetitionType,
  MarketplaceDateRangeFilter,
  MarketplacePricingFilter,
  MarketplaceQueryOptions,
  MarketplaceRegistrationStatusFilter,
  MarketplaceSortOption,
} from '@/types';
import {
  Globe,
  MapPin,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';

interface MarketplaceFilterBarProps {
  filters: MarketplaceQueryOptions;
  facets?: {
    categories: Record<string, number>;
    engines: Record<string, number>;
    participationTypes: Record<string, number>;
    registrationStatuses: Record<string, number>;
  };
  totalCount: number;
  onFilterChange: (newFilters: Partial<MarketplaceQueryOptions>) => void;
  onResetFilters: () => void;
}

export default function MarketplaceFilterBar({
  filters,
  facets,
  totalCount,
  onFilterChange,
  onResetFilters,
}: MarketplaceFilterBarProps) {
  const activeFiltersCount = [
    filters.query,
    filters.category && filters.category !== 'all',
    filters.engine && filters.engine !== 'all',
    filters.participation_type && filters.participation_type !== 'all',
    filters.registration_status && filters.registration_status !== 'all',
    filters.pricing && filters.pricing !== 'all',
    filters.date_range && filters.date_range !== 'all',
  ].filter(Boolean).length;

  const categories: Array<{ id: CompetitionType | 'all'; label: string }> = [
    { id: 'all', label: 'All Categories' },
    { id: 'sports', label: 'Sports & Leagues' },
    { id: 'gaming', label: 'Esports & Gaming' },
    { id: 'fitness', label: 'Fitness & Challenges' },
    { id: 'workplace', label: 'Workplace & Sales' },
    { id: 'education', label: 'Education' },
    { id: 'custom', label: 'Community & Other' },
  ];

  const engines: Array<{ id: CompetitionEngine | 'all'; label: string }> = [
    { id: 'all', label: 'All Formats' },
    { id: 'tournament', label: 'Tournaments (Brackets)' },
    { id: 'league_table', label: 'Leagues (Round-Robin)' },
    { id: 'simple_points', label: 'Leaderboards (Points)' },
  ];

  const registrationStatuses: Array<{ id: MarketplaceRegistrationStatusFilter; label: string }> = [
    { id: 'all', label: 'All Registration' },
    { id: 'open', label: 'Open Registration' },
    { id: 'approval_required', label: 'Approval Required' },
    { id: 'waitlist', label: 'Waitlist Available' },
    { id: 'closed', label: 'Closed' },
    { id: 'view_only', label: 'View Only' },
  ];

  const sortOptions: Array<{ id: MarketplaceSortOption; label: string }> = [
    { id: 'recently_updated', label: 'Recently Updated' },
    { id: 'upcoming', label: 'Upcoming First' },
    { id: 'popular', label: 'Most Popular (Participants)' },
    { id: 'newest', label: 'Newest Added' },
  ];

  return (
    <div className="space-y-4">
      {/* Top Search & Primary Filters */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
        {/* Search Input */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={filters.query || ''}
            onChange={(e) => onFilterChange({ query: e.target.value, page: 1 })}
            placeholder="Search by competition name, rules, venue, or organizer..."
            className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-neutral-900/80 border border-neutral-800 text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all shadow-inner"
          />
          {filters.query && (
            <button
              onClick={() => onFilterChange({ query: '', page: 1 })}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-500 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Engine/Format Selector */}
        <div className="shrink-0">
          <select
            value={filters.engine || 'all'}
            onChange={(e) => onFilterChange({ engine: e.target.value as CompetitionEngine | 'all', page: 1 })}
            className="w-full md:w-auto px-3.5 py-2.5 rounded-xl bg-neutral-900/80 border border-neutral-800 text-sm text-neutral-200 focus:outline-none focus:ring-2 focus:ring-violet-500/50 cursor-pointer"
          >
            {engines.map((eng) => (
              <option key={eng.id} value={eng.id} className="bg-neutral-900 text-white">
                {eng.label}
              </option>
            ))}
          </select>
        </div>

        {/* Sort Selector */}
        <div className="shrink-0">
          <select
            value={filters.sort || 'recently_updated'}
            onChange={(e) => onFilterChange({ sort: e.target.value as MarketplaceSortOption, page: 1 })}
            className="w-full md:w-auto px-3.5 py-2.5 rounded-xl bg-neutral-900/80 border border-neutral-800 text-sm text-neutral-200 focus:outline-none focus:ring-2 focus:ring-violet-500/50 cursor-pointer"
          >
            {sortOptions.map((s) => (
              <option key={s.id} value={s.id} className="bg-neutral-900 text-white">
                Sort: {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Category Pills Slider */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {categories.map((cat) => {
          const isSelected = (filters.category || 'all') === cat.id;
          const count = cat.id === 'all' ? totalCount : facets?.categories[cat.id];
          return (
            <button
              key={cat.id}
              onClick={() => onFilterChange({ category: cat.id, page: 1 })}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                isSelected
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-900/30'
                  : 'bg-neutral-900/60 hover:bg-neutral-800 text-neutral-300 border border-neutral-800'
              }`}
            >
              <span>{cat.label}</span>
              {count !== undefined && count > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  isSelected ? 'bg-violet-800/80 text-violet-100' : 'bg-neutral-800 text-neutral-400'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Secondary Filter Chips Row */}
      <div className="flex flex-wrap items-center gap-2.5 pt-1 text-xs">
        {/* Participation Type Buttons */}
        <div className="inline-flex rounded-lg p-0.5 bg-neutral-900/80 border border-neutral-800">
          <button
            onClick={() => onFilterChange({ participation_type: 'all', page: 1 })}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              (filters.participation_type || 'all') === 'all'
                ? 'bg-neutral-800 text-white font-semibold'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            All Locations
          </button>
          <button
            onClick={() => onFilterChange({ participation_type: 'online', page: 1 })}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors ${
              filters.participation_type === 'online'
                ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/30'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Globe className="w-3 h-3" /> Online
          </button>
          <button
            onClick={() => onFilterChange({ participation_type: 'in_person', page: 1 })}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors ${
              filters.participation_type === 'in_person'
                ? 'bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/30'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <MapPin className="w-3 h-3" /> In-Person
          </button>
        </div>

        {/* Registration Status Selector */}
        <select
          value={filters.registration_status || 'all'}
          onChange={(e) => onFilterChange({ registration_status: e.target.value as MarketplaceRegistrationStatusFilter, page: 1 })}
          className="px-3 py-1.5 rounded-lg bg-neutral-900/80 border border-neutral-800 text-neutral-300 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500 cursor-pointer"
        >
          {registrationStatuses.map((st) => (
            <option key={st.id} value={st.id} className="bg-neutral-900 text-white">
              {st.label}
            </option>
          ))}
        </select>

        {/* Pricing Toggle */}
        <select
          value={filters.pricing || 'all'}
          onChange={(e) => onFilterChange({ pricing: e.target.value as MarketplacePricingFilter, page: 1 })}
          className="px-3 py-1.5 rounded-lg bg-neutral-900/80 border border-neutral-800 text-neutral-300 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500 cursor-pointer"
        >
          <option value="all">All Pricing</option>
          <option value="free">Free Entry Only</option>
          <option value="paid">Paid Competitions</option>
        </select>

        {/* Date Range Selector */}
        <select
          value={filters.date_range || 'all'}
          onChange={(e) => onFilterChange({ date_range: e.target.value as MarketplaceDateRangeFilter, page: 1 })}
          className="px-3 py-1.5 rounded-lg bg-neutral-900/80 border border-neutral-800 text-neutral-300 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500 cursor-pointer"
        >
          <option value="all">All Dates</option>
          <option value="upcoming">Upcoming</option>
          <option value="ongoing">Currently Active</option>
          <option value="past">Completed / Past</option>
        </select>

        {/* Reset Filters button */}
        {activeFiltersCount > 0 && (
          <button
            onClick={onResetFilters}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-850 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700 transition-colors ml-auto cursor-pointer"
          >
            <RotateCcw className="w-3 h-3 text-neutral-400" />
            <span>Reset Filters ({activeFiltersCount})</span>
          </button>
        )}
      </div>
    </div>
  );
}
