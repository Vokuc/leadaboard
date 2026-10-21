'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { MarketplaceCompetition } from '@/types';
import {
  Calendar,
  Clock,
  ExternalLink,
  Globe,
  MapPin,
  ShieldAlert,
  Sparkles,
  Tag,
  Trophy,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import Image from 'next/image';

interface CompetitionQuickViewModalProps {
  competition: MarketplaceCompetition | null;
  onClose: () => void;
}

export default function CompetitionQuickViewModal({
  competition,
  onClose,
}: CompetitionQuickViewModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'rules' | 'registration'>('overview');

  if (!competition) return null;

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

  const formatIsoDate = (isoStr: string | null | undefined) => {
    if (!isoStr) return null;
    try {
      const d = new Date(isoStr);
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(d);
    } catch {
      return null;
    }
  };

  const startDateFormatted = formatIsoDate(season?.start_date);
  const endDateFormatted = formatIsoDate(season?.end_date);
  const deadlineFormatted = formatIsoDate(registration.closes_at);
  const opensFormatted = formatIsoDate(registration.opens_at);

  const regUrl = `/leaderboards/${slug}?register=true#registration`;
  const viewUrl = `/leaderboards/${slug}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div
        className="relative w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Cover Banner */}
        <div className="relative w-full h-44 bg-neutral-950 shrink-0 border-b border-neutral-800">
          {cover_image_url ? (
            <Image
              src={cover_image_url}
              alt={name}
              fill
              className="object-cover opacity-80"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-950/40 via-neutral-900 to-black">
              <Trophy className="w-12 h-12 text-violet-400/50" />
            </div>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/60 hover:bg-black/90 text-neutral-300 hover:text-white border border-white/10 transition-colors z-20 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Badges Overlay */}
          <div className="absolute bottom-3 left-4 right-4 flex flex-wrap items-center gap-2 z-10">
            <span className="px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-violet-500/20 text-violet-300 border border-violet-500/30 backdrop-blur-md">
              {competition_type}
            </span>

            <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-neutral-900/80 text-neutral-200 border border-neutral-700 backdrop-blur-md capitalize">
              {engine_type.replace('_', ' ')}
            </span>

            {is_demo && (
              <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 backdrop-blur-md">
                Demo Sample
              </span>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* Title & Organizer */}
          <div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight glow-text mb-1">
              {name}
            </h2>
            <div className="flex items-center gap-2 text-sm text-neutral-400">
              <span className="w-2 h-2 rounded-full bg-violet-400" />
              <span>Organized by <strong className="text-neutral-200">{organizer.name}</strong></span>
              {season && <span>• {season.name}</span>}
            </div>
          </div>

          {/* Demo Notice Banner if demo */}
          {is_demo && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3 text-xs text-amber-200">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-300">Sample Demonstration Competition</p>
                <p className="text-amber-200/80 mt-0.5">
                  This competition is provided for local exploration. Registrations and scores are simulated in your browser demo session and will not affect live production competitions.
                </p>
              </div>
            </div>
          )}

          {/* Tabs Navigation */}
          <div className="flex border-b border-neutral-800 text-sm font-semibold">
            <button
              onClick={() => setActiveTab('overview')}
              className={`pb-2.5 px-3 border-b-2 transition-colors cursor-pointer ${
                activeTab === 'overview'
                  ? 'border-violet-500 text-violet-400'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Overview & Details
            </button>
            <button
              onClick={() => setActiveTab('registration')}
              className={`pb-2.5 px-3 border-b-2 transition-colors cursor-pointer ${
                activeTab === 'registration'
                  ? 'border-violet-500 text-violet-400'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Registration & Eligibility
            </button>
            <button
              onClick={() => setActiveTab('rules')}
              className={`pb-2.5 px-3 border-b-2 transition-colors cursor-pointer ${
                activeTab === 'rules'
                  ? 'border-violet-500 text-violet-400'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Rules & Format
            </button>
          </div>

          {/* Tab 1: Overview */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {description && (
                <p className="text-sm text-neutral-300 leading-relaxed bg-neutral-950/40 p-3.5 rounded-xl border border-neutral-850">
                  {description}
                </p>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-1">
                  <span className="text-neutral-500 font-medium">Participation</span>
                  <div className="flex items-center gap-1.5 font-semibold text-neutral-200">
                    {participation_type === 'online' ? (
                      <Globe className="w-3.5 h-3.5 text-cyan-400" />
                    ) : (
                      <MapPin className="w-3.5 h-3.5 text-rose-400" />
                    )}
                    <span className="truncate">{location_name || (participation_type === 'online' ? 'Online' : 'In-Person')}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-1">
                  <span className="text-neutral-500 font-medium">Entry Fee</span>
                  <div className="flex items-center gap-1.5 font-semibold text-neutral-200">
                    <Tag className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{pricing.is_free ? 'Free Entry' : `${pricing.currency} ${pricing.entry_fee}`}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-1">
                  <span className="text-neutral-500 font-medium">Competitors</span>
                  <div className="flex items-center gap-1.5 font-semibold text-neutral-200">
                    <Users className="w-3.5 h-3.5 text-violet-400" />
                    <span>{participant_count} registered</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-1">
                  <span className="text-neutral-500 font-medium">Start Date</span>
                  <div className="flex items-center gap-1.5 font-semibold text-neutral-200">
                    <Calendar className="w-3.5 h-3.5 text-amber-400" />
                    <span>{startDateFormatted || 'TBD'}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-1">
                  <span className="text-neutral-500 font-medium">End Date</span>
                  <div className="flex items-center gap-1.5 font-semibold text-neutral-200">
                    <Calendar className="w-3.5 h-3.5 text-amber-400" />
                    <span>{endDateFormatted || 'Ongoing'}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-1">
                  <span className="text-neutral-500 font-medium">Reg Deadline</span>
                  <div className="flex items-center gap-1.5 font-semibold text-neutral-200">
                    <Clock className="w-3.5 h-3.5 text-rose-400" />
                    <span>{deadlineFormatted || 'Open'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Registration & Eligibility */}
          {activeTab === 'registration' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-neutral-950/60 border border-neutral-800 space-y-3 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                  <span className="text-neutral-400 font-medium">Registration Mode</span>
                  <span className="font-semibold text-neutral-200 capitalize">
                    {registration.require_approval ? 'Approval Required by Organizer' : 'Instant Confirmation'}
                  </span>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                  <span className="text-neutral-400 font-medium">Maximum Capacity</span>
                  <span className="font-semibold text-neutral-200">
                    {registration.capacity ? `${registration.capacity} Participants` : 'Unlimited'}
                  </span>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                  <span className="text-neutral-400 font-medium">Waitlist Policy</span>
                  <span className="font-semibold text-neutral-200">
                    {registration.allow_waitlist ? 'Waitlist Enabled upon Capacity' : 'No Waitlist'}
                  </span>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                  <span className="text-neutral-400 font-medium">Registration Window</span>
                  <span className="font-semibold text-neutral-200">
                    {opensFormatted ? `Opens ${opensFormatted} ` : ''}
                    {deadlineFormatted ? `• Closes ${deadlineFormatted}` : 'Open'}
                  </span>
                </div>

                {registration.eligibility_rules?.allowed_domains && registration.eligibility_rules.allowed_domains.length > 0 && (
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                    <span className="text-neutral-400 font-medium">Allowed Email Domains</span>
                    <span className="font-semibold text-cyan-400">
                      {registration.eligibility_rules.allowed_domains.join(', ')}
                    </span>
                  </div>
                )}

                {registration.eligibility_rules?.min_age && (
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                    <span className="text-neutral-400 font-medium">Minimum Age</span>
                    <span className="font-semibold text-neutral-200">
                      {registration.eligibility_rules.min_age}+ years old
                    </span>
                  </div>
                )}

                {registration.eligibility_rules?.notes && (
                  <div className="pt-1">
                    <span className="text-neutral-500 font-medium">Special Eligibility Notes:</span>
                    <p className="text-neutral-300 mt-1 italic">{registration.eligibility_rules.notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 3: Rules & Format */}
          {activeTab === 'rules' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-xl bg-neutral-950/60 border border-neutral-800 space-y-3">
                <div className="flex items-center gap-2 text-violet-400 font-bold text-sm">
                  <Sparkles className="w-4 h-4" />
                  <span>Competition Scoring & Format</span>
                </div>
                <p className="text-neutral-300 leading-relaxed">
                  {rules_summary || 'Standard competition points and ranking rules apply.'}
                </p>

                <div className="pt-2 border-t border-neutral-800 grid grid-cols-2 gap-2 text-neutral-400">
                  <div>
                    <span className="text-neutral-500">Engine Type:</span>{' '}
                    <strong className="text-neutral-200 capitalize">{engine_type.replace('_', ' ')}</strong>
                  </div>
                  <div>
                    <span className="text-neutral-500">Entity Category:</span>{' '}
                    <strong className="text-neutral-200 capitalize">{competition.entity_type}</strong>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between gap-3 shrink-0">
          <Link
            href={viewUrl}
            className="px-4 py-2.5 rounded-xl bg-neutral-850 hover:bg-neutral-800 text-neutral-200 hover:text-white border border-neutral-700 text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Full Competition Page
          </Link>

          {registration.status === 'open' || registration.status === 'approval_required' || registration.status === 'waitlist' ? (
            <Link
              href={regUrl}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-violet-900/30 flex items-center gap-1.5"
            >
              <UserCheck className="w-4 h-4" />
              {registration.status === 'open'
                ? 'Register Now'
                : registration.status === 'approval_required'
                ? 'Request Registration'
                : 'Join Waitlist'}
            </Link>
          ) : (
            <Link
              href={viewUrl}
              className="px-4 py-2.5 rounded-xl bg-neutral-800 text-neutral-400 text-xs font-semibold"
            >
              View Standings
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
