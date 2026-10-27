'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Search, 
  ArrowRight, 
  Clock, 
  HelpCircle,
  X
} from 'lucide-react';
import { SearchResult, DocCategory } from '@/lib/docs/api';

interface DocsSearchClientProps {
  initialQuery?: string;
  initialCategory?: string;
  categories: DocCategory[];
}

export default function DocsSearchClient({
  initialQuery = '',
  initialCategory = '',
  categories,
}: DocsSearchClientProps) {
  const [query, setQuery] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    const fetchResults = async () => {
      if (!query.trim() && !selectedCategory) {
        setResults([]);
        setHasSearched(false);
        return;
      }

      setIsLoading(true);
      setHasSearched(true);
      try {
        const params = new URLSearchParams();
        if (query.trim()) params.set('q', query.trim());
        if (selectedCategory) params.set('category', selectedCategory);

        const res = await fetch(`/api/docs/search?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results || []);
        }
      } catch (err) {
        console.error('Search request failed:', err);
      } finally {
        setIsLoading(false);
      }
    };

    const timer = setTimeout(fetchResults, 120);
    return () => clearTimeout(timer);
  }, [query, selectedCategory]);

  // Update URL search params as search state changes
  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (selectedCategory) params.set('category', selectedCategory);

    const queryString = params.toString();
    const newPath = queryString ? `/docs/search?${queryString}` : '/docs/search';
    window.history.replaceState(null, '', newPath);
  }, [query, selectedCategory]);

  return (
    <div className="space-y-8">
      {/* Search Input Bar */}
      <div className="relative">
        <div className="relative flex items-center">
          <Search className="absolute left-4 w-5 h-5 text-neutral-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type keywords (e.g. tie-breaker, bracket, schedule, paystack, embed)..."
            autoFocus
            className="w-full pl-12 pr-12 py-4 bg-neutral-900 border border-white/10 focus:border-violet-500 rounded-2xl text-white placeholder-neutral-400 text-base outline-none shadow-xl transition-all"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-4 p-1 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button
          type="button"
          onClick={() => setSelectedCategory('')}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-colors ${
            !selectedCategory
              ? 'bg-violet-600 text-white'
              : 'bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10 border border-white/5'
          }`}
        >
          All Topics
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setSelectedCategory(cat.name === selectedCategory ? '' : cat.name)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-colors ${
              selectedCategory.toLowerCase() === cat.name.toLowerCase()
                ? 'bg-violet-600 text-white'
                : 'bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10 border border-white/5'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Search Results Display */}
      <div>
        {isLoading ? (
          <div className="py-16 text-center text-sm text-neutral-400">
            Searching across all documentation articles...
          </div>
        ) : results.length > 0 ? (
          <div className="space-y-4">
            <div className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">
              Found {results.length} result{results.length === 1 ? '' : 's'}
            </div>
            <div className="divide-y divide-white/5 border border-white/10 bg-neutral-900/40 rounded-2xl overflow-hidden shadow-xl">
              {results.map((res) => (
                <Link
                  key={res.slug}
                  href={`/docs/${res.slug}`}
                  className="p-6 hover:bg-white/5 transition-colors block group"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-violet-400 bg-violet-500/10 px-2.5 py-0.5 rounded-full">
                      {res.category}
                    </span>
                    <span className="text-xs text-neutral-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {res.readTime}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white group-hover:text-violet-300 transition-colors mb-2 flex items-center justify-between">
                    <span>{res.title}</span>
                    <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-white group-hover:translate-x-1 transition-all" />
                  </h3>
                  <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed">
                    {res.snippet}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        ) : hasSearched ? (
          <div className="py-20 text-center max-w-md mx-auto p-8 bg-neutral-900/40 border border-white/10 rounded-2xl">
            <HelpCircle className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">No matching articles found</h3>
            <p className="text-xs text-neutral-400 leading-relaxed mb-6">
              We couldn&apos;t find any articles matching &quot;{query}&quot;. Try using more general search terms or explore our popular categories.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => { setQuery('league'); setSelectedCategory(''); }}
                className="px-3 py-1 bg-white/5 hover:bg-white/10 text-xs text-neutral-300 rounded-lg transition-colors border border-white/10"
              >
                League Tables
              </button>
              <button
                type="button"
                onClick={() => { setQuery('tournament'); setSelectedCategory(''); }}
                className="px-3 py-1 bg-white/5 hover:bg-white/10 text-xs text-neutral-300 rounded-lg transition-colors border border-white/10"
              >
                Tournaments
              </button>
              <button
                type="button"
                onClick={() => { setQuery('embed'); setSelectedCategory(''); }}
                className="px-3 py-1 bg-white/5 hover:bg-white/10 text-xs text-neutral-300 rounded-lg transition-colors border border-white/10"
              >
                Embeds
              </button>
            </div>
          </div>
        ) : (
          <div className="py-16 text-center text-sm text-neutral-400">
            Type a search term above to instantly search across all 25+ guides.
          </div>
        )}
      </div>
    </div>
  );
}
