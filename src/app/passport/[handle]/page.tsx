import type { Metadata } from 'next';
import { PublicPassportClient } from '@/components/competition/passport/PublicPassportClient';

type PageProps = {
  params: Promise<{ handle: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { handle } = await params;
  const cleanHandle = handle.replace(/^@/, '');

  return {
    title: `@${cleanHandle} | Competition Passport`,
    description: `Verified competitive history, match results, and trophy case for @${cleanHandle} on LeaderboardOS.`,
    openGraph: {
      title: `@${cleanHandle} — Competition Passport`,
      description: `Verified competitive history and trophy case on LeaderboardOS.`,
      type: 'profile',
    },
  };
}

export default async function PassportPage({ params }: PageProps) {
  const { handle } = await params;
  const cleanHandle = handle.replace(/^@/, '');

  return <PublicPassportClient handle={cleanHandle} />;
}
