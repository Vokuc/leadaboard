/**
 * Competition Sharing Service (Era 4 Prompt 2)
 *
 * Provides authoritative resolution, URL generation, social text generation,
 * and security sanitization for shareable competition results:
 *  - Competitions (overall leaderboard/tournament/league)
 *  - Placements (standings position, points, tier)
 *  - Champions (crowned tournament/league champions)
 *  - Match Results (head-to-head fixtures, scores, winners)
 *  - Participant Achievements (trophies, medals, career milestones)
 */

import { BASE_URL } from '@/lib/seo/metadata';
import { DatabaseService } from '@/lib/db';
import { CompetitionPassportService } from '@/lib/competition/passport/service';
import { AchievementService } from '@/lib/competition/achievements/service';
import { TournamentService } from '@/lib/tournament/service';
import { LeagueService } from '@/lib/league/service';

export type ShareType = 'competition' | 'placement' | 'champion' | 'match' | 'achievement' | 'bracket';

export interface ShareIntentUrls {
  canonicalUrl: string;
  copyText: string;
  whatsapp: string;
  twitter: string;
  linkedin: string;
  facebook: string;
  telegram: string;
}

export interface ShareableResultPayload {
  type: ShareType;
  title: string;
  subtitle: string;
  competitionName: string;
  competitionType: string;
  entityType?: 'individual' | 'team';
  isVerified: boolean;
  verificationBadgeText?: string;
  avatarUrl?: string | null;
  actorName: string;
  actorHandle?: string | null;
  detailScore?: string;
  rank?: number;
  totalParticipants?: number;
  highlightText?: string;
  badgeIcon?: string;
  badgeRarity?: string;
  updatedAt: string;
  versionHash: string;
  isPrivate: boolean;
  isRevoked?: boolean;
  revocationReason?: string | null;
  canonicalUrl: string;
  ogImageUrl: string;
  sponsorName?: string | null;
  sponsorTier?: string | null;
}

export interface ShareUrlOptions {
  type: ShareType;
  slug?: string;
  handle?: string;
  memberId?: string;
  matchId?: string;
  fixtureId?: string;
  achievementId?: string;
  version?: string | number;
}

/**
 * Generate a canonical shareable URL with query parameters.
 */
export function buildShareUrl(options: ShareUrlOptions, baseUrl: string = BASE_URL): string {
  const { type, slug, handle, memberId, matchId, fixtureId, achievementId, version } = options;

  let pathname = '';
  const params = new URLSearchParams();

  if (type === 'achievement') {
    const cleanHandle = (handle || '').replace(/^@/, '');
    pathname = `/passport/${encodeURIComponent(cleanHandle)}`;
    params.set('share', 'achievement');
    if (achievementId) params.set('id', achievementId);
  } else {
    pathname = `/leaderboards/${encodeURIComponent(slug || '')}`;
    params.set('share', type);
    if (type === 'placement' && memberId) params.set('member', memberId);
    if (type === 'match') {
      if (matchId) params.set('match', matchId);
      else if (fixtureId) params.set('fixture', fixtureId);
    }
  }

  if (version) {
    params.set('v', String(version));
  }

  const query = params.toString();
  return `${baseUrl.replace(/\/$/, '')}${pathname}${query ? `?${query}` : ''}`;
}

/**
 * Generate a dynamic Open Graph image URL.
 */
export function buildOgImageUrl(options: ShareUrlOptions, baseUrl: string = BASE_URL): string {
  const { type, slug, handle, memberId, matchId, fixtureId, achievementId, version } = options;
  const params = new URLSearchParams();
  params.set('type', type);
  if (slug) params.set('slug', slug);
  if (handle) params.set('handle', handle.replace(/^@/, ''));
  if (memberId) params.set('member', memberId);
  if (matchId) params.set('match', matchId);
  if (fixtureId) params.set('fixture', fixtureId);
  if (achievementId) params.set('achievement', achievementId);
  if (version) params.set('v', String(version));

  return `${baseUrl.replace(/\/$/, '')}/api/og/share?${params.toString()}`;
}

