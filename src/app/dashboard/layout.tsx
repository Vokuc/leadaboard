import type { Metadata } from 'next';

/**
 * Dashboard layout — noindex for all /dashboard/* routes.
 *
 * Dashboard pages are authenticated UX and should never appear in search
 * results. Setting noindex here covers every child route automatically:
 * /dashboard, /dashboard/create, /dashboard/leaderboards/[id],
 * /dashboard/billing, /dashboard/admin/*, etc.
 *
 * Note: The middleware already redirects unauthenticated users away from
 * these routes, but noindex is needed as an independent safeguard in case
 * a crawler follows an authenticated link.
 */
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
