'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  ChevronDown, 
  ChevronRight, 
  Search, 
  ArrowLeft,
  Sparkles,
  Menu,
  X
} from 'lucide-react';
import { DocCategory } from '@/lib/docs/api';

interface DocsSidebarProps {
  categories: DocCategory[];
  currentSlug?: string;
}

export default function DocsSidebar({ categories, currentSlug }: DocsSidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  
  // Track open state for categories; default all open or matching open
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(() => {
    const initialState: Record<string, boolean> = {};
    for (const cat of categories) {
      // Open if it contains the current slug or by default
      const hasCurrent = cat.articles.some(a => a.slug === currentSlug);
      initialState[cat.id] = hasCurrent || true;
    }
    return initialState;
  });

  const toggleCategory = (catId: string) => {
    setOpenCategories(prev => ({
      ...prev,
      [catId]: !prev[catId]
    }));
  };

  const sidebarContent = (
    <div className="flex flex-col h-full py-6 pr-2">
      {/* Top Navigation */}
      <div className="px-4 mb-6">
        <Link 
          href="/docs"
          className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-400 hover:text-white transition-colors mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Documentation Home
        </Link>
        <Link 
          href="/docs/search"
          className="flex items-center justify-between w-full px-3 py-2 bg-neutral-900 hover:bg-neutral-800 border border-white/10 rounded-lg text-xs text-neutral-400 hover:text-white transition-colors shadow-inner"
        >
          <span className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-neutral-400" />
            Search articles...
          </span>
          <kbd className="text-[10px] bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-neutral-400">
            /
          </kbd>
        </Link>
      </div>

      {/* Categories & Articles List */}
      <nav className="flex-1 overflow-y-auto px-2 space-y-4 text-sm scrollbar-thin scrollbar-thumb-white/10">
        {categories.map((category) => {
          const isOpen = openCategories[category.id] ?? true;
          const hasActiveArticle = category.articles.some(a => a.slug === currentSlug);

          return (
            <div key={category.id} className="space-y-1">
              <button
                type="button"
                onClick={() => toggleCategory(category.id)}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider rounded-lg transition-colors ${
                  hasActiveArticle ? 'text-violet-400 bg-violet-500/10' : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5'
                }`}
              >
                <span className="truncate">{category.name}</span>
                <span className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[11px] font-mono text-neutral-400">{category.articles.length}</span>
                  {isOpen ? (
                    <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
                  )}
                </span>
              </button>

              {isOpen && (
                <ul className="pl-2 space-y-1 mt-1 border-l border-white/10 ml-3">
                  {category.articles.map((article) => {
                    const isActive = article.slug === currentSlug || pathname === `/docs/${article.slug}`;

                    return (
                      <li key={article.slug}>
                        <Link
                          href={`/docs/${article.slug}`}
                          onClick={() => setMobileOpen(false)}
                          className={`block px-3 py-1.5 text-xs rounded-lg transition-colors leading-snug ${
                            isActive
                              ? 'bg-violet-600/20 text-violet-300 font-bold border-l-2 -ml-[9px] pl-3 border-violet-500 rounded-r-lg'
                              : 'text-neutral-400 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          {article.title}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      {/* App Quick Link Box */}
      <div className="mt-6 mx-3 p-3 bg-gradient-to-br from-violet-950/40 to-neutral-900 border border-violet-500/20 rounded-xl">
        <div className="flex items-center gap-2 text-xs font-semibold text-violet-300 mb-1">
          <Sparkles className="w-3.5 h-3.5" />
          Ready to compete?
        </div>
        <p className="text-[11px] text-neutral-400 mb-2 leading-relaxed">
          Create and run live leaderboards in under 60 seconds.
        </p>
        <Link
          href="/dashboard/create"
          className="block w-full py-1.5 text-center text-xs font-medium text-white bg-violet-600 hover:bg-violet-500 rounded-lg transition-colors shadow-md"
        >
          Create Competition
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Drawer Toggle */}
      <div className="lg:hidden fixed bottom-6 right-6 z-40">
        <button
          type="button"
          onClick={() => setMobileOpen(prev => !prev)}
          className="flex items-center gap-2 px-4 py-3 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-full shadow-2xl transition-all cursor-pointer"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          <span>{mobileOpen ? 'Close Menu' : 'Docs Navigation'}</span>
        </button>
      </div>

      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div 
          onClick={() => setMobileOpen(false)}
          className="lg:hidden fixed inset-0 bg-black/80 backdrop-blur-sm z-40"
        />
      )}

      {/* Mobile Drawer Panel */}
      <aside className={`lg:hidden fixed top-0 bottom-0 left-0 w-[85%] max-w-xs bg-neutral-950 border-r border-white/10 z-50 transform transition-transform duration-200 ease-in-out ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {sidebarContent}
      </aside>

      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:block w-72 shrink-0 sticky top-16 h-[calc(100vh-4rem)] border-r border-white/10 overflow-hidden">
        {sidebarContent}
      </aside>
    </>
  );
}
