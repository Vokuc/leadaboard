'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, ArrowRight, FileText, CornerDownLeft } from 'lucide-react';
import { SearchResult } from '@/lib/docs/api';

interface DocsSearchBarProps {
  initialQuery?: string;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}

export default function DocsSearchBar({
  initialQuery = '',
  placeholder = 'Search articles, features, rules, or troubleshooting...',
  autoFocus = false,
  className = '',
}: DocsSearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search when typing
  useEffect(() => {
    if (!query.trim()) {
      const resetTimer = setTimeout(() => {
        setResults([]);
        setIsOpen(false);
      }, 0);
      return () => clearTimeout(resetTimer);
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/docs/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results || []);
          setIsOpen(true);
        }
      } catch (err) {
        console.error('Failed to search docs:', err);
      } finally {
        setIsLoading(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/docs/search?q=${encodeURIComponent(query.trim())}`);
      setIsOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} className={`relative w-full ${className}`}>
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative flex items-center">
          <Search className="absolute left-4 w-5 h-5 text-neutral-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (results.length > 0) setIsOpen(true);
            }}
            placeholder={placeholder}
            autoFocus={autoFocus}
            className="w-full pl-12 pr-28 py-3.5 bg-neutral-900/90 hover:bg-neutral-900 focus:bg-neutral-900 border border-white/10 focus:border-violet-500 rounded-xl text-white placeholder-neutral-400 text-sm md:text-base outline-none transition-all shadow-lg backdrop-blur-md"
          />
          <div className="absolute right-3 flex items-center gap-1.5 pointer-events-none">
            <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 text-[11px] font-mono text-neutral-400 bg-white/5 border border-white/10 rounded">
              <CornerDownLeft className="w-3 h-3 mr-0.5" /> Enter
            </kbd>
          </div>
        </div>
      </form>

      {/* Instant Results Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-neutral-900/95 border border-white/10 rounded-xl shadow-2xl backdrop-blur-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150 max-h-[420px] overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-neutral-400">Searching documentation...</div>
          ) : results.length > 0 ? (
            <div className="py-2 divide-y divide-white/5">
              <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Matching Articles ({results.length})
              </div>
              {results.slice(0, 6).map((item) => (
                <Link
                  key={item.slug}
                  href={`/docs/${item.slug}`}
                  onClick={() => setIsOpen(false)}
                  className="flex items-start gap-3 p-3 hover:bg-white/5 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 shrink-0 mt-0.5 group-hover:bg-violet-500/20 transition-colors">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-medium text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-full">
                        {item.category}
                      </span>
                      <span className="text-xs text-neutral-400">{item.readTime}</span>
                    </div>
                    <h4 className="text-sm font-semibold text-white group-hover:text-violet-300 transition-colors truncate">
                      {item.title}
                    </h4>
                    <p className="text-xs text-neutral-400 line-clamp-1 mt-0.5">{item.snippet}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-white shrink-0 self-center transition-colors" />
                </Link>
              ))}
              <div className="p-2 bg-black/40">
                <Link
                  href={`/docs/search?q=${encodeURIComponent(query)}`}
                  onClick={() => setIsOpen(false)}
                  className="w-full flex items-center justify-center gap-2 py-2 text-xs font-medium text-violet-400 hover:text-violet-300 transition-colors"
                >
                  View all results for &quot;{query}&quot; &rarr;
                </Link>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center">
              <p className="text-sm text-neutral-300 font-medium">No documentation found</p>
              <p className="text-xs text-neutral-500 mt-1">
                Try searching for general terms like &quot;league&quot;, &quot;points&quot;, &quot;rules&quot;, or &quot;embed&quot;.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
