import { createSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server';
import { DEFAULT_LEADERBOARDS, DEFAULT_MEMBERS } from '@/lib/db';
import { DiscoveryCategory } from './registry';

export const DISCOVERY_PAGE_SIZE = 12;

export interface DiscoveryLeaderboard {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  competition_type: string;
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
    let mockList = DEFAULT_LEADERBOARDS.filter(
      (lb) => lb.visibility === 'public' && lb.status === 'active'
    );

    if (category) {
      mockList = mockList.filter(
        (lb) => lb[category.filter.column] === category.filter.value
      );
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      mockList = mockList.filter(
        (lb) =>
          lb.name.toLowerCase().includes(q) ||
          (lb.description ? lb.description.toLowerCase().includes(q) : false)
      );
    }

    mockList.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    const totalCount = mockList.length;
    const offset = (page - 1) * DISCOVERY_PAGE_SIZE;
    const pageData = mockList.slice(offset, offset + DISCOVERY_PAGE_SIZE);

    const formattedData: DiscoveryLeaderboard[] = pageData.map((lb) => ({
      id: lb.id,
      slug: lb.slug,
      name: lb.name,
      description: lb.description,
      competition_type: lb.competition_type,
      cover_image_url: lb.cover_image_url,
      updated_at: lb.updated_at,
      rankings_count: DEFAULT_MEMBERS.filter((m) => m.leaderboard_id === lb.id).length,
    }));

    return { data: formattedData, totalCount };
  }

  const supabase = await createSupabaseServerClient();
  const offset = (page - 1) * DISCOVERY_PAGE_SIZE;

  let query = supabase
    .from('leaderboards')
    .select('id, slug, name, description, competition_type, cover_image_url, updated_at, rankings:leaderboard_rankings(count)', { count: 'exact' })
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
    competition_type: lb.competition_type,
    cover_image_url: lb.cover_image_url,
    updated_at: lb.updated_at,
    rankings_count: (lb as { rankings?: Array<{ count?: number }> }).rankings?.[0]?.count ?? 0,
  }));

  return { data: formattedData, totalCount: count || 0 };
}
