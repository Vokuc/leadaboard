import { NextRequest } from 'next/server';
import { DatabaseService } from '@/lib/db';
import { LeagueService } from '@/lib/league/service';
import { TournamentService } from '@/lib/tournament/service';
import { authenticateApiKey, extractApiKeyFromRequest } from '@/lib/api/auth';
import { apiError, apiSuccess } from '@/lib/api/response';

export const runtime = 'nodejs';

/**
 * GET /api/v1/competitions/[idOrSlug]/results
 * Retrieve authoritative result logs and score events.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ idOrSlug: string }> }
) {
  try {
    const { idOrSlug } = await context.params;
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10)));

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

    const [config, members] = await Promise.all([
      DatabaseService.getCompetitionConfig(lb.id),
      DatabaseService.getMembers(lb.id),
    ]);
    const memberMap = new Map(members.map((m) => [m.id, m]));

    if (config?.engine_type === 'tournament') {
      const results = await TournamentService.getMatchResults(lb.id);
      const matches = await TournamentService.getMatches(lb.id);
      const matchMap = new Map(matches.map((m) => [m.id, m]));

      const total = results.length;
      const paginated = results.slice((page - 1) * pageSize, page * pageSize);

      const items = paginated.map((r) => {
        const match = matchMap.get(r.match_id);
        const home = match?.home_member_id ? memberMap.get(match.home_member_id) : null;
        const away = match?.away_member_id ? memberMap.get(match.away_member_id) : null;
        return {
          match_id: r.match_id,
          home_score: r.home_score,
          away_score: r.away_score,
          home_name: home?.name || 'TBD',
          away_name: away?.name || 'TBD',
          status: r.status,
          created_at: r.created_at,
          updated_at: r.updated_at,
        };
      });

      return apiSuccess(items, { page, pageSize, total, hasMore: page * pageSize < total }, 200, {
        'Cache-Control': isPublic && !authenticatedOwnerId ? 'public, s-maxage=60' : 'private, no-cache',
        ...rateLimitHeaders,
      });
    }

    if (config?.engine_type === 'league_table') {
      const results = await LeagueService.getRecentResults(lb.id);
      const total = results.length;
      const paginated = results.slice((page - 1) * pageSize, page * pageSize);

      const items = paginated.map((r) => ({
        fixture_id: r.fixture.id,
        round_name: r.fixture.round_name,
        home_name: r.homeMember?.name || 'Home',
        away_name: r.awayMember?.name || 'Away',
        home_score: r.result?.home_score ?? 0,
        away_score: r.result?.away_score ?? 0,
        scheduled_at: r.fixture.scheduled_at,
        updated_at: r.fixture.updated_at,
      }));

      return apiSuccess(items, { page, pageSize, total, hasMore: page * pageSize < total }, 200, {
        'Cache-Control': isPublic && !authenticatedOwnerId ? 'public, s-maxage=60' : 'private, no-cache',
        ...rateLimitHeaders,
      });
    }

    // Default: Score events
    const events = await DatabaseService.getScoreEvents(lb.id);
    const total = events.length;
    const paginated = events.slice((page - 1) * pageSize, page * pageSize);

    const items = paginated.map((e) => {
      const member = memberMap.get(e.member_id);
      return {
        id: e.id,
        member_id: e.member_id,
        member_name: member?.name || 'Unknown',
        points: e.points,
        reason: e.reason,
        created_at: e.created_at,
      };
    });

    return apiSuccess(items, { page, pageSize, total, hasMore: page * pageSize < total }, 200, {
      'Cache-Control': isPublic && !authenticatedOwnerId ? 'public, s-maxage=60' : 'private, no-cache',
      ...rateLimitHeaders,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return apiError('SERVER_ERROR', message, 500);
  }
}
