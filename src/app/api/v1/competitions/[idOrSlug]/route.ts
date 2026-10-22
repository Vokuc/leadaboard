import { NextRequest } from 'next/server';
import { DatabaseService } from '@/lib/db';
import { authenticateApiKey, extractApiKeyFromRequest } from '@/lib/api/auth';
import { apiError, apiSuccess } from '@/lib/api/response';

export const runtime = 'nodejs';

/**
 * GET /api/v1/competitions/[idOrSlug]
 * Retrieve details for a single competition by ID or slug.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ idOrSlug: string }> }
) {
  try {
    const { idOrSlug } = await context.params;

    let authenticatedOwnerId: string | null = null;
    let rateLimitHeaders: Record<string, string> = {};

    const hasAuth = !!extractApiKeyFromRequest(request);
    if (hasAuth) {
      const auth = await authenticateApiKey(request, 'competitions:read');
      if (!auth.success) return auth.response;
      authenticatedOwnerId = auth.ownerId;
      rateLimitHeaders = auth.rateLimitHeaders;
    }

    // Lookup by ID or slug
    let lb = await DatabaseService.getLeaderboard(idOrSlug);
    if (!lb) {
      lb = await DatabaseService.getLeaderboardBySlug(idOrSlug);
    }

    if (!lb) {
      return apiError('NOT_FOUND', `Competition "${idOrSlug}" not found.`, 404, undefined, rateLimitHeaders);
    }

    // Check visibility permissions
    const isPublic = lb.visibility === 'public';
    const isOwner = authenticatedOwnerId && lb.owner_id === authenticatedOwnerId;

    if (!isPublic && !isOwner) {
      // Do not reveal private existence to unauthorized requesters
      return apiError('NOT_FOUND', `Competition "${idOrSlug}" not found.`, 404, undefined, rateLimitHeaders);
    }

    // Fetch related metadata
    const [config, members, seasons, rules] = await Promise.all([
      DatabaseService.getCompetitionConfig(lb.id),
      DatabaseService.getMembers(lb.id),
      DatabaseService.getSeasons(lb.id),
      DatabaseService.getScoringRules(lb.id),
    ]);

    const now = new Date();
    const activeSeason = seasons.find((s) => !s.end_date || new Date(s.end_date) >= now) || seasons[0] || null;

    const data = {
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
      participant_count: members.filter((m) => m.is_active).length,
      current_season: activeSeason
        ? {
            id: activeSeason.id,
            name: activeSeason.name,
            start_date: activeSeason.start_date,
            end_date: activeSeason.end_date,
          }
        : null,
      scoring_rules: rules.map((r) => ({
        id: r.id,
        event_name: r.event_name,
        points: r.points,
        description: r.description,
      })),
      created_at: lb.created_at,
      updated_at: lb.updated_at,
    };

    const cacheHeader = isPublic && !authenticatedOwnerId
      ? 'public, s-maxage=60, stale-while-revalidate=120'
      : 'private, no-cache';

    return apiSuccess(data, undefined, 200, {
      'Cache-Control': cacheHeader,
      ...rateLimitHeaders,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return apiError('SERVER_ERROR', message, 500);
  }
}
