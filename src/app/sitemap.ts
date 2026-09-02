import type { MetadataRoute } from 'next';
import { isSupabaseServerConfigured } from '@/lib/supabase/server';
import { canIndexLeaderboard } from '@/lib/seo/indexing';
import { createClient } from '@supabase/supabase-js';

// Cache sitemap requests for 24 hours to prevent database overload
export const revalidate = 86400;

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://leaderboardos.com';
const SITEMAP_CHUNK_SIZE = 25000;

// Create a stateless client for build-time generation
const getSitemapClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  );
};

export async function generateSitemaps() {
  if (!isSupabaseServerConfigured) return [{ id: 0 }];

  const supabase = getSitemapClient();
  // Fetch just the count to determine how many chunks we need
  const { count } = await supabase
    .from('leaderboards')
    .select('*', { count: 'exact', head: true })
    .eq('visibility', 'public')
    .eq('status', 'active');

  if (!count) return [{ id: 0 }];

  const chunkCount = Math.ceil(count / SITEMAP_CHUNK_SIZE);
  return Array.from({ length: chunkCount }, (_, i) => ({ id: i }));
}

export default async function sitemap({ id }: { id: number }): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = id === 0 ? [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${BASE_URL}/login`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/how-to-play`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/tools`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE_URL}/tools/leaderboard-maker`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE_URL}/tools/league-table-generator`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/tools/football-league-table`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/tools/tournament-generator`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/tools/points-calculator`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
  ] : [];

  if (!isSupabaseServerConfigured) {
    return staticRoutes;
  }

  try {
    const supabase = getSitemapClient();

    // Fetch this chunk of leaderboards, including their ranking counts in a single query
    const { data } = await supabase
      .from('leaderboards')
      .select('id, slug, updated_at, visibility, status, rankings:leaderboard_rankings(count)')
      .eq('visibility', 'public')
      .eq('status', 'active')
      .order('id', { ascending: true }) // Stable sort for pagination
      .range(id * SITEMAP_CHUNK_SIZE, (id + 1) * SITEMAP_CHUNK_SIZE - 1);

    const validLeaderboards = (data || []).filter((lb) => {
      // @ts-ignore - Supabase types return { count } for joined tables but TS doesn't infer it correctly
      const rankingsCount = lb.rankings?.[0]?.count ?? 0;
      // Note: we pass lb as any to canIndexLeaderboard because we only selected a subset of fields
      return canIndexLeaderboard(lb as any, rankingsCount);
    });

    const leaderboardRoutes: MetadataRoute.Sitemap = validLeaderboards.map((lb) => ({
      url: `${BASE_URL}/leaderboards/${lb.slug}`,
      lastModified: new Date(lb.updated_at as string),
      priority: 0.8,
      changeFrequency: 'hourly' as const,
    }));

    return [...staticRoutes, ...leaderboardRoutes];
  } catch (error) {
    console.error('Error generating sitemap chunk:', error);
    return staticRoutes;
  }
}
