import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import ReactMarkdown from 'react-markdown';
import { 
  ArrowLeft, 
  ArrowRight, 
  Clock, 
  Calendar, 
  ChevronRight, 
  Tag,
  Share2,
  ExternalLink,
  BookOpen
} from 'lucide-react';
import DocsHeader from '@/components/docs/DocsHeader';
import DocsSidebar from '@/components/docs/DocsSidebar';
import DocsTableOfContents from '@/components/docs/DocsTableOfContents';
import FeedbackWidget from '@/components/docs/FeedbackWidget';
import SeoFooter from '@/components/seo/SeoFooter';
import { 
  getDocBySlug, 
  getDocSlugs, 
  getCategories, 
  getAdjacentDocs,
  getAllDocs
} from '@/lib/docs/api';

export async function generateStaticParams() {
  const slugs = getDocSlugs();
  return slugs.map((slug) => ({
    slug: slug.replace(/\.md$/, ''),
  }));
}

export async function generateMetadata({ 
  params 
}: { 
  params: Promise<{ slug: string }> 
}): Promise<Metadata> {
  const { slug } = await params;
  const doc = getDocBySlug(slug);

  if (!doc) {
    return { title: 'Article Not Found | LeaderboardOS Help Center' };
  }

  const canonicalUrl = `https://leaderboardos.com/docs/${doc.slug}`;

  return {
    title: `${doc.title} — LeaderboardOS Guide`,
    description: doc.description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `${doc.title} — LeaderboardOS Guide`,
      description: doc.description,
      url: canonicalUrl,
      type: 'article',
      siteName: 'LeaderboardOS',
    },
  };
}

