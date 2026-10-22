import { NextRequest } from 'next/server';
import { DatabaseService } from '@/lib/db';
import { LeagueService } from '@/lib/league/service';
import { authenticateApiKey, extractApiKeyFromRequest } from '@/lib/api/auth';
import { apiError, apiSuccess } from '@/lib/api/response';

export const runtime = 'nodejs';

/**
 * GET /api/v1/competitions/[idOrSlug]/standings
 * Retrieve current standings and ranking table for a competition.
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

    let lb = await DatabaseService.getLeaderboard(idOrSlug);
    if (!lb) lb = await DatabaseService.getLeaderboardBySlug(idOrSlug);

    if (!lb) {
      return apiError('NOT_FOUND', `Competition "${idOrSlug}" not found.`, 404, undefined, rateLimitHeaders);
    }

    const isPublic = lb.visibility === 'public';
    const isOwner = authenticatedOwnerId && lb.owner_id === authenticatedOwnerId;
    if (!isPublic && !isOwner) {
      return apiError('NOT_FOUND', `Competition "${idOrSlug}" not found.`, 404, undefined, rateLimitHeaders);
    }

    const config = await DatabaseService.getCompetitionConfig(lb.id);

    if (config?.engine_type === 'league_table') {
      const standings = await LeagueService.getLeagueStandings(lb.id);
      return apiSuccess(
        {
          engine_type: 'league_table',
          competition_id: lb.id,
          competition_name: lb.name,
          standings: standings.map((s) => ({
            rank: s.position,
            member_id: s.member_id,
            name: s.name,
            team: s.team,
            avatar_url: s.avatar_url,
            points: s.stats?.pts ?? s.stats?.points ?? 0,
            stats: s.stats || {},
          })),
        },
        undefined,
        200,
        {
          'Cache-Control': isPublic && !authenticatedOwnerId ? 'public, s-maxage=60' : 'private, no-cache',
          ...rateLimitHeaders,
        }
      );
    }

    // Default: Simple Points rankings
    const rankings = await DatabaseService.getRankings(lb.id);
    return apiSuccess(
      {
        engine_type: config?.engine_type || 'simple_points',
        competition_id: lb.id,
        competition_name: lb.name,
        standings: rankings.map((r, idx) => ({
          rank: idx + 1,
          member_id: r.member_id,
          name: r.player_name,
          team: r.team,
          avatar_url: r.avatar_url,
          points: r.total_points,
        })),
      },
      undefined,
      200,
      {
        'Cache-Control': isPublic && !authenticatedOwnerId ? 'public, s-maxage=60' : 'private, no-cache',
        ...rateLimitHeaders,
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return apiError('SERVER_ERROR', message, 500);
  }
}
