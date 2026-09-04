import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { seoContent } from '@/lib/seo/content';
import SeoHero from '@/components/seo/SeoHero';
import SeoFeatures from '@/components/seo/SeoFeatures';
import SeoBenefits from '@/components/seo/SeoBenefits';
import SeoFAQ from '@/components/seo/SeoFAQ';
import SeoRelatedLinks from '@/components/seo/SeoRelatedLinks';
import Logo from '@/components/Logo';
import Link from 'next/link';

// Generate static pages at build time
export function generateStaticParams() {
  return Object.keys(seoContent).map((slug) => ({
    slug,
  }));
}

// Generate dynamic metadata for each page
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const content = seoContent[slug];
  
  if (!content) {
    return {
      title: 'Not Found | LeaderboardOS',
    };
  }

  return {
    title: content.title,
    description: content.metaDescription,
    openGraph: {
      title: content.title,
      description: content.metaDescription,
      type: 'website',
    },
    alternates: {
      canonical: `https://leaderboardos.com/${content.slug}`,
    }
  };
}

export default async function SeoLandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const content = seoContent[slug];

  // Safely 404 if the slug isn't explicitly defined in our content registry
  if (!content) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-black selection:bg-violet-500/30 selection:text-white">
      {/* Simple Header */}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-black/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/">
            <Logo className="w-32 hover:opacity-80 transition-opacity" />
          </Link>
          <div className="flex gap-4">
            <Link 
              href="/login" 
              className="text-sm font-medium text-neutral-400 hover:text-white transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      <main>
        <SeoHero content={content} />
        <SeoBenefits content={content} />
        <SeoFeatures content={content} />
        <SeoFAQ content={content} />
        <SeoRelatedLinks content={content} />
      </main>

      {/* Simple Footer */}
      <footer className="bg-black py-12 px-6 border-t border-white/5 text-center text-sm text-neutral-500">
        <p>© {new Date().getFullYear()} LeaderboardOS. Built for performance.</p>
      </footer>
    </div>
  );
}
