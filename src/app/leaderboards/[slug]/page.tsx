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
import { createSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server';
import LeaderboardView, {
  type LeaderboardViewInitialData,
} from './LeaderboardView';

// ─── Types ────────────────────────────────────────────────────────────────────

type PageProps = {
  params: Promise<{ slug: string }>;
};

// ─── Server-Side Data Fetching ────────────────────────────────────────────────

async function fetchPublicLeaderboardData(
  slug: string,
): Promise<LeaderboardViewInitialData | null> {
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
}

// ─── Dynamic Metadata ─────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;

  // Demo mode: we have no server data — return minimal non-indexed metadata
  if (!isSupabaseServerConfigured) {
    return {
      title: 'Leaderboard',
      robots: { index: false, follow: false },
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data: lb } = await supabase
    .from('leaderboards')
    .select('name, description, cover_image_url, visibility, slug')
    .eq('slug', slug)
    .maybeSingle();

  // Private or missing leaderboard: noindex
  if (!lb || lb.visibility !== 'public') {
    return {
      title: 'Leaderboard Not Found',
      robots: { index: false, follow: false },
    };
  }

  const description =
    lb.description ||
    `Live real-time leaderboard for ${lb.name}. View current rankings, scores, and standings.`;

  return {
    title: lb.name,
    description,
    openGraph: {
      title: lb.name,
      description,
      type: 'website',
      images: lb.cover_image_url
        ? [{ url: lb.cover_image_url, width: 1200, height: 630, alt: lb.name }]
        : undefined,
    },
    twitter: {
      card: lb.cover_image_url ? 'summary_large_image' : 'summary',
      title: lb.name,
      description,
      images: lb.cover_image_url ? [lb.cover_image_url] : undefined,
    },
    alternates: {
      canonical: `/leaderboards/${lb.slug}`,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
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
  if (!data) {
    notFound();
  }

  // Pass SSR data as initial props. The client component will:
  //  - Render immediately without a loading flash
  //  - Subscribe to Supabase Realtime for live updates
  return <LeaderboardView slug={slug} initialData={data} />;
}
