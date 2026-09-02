/**
 * Centralized SEO metadata configuration and helper utilities.
 *
 * Usage:
 *   import { buildMetadata, SITE_CONFIG, BASE_URL } from '@/lib/seo/metadata';
 *
 *   export const metadata = buildMetadata({
 *     title: 'Page Title',
 *     description: 'Page description',
 *     canonical: `${BASE_URL}/path`,
 *   });
 */

import type { Metadata } from 'next';

// ─── Site Configuration ───────────────────────────────────────────────────────

export const BASE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://leaderboardos.com').replace(
  /\/$/,
  '',
);

export const SITE_CONFIG = {
  name: 'LeaderboardOS',
  tagline: 'Real-Time Leaderboard as a Service',
  description:
    'Create customizable, real-time leaderboards for gaming tournaments, sports clubs, fitness groups, and corporate sales targets in under a minute without writing code.',
  url: BASE_URL,
  ogImage: `${BASE_URL}/og-default.png`,
  twitterHandle: undefined, // Add @handle when available
} as const;

// ─── Metadata Builder ─────────────────────────────────────────────────────────

export interface BuildMetadataOptions {
  /** Page title. Will be formatted as "{title} | LeaderboardOS" via the root template. */
  title: string;
  /** Meta description. Falls back to site default if omitted. */
  description?: string;
  /** Absolute canonical URL for this page. Strongly recommended for all indexable pages. */
  canonical?: string;
  /** Absolute URL for the Open Graph image. Falls back to /og-default.png. */
  ogImage?: string;
  /** Open Graph type. Defaults to 'website'. */
  ogType?: 'website' | 'article';
  /** Set true to emit noindex/nofollow. */
  noindex?: boolean;
}

export function buildMetadata({
  title,
  description = SITE_CONFIG.description,
  canonical,
  ogImage = SITE_CONFIG.ogImage,
  ogType = 'website',
  noindex = false,
}: BuildMetadataOptions): Metadata {
  return {
    title,
    description,
    ...(canonical && {
      alternates: { canonical },
    }),
    openGraph: {
      title,
      description,
      type: ogType,
      siteName: SITE_CONFIG.name,
      ...(canonical && { url: canonical }),
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
      ...(SITE_CONFIG.twitterHandle ? { site: SITE_CONFIG.twitterHandle } : {}),
    },
    robots: noindex
      ? { index: false, follow: false }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            'max-image-preview': 'large',
            'max-snippet': -1,
          },
        },
  };
}

// ─── JSON-LD Helpers ──────────────────────────────────────────────────────────

/**
 * Sitewide JSON-LD: Organization + WebSite + SoftwareApplication.
 * Embed once in the root layout.
 */
export function buildSiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${BASE_URL}/#organization`,
        name: SITE_CONFIG.name,
        url: BASE_URL,
        logo: {
          '@type': 'ImageObject',
          '@id': `${BASE_URL}/#logo`,
          url: SITE_CONFIG.ogImage,
          width: 1200,
          height: 630,
          caption: SITE_CONFIG.name,
        },
        image: { '@id': `${BASE_URL}/#logo` },
      },
      {
        '@type': 'WebSite',
        '@id': `${BASE_URL}/#website`,
        url: BASE_URL,
        name: SITE_CONFIG.name,
        description: SITE_CONFIG.description,
        publisher: { '@id': `${BASE_URL}/#organization` },
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${BASE_URL}/#software`,
        name: SITE_CONFIG.name,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
        url: BASE_URL,
        description: SITE_CONFIG.description,
        publisher: { '@id': `${BASE_URL}/#organization` },
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
          description: 'Free tier available — no credit card required',
        },
      },
    ],
  };
}

/**
 * BreadcrumbList JSON-LD for a leaderboard page.
 */
export function buildLeaderboardBreadcrumbJsonLd(leaderboardName: string, slug: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: BASE_URL,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Leaderboards',
        item: `${BASE_URL}/leaderboards`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: leaderboardName,
        item: `${BASE_URL}/leaderboards/${slug}`,
      },
    ],
  };
}

/**
 * Event JSON-LD for a leaderboard/competition page.
 */
export function buildLeaderboardEventJsonLd(lb: {
  name: string;
  description: string | null;
  slug: string;
  cover_image_url: string | null;
  competition_type: string;
  startDate?: string;
  endDate?: string;
}) {
  // Map competition_type to Event subtype
  const eventType =
    lb.competition_type === 'sports' || lb.competition_type === 'fitness'
      ? 'SportsEvent'
      : 'Event';

  return {
    '@context': 'https://schema.org',
    '@type': eventType,
    '@id': `${BASE_URL}/leaderboards/${lb.slug}/#event`,
    name: lb.name,
    description: lb.description ?? undefined,
    url: `${BASE_URL}/leaderboards/${lb.slug}`,
    ...(lb.cover_image_url && { image: lb.cover_image_url }),
    ...(lb.startDate && { startDate: lb.startDate }),
    ...(lb.endDate && { endDate: lb.endDate }),
    eventStatus: 'https://schema.org/EventScheduled',
    organizer: { '@id': `${BASE_URL}/#organization` },
  };
}
