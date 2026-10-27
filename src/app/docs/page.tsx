import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import { 
  Rocket, 
  Trophy, 
  Table, 
  GitBranch, 
  Users, 
  Share2, 
  CreditCard, 
  HelpCircle, 
  Sparkles, 
  ArrowRight, 
  BookOpen,
  CheckCircle2,
  ExternalLink,
  Code2
} from 'lucide-react';
import DocsHeader from '@/components/docs/DocsHeader';
import DocsSearchBar from '@/components/docs/DocsSearchBar';
import SeoFooter from '@/components/seo/SeoFooter';
import { getCategories, getAllDocs } from '@/lib/docs/api';

export const metadata: Metadata = {
  title: 'LeaderboardOS Help Center & Documentation Hub',
  description: 'Official guides, rules configuration, API references, and troubleshooting for LeaderboardOS competitions.',
  alternates: {
    canonical: 'https://leaderboardos.com/docs',
  },
  openGraph: {
    title: 'LeaderboardOS Help Center & Documentation Hub',
    description: 'Learn how to create, schedule, score, and monetize sports leagues, esports tournaments, and points boards.',
    url: 'https://leaderboardos.com/docs',
    siteName: 'LeaderboardOS',
    type: 'website',
  },
};

const CATEGORY_ICON_MAP: Record<string, React.ReactNode> = {
  'getting-started': <Rocket className="w-6 h-6 text-violet-400" />,
  'leaderboards-and-scoring': <Trophy className="w-6 h-6 text-amber-400" />,
  'league-tables': <Table className="w-6 h-6 text-emerald-400" />,
  'tournaments-and-brackets': <GitBranch className="w-6 h-6 text-cyan-400" />,
  'participants-and-administration': <Users className="w-6 h-6 text-indigo-400" />,
  'sharing-and-embeds': <Share2 className="w-6 h-6 text-pink-400" />,
  'plans-and-billing': <CreditCard className="w-6 h-6 text-yellow-400" />,
  'troubleshooting-and-faq': <HelpCircle className="w-6 h-6 text-rose-400" />,
};

