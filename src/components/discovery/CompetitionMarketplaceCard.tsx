'use client';

import React from 'react';
import Link from 'next/link';
import { MarketplaceCompetition } from '@/types';
import {
  Calendar,
  Clock,
  Eye,
  GitBranch,
  Globe,
  Lock,
  MapPin,
  Sparkles,
  Table,
  Tag,
  Trophy,
  UserCheck,
  Users,
} from 'lucide-react';
import Image from 'next/image';

interface CompetitionMarketplaceCardProps {
  competition: MarketplaceCompetition;
  onQuickView?: (comp: MarketplaceCompetition) => void;
}

export default function CompetitionMarketplaceCard({
  competition,
  onQuickView,
}: CompetitionMarketplaceCardProps) {
  const {
    slug,
    name,
    description,
    competition_type,
    engine_type,
    organizer,
    season,
    registration,
    participation_type,
    location_name,
    pricing,
    rules_summary,
    participant_count,
    cover_image_url,
    is_demo,
  } = competition;

  // Format dates
  const formatIsoDate = (isoStr: string | null | undefined) => {
    if (!isoStr) return null;
    try {
      const d = new Date(isoStr);
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
      }).format(d);
    } catch {
      return null;
    }
  };

  const startDateFormatted = formatIsoDate(season?.start_date);
  const deadlineFormatted = formatIsoDate(registration.closes_at);

  // Status styling
  const getStatusBadge = () => {
    switch (registration.status) {
      case 'open':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Registration Open
          </span>
        );
      case 'approval_required':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <Clock className="w-3 h-3" />
            Approval Required
          </span>
        );
      case 'waitlist':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-500/15 text-orange-400 border border-orange-500/30">
            <Users className="w-3 h-3" />
            Waitlist Available
          </span>
        );
      case 'closed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-neutral-800 text-neutral-400 border border-neutral-700">
            <Lock className="w-3 h-3" />
            Registration Closed
          </span>
        );
      case 'view_only':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-neutral-800/80 text-neutral-400 border border-neutral-700/60">
            <Eye className="w-3 h-3" />
            View Only
          </span>
        );
    }
  };

  // Engine format icon & label
  const getEngineDisplay = () => {
    switch (engine_type) {
      case 'tournament':
        return {
          icon: <GitBranch className="w-3.5 h-3.5 text-fuchsia-400" />,
          label: 'Tournament Bracket',
          color: 'bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/20',
        };
      case 'league_table':
        return {
          icon: <Table className="w-3.5 h-3.5 text-cyan-400" />,
          label: 'League Table',
          color: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
        };
      case 'simple_points':
      default:
        return {
          icon: <Trophy className="w-3.5 h-3.5 text-amber-400" />,
          label: 'Points Leaderboard',
          color: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
        };
    }
  };

  const engine = getEngineDisplay();

  // Registration CTA configuration
  const getPrimaryAction = () => {
    const regUrl = `/leaderboards/${slug}?register=true#registration`;
    const viewUrl = `/leaderboards/${slug}`;

    if (registration.status === 'open') {
      return {
        href: regUrl,
        label: 'Register Now',
        icon: <UserCheck className="w-4 h-4" />,
        className: 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-md shadow-violet-900/30',
      };
    }

    if (registration.status === 'approval_required') {
      return {
        href: regUrl,
        label: 'Request to Join',
        icon: <Clock className="w-4 h-4" />,
        className: 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-md shadow-amber-900/30',
      };
    }

    if (registration.status === 'waitlist') {
      return {
        href: regUrl,
        label: 'Join Waitlist',
        icon: <Users className="w-4 h-4" />,
        className: 'bg-gradient-to-r from-orange-600 to-amber-700 hover:from-orange-500 hover:to-amber-600 text-white',
      };
    }

    return {
      href: viewUrl,
      label: 'View Standings',
      icon: <Eye className="w-4 h-4" />,
      className: 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700',
    };
  };

  const action = getPrimaryAction();

  return (
    <div className="group glass p-5 rounded-2xl border border-white/5 hover:border-violet-500/30 hover:bg-neutral-900/70 transition-all flex flex-col h-full overflow-hidden relative shadow-lg hover:shadow-2xl hover:shadow-violet-950/20">
      {/* Background glow on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-600/0 via-violet-600/0 to-violet-600/5 group-hover:to-violet-600/10 transition-colors pointer-events-none" />

      {/* Header Image / Fallback Cover */}
      <div className="w-full h-36 rounded-xl overflow-hidden mb-4 relative bg-neutral-900 border border-white/5">
        {cover_image_url ? (
          <Image
            src={cover_image_url}
            alt={`${name} cover`}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-violet-950/40 via-neutral-900 to-neutral-950 p-4 text-center">
            <Trophy className="w-8 h-8 text-violet-400/60 mb-2" />
            <span className="text-xs font-semibold text-neutral-400 capitalize">
              {competition_type} Competition
            </span>
          </div>
        )}

        {/* Overlay Badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-wrap items-center gap-1.5 z-10">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border backdrop-blur-md ${engine.color}`}>
            {engine.icon}
            {engine.label}
          </span>

          {is_demo && (
            <span
              title="This is sample demonstration data for testing."
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 backdrop-blur-md"
            >
              Demo Sample
            </span>
          )}
        </div>

        <div className="absolute top-2.5 right-2.5 z-10">
          {getStatusBadge()}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col space-y-3">
        {/* Title */}
        <Link href={`/leaderboards/${slug}`} className="hover:underline">
          <h3 className="text-xl font-bold text-white group-hover:text-violet-300 transition-colors line-clamp-1">
            {name}
          </h3>
        </Link>

        {/* Organizer */}
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <div className="w-5 h-5 rounded-full bg-violet-600/30 border border-violet-500/30 flex items-center justify-center overflow-hidden shrink-0">
            {organizer.avatar_url ? (
              <Image
                src={organizer.avatar_url}
                alt={organizer.name}
                width={20}
                height={20}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-[10px] font-bold text-violet-300">
                {organizer.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <span className="truncate">By {organizer.name}</span>
        </div>

        {/* Description */}
        {description && (
          <p className="text-sm text-neutral-400 leading-relaxed line-clamp-2">
            {description}
          </p>
        )}

        {/* Rules summary snippet */}
        {rules_summary && (
          <div className="p-2.5 rounded-lg bg-neutral-900/60 border border-neutral-800 text-xs text-neutral-300 line-clamp-1 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-violet-400 shrink-0" />
            <span className="truncate">{rules_summary}</span>
          </div>
        )}

        {/* Badges / Attributes Grid */}
        <div className="grid grid-cols-2 gap-2 pt-2 text-xs text-neutral-400">
          {/* Participation Location */}
          <div className="flex items-center gap-1.5 p-1.5 rounded-md bg-neutral-900/40 border border-neutral-850 truncate">
            {participation_type === 'online' ? (
              <Globe className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            ) : (
              <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            )}
            <span className="truncate">
              {location_name || (participation_type === 'online' ? 'Online Event' : 'In-Person Venue')}
            </span>
          </div>

          {/* Pricing */}
          <div className="flex items-center gap-1.5 p-1.5 rounded-md bg-neutral-900/40 border border-neutral-850">
            <Tag className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="font-semibold text-neutral-200">
              {pricing.is_free ? 'Free Entry' : `${pricing.currency} ${pricing.entry_fee}`}
            </span>
          </div>

          {/* Participants */}
          <div className="flex items-center gap-1.5 p-1.5 rounded-md bg-neutral-900/40 border border-neutral-850">
            <Users className="w-3.5 h-3.5 text-violet-400 shrink-0" />
            <span>
              {registration.capacity
                ? `${participant_count} / ${registration.capacity} Spots`
                : `${participant_count} Participants`}
            </span>
          </div>

          {/* Dates / Deadlines */}
          <div className="flex items-center gap-1.5 p-1.5 rounded-md bg-neutral-900/40 border border-neutral-850 truncate">
            <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">
              {deadlineFormatted
                ? `Closes ${deadlineFormatted}`
                : startDateFormatted
                ? `Starts ${startDateFormatted}`
                : 'Ongoing'}
            </span>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="pt-4 mt-4 border-t border-white/5 flex items-center gap-2">
        {onQuickView && (
          <button
            onClick={() => onQuickView(competition)}
            className="px-3 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
            title="Quick preview of standings, bracket, and details"
          >
            <Eye className="w-3.5 h-3.5" />
            Quick View
          </button>
        )}

        <Link
          href={action.href}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all text-center ${action.className}`}
        >
          {action.icon}
          <span>{action.label}</span>
        </Link>
      </div>
    </div>
  );
}
