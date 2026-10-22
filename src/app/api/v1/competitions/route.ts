import { NextRequest } from 'next/server';
import { DatabaseService } from '@/lib/db';
import { authenticateApiKey, extractApiKeyFromRequest } from '@/lib/api/auth';
import { apiError, apiSuccess } from '@/lib/api/response';
import { CompetitionEngine, CompetitionType, Leaderboard } from '@/types';

export const runtime = 'nodejs';

/**
 * GET /api/v1/competitions
 * List competitions.
 * - Public requests: returns active public competitions only.
 * - Authenticated requests: returns public competitions plus private competitions owned by the key owner.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10)));
    const category = searchParams.get('category') as CompetitionType | null;
    const engine = searchParams.get('engine') as CompetitionEngine | null;
    const search = searchParams.get('search')?.toLowerCase().trim() || null;

    let authenticatedOwnerId: string | null = null;
    let rateLimitHeaders: Record<string, string> = {};

    const hasAuthHeader = !!extractApiKeyFromRequest(request);
    if (hasAuthHeader) {
      const auth = await authenticateApiKey(request, 'competitions:read');
      if (!auth.success) {
        return auth.response;
      }
      authenticatedOwnerId = auth.ownerId;
      rateLimitHeaders = auth.rateLimitHeaders;
    }

    const allLeaderboards = await DatabaseService.getLeaderboards();
    const allConfigs = await DatabaseService.getCompetitionConfigs();

    // Filter competitions
    let filtered = allLeaderboards.filter((lb: Leaderboard) => {
      // Visibility rule: must be public, OR owned by the authenticated API key owner
      const isVisible =
        lb.visibility === 'public' || (authenticatedOwnerId && lb.owner_id === authenticatedOwnerId);
      if (!isVisible) return false;

      // Category filter
      if (category && category !== 'custom' && lb.competition_type !== category) {
        return false;
      }

      // Search filter
      if (search) {
        const nameMatch = lb.name.toLowerCase().includes(search);
        const descMatch = (lb.description || '').toLowerCase().includes(search);
        if (!nameMatch && !descMatch) return false;
      }

      return true;
    });

    // Engine filter
    if (engine) {
      filtered = filtered.filter((lb) => {
        const config = allConfigs.find((c) => c.leaderboard_id === lb.id);
        const engineType = config?.engine_type || 'simple_points';
        return engineType === engine;
      });
    }

    // Pagination
    const total = filtered.length;
    const totalPages = Math.ceil(total / pageSize);
    const offset = (page - 1) * pageSize;
    const paginated = filtered.slice(offset, offset + pageSize);

    // Format normalized response items
    const data = paginated.map((lb) => {
      const config = allConfigs.find((c) => c.leaderboard_id === lb.id);
      return {
        id: lb.id,
        slug: lb.slug,
        name: lb.name,
        description: lb.description,
        visibility: lb.visibility,
        competition_type: lb.competition_type,
        engine_type: config?.engine_type || 'simple_points',
        entity_type: config?.entity_type || 'individual',
        operational_status: config?.operational_status || 'in_progress',
        cover_image_url: lb.cover_image_url,
        owner_id: lb.owner_id,
        status: lb.status,
        created_at: lb.created_at,
        updated_at: lb.updated_at,
      };
    });

    const cacheHeader = authenticatedOwnerId
      ? 'private, no-cache'
      : 'public, s-maxage=60, stale-while-revalidate=120';

    return apiSuccess(
      data,
      {
        page,
        pageSize,
        total,
        hasMore: page < totalPages,
      },
      200,
      {
        'Cache-Control': cacheHeader,
        ...rateLimitHeaders,
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return apiError('SERVER_ERROR', message, 500);
  }
}