/**
 * Format pre-populated social sharing text and web intents.
 * These are client-side intent URLs requiring zero OAuth permissions or secret keys.
 */
export function buildSocialShareIntents(payload: ShareableResultPayload): ShareIntentUrls {
  const canonicalUrl = payload.canonicalUrl;
  let text = '';

  switch (payload.type) {
    case 'champion':
      text = `🏆 ${payload.actorName} is crowned Champion of ${payload.competitionName} on LeaderboardOS! View final standings & results:`;
      break;
    case 'placement':
      text = `⚡ ${payload.actorName} reached Rank #${payload.rank ?? 1} in ${payload.competitionName} (${payload.detailScore || ''}) on LeaderboardOS! Check live standings:`;
      break;
    case 'match':
      text = `⚔️ ${payload.title} — Verified Match Result in ${payload.competitionName} on LeaderboardOS! View match stats:`;
      break;
    case 'achievement':
      text = `🎖️ @${payload.actorHandle || payload.actorName} unlocked the "${payload.title}" trophy (${payload.badgeRarity || 'Career'} Milestone) on LeaderboardOS! View passport:`;
      break;
    case 'bracket':
      text = `📊 Tournament Brackets & Match Progression for ${payload.competitionName} on LeaderboardOS! Follow live:`;
      break;
    case 'competition':
    default:
      text = `🏆 Follow ${payload.competitionName} live on LeaderboardOS — Real-time rankings, results, and fixtures:`;
      break;
  }

  const encodedUrl = encodeURIComponent(canonicalUrl);
  const encodedText = encodeURIComponent(text);

  return {
    canonicalUrl,
    copyText: `${text} ${canonicalUrl}`,
    whatsapp: `https://api.whatsapp.com/send?text=${encodeURIComponent(`${text} ${canonicalUrl}`)}`,
    twitter: `https://x.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
  };
}

/**
 * Authoritatively fetch and normalize share data.
 * Enforces public visibility: returns null if the target competition is private.
 * Strips all sensitive private participant data.
 */
export async function getAuthoritativeShareData(
  options: ShareUrlOptions
): Promise<ShareableResultPayload | null> {
  const { type, slug, handle, memberId, matchId, fixtureId, achievementId } = options;

  // 1. Participant Achievement Sharing
  if (type === 'achievement') {
    const cleanHandle = (handle || '').replace(/^@/, '').trim();
    if (!cleanHandle) return null;

    let passportData;
    try {
      passportData = await CompetitionPassportService.getPassport(cleanHandle, null);
    } catch {
      return null;
    }

    if (!passportData || !passportData.profile) return null;

    // Check privacy settings: If passport is private, reject public sharing
    if (!passportData.profile.privacy_settings?.is_public) {
      return {
        type: 'achievement',
        title: 'Private Passport',
        subtitle: 'This participant profile is private.',
        competitionName: 'Private Passport',
        competitionType: 'trophy',
        isVerified: false,
        actorName: 'Private',
        updatedAt: new Date().toISOString(),
        versionHash: 'private',
        isPrivate: true,
        canonicalUrl: `${BASE_URL}/passport/${cleanHandle}`,
        ogImageUrl: `${BASE_URL}/og-default.png`,
      };
    }

    const userId = passportData.profile.user_id || passportData.profile.id;
    const allAwards = await DatabaseService.getParticipantAchievements(userId, true);
    const award = achievementId
      ? allAwards.find((a) => a.id === achievementId || a.achievement_id === achievementId)
      : (passportData.achievements || [])[0];

    const defs = await AchievementService.getDefinitions();
    const def = award
      ? defs.find((d) => d.id === award.achievement_id) || award.achievement
      : null;

    if (!award || !def) return null;

    const updatedAt = award.updated_at || award.created_at || new Date().toISOString();
    const versionHash = String(new Date(updatedAt).getTime());

    const canonicalUrl = buildShareUrl(
      { type: 'achievement', handle: cleanHandle, achievementId: award.id, version: versionHash },
      BASE_URL
    );
    const ogImageUrl = buildOgImageUrl(
      { type: 'achievement', handle: cleanHandle, achievementId: award.id, version: versionHash },
      BASE_URL
    );

    return {
      type: 'achievement',
      title: def.name,
      subtitle: def.description,
      competitionName: award.provenance?.competition_name || 'LeaderboardOS Career',
      competitionType: 'trophy',
      isVerified: !award.is_revoked,
      verificationBadgeText: award.is_revoked ? 'Award Revoked' : 'Verified Achievement',
      avatarUrl: passportData.profile.avatar_url,
      actorName: passportData.profile.display_name,
      actorHandle: passportData.profile.username,
      badgeIcon: def.badge_icon || '🏆',
      badgeRarity: def.rarity || 'common',
      highlightText: `${def.points_reward} Points`,
      updatedAt,
      versionHash,
      isPrivate: false,
      isRevoked: award.is_revoked,
      revocationReason: award.revocation_reason,
      canonicalUrl,
      ogImageUrl,
    };
  }

  // 2. Competition-Scoped Results (must have slug)
  if (!slug) return null;

  // Retrieve leaderboard
  const lb = await DatabaseService.getLeaderboardBySlug(slug);
  if (!lb) return null;

  // STRICT PRIVACY ENFORCEMENT: Never expose private leaderboards to public share channels
  if (lb.visibility !== 'public') {
    return {
      type,
      title: 'Private Competition',
      subtitle: 'This competition is private and not accessible publicly.',
      competitionName: 'Private Competition',
      competitionType: lb.competition_type || 'standard',
      isVerified: false,
      actorName: 'Private',
      updatedAt: lb.updated_at,
      versionHash: 'private',
      isPrivate: true,
      canonicalUrl: `${BASE_URL}/leaderboards/${lb.slug}`,
      ogImageUrl: `${BASE_URL}/og-default.png`,
    };
  }

  const [members, config, rankings] = await Promise.all([
    DatabaseService.getMembers(lb.id),
    DatabaseService.getCompetitionConfig(lb.id),
    DatabaseService.getRankings(lb.id),
  ]);

  let sponsorName: string | null = null;
  let sponsorTier: string | null = null;
  try {
    const { CompetitionSponsorshipService } = await import('@/lib/competition/sponsorship/service');
    const sponsors = await CompetitionSponsorshipService.getSponsorsForCompetition(lb.id);
    if (sponsors.length > 0) {
      sponsorName = sponsors[0].name;
      sponsorTier = sponsors[0].tier;
    }
  } catch {
    // Non-blocking
  }

  const updatedAt = lb.updated_at || lb.created_at;
  const versionHash = String(new Date(updatedAt).getTime());

  // 2A. Champion Share
  if (type === 'champion') {
    let championName = 'Champion';
    let championAvatar: string | null = null;
    let detailScore = '';

    if (config?.engine_type === 'tournament') {
      const tournament = await TournamentService.getTournament(lb.id);
      if (tournament?.champion_member_id) {
        const champMember = members.find((m) => m.id === tournament.champion_member_id);
        if (champMember) {
          championName = champMember.name;
          championAvatar = champMember.avatar_url;
        }
      }
    } else if (config?.engine_type === 'league_table') {
      const standings = await LeagueService.getLeagueStandings(lb.id);
      if (standings.length > 0) {
        championName = standings[0].name;
        championAvatar = standings[0].avatar_url;
        const pts = standings[0].stats?.pts ?? standings[0].stats?.points ?? 0;
        detailScore = `${pts} pts`;
      }
    } else {
      if (rankings.length > 0) {
        championName = rankings[0].player_name;
        championAvatar = rankings[0].avatar_url;
        detailScore = `${rankings[0].total_points.toLocaleString()} pts`;
      }
    }

    const canonicalUrl = buildShareUrl({ type: 'champion', slug: lb.slug, version: versionHash });
    const ogImageUrl = buildOgImageUrl({ type: 'champion', slug: lb.slug, version: versionHash });

    return {
      type: 'champion',
      title: `${championName} — Champion`,
      subtitle: `Crowned #1 Champion in ${lb.name}`,
      competitionName: lb.name,
      competitionType: config?.engine_type || lb.competition_type,
      entityType: config?.entity_type === 'team' ? 'team' : 'individual',
      isVerified: true,
      verificationBadgeText: 'Official Champion',
      avatarUrl: championAvatar,
      actorName: championName,
      detailScore,
      rank: 1,
      totalParticipants: members.length,
      highlightText: '1st Place Finish',
      updatedAt,
      versionHash,
      isPrivate: false,
      canonicalUrl,
      ogImageUrl,
      sponsorName,
      sponsorTier,
    };
  }

  // 2B. Placement Share (Single Member Standing)
  if (type === 'placement') {
    const targetMemberId = memberId || (rankings[0]?.member_id ?? members[0]?.id);
    let memberName = 'Competitor';
    let memberAvatar: string | null = null;
    let memberTeam: string | null = null;
    let rank = 1;
    let detailScore = '';

    if (config?.engine_type === 'league_table') {
      const standings = await LeagueService.getLeagueStandings(lb.id);
      const row = targetMemberId
        ? standings.find((s) => s.member_id === targetMemberId) || standings[0]
        : standings[0];
      if (row) {
        memberName = row.name;
        memberAvatar = row.avatar_url;
        memberTeam = row.team;
        rank = row.position;
        const pts = row.stats?.pts ?? row.stats?.points ?? 0;
        detailScore = `${pts} Points`;
      }
    } else {
      const rankingRow = targetMemberId
        ? rankings.find((r) => r.member_id === targetMemberId) || rankings[0]
        : rankings[0];
      if (rankingRow) {
        memberName = rankingRow.player_name;
        memberAvatar = rankingRow.avatar_url;
        memberTeam = rankingRow.team;
        rank = rankings.findIndex((r) => r.member_id === rankingRow.member_id) + 1;
        detailScore = `${rankingRow.total_points.toLocaleString()} Points`;
      }
    }

    const canonicalUrl = buildShareUrl({
      type: 'placement',
      slug: lb.slug,
      memberId: targetMemberId,
      version: versionHash,
    });
    const ogImageUrl = buildOgImageUrl({
      type: 'placement',
      slug: lb.slug,
      memberId: targetMemberId,
      version: versionHash,
    });

    return {
      type: 'placement',
      title: `${memberName} — Rank #${rank}`,
      subtitle: `${memberName} placed #${rank} of ${members.length} in ${lb.name}`,
      competitionName: lb.name,
      competitionType: config?.engine_type || lb.competition_type,
      entityType: config?.entity_type === 'team' ? 'team' : 'individual',
      isVerified: true,
      verificationBadgeText: rank === 1 ? 'Champion' : rank <= 3 ? 'Podium Finish' : 'Verified Competitor',
      avatarUrl: memberAvatar,
      actorName: memberName,
      detailScore,
      rank,
      totalParticipants: members.length,
      highlightText: memberTeam ? `Team ${memberTeam}` : undefined,
      updatedAt,
      versionHash,
      isPrivate: false,
      canonicalUrl,
      ogImageUrl,
      sponsorName,
      sponsorTier,
    };
  }

  // 2C. Match / Fixture Share
  if (type === 'match') {
    let matchTitle = 'Match Result';
    let detailScore = '';
    let winnerName = '';
    let matchState = 'completed';
    let matchUpdatedAt = updatedAt;

    if (config?.engine_type === 'tournament') {
      const allMatches = await TournamentService.getMatches(lb.id);
      const matchResults = await TournamentService.getMatchResults(lb.id);
      const targetMatch = matchId
        ? allMatches.find((m) => m.id === matchId) || allMatches[0]
        : allMatches[0];

      if (targetMatch) {
        const homeMember = members.find((m) => m.id === targetMatch.home_member_id);
        const awayMember = members.find((m) => m.id === targetMatch.away_member_id);
        const result = matchResults.find((r) => r.match_id === targetMatch.id);

        const homeName = homeMember?.name || 'TBD';
        const awayName = awayMember?.name || 'TBD';

        if (result) {
          matchTitle = `${homeName} ${result.home_score} - ${result.away_score} ${awayName}`;
          detailScore = `Final: ${result.home_score} - ${result.away_score}`;
        } else {
          matchTitle = `${homeName} vs ${awayName}`;
          detailScore = 'Scheduled';
        }

        if (targetMatch.winner_member_id) {
          const winner = members.find((m) => m.id === targetMatch.winner_member_id);
          winnerName = winner?.name || '';
        }
        matchState = targetMatch.state;
        matchUpdatedAt = targetMatch.updated_at || targetMatch.created_at;
      }
    } else {
      // League fixtures
      const fixtures = await LeagueService.getFixtures(lb.id);
      const results = await LeagueService.getFixtureResults(lb.id);
      const targetFixture = fixtureId
        ? fixtures.find((f) => f.id === fixtureId) || fixtures[0]
        : fixtures[0];

      if (targetFixture) {
        const homeMember = members.find((m) => m.id === targetFixture.home_member_id);
        const awayMember = members.find((m) => m.id === targetFixture.away_member_id);
        const result = results.find((r) => r.fixture_id === targetFixture.id);

        const homeName = homeMember?.name || 'Home';
        const awayName = awayMember?.name || 'Away';

        if (result) {
          matchTitle = `${homeName} ${result.home_score} - ${result.away_score} ${awayName}`;
          detailScore = `Final: ${result.home_score} - ${result.away_score}`;
          if (result.home_score > result.away_score) winnerName = homeName;
          else if (result.away_score > result.home_score) winnerName = awayName;
          else winnerName = 'Draw';
        } else {
          matchTitle = `${homeName} vs ${awayName}`;
          detailScore = 'Scheduled';
        }
        matchState = targetFixture.status;
        matchUpdatedAt = targetFixture.updated_at || targetFixture.created_at;
      }
    }

    const versionHash = String(new Date(matchUpdatedAt).getTime());
    const canonicalUrl = buildShareUrl({
      type: 'match',
      slug: lb.slug,
      matchId,
      fixtureId,
      version: versionHash,
    });
    const ogImageUrl = buildOgImageUrl({
      type: 'match',
      slug: lb.slug,
      matchId,
      fixtureId,
      version: versionHash,
    });

    return {
      type: 'match',
      title: matchTitle,
      subtitle: `Verified result in ${lb.name}`,
      competitionName: lb.name,
      competitionType: config?.engine_type || lb.competition_type,
      entityType: config?.entity_type === 'team' ? 'team' : 'individual',
      isVerified: matchState === 'completed',
      verificationBadgeText: matchState === 'completed' ? 'Verified Match Result' : 'Scheduled Match',
      actorName: winnerName ? `Winner: ${winnerName}` : matchTitle,
      detailScore,
      highlightText: matchState === 'completed' ? 'Official Scorecard' : 'Upcoming Fixture',
      updatedAt: matchUpdatedAt,
      versionHash,
      isPrivate: false,
      canonicalUrl,
      ogImageUrl,
      sponsorName,
      sponsorTier,
    };
  }

  // 2D. Default: Competition / Bracket Overview
  const canonicalUrl = buildShareUrl({ type: 'competition', slug: lb.slug, version: versionHash });
  const ogImageUrl = buildOgImageUrl({ type: 'competition', slug: lb.slug, version: versionHash });

  return {
    type: 'competition',
    title: lb.name,
    subtitle: lb.description || 'Real-time competitive standings, brackets, and score history.',
    competitionName: lb.name,
    competitionType: config?.engine_type || lb.competition_type,
    entityType: config?.entity_type === 'team' ? 'team' : 'individual',
    isVerified: true,
    verificationBadgeText: 'Official Competition',
    avatarUrl: lb.cover_image_url,
    actorName: lb.name,
    totalParticipants: members.length,
    highlightText: `${members.length} Competitors`,
    updatedAt,
    versionHash,
    isPrivate: false,
    canonicalUrl,
    ogImageUrl,
    sponsorName,
    sponsorTier,
  };
}
