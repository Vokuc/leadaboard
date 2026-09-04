import { createSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server';
import { DiscoveryCategory } from './registry';

export const DISCOVERY_PAGE_SIZE = 12;

export interface DiscoveryLeaderboard {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  type: string;
  template_key: string | null;
  engine: string;
  cover_image_url: string | null;
  updated_at: string;
  rankings_count: number;
}

export async function getPublicLeaderboards(
  page: number,
  category?: DiscoveryCategory,
  searchQuery?: string
): Promise<{ data: DiscoveryLeaderboard[]; totalCount: number }> {
  if (!isSupabaseServerConfigured) {
    return { data: [], totalCount: 0 };
  }

  const supabase = await createSupabaseServerClient();
  const offset = (page - 1) * DISCOVERY_PAGE_SIZE;

  let query = supabase
    .from('leaderboards')
    .select('id, slug, name, description, type, template_key, engine, cover_image_url, updated_at, rankings:leaderboard_rankings(count)', { count: 'exact' })
    .eq('visibility', 'public')
    .eq('status', 'active');

  if (category) {
    query = query.eq(category.filter.column, category.filter.value);
  }

  if (searchQuery) {
    query = query.ilike('name', `%${searchQuery}%`);
  }

  // Order by recently updated to keep the discovery feed fresh
  query = query.order('updated_at', { ascending: false });
  query = query.range(offset, offset + DISCOVERY_PAGE_SIZE - 1);

  const { data, count, error } = await query;

  if (error) {
    console.error('Error fetching discovery leaderboards:', error);
    return { data: [], totalCount: 0 };
  }

  const formattedData: DiscoveryLeaderboard[] = (data || []).map((lb) => ({
    id: lb.id,
    slug: lb.slug,
    name: lb.name,
    description: lb.description,
    type: lb.type,
    template_key: lb.template_key,
    engine: lb.engine,
    cover_image_url: lb.cover_image_url,
    updated_at: lb.updated_at,
    // @ts-ignore - Supabase join count is returned as an array in PostgREST but TS typing can be tricky
    rankings_count: lb.rankings?.[0]?.count ?? 0,
  }));

  return { data: formattedData, totalCount: count || 0 };
}
