import type { Metadata } from 'next';
import { PublicPassportClient } from '@/components/competition/passport/PublicPassportClient';
import { BASE_URL } from '@/lib/seo/metadata';
import { getAuthoritativeShareData } from '@/lib/sharing/service';

type PageProps = {
  params: Promise<{ handle: string }>;
  searchParams?: Promise<{
    share?: string;
    id?: string;
    achievement?: string;
    v?: string;
  }>;
};

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { handle } = await params;
  const { share, id, achievement, v } = (await searchParams) || {};
  const cleanHandle = handle.replace(/^@/, '');

  if (share === 'achievement') {
    const achievementId = id || achievement;
    const shareData = await getAuthoritativeShareData({
      type: 'achievement',
      handle: cleanHandle,
      achievementId,
      version: v,
    });

    if (shareData && !shareData.isPrivate) {
      return {
        title: `${shareData.title} | @${cleanHandle} | LeaderboardOS`,
        description: `${shareData.subtitle} Awarded on LeaderboardOS.`,
        alternates: {
          canonical: shareData.canonicalUrl,
        },
        openGraph: {
          title: `${shareData.title} — @${cleanHandle}`,
          description: shareData.subtitle,
          url: shareData.canonicalUrl,
          siteName: 'LeaderboardOS',
          images: [
            {
              url: shareData.ogImageUrl,
              width: 1200,
              height: 630,
              alt: `${shareData.title} unlocked by @${cleanHandle}`,
            },
          ],
          type: 'profile',
        },
        twitter: {
          card: 'summary_large_image',
          title: `${shareData.title} — @${cleanHandle}`,
          description: shareData.subtitle,
          images: [shareData.ogImageUrl],
        },
      };
    }
  }

  const ogImageUrl = `${BASE_URL}/api/og/share?type=achievement&handle=${cleanHandle}`;

  return {
    title: `@${cleanHandle} | Competition Passport`,
    description: `Verified competitive history, match results, and trophy case for @${cleanHandle} on LeaderboardOS.`,
    alternates: {
      canonical: `${BASE_URL}/passport/${cleanHandle}`,
    },
    openGraph: {
      title: `@${cleanHandle} — Competition Passport`,
      description: `Verified competitive history and trophy case on LeaderboardOS.`,
      url: `${BASE_URL}/passport/${cleanHandle}`,
      type: 'profile',
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `@${cleanHandle} Competition Passport on LeaderboardOS`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `@${cleanHandle} — Competition Passport`,
      description: `Verified competitive history and trophy case on LeaderboardOS.`,
      images: [ogImageUrl],
    },
  };
}

export default async function PassportPage({ params }: PageProps) {
  const { handle } = await params;
  const cleanHandle = handle.replace(/^@/, '');

  return <PublicPassportClient handle={cleanHandle} />;
}
