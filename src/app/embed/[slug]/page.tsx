import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { cache } from 'react';
import { createSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server';
import { buildMetadata, BASE_URL } from '@/lib/seo/metadata';
import EmbedView from './EmbedView';

// ─── Types ────────────────────────────────────────────────────────────────────

type PageProps = {
  params: Promise<{ slug: string }>;
};

// ─── Server-Side Data Fetching ────────────────────────────────────────────────

const fetchPublicLeaderboardData = cache(async (slug: string) => {
  if (!isSupabaseServerConfigured) return null;

  const supabase = await createSupabaseServerClient();

  // Fetch the leaderboard
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
      .limit(20),
    supabase
      .from('competition_configs')
      .select('*')
      .eq('leaderboard_id', lb.id)
      .maybeSingle(),
  ]);

  return {
    leaderboard: lb,
    season: seasons?.[0] ?? null,
    rankings: (rankings ?? []),
    activityLogs: (logs ?? []),
    competitionConfig: (config ?? null),
  };
});

// ─── Dynamic Metadata ─────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  
  if (!isSupabaseServerConfigured) {
    return buildMetadata({
      title: 'Leaderboard Embed',
      noindex: true,
    });
  }

  const data = await fetchPublicLeaderboardData(slug);
  const lb = data?.leaderboard;

  // Embed routes should ALWAYS be noindex to prevent competing with canonical page
  if (!lb) {
    return buildMetadata({
      title: 'Leaderboard Not Found',
      noindex: true,
    });
  }

  return buildMetadata({
    title: `${lb.name} Embed`,
    description: `Embedded leaderboard for ${lb.name}`,
    canonical: `${BASE_URL}/leaderboards/${lb.slug}`,
    noindex: true,
  });
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default async function EmbedPage({ params }: PageProps) {
  const { slug } = await params;

  if (!isSupabaseServerConfigured) {
    return <EmbedView slug={slug} initialData={null} />;
  }

  const data = await fetchPublicLeaderboardData(slug);

  if (!data || !data.leaderboard) {
    notFound();
  }

  return <EmbedView slug={slug} initialData={data} />;
}