export default function DocsHomePage() {
  const categories = getCategories();
  const allDocs = getAllDocs();

  // Highlighted popular guides
  const popularArticles = [
    {
      slug: 'creating-your-first-competition',
      title: 'Creating Your First Competition',
      category: 'Getting Started',
      description: 'Step-by-step walkthrough to set up rules, teams, and launch in under 60 seconds.',
    },
    {
      slug: 'managing-fixtures-and-match-results',
      title: 'Automated Round-Robin Scheduling',
      category: 'League Tables',
      description: 'Generate balanced league calendars with venue allocations and zero clashes.',
    },
    {
      slug: 'managing-matches-and-advancing-winners',
      title: 'Knockout Brackets & Winner Progression',
      category: 'Tournaments & Brackets',
      description: 'How single-elimination tournament seeds advance through interactive brackets.',
    },
    {
      slug: 'embedding-competitions',
      title: 'Embedding Live Widgets on Websites',
      category: 'Sharing & Embeds',
      description: 'Integrate live standings and brackets into WordPress, Wix, or custom websites.',
    },
    {
      slug: 'subscription-plans-and-limits',
      title: 'SaaS Plans & Entitlements',
      category: 'Plans & Billing',
      description: 'Understand limits, upgrading to Pro, and unlocking developer API keys.',
    },
    {
      slug: 'frequently-asked-questions',
      title: 'Frequently Asked Questions (FAQ)',
      category: 'Troubleshooting & FAQ',
      description: 'Quick answers on demo mode, tie-breakers, participant passports, and pricing.',
    },
  ];

  return (
    <div className="min-h-screen bg-black text-white flex flex-col selection:bg-violet-500/30">
      <DocsHeader showSearch={false} />

      {/* Hero Section with Search */}
      <section className="relative py-20 px-4 sm:px-6 overflow-hidden border-b border-white/10 bg-radial-[at_50%_0%] from-violet-950/40 via-black to-black">
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-xs font-semibold text-violet-300 mb-6">
            <BookOpen className="w-3.5 h-3.5" />
            <span>LeaderboardOS Official Documentation</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white mb-6">
            How can we help you compete?
          </h1>

          <p className="text-base sm:text-lg text-neutral-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Search our guides, learn how to configure competition rules, manage round-robin leagues, advance tournament brackets, and embed live scoreboards.
          </p>

          <div className="max-w-2xl mx-auto">
            <DocsSearchBar placeholder="Search articles, guides, rules, or troubleshooting..." autoFocus />
            <div className="flex flex-wrap items-center justify-center gap-2 mt-4 text-xs text-neutral-400">
              <span className="text-neutral-400 font-medium">Popular:</span>
              <Link href="/docs/creating-your-first-competition" className="text-neutral-300 hover:text-white underline decoration-white/20 transition-colors">First Competition</Link>
              <span>&bull;</span>
              <Link href="/docs/managing-fixtures-and-match-results" className="text-neutral-300 hover:text-white underline decoration-white/20 transition-colors">Scheduler</Link>
              <span>&bull;</span>
              <Link href="/docs/embedding-competitions" className="text-neutral-300 hover:text-white underline decoration-white/20 transition-colors">Embeds</Link>
              <span>&bull;</span>
              <Link href="/docs/subscription-plans-and-limits" className="text-neutral-300 hover:text-white underline decoration-white/20 transition-colors">Pricing</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Quickstart Callout Banner */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 -mt-8 relative z-20 w-full">
        <div className="p-6 md:p-8 bg-gradient-to-r from-neutral-900 to-neutral-900/90 border border-violet-500/30 rounded-2xl shadow-2xl backdrop-blur-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2 text-xs font-bold text-violet-400 uppercase tracking-wider">
              <Sparkles className="w-4 h-4" />
              Quickstart Guide
            </div>
            <h3 className="text-xl font-bold text-white">New to LeaderboardOS? Start here.</h3>
            <p className="text-sm text-neutral-400 leading-relaxed">
              Explore our core concepts, learn the differences between the three competition engines, and launch your first live leaderboard in under 60 seconds.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0">
            <Link
              href="/docs/what-is-leaderboardos"
              className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors shadow-lg flex items-center gap-2"
            >
              <span>Read Introduction</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/dashboard/create"
              className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2"
            >
              <span>Open Creator</span>
              <ExternalLink className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Categories Grid */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-20 flex-1 w-full">
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-white tracking-tight mb-2">Browse by Topic</h2>
          <p className="text-sm text-neutral-400">
            Explore comprehensive guides organized across {categories.length} core platform areas.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {categories.map((category) => {
            const icon = CATEGORY_ICON_MAP[category.id] || <BookOpen className="w-6 h-6 text-violet-400" />;
            const firstArticle = category.articles[0];

            return (
              <div
                key={category.id}
                className="group p-6 bg-neutral-900/60 hover:bg-neutral-900 border border-white/10 hover:border-violet-500/40 rounded-2xl transition-all duration-200 flex flex-col justify-between"
              >
                <div>
                  <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                    {icon}
                  </div>
                  <h3 className="text-base font-bold text-white group-hover:text-violet-300 transition-colors mb-2">
                    {category.name}
                  </h3>
                  <p className="text-xs text-neutral-400 leading-relaxed mb-6">
                    {category.description}
                  </p>
                </div>

                <div>
                  <div className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider mb-3">
                    {category.articles.length} Articles
                  </div>
                  {firstArticle && (
                    <Link
                      href={`/docs/${firstArticle.slug}`}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors"
                    >
                      <span>Explore Topic</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Popular Articles Section */}
        <div className="mt-24">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight mb-2">Popular Articles</h2>
              <p className="text-sm text-neutral-400">Essential guides and best practices for organizers.</p>
            </div>
            <Link
              href="/docs/search"
              className="text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1"
            >
              <span>View All ({allDocs.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {popularArticles.map((article) => (
              <Link
                key={article.slug}
                href={`/docs/${article.slug}`}
                className="p-6 bg-neutral-900/40 hover:bg-neutral-900 border border-white/10 hover:border-white/20 rounded-2xl transition-all group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-medium text-violet-400 bg-violet-500/10 px-2.5 py-0.5 rounded-full">
                      {article.category}
                    </span>
                  </div>
                  <h4 className="text-base font-semibold text-white group-hover:text-violet-300 transition-colors mb-2">
                    {article.title}
                  </h4>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    {article.description}
                  </p>
                </div>
                <div className="mt-6 flex items-center gap-1.5 text-xs font-medium text-neutral-400 group-hover:text-white transition-colors">
                  <span>Read Article</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Developer API & Integrations Banner */}
        <div className="mt-20 p-8 bg-neutral-900/60 border border-white/10 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 shrink-0">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-base font-bold text-white">Developer API & Webhooks</h4>
              <p className="text-xs text-neutral-400 mt-1 max-w-xl leading-relaxed">
                Automate score logging, integrate game servers, or receive real-time match events with our scoped REST API v1.
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/developer"
            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-medium rounded-xl transition-colors shrink-0 flex items-center gap-2"
          >
            <span>Developer Portal</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </main>

      <SeoFooter />
    </div>
  );
}
