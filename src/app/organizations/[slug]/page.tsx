import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Building2,
  Trophy,
  ExternalLink,
  Globe,
  ArrowLeft,
  LayoutDashboard,
  ShieldCheck,
  Compass,
} from 'lucide-react';
import SafeImage from '@/components/SafeImage';
import { OrganizationService } from '@/lib/organization/service';
import { getServerAuthUser } from '@/lib/auth/server-user';
import { BASE_URL } from '@/lib/seo/metadata';

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

export const revalidate = 60;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const org = await OrganizationService.getOrganization(slug);

  if (!org) {
    return {
      title: 'Organization Not Found | LeaderboardOS',
    };
  }

  const title = `${org.name} — Public Profile & Competitions | LeaderboardOS`;
  const description =
    org.description ||
    `Explore public leagues, tournaments, and scoreboards hosted by ${org.name} on LeaderboardOS.`;

  return {
    title,
    description,
    alternates: {
      canonical: `${BASE_URL}/organizations/${org.slug}`,
    },
    openGraph: {
      title,
      description,
      url: `${BASE_URL}/organizations/${org.slug}`,
      type: 'profile',
      images: org.logo_url ? [{ url: org.logo_url }] : undefined,
    },
  };
}

export default async function PublicOrganizationProfilePage({ params }: PageProps) {
  const { slug } = await params;
  const org = await OrganizationService.getOrganization(slug);

  if (!org) {
    notFound();
  }

  // 1. Fetch active public competitions only (protect private competitions and members)
  const allComps = await OrganizationService.getOrganizationCompetitions(org.id);
  const publicComps = allComps.filter(
    (c) => c.visibility === 'public' && c.status === 'active'
  );

  // 2. Check if the current visitor is an authorized member/admin of this organization
  const currentUser = await getServerAuthUser();
  let userRole = null;
  if (currentUser) {
    userRole = await OrganizationService.getMemberRole(org.id, currentUser.id);
  }
  const isAuthorizedManager =
    userRole === 'owner' || userRole === 'admin' || userRole === 'manager';

  const brandPrimary = org.primary_color || '#8b5cf6';

  return (
    <div className="min-h-screen bg-black text-white flex flex-col selection:bg-violet-500/30">
      {/* Dynamic Brand Glow Accent */}
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] rounded-full blur-[140px] pointer-events-none -z-10 opacity-30"
        style={{ backgroundColor: brandPrimary }}
      />

      {/* Navigation Bar */}
      <header className="border-b border-white/5 bg-black/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/directory?tab=organizations"
              className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Discover Organizations
            </Link>
            <span className="text-neutral-800">/</span>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-violet-400" />
              <span className="text-xs font-bold text-neutral-300 truncate max-w-[180px] sm:max-w-xs">
                {org.name}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isAuthorizedManager && (
              <Link
                href={`/dashboard/organizations/${org.id}`}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-xs font-semibold rounded-xl text-neutral-200 hover:text-white transition-colors"
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-violet-400" />
                <span>Manage Workspace</span>
              </Link>
            )}
            <Link
              href="/dashboard/create"
              className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-xl transition-colors shadow-lg shadow-violet-600/20"
            >
              Create Competition
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10 md:py-16 space-y-12">
        {/* Organization Hero Profile */}
        <section className="glass rounded-3xl p-6 sm:p-10 border border-white/10 relative overflow-hidden space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {org.logo_url ? (
              <SafeImage
                src={org.logo_url}
                alt={org.name}
                width={88}
                height={88}
                className="w-20 h-20 sm:w-22 sm:h-22 rounded-2xl object-contain border border-white/10 bg-neutral-950 p-1 shadow-xl shrink-0"
              />
            ) : (
              <div
                className="w-20 h-20 sm:w-22 sm:h-22 rounded-2xl flex items-center justify-center text-3xl font-black text-white shadow-xl shrink-0"
                style={{ backgroundColor: brandPrimary }}
              >
                {org.name.charAt(0).toUpperCase()}
              </div>
            )}

            <div className="space-y-2 flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                  {org.name}
                </h1>
                {org.custom_domain && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    <ShieldCheck className="w-3 h-3" /> Verified Domain
                  </span>
                )}
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-violet-500/10 text-violet-300 border border-violet-500/20">
                  <Trophy className="w-3 h-3" /> {publicComps.length} Public{' '}
                  {publicComps.length === 1 ? 'Competition' : 'Competitions'}
                </span>
              </div>

              {org.description ? (
                <p className="text-sm text-neutral-300 leading-relaxed max-w-2xl">
                  {org.description}
                </p>
              ) : (
                <p className="text-xs text-neutral-500 italic">
                  Public competition organizer on LeaderboardOS.
                </p>
              )}

              {org.website_url && (
                <div className="pt-1">
                  <a
                    href={org.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>{org.website_url.replace(/^https?:\/\//, '')}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Public Competitions Showcase */}
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-4">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                <span>Hosted Public Competitions</span>
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Live tournaments, round-robin leagues, and point races hosted by {org.name}.
              </p>
            </div>
          </div>

          {publicComps.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center border border-white/5 space-y-3">
              <Trophy className="w-10 h-10 text-neutral-600 mx-auto" />
              <h3 className="text-base font-bold text-white">No Public Competitions Active</h3>
              <p className="text-xs text-neutral-400 max-w-md mx-auto">
                {org.name} does not have any active public competitions listed right now. Check back soon for upcoming tournaments and leagues.
              </p>
              <Link
                href="/directory"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold rounded-xl border border-neutral-800 transition-colors"
              >
                <Compass className="w-3.5 h-3.5 text-violet-400" /> Browse Other Competitions
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {publicComps.map((comp) => (
                <div
                  key={comp.id}
                  className="glass rounded-2xl p-6 border border-white/5 hover:border-violet-500/30 transition-all flex flex-col justify-between group"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest bg-violet-500/10 px-2.5 py-0.5 rounded-full border border-violet-500/20">
                        {comp.competition_type}
                      </span>
                      <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        Active
                      </span>
                    </div>

                    <h3 className="font-bold text-lg text-white group-hover:text-violet-400 transition-colors">
                      {comp.name}
                    </h3>

                    {comp.description && (
                      <p className="text-xs text-neutral-400 line-clamp-3 leading-relaxed">
                        {comp.description}
                      </p>
                    )}
                  </div>

                  <div className="pt-4 mt-6 border-t border-white/5 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-neutral-500">/{comp.slug}</span>
                    <Link
                      href={`/leaderboards/${comp.slug}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm"
                    >
                      View Board <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 mt-auto bg-black text-center text-neutral-500 text-xs">
        <p>© {new Date().getFullYear()} LeaderboardOS. All rights reserved.</p>
      </footer>
    </div>
  );
}

