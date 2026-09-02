import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://leaderboardos.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/leaderboards/', '/how-to-play', '/templates/', '/tools/', '/blog/'],
        disallow: [
          '/dashboard/',
          '/admin/',
          '/account/',
          '/settings/',
          '/api/',
          '/auth/',
          '/login',
          '/signup',
          '/checkout/',
          '/payment/',
          '/*?*filter=',
          '/*?*sort=',
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
