import { NextRequest } from 'next/server';
import { CompetitionPassportService } from '@/lib/competition/passport/service';
import { authenticateApiKey, extractApiKeyFromRequest } from '@/lib/api/auth';
import { apiError, apiSuccess } from '@/lib/api/response';

export const runtime = 'nodejs';

/**
 * GET /api/v1/participants/[idOrHandle]
 * Retrieve public career overview and verified achievements for a participant.
 * Respects participant privacy settings and never exposes private account email.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ idOrHandle: string }> }
) {
  try {
    const { idOrHandle } = await context.params;
    const cleanIdentifier = idOrHandle.replace(/^@/, '').trim();

    let rateLimitHeaders: Record<string, string> = {};

    const hasAuth = !!extractApiKeyFromRequest(request);
    if (hasAuth) {
      const auth = await authenticateApiKey(request, 'competitions:read');
      if (!auth.success) return auth.response;
      rateLimitHeaders = auth.rateLimitHeaders;
    }

    const passport = await CompetitionPassportService.getPassport(cleanIdentifier, null);

    if (!passport || !passport.profile) {
      return apiError('NOT_FOUND', `Participant "${idOrHandle}" not found.`, 404, undefined, rateLimitHeaders);
    }

    if (!passport.profile.privacy_settings?.is_public) {
      return apiError(
        'FORBIDDEN',
        'This participant profile is set to private by its owner.',
        403,
        undefined,
        rateLimitHeaders
      );
    }

    const data = {
      username: passport.profile.username,
      display_name: passport.profile.display_name,
      avatar_url: passport.profile.avatar_url,
      bio: passport.profile.bio,
      headline: passport.profile.headline,
      location: passport.profile.location,
      social_links: passport.profile.social_links,
      overview: {
        total_competitions: passport.overview.total_competitions,
        verified_competitions: passport.overview.verified_competitions,
        total_wins: passport.overview.total_wins,
        win_percentage: passport.overview.win_percentage,
        first_place_finishes: passport.overview.first_place_finishes,
        highest_rank_achieved: passport.overview.highest_rank_achieved,
        total_points_scored: passport.overview.total_points_scored,
      },
      achievements: (passport.achievements || []).map((a) => ({
        id: a.id,
        achievement_id: a.achievement_id,
        name: a.achievement?.name || 'Achievement',
        description: a.achievement?.description || '',
        category: a.achievement?.category || 'general',
        badge_icon: a.achievement?.badge_icon || '🏆',
        badge_color: a.achievement?.badge_color || '#38bdf8',
        rarity: a.achievement?.rarity || 'common',
        awarded_at: a.awarded_at,
        is_revoked: a.is_revoked,
      })),
      created_at: passport.profile.created_at,
    };

    return apiSuccess(data, undefined, 200, {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      ...rateLimitHeaders,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return apiError('SERVER_ERROR', message, 500);
  }
}
