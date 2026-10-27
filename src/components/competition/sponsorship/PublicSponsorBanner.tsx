'use client';

import React, { useEffect, useState } from 'react';
import { CompetitionSponsor, SponsorshipTier } from '@/types';
import SafeImage from '@/components/SafeImage';
import { ExternalLink, Sparkles, ShieldCheck } from 'lucide-react';

interface PublicSponsorBannerProps {
  leaderboardId: string;
  initialSponsors?: CompetitionSponsor[];
}

const TIER_LABELS: Record<SponsorshipTier, string> = {
  headline: 'Headline Partner',
  gold: 'Gold Sponsor',
  silver: 'Silver Sponsor',
  bronze: 'Bronze Sponsor',
  partner: 'Official Partner',
  community: 'Community Sponsor',
};

const TIER_STYLES: Record<
  SponsorshipTier,
  { badgeBg: string; badgeBorder: string; badgeText: string; cardBorder: string }
> = {
  headline: {
    badgeBg: 'bg-amber-500/15',
    badgeBorder: 'border-amber-500/30',
    badgeText: 'text-amber-300',
    cardBorder: 'border-amber-500/30 hover:border-amber-500/50 bg-gradient-to-r from-amber-950/20 via-neutral-900/60 to-amber-950/20',
  },
  gold: {
    badgeBg: 'bg-yellow-500/10',
    badgeBorder: 'border-yellow-500/25',
    badgeText: 'text-yellow-400',
    cardBorder: 'border-yellow-500/25 hover:border-yellow-500/40 bg-neutral-900/60',
  },
  silver: {
    badgeBg: 'bg-slate-300/10',
    badgeBorder: 'border-slate-300/25',
    badgeText: 'text-slate-300',
    cardBorder: 'border-slate-500/25 hover:border-slate-400/40 bg-neutral-900/60',
  },
  bronze: {
    badgeBg: 'bg-amber-700/15',
    badgeBorder: 'border-amber-700/30',
    badgeText: 'text-amber-400',
    cardBorder: 'border-amber-700/25 hover:border-amber-600/40 bg-neutral-900/60',
  },
  partner: {
    badgeBg: 'bg-cyan-500/10',
    badgeBorder: 'border-cyan-500/20',
    badgeText: 'text-cyan-400',
    cardBorder: 'border-cyan-500/20 hover:border-cyan-500/35 bg-neutral-900/60',
  },
  community: {
    badgeBg: 'bg-neutral-800',
    badgeBorder: 'border-neutral-700',
    badgeText: 'text-neutral-400',
    cardBorder: 'border-neutral-800 hover:border-neutral-700 bg-neutral-900/40',
  },
};

