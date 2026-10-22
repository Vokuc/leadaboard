import { NextRequest } from 'next/server';
import { DatabaseService } from '@/lib/db';
import { LeagueService } from '@/lib/league/service';
import { TournamentService } from '@/lib/tournament/service';
import { authenticateApiKey, extractApiKeyFromRequest } from '@/lib/api/auth';
import { apiError, apiSuccess } from '@/lib/api/response';

export const runtime = 'nodejs';

/**
 * GET /api/v1/competitions/[idOrSlug]/fixtures
 * Retrieve fixtures or scheduled tournament matches.
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

    const [config, members] = await Promise.all([
      DatabaseService.getCompetitionConfig(lb.id),
      DatabaseService.getMembers(lb.id),
    ]);

    const memberMap = new Map(members.map((m) => [m.id, m]));

    if (config?.engine_type === 'tournament') {
      const [rounds, matches, results] = await Promise.all([
        TournamentService.getRounds(lb.id),
        TournamentService.getMatches(lb.id),
        TournamentService.getMatchResults(lb.id),
      ]);

      const roundMap = new Map(rounds.map((r) => [r.id, r]));
      const resultMap = new Map(results.map((res) => [res.match_id, res]));

      const formatted = matches.map((m) => {
        const round = roundMap.get(m.round_id);
        const result = resultMap.get(m.id);
        const home = m.home_member_id ? memberMap.get(m.home_member_id) : null;
        const away = m.away_member_id ? memberMap.get(m.away_member_id) : null;

        return {
          id: m.id,
          round_name: round?.round_name || `Round ${m.round_index}`,
          round_index: m.round_index,
          match_index: m.match_index,
          state: m.state,
          scheduled_at: m.scheduled_at,
          home: {
            id: m.home_member_id,
            name: home?.name || 'TBD',
            score: result?.home_score ?? null,
          },
          away: {
            id: m.away_member_id,
            name: away?.name || 'TBD',
            score: result?.away_score ?? null,
          },
          winner_id: m.winner_member_id,
        };
      });

      return apiSuccess(
        {
          engine_type: 'tournament',
          competition_id: lb.id,
          fixtures: formatted,
        },
        undefined,
        200,
        {
          'Cache-Control': isPublic && !authenticatedOwnerId ? 'public, s-maxage=60' : 'private, no-cache',
          ...rateLimitHeaders,
        }
      );
    }

    // League Table fixtures
    const [fixtures, results] = await Promise.all([
      LeagueService.getFixtures(lb.id),
      LeagueService.getFixtureResults(lb.id),
    ]);

    const resultMap = new Map(results.map((r) => [r.fixture_id, r]));

    const formatted = fixtures.map((f) => {
      const home = memberMap.get(f.home_member_id);
      const away = memberMap.get(f.away_member_id);
      const res = resultMap.get(f.id);

      return {
        id: f.id,
        round_name: f.round_name,
        status: f.status,
        scheduled_at: f.scheduled_at,
        home: {
          id: f.home_member_id,
          name: home?.name || 'Home',
          score: res?.home_score ?? null,
        },
        away: {
          id: f.away_member_id,
          name: away?.name || 'Away',
          score: res?.away_score ?? null,
        },
      };
    });

    return apiSuccess(
      {
        engine_type: config?.engine_type || 'league_table',
        competition_id: lb.id,
        fixtures: formatted,
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
