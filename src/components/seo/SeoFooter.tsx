import React from 'react';
import Link from 'next/link';

export default function SeoFooter() {
  return (
    <footer className="w-full border-t border-white/5 bg-black py-12 mt-auto">
      <div className="max-w-5xl mx-auto px-6 text-center">
        <p className="text-neutral-500 text-sm mb-4">
          &copy; {new Date().getFullYear()} LeaderboardOS. All rights reserved.
        </p>
        <div className="flex items-center justify-center gap-6 text-sm text-neutral-400">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <Link href="/blog" className="hover:text-white transition-colors">Blog</Link>
          <Link href="/directory" className="hover:text-white transition-colors">Discover</Link>
        </div>
      </div>
    </footer>
  );
}
