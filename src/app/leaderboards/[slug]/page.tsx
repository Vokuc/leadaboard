/**
 * /leaderboards/[slug] — Public Leaderboard Page
 *
 * This is a Server Component. It:
 *  1. Fetches leaderboard data server-side (SSR) so Googlebot sees real content.
 *  2. Exports generateMetadata() for per-leaderboard title, description, and OG tags.
 *  3. Returns 404 for private or non-existent leaderboards.
 *  4. Passes SSR data to LeaderboardView (Client Component) as initial props,
 *     eliminating the loading flash for real users while keeping real-time updates alive.
 *
 * Demo mode (no Supabase env vars): renders LeaderboardView with initialData=null so the
 * client component falls back to its existing localStorage-based loading flow.
 */

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { cache } from 'react';
import { createSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server';
import {
  buildMetadata,
  BASE_URL,
  buildLeaderboardBreadcrumbJsonLd,
  buildLeaderboardEventJsonLd,
} from '@/lib/seo/metadata';
import { canIndexLeaderboard } from '@/lib/seo/indexing';
import LeaderboardView, {
  type LeaderboardViewInitialData,
} from './LeaderboardView';

import { getAuthoritativeShareData, ShareType } from '@/lib/sharing/service';

// ─── Types ────────────────────────────────────────────────────────────────────

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{
    share?: string;
    member?: string;
    match?: string;
    fixture?: string;
    v?: string;
  }>;
};

// ─── Server-Side Data Fetching ────────────────────────────────────────────────

// cache() deduplicates requests if called multiple times in the same render pass
// (e.g. once in generateMetadata, once in the page component).
const fetchPublicLeaderboardData = cache(async (
  slug: string,
): Promise<LeaderboardViewInitialData | null> => {
  if (!isSupabaseServerConfigured) return null;

  const supabase = await createSupabaseServerClient();

  // Fetch the leaderboard — RLS will enforce visibility=public for anon requests.
  // We also add an explicit .eq('visibility', 'public') as defense-in-depth.
  const { data: lb, error: lbError } = await supabase
    .from('leaderboards')
    .select('*')
    .eq('slug', slug)
    .eq('visibility', 'public')
    .maybeSingle();

  if (lbError || !lb) return null;

  // Parallel fetch of all related data
  const [
    { data: seasons },
    { data: rankings },
    { data: logs },
    { data: config },
  ] = await Promise.all([
    supabase
      .from('seasons')
      .select('*')
      .eq('leaderboard_id', lb.id)
      .order('start_date', { ascending: false }),
    supabase
      .from('leaderboard_rankings')
      .select('*')
      .eq('leaderboard_id', lb.id)
      .order('total_points', { ascending: false }),
    supabase
      .from('activity_logs')
      .select('*')
      .eq('leaderboard_id', lb.id)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('competition_configs')
      .select('*')
      .eq('leaderboard_id', lb.id)
      .maybeSingle(),
  ]);

  return {
    leaderboard: lb,
    season: seasons?.[0] ?? null,
    rankings: (rankings ?? []) as LeaderboardViewInitialData['rankings'],
    activityLogs: (logs ?? []) as LeaderboardViewInitialData['activityLogs'],
    competitionConfig: (config ?? null) as LeaderboardViewInitialData['competitionConfig'],
  };
});

// ─── Dynamic Metadata ─────────────────────────────────────────────────────────

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { share, member, match, fixture, v } = (await searchParams) || {};

  // Check if this is a shared result deep link
  if (share && ['placement', 'champion', 'match', 'bracket', 'competition'].includes(share)) {
    const shareData = await getAuthoritativeShareData({
      type: share as ShareType,
      slug,
      memberId: member,
      matchId: match,
      fixtureId: fixture,
      version: v,
    });

    if (shareData && !shareData.isPrivate) {
      return {
        title: `${shareData.title} | ${shareData.competitionName} | LeaderboardOS`,
        description: `${shareData.subtitle} Verified competitive results on LeaderboardOS.`,
        alternates: {
          canonical: shareData.canonicalUrl,
        },
        openGraph: {
          title: `${shareData.title} — ${shareData.competitionName}`,
          description: shareData.subtitle,
          url: shareData.canonicalUrl,
          siteName: 'LeaderboardOS',
          images: [
            {
              url: shareData.ogImageUrl,
              width: 1200,
              height: 630,
              alt: `${shareData.title} on LeaderboardOS`,
            },
          ],
          type: 'website',
        },
        twitter: {
          card: 'summary_large_image',
          title: `${shareData.title} — ${shareData.competitionName}`,
          description: shareData.subtitle,
          images: [shareData.ogImageUrl],
        },
      };
    }
  }

  // Demo mode: we have no server data — return minimal non-indexed metadata
  if (!isSupabaseServerConfigured) {
    return buildMetadata({
      title: 'Leaderboard',
      noindex: true,
    });
  }

  const data = await fetchPublicLeaderboardData(slug);
  const lb = data?.leaderboard;

  // Private or missing leaderboard: noindex
  if (!lb || lb.visibility !== 'public') {
    return buildMetadata({
      title: 'Leaderboard Not Found',
      noindex: true,
    });
  }

  // Thin/empty leaderboard: render normally but noindex
  const isIndexable = canIndexLeaderboard(lb, data.rankings.length);
  if (!isIndexable) {
    return buildMetadata({
      title: lb.name,
      description: lb.description || `Live real-time leaderboard for ${lb.name}.`,
      noindex: true,
    });
  }

  const description =
    lb.description ||
    `Live real-time leaderboard for ${lb.name}. View current rankings, scores, and standings.`;

  const versionHash = String(new Date(lb.updated_at || lb.created_at).getTime());
  const ogImageUrl = `${BASE_URL}/api/og/share?type=competition&slug=${lb.slug}&v=${versionHash}`;

  return buildMetadata({
    title: lb.name,
    description,
    canonical: `${BASE_URL}/leaderboards/${lb.slug}`,
    ogImage: lb.cover_image_url || ogImageUrl,
  });
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default async function PublicLeaderboardPage({ params }: PageProps) {
  const { slug } = await params;

  // Demo mode: no server data available — hand off to client component
  // which will load from localStorage using the existing demo flow.
  if (!isSupabaseServerConfigured) {
    return <LeaderboardView slug={slug} initialData={null} />;
  }

  const data = await fetchPublicLeaderboardData(slug);

  // Private or non-existent leaderboard → proper 404
  if (!data || !data.leaderboard) {
    notFound();
  }

  const breadcrumbJsonLd = buildLeaderboardBreadcrumbJsonLd(data.leaderboard.name, slug);
  const eventJsonLd = buildLeaderboardEventJsonLd({
    name: data.leaderboard.name,
    description: data.leaderboard.description,
    slug: data.leaderboard.slug,
    cover_image_url: data.leaderboard.cover_image_url,
    competition_type: data.competitionConfig?.template_key || 'standard',
    startDate: data.season?.start_date || undefined,
    endDate: data.season?.end_date || undefined,
  });

  // Pass SSR data as initial props. The client component will:
  //  - Render immediately without a loading flash
  //  - Subscribe to Supabase Realtime for live updates
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(eventJsonLd) }}
      />
      <LeaderboardView slug={slug} initialData={data} />
    </>
  );
}