export default async function DocArticlePage({ 
  params 
}: { 
  params: Promise<{ slug: string }> 
}) {
  const { slug } = await params;
  const doc = getDocBySlug(slug);

  if (!doc) {
    notFound();
  }

  const categories = getCategories();
  const { previous, next } = getAdjacentDocs(slug);
  const allDocs = getAllDocs();
  
  // Find related articles by matching slugs or same category
  const relatedArticles = doc.related
    .map(relSlug => allDocs.find(d => d.slug === relSlug))
    .filter((d): d is typeof allDocs[0] => Boolean(d))
    .slice(0, 3);

  // JSON-LD Structured Data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: doc.title,
    description: doc.description,
    articleSection: doc.category,
    dateModified: doc.lastUpdated,
    author: {
      '@type': 'Organization',
      name: 'LeaderboardOS Technical Team',
      url: 'https://leaderboardos.com',
    },
    publisher: {
      '@type': 'Organization',
      name: 'LeaderboardOS',
      logo: {
        '@type': 'ImageObject',
        url: 'https://leaderboardos.com/icon.jpg',
      },
    },
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col selection:bg-violet-500/30">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <DocsHeader showSearch={true} />

      <div className="flex-1 max-w-7xl mx-auto w-full flex">
        {/* Left Navigation Sidebar */}
        <DocsSidebar categories={categories} currentSlug={doc.slug} />

        {/* Center Article Content */}
        <main className="flex-1 min-w-0 px-4 sm:px-8 py-8 md:py-12 overflow-x-hidden">
          {/* Breadcrumb Navigation */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-neutral-400 mb-6 flex-wrap">
            <Link href="/docs" className="hover:text-white transition-colors">
              Help Center
            </Link>
            <ChevronRight className="w-3 h-3 text-neutral-400" />
            <span className="text-violet-400 font-medium">{doc.category}</span>
            <ChevronRight className="w-3 h-3 text-neutral-400" />
            <span className="text-neutral-300 truncate max-w-xs">{doc.title}</span>
          </nav>

          {/* Article Header */}
          <header className="mb-10 pb-8 border-b border-white/10">
            <div className="flex items-center gap-3 text-xs text-neutral-400 mb-4 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 font-medium">
                {doc.category}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {doc.readTime}
              </span>
              <span>&bull;</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Updated {doc.lastUpdated}
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-4">
              {doc.title}
            </h1>

            <p className="text-base sm:text-lg text-neutral-400 leading-relaxed max-w-3xl">
              {doc.description}
            </p>
          </header>

          {/* Markdown Body */}
          <article className="prose prose-invert prose-violet max-w-none prose-headings:scroll-mt-24 prose-headings:tracking-tight prose-headings:font-bold prose-h2:text-2xl sm:prose-h2:text-3xl prose-h2:mt-12 prose-h2:mb-4 prose-h2:pb-2 prose-h2:border-b prose-h2:border-white/5 prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3 prose-p:text-neutral-300 prose-p:leading-relaxed prose-p:mb-6 prose-ul:my-6 prose-li:text-neutral-300 prose-li:my-1 prose-table:my-8 prose-th:bg-white/5 prose-th:p-3 prose-td:p-3 prose-td:border-b prose-td:border-white/5 prose-pre:bg-neutral-900 prose-pre:border prose-pre:border-white/10 prose-code:text-violet-300 prose-code:bg-white/5 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:font-mono">
            <ReactMarkdown
              components={{
                a: ({ node, ...props }) => {
                  const href = props.href || '#';
                  const isExternal = href.startsWith('http');
                  return (
                    <Link
                      href={href}
                      target={isExternal ? '_blank' : undefined}
                      rel={isExternal ? 'noopener noreferrer' : undefined}
                      className="text-violet-400 hover:text-violet-300 underline underline-offset-4 font-medium transition-colors inline-flex items-center gap-0.5"
                    >
                      <span>{props.children}</span>
                      {isExternal && <ExternalLink className="w-3 h-3 inline-block ml-0.5" />}
                    </Link>
                  );
                },
                h2: ({ node, ...props }) => {
                  const text = props.children?.toString() || '';
                  const id = text.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
                  return <h2 id={id} {...props} />;
                },
                h3: ({ node, ...props }) => {
                  const text = props.children?.toString() || '';
                  const id = text.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
                  return <h3 id={id} {...props} />;
                },
                table: ({ node, ...props }) => (
                  <div className="overflow-x-auto my-8 border border-white/10 rounded-xl">
                    <table className="w-full text-left text-sm" {...props} />
                  </div>
                ),
              }}
            >
              {doc.content}
            </ReactMarkdown>
          </article>

          {/* Tags */}
          {doc.tags.length > 0 && (
            <div className="mt-12 pt-6 border-t border-white/10 flex items-center gap-2 flex-wrap text-xs text-neutral-400">
              <Tag className="w-3.5 h-3.5 text-neutral-400" />
              <span className="font-medium">Tags:</span>
              {doc.tags.map(tag => (
                <Link
                  key={tag}
                  href={`/docs/search?q=${encodeURIComponent(tag)}`}
                  className="px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 hover:text-white transition-colors"
                >
                  #{tag}
                </Link>
              ))}
            </div>
          )}

          {/* Feedback Widget */}
          <FeedbackWidget slug={doc.slug} />

          {/* Previous / Next Article Navigation */}
          <nav aria-label="Article navigation" className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-10 pt-6 border-t border-white/10">
            {previous ? (
              <Link
                href={`/docs/${previous.slug}`}
                className="p-4 rounded-xl bg-neutral-900/60 hover:bg-neutral-900 border border-white/10 hover:border-violet-500/40 transition-all group"
              >
                <div className="text-xs text-neutral-400 flex items-center gap-1 mb-1">
                  <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
                  <span>Previous Article</span>
                </div>
                <div className="text-sm font-semibold text-white group-hover:text-violet-300 transition-colors line-clamp-1">
                  {previous.title}
                </div>
              </Link>
            ) : <div />}

            {next ? (
              <Link
                href={`/docs/${next.slug}`}
                className="p-4 rounded-xl bg-neutral-900/60 hover:bg-neutral-900 border border-white/10 hover:border-violet-500/40 transition-all text-right group ml-auto w-full sm:w-auto"
              >
                <div className="text-xs text-neutral-400 flex items-center justify-end gap-1 mb-1">
                  <span>Next Article</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
                <div className="text-sm font-semibold text-white group-hover:text-violet-300 transition-colors line-clamp-1">
                  {next.title}
                </div>
              </Link>
            ) : <div />}
          </nav>

          {/* Related Articles Cards */}
          {relatedArticles.length > 0 && (
            <div className="mt-12 pt-8 border-t border-white/10">
              <h3 className="text-lg font-bold text-white mb-4">Related Guides</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {relatedArticles.map(rel => (
                  <Link
                    key={rel.slug}
                    href={`/docs/${rel.slug}`}
                    className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all group"
                  >
                    <div className="text-[11px] text-violet-400 font-medium mb-1">{rel.category}</div>
                    <h4 className="text-xs font-bold text-white group-hover:text-violet-300 transition-colors line-clamp-2">
                      {rel.title}
                    </h4>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </main>

        {/* Right On-This-Page Table of Contents */}
        <DocsTableOfContents headings={doc.headings} />
      </div>

      <SeoFooter />
    </div>
  );
}
