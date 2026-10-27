import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import { ArrowLeft, BookOpen } from 'lucide-react';
import DocsHeader from '@/components/docs/DocsHeader';
import DocsSearchClient from '@/components/docs/DocsSearchClient';
import SeoFooter from '@/components/seo/SeoFooter';
import { getCategories } from '@/lib/docs/api';

export const metadata: Metadata = {
  title: 'Search Documentation | LeaderboardOS Help Center',
  description: 'Search guides, features, rules configuration, and troubleshooting documentation across LeaderboardOS.',
  alternates: {
    canonical: 'https://leaderboardos.com/docs/search',
  },
};

export default async function DocsSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const { q = '', category = '' } = await searchParams;
  const categories = getCategories();

  return (
    <div className="min-h-screen bg-black text-white flex flex-col selection:bg-violet-500/30">
      <DocsHeader showSearch={false} />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-12">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 mb-8">
          <Link
            href="/docs"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Help Center Home</span>
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-2">
            Search Documentation
          </h1>
          <p className="text-sm text-neutral-400">
            Find answers, step-by-step guides, rules configurations, and troubleshooting solutions.
          </p>
        </div>

        <DocsSearchClient
          initialQuery={q}
          initialCategory={category}
          categories={categories}
        />
      </main>

      <SeoFooter />
    </div>
  );
}
