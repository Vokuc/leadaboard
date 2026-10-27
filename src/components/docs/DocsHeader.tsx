import React from 'react';
import Link from 'next/link';
import Logo from '@/components/Logo';
import DocsSearchBar from '@/components/docs/DocsSearchBar';

interface DocsHeaderProps {
  showSearch?: boolean;
}

export default function DocsHeader({ showSearch = true }: DocsHeaderProps) {
  return (
    <header className="w-full border-b border-white/10 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
        {/* Left Brand */}
        <div className="flex items-center gap-3">
          <Link href="/" className="hover:opacity-85 transition-opacity">
            <Logo className="scale-90 origin-left" />
          </Link>
          <div className="hidden sm:block h-4 w-px bg-white/20" />
          <Link 
            href="/docs" 
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-xs font-semibold text-violet-300 hover:bg-violet-500/20 transition-colors"
          >
            <span>Help Center</span>
          </Link>
        </div>

        {/* Center Search (Desktop) */}
        {showSearch && (
          <div className="hidden md:block flex-1 max-w-md mx-4">
            <DocsSearchBar placeholder="Search articles, guides, or rules..." />
          </div>
        )}

        {/* Right Nav */}
        <nav className="flex items-center gap-3 text-xs sm:text-sm font-medium">
          <Link 
            href="/docs" 
            className="text-neutral-400 hover:text-white transition-colors"
          >
            Docs
          </Link>
          <Link 
            href="/directory" 
            className="hidden sm:block text-neutral-400 hover:text-white transition-colors"
          >
            Discover
          </Link>
          <Link
            href="/dashboard"
            className="px-3.5 py-1.5 bg-violet-600 hover:bg-violet-500 rounded-lg text-white font-medium transition-colors shadow-sm"
          >
            Open App
          </Link>
        </nav>
      </div>
    </header>
  );
}
