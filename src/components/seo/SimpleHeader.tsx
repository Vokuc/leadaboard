import React from 'react';
import Link from 'next/link';
import Logo from '@/components/Logo';

export default function SimpleHeader() {
  return (
    <header className="w-full border-b border-white/5 bg-black/50 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/">
          <Logo className="scale-90 origin-left hover:opacity-80 transition-opacity" />
        </Link>
        <nav className="flex items-center gap-4 text-sm font-medium">
          <Link href="/blog" className="text-neutral-400 hover:text-white transition-colors">Blog</Link>
          <Link href="/directory" className="text-neutral-400 hover:text-white transition-colors">Discover</Link>
          <Link 
            href="/login"
            className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-white transition-colors"
          >
            Sign In
          </Link>
        </nav>
      </div>
    </header>
  );
}
