import type { MetadataRoute } from 'next';
import { createSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://leagueboard.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      priority: 1.0,
      changeFrequency: 'weekly',
    },
    {
      url: `${BASE_URL}/how-to-play`,
      lastModified: new Date(),
      priority: 0.5,
      changeFrequency: 'monthly',
    },
  ];

  // Demo mode: no Supabase, so only static routes are known
  if (!isSupabaseServerConfigured) {
    return staticRoutes;
  }

  try {
    const supabase = await createSupabaseServerClient();

    const { data } = await supabase
      .from('leaderboards')
      .select('slug, updated_at')
      .eq('visibility', 'public')
      .eq('status', 'active')
      .order('updated_at', { ascending: false });

    const leaderboardRoutes: MetadataRoute.Sitemap = (data || []).map((lb) => ({
      url: `${BASE_URL}/leaderboards/${lb.slug}`,
      lastModified: new Date(lb.updated_at as string),
      priority: 0.8,
      changeFrequency: 'hourly' as const,
    }));

    return [...staticRoutes, ...leaderboardRoutes];
  } catch {
    // Supabase unavailable — fall back to static routes only
    return staticRoutes;
  }
}
