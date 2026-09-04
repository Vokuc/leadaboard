'use client';

import React, { useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';

interface Props {
  basePath: string;
}

export default function DiscoverySearch({ basePath }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`${basePath}?q=${encodeURIComponent(query.trim())}`);
    } else {
      router.push(basePath);
    }
  };

  return (
    <form onSubmit={handleSearch} className="relative max-w-md w-full">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Search className="h-5 w-5 text-neutral-500" />
      </div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search leaderboards..."
        className="block w-full pl-10 pr-4 py-3 bg-neutral-900/50 border border-neutral-800 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
      />
      <button type="submit" className="hidden">Search</button>
    </form>
  );
}