export function PublicSponsorBanner({
  leaderboardId,
  initialSponsors,
}: PublicSponsorBannerProps) {
  const [sponsors, setSponsors] = useState<CompetitionSponsor[]>(initialSponsors || []);
  const [loading, setLoading] = useState(!initialSponsors);

  // Fetch sponsors if not pre-populated
  useEffect(() => {
    let ignore = false;
    async function fetchSponsors() {
      try {
        const res = await fetch(`/api/competitions/${leaderboardId}/sponsors`);
        const data = await res.json();
        if (!ignore && res.ok && Array.isArray(data.sponsors)) {
          setSponsors(data.sponsors);
        }
      } catch (err) {
        if (!ignore) console.warn('Could not load sponsors:', err);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    if (!initialSponsors) {
      void fetchSponsors();
    }
    return () => {
      ignore = true;
    };
  }, [leaderboardId, initialSponsors]);

  // Record impressions once per visitor session
  useEffect(() => {
    if (sponsors.length === 0) return;

    // Send impression beacons for visible sponsors
    sponsors.forEach((sponsor) => {
      try {
        void fetch(`/api/competitions/${leaderboardId}/sponsors/${sponsor.id}/track`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventType: 'impression' }),
          keepalive: true,
        });
      } catch {
        // Non-blocking beacon
      }
    });
  }, [leaderboardId, sponsors]);

  const handleSponsorClick = (sponsor: CompetitionSponsor) => {
    try {
      void fetch(`/api/competitions/${leaderboardId}/sponsors/${sponsor.id}/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventType: 'click' }),
        keepalive: true,
      });
    } catch {
      // Non-blocking
    }
  };

  if (loading || sponsors.length === 0) {
    return null;
  }

  const headlineSponsors = sponsors.filter((s) => s.tier === 'headline');
  const tieredSponsors = sponsors.filter((s) => s.tier !== 'headline');

  return (
    <section
      aria-label="Official Competition Sponsors"
      className="w-full max-w-4xl mx-auto my-6 space-y-4"
    >
      {/* Editorial vs Paid Sponsorship Disclosure */}
      <div className="flex items-center justify-between px-2 text-xs">
        <div className="flex items-center gap-1.5 text-neutral-400">
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
          <span className="font-semibold tracking-wide uppercase text-[11px] text-neutral-300">
            Official Sponsors
          </span>
        </div>
        <span className="text-[10px] text-neutral-500 font-medium tracking-tight">
          Paid Sponsorship
        </span>
      </div>

      {/* Headline / Title Sponsors */}
      {headlineSponsors.length > 0 && (
        <div className="space-y-3">
          {headlineSponsors.map((sponsor) => {
            const styles = TIER_STYLES[sponsor.tier] || TIER_STYLES.headline;
            return (
              <a
                key={sponsor.id}
                href={sponsor.website_url}
                target="_blank"
                rel="noopener noreferrer sponsored"
                onClick={() => handleSponsorClick(sponsor)}
                className={`group block p-4 sm:p-5 rounded-2xl border transition-all duration-200 backdrop-blur-md ${styles.cardBorder}`}
              >
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4 text-center sm:text-left">
                    {sponsor.logo_url ? (
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-neutral-900 border border-neutral-700/60 p-2 shrink-0 flex items-center justify-center overflow-hidden group-hover:scale-105 transition-transform">
                        <SafeImage
                          src={sponsor.logo_url}
                          alt={sponsor.name}
                          width={56}
                          height={56}
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-br from-amber-500/20 to-neutral-800 border border-amber-500/30 shrink-0 flex items-center justify-center text-xl font-bold text-amber-300">
                        {sponsor.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center justify-center sm:justify-start gap-2">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${styles.badgeBg} ${styles.badgeBorder} ${styles.badgeText} flex items-center gap-1`}
                        >
                          <Sparkles className="w-2.5 h-2.5" />
                          {TIER_LABELS[sponsor.tier]}
                        </span>
                      </div>
                      <h4 className="text-lg sm:text-xl font-extrabold text-white mt-1 group-hover:text-amber-200 transition-colors">
                        {sponsor.name}
                      </h4>
                      {sponsor.tagline && (
                        <p className="text-xs sm:text-sm text-neutral-400 mt-0.5 max-w-lg line-clamp-2">
                          {sponsor.tagline}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-medium text-neutral-300 group-hover:text-white group-hover:bg-white/10 transition-colors shrink-0">
                    <span>Visit Partner</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      )}

      {/* Tiered / Supporting Sponsors Grid */}
      {tieredSponsors.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {tieredSponsors.map((sponsor) => {
            const styles = TIER_STYLES[sponsor.tier] || TIER_STYLES.community;
            return (
              <a
                key={sponsor.id}
                href={sponsor.website_url}
                target="_blank"
                rel="noopener noreferrer sponsored"
                onClick={() => handleSponsorClick(sponsor)}
                className={`group p-3.5 rounded-xl border transition-all duration-150 backdrop-blur-sm flex items-center justify-between gap-3 ${styles.cardBorder}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {sponsor.logo_url ? (
                    <div className="w-10 h-10 rounded-lg bg-neutral-950 border border-neutral-800 p-1.5 shrink-0 flex items-center justify-center overflow-hidden">
                      <SafeImage
                        src={sponsor.logo_url}
                        alt={sponsor.name}
                        width={32}
                        height={32}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-neutral-800 border border-neutral-700 shrink-0 flex items-center justify-center text-sm font-bold text-neutral-300">
                      {sponsor.name.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div className="min-w-0">
                    <span
                      className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.2 rounded border ${styles.badgeBg} ${styles.badgeBorder} ${styles.badgeText}`}
                    >
                      {TIER_LABELS[sponsor.tier]}
                    </span>
                    <h5 className="text-sm font-semibold text-white truncate mt-0.5 group-hover:text-cyan-300 transition-colors">
                      {sponsor.name}
                    </h5>
                    {sponsor.tagline && (
                      <p className="text-[11px] text-neutral-400 truncate">
                        {sponsor.tagline}
                      </p>
                    )}
                  </div>
                </div>

                <ExternalLink className="w-3.5 h-3.5 text-neutral-500 group-hover:text-neutral-300 shrink-0 transition-colors" />
              </a>
            );
          })}
        </div>
      )}
    </section>
  );
}
