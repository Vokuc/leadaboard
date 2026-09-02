import type { Metadata } from 'next';

// /login should never appear in search results.
// We use a thin layout wrapper so the page itself can remain 'use client'
// (Next.js doesn't allow metadata exports from client components).
export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to your LeaderboardOS account to manage and publish your leaderboards.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
