'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { CompetitionPassportData } from '@/types';
import {
  ShieldCheck,
  ShieldAlert,
  Trophy,
  Calendar,
  Share2,
  ExternalLink,
  Lock,
  MapPin,
  CheckCircle2,
  Users,
  Flame,
  Award,
  Sparkles,
  ArrowRight,
  Filter,
} from 'lucide-react';
import SafeImage from '@/components/SafeImage';

interface CompetitionPassportViewProps {
  passport: CompetitionPassportData;
  isOwner?: boolean;
}

export const CompetitionPassportView: React.FC<CompetitionPassportViewProps> = ({
  passport,
  isOwner = false,
}) => {
  const { profile, overview, competitions, matches, teams, account_email } = passport;
  const [activeTab, setActiveTab] = useState<'overview' | 'competitions' | 'matches' | 'teams'>('overview');
  const [matchFilter, setMatchFilter] = useState<'all' | 'verified'>('all');
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${profile.display_name} — Competition Passport`,
          text: `Check out ${profile.display_name}'s verified competitive career on LeaderboardOS!`,
          url,
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const filteredMatches = matches.filter((m) => {
    if (matchFilter === 'verified') return m.is_verified;
    return true;
  });

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8">
      {/* Privacy Notice Banner for Owner */}
      {isOwner && !profile.privacy_settings.is_public && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-center justify-between text-amber-300 text-sm">
          <div className="flex items-center gap-3">
            <Lock className="w-5 h-5 shrink-0 text-amber-400" />
            <span>
              <strong>Private Passport:</strong> Only you can see this passport. Change to public in Passport Settings whenever you want to share it.
            </span>
          </div>
          <Link
            href="/dashboard/passport"
            className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 font-semibold text-xs transition"
          >
            Settings
          </Link>
        </div>
      )}

      {/* Main Digital Passport Card */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-neutral-900 via-neutral-900/90 to-neutral-950 p-6 sm:p-10 shadow-2xl backdrop-blur-xl">
        {/* Holographic accent glow */}
        <div className="absolute top-0 right-0 -mr-24 -mt-24 w-80 h-80 rounded-full bg-violet-600/15 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-24 -mb-24 w-80 h-80 rounded-full bg-cyan-600/15 blur-3xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-8 border-b border-white/10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {/* Avatar with Credential Badge */}
            <div className="relative">
              {profile.avatar_url ? (
                <SafeImage
                  src={profile.avatar_url}
                  alt={profile.display_name}
                  width={96}
                  height={96}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-2 border-violet-500/40 object-cover shadow-xl shadow-violet-950/50"
                />
              ) : (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center font-black text-3xl text-white shadow-xl">
                  {profile.display_name.charAt(0).toUpperCase()}
                </div>
              )}
              {overview.verified_competitions > 0 && (
                <div
                  className="absolute -bottom-2 -right-2 p-1.5 rounded-xl bg-emerald-500 text-black shadow-lg"
                  title="Verified Competitor with confirmed competition audit logs"
                >
                  <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {profile.display_name}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-neutral-800/80 text-violet-300 border border-violet-500/20">
                  @{profile.username}
                </span>
                {overview.verified_competitions > 0 ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    <CheckCircle2 className="w-3 h-3" /> Verified Athlete
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-neutral-800 text-neutral-400 border border-neutral-700">
                    Active Contender
                  </span>
                )}
              </div>

              {profile.headline && (
                <p className="text-sm font-medium text-neutral-300 max-w-xl">
                  {profile.headline}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-400 pt-1">
                {profile.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-neutral-500" />
                    {profile.location}
                  </span>
                )}
                {account_email && (
                  <span className="inline-flex items-center gap-1 font-mono text-neutral-300">
                    {account_email}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                  Passport Issued {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={handleShare}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs font-semibold transition cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              {copied ? 'Link Copied! 📋' : 'Share Passport'}
            </button>
            {isOwner && (
              <Link
                href="/dashboard/passport"
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition shadow-lg shadow-violet-900/30"
              >
                Manage Passport
              </Link>
            )}
          </div>
        </div>

        {/* Bio */}
        {profile.bio && (
          <div className="pt-6 pb-2 text-sm text-neutral-300 leading-relaxed border-b border-white/5">
            {profile.bio}
          </div>
        )}

        {/* Career Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-6">
          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col">
            <span className="text-[11px] font-semibold text-neutral-400">Competitions</span>
            <span className="text-2xl font-black text-white mt-1">{overview.total_competitions}</span>
            <span className="text-[10px] text-emerald-400/90 font-medium mt-auto pt-1">
              {overview.verified_competitions} verified
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col">
            <span className="text-[11px] font-semibold text-neutral-400">Matches Played</span>
            <span className="text-2xl font-black text-white mt-1">{overview.total_matches}</span>
            <span className="text-[10px] text-neutral-400 mt-auto pt-1">
              {overview.matches_won}W - {overview.matches_drawn}D - {overview.matches_lost}L
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col">
            <span className="text-[11px] font-semibold text-neutral-400">Win Rate</span>
            <span className="text-2xl font-black text-emerald-400 mt-1">{overview.win_percentage}%</span>
            <span className="text-[10px] text-neutral-400 mt-auto pt-1">
              across fixtures
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col">
            <span className="text-[11px] font-semibold text-neutral-400">Podiums</span>
            <span className="text-2xl font-black text-amber-300 mt-1">
              {overview.first_place_finishes + overview.second_place_finishes + overview.third_place_finishes}
            </span>
            <span className="text-[10px] text-neutral-400 mt-auto pt-1">
              🥇{overview.first_place_finishes} 🥈{overview.second_place_finishes} 🥉{overview.third_place_finishes}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col">
            <span className="text-[11px] font-semibold text-neutral-400">Career Points</span>
            <span className="text-2xl font-black text-violet-400 mt-1">{overview.total_points_scored}</span>
            <span className="text-[10px] text-neutral-400 mt-auto pt-1">
              recorded points
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col">
            <span className="text-[11px] font-semibold text-neutral-400">Teams</span>
            <span className="text-2xl font-black text-white mt-1">{overview.active_teams}</span>
            <span className="text-[10px] text-neutral-400 mt-auto pt-1">
              current affiliations
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-white/10 gap-2 overflow-x-auto pb-1 text-sm">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 font-bold rounded-t-xl transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'overview'
              ? 'bg-neutral-900 border-t-2 border-violet-500 text-white'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Sparkles className="w-4 h-4 text-violet-400" />
          Overview & Trophies
        </button>
        <button
          onClick={() => setActiveTab('competitions')}
          className={`px-4 py-2.5 font-bold rounded-t-xl transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'competitions'
              ? 'bg-neutral-900 border-t-2 border-violet-500 text-white'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Trophy className="w-4 h-4 text-amber-400" />
          Competitions ({competitions.length})
        </button>
        <button
          onClick={() => setActiveTab('matches')}
          className={`px-4 py-2.5 font-bold rounded-t-xl transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'matches'
              ? 'bg-neutral-900 border-t-2 border-violet-500 text-white'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Flame className="w-4 h-4 text-red-400" />
          Match History ({matches.length})
        </button>
        <button
          onClick={() => setActiveTab('teams')}
          className={`px-4 py-2.5 font-bold rounded-t-xl transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'teams'
              ? 'bg-neutral-900 border-t-2 border-violet-500 text-white'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4 text-cyan-400" />
          Team Affiliations ({teams.length})
        </button>
      </div>

      {/* Tab 1: Overview & Trophy Case */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Trophy Case */}
          <div className="rounded-3xl border border-white/10 bg-neutral-900/60 p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-400" />
                  Trophy Case & Verified Honours
                </h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Podium finishes and certified competition results
                </p>
              </div>
            </div>

            {competitions.filter((c) => c.podium_finish).length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {competitions
                  .filter((c) => c.podium_finish)
                  .map((comp) => {
                    const isGold = comp.podium_finish === 1;
                    const isSilver = comp.podium_finish === 2;

                    return (
                      <div
                        key={comp.leaderboard_id}
                        className={`p-4 rounded-2xl border flex items-start gap-3.5 transition ${
                          isGold
                            ? 'bg-amber-500/[0.06] border-amber-500/30'
                            : isSilver
                            ? 'bg-slate-400/[0.06] border-slate-400/30'
                            : 'bg-amber-700/[0.06] border-amber-700/30'
                        }`}
                      >
                        <div
                          className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-lg shrink-0 ${
                            isGold
                              ? 'bg-amber-500/20 text-amber-300'
                              : isSilver
                              ? 'bg-slate-300/20 text-slate-200'
                              : 'bg-amber-700/20 text-amber-400'
                          }`}
                        >
                          {isGold ? '🥇' : isSilver ? '🥈' : '🥉'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-sm text-white truncate">
                              {comp.competition_name}
                            </span>
                            {comp.is_verified && (
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-neutral-400 mt-0.5 truncate">
                            {isGold ? 'Champion' : isSilver ? 'Runner-Up' : '3rd Place Finish'}
                            {comp.team_name ? ` • ${comp.team_name}` : ''}
                          </p>
                          <div className="flex items-center gap-2 mt-2 text-[10px] text-neutral-500 font-mono">
                            <span>{comp.points} PTS</span>
                            <span>•</span>
                            <span>{comp.matches_won}W - {comp.matches_lost}L</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="text-center py-10 rounded-2xl border border-dashed border-white/10 text-neutral-400 text-xs">
                No podium trophies yet. Compete in upcoming events to build your career showcase.
              </div>
            )}
          </div>

          {/* Recent Competitive Activity Highlights */}
          <div className="rounded-3xl border border-white/10 bg-neutral-900/60 p-6 sm:p-8 space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Flame className="w-5 h-5 text-red-400" />
              Latest Match Performances
            </h2>
            {matches.slice(0, 4).length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {matches.slice(0, 4).map((m) => (
                  <div
                    key={m.match_id}
                    className="p-4 rounded-2xl bg-neutral-950/70 border border-white/5 flex items-center justify-between"
                  >
                    <div className="space-y-1">
                      <div className="text-xs text-neutral-400 font-medium">
                        {m.competition_name} • {m.round_name}
                      </div>
                      <div className="text-sm font-bold text-white flex items-center gap-2">
                        <span>vs {m.opponent_name}</span>
                        {m.is_verified && (
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      {m.home_score !== null && m.away_score !== null ? (
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-white text-base">
                            {m.home_score} - {m.away_score}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                              m.outcome === 'win'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : m.outcome === 'loss'
                                ? 'bg-red-500/20 text-red-300'
                                : 'bg-neutral-800 text-neutral-300'
                            }`}
                          >
                            {m.outcome}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs font-medium text-neutral-500">Scheduled</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-neutral-400">No match records logged yet.</p>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Competitions List */}
      {activeTab === 'competitions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-neutral-400 px-1">
            <span>Showing {competitions.length} enrolled / completed competitions</span>
            <span className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1 text-emerald-400">
                <ShieldCheck className="w-3.5 h-3.5" /> Verified
              </span>
              <span className="inline-flex items-center gap-1 text-amber-400">
                <ShieldAlert className="w-3.5 h-3.5" /> Unverified
              </span>
            </span>
          </div>

          {competitions.length > 0 ? (
            <div className="grid grid-cols-1 gap-3.5">
              {competitions.map((comp) => (
                <div
                  key={comp.leaderboard_id}
                  className="p-5 rounded-2xl border border-white/10 bg-neutral-900/70 hover:border-white/20 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-base text-white">
                        {comp.competition_name}
                      </h3>
                      {comp.is_verified ? (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                          title={comp.verification_reason}
                        >
                          <ShieldCheck className="w-3 h-3" /> Verified Official
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30"
                          title={comp.verification_reason}
                        >
                          <ShieldAlert className="w-3 h-3" /> Unverified / Unofficial
                        </span>
                      )}
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">
                        {comp.engine_type.replace('_', ' ')}
                      </span>
                    </div>

                    <p className="text-xs text-neutral-400">
                      Roster: <strong className="text-white">{comp.member_name}</strong>
                      {comp.team_name && (
                        <span> • Team: <strong className="text-violet-300">{comp.team_name}</strong></span>
                      )}
                      {comp.season_name && (
                        <span> • {comp.season_name}</span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-6 self-end sm:self-center">
                    <div className="text-right">
                      <div className="text-sm font-bold text-white">
                        {comp.rank ? `#${comp.rank} of ${comp.total_participants}` : 'Participant'}
                      </div>
                      <div className="text-xs text-neutral-400 font-mono">
                        {comp.points} PTS • {comp.matches_won}W - {comp.matches_lost}L
                      </div>
                    </div>

                    <Link
                      href={`/leaderboards/${comp.slug}`}
                      className="p-2.5 rounded-xl border border-white/10 hover:bg-white/10 text-neutral-400 hover:text-white transition"
                      title="View Public Board"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 rounded-3xl border border-dashed border-white/10 text-neutral-400 text-sm">
              No competitions linked to this passport yet.
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Match History */}
      {activeTab === 'matches' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-neutral-400 px-1">
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-neutral-500" />
              <span>Filter:</span>
              <button
                onClick={() => setMatchFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                  matchFilter === 'all'
                    ? 'bg-violet-600 text-white'
                    : 'bg-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                All ({matches.length})
              </button>
              <button
                onClick={() => setMatchFilter('verified')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                  matchFilter === 'verified'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                Verified Only ({matches.filter((m) => m.is_verified).length})
              </button>
            </div>
            <span className="text-[11px] text-neutral-500">
              Only scores recorded by official engines appear here
            </span>
          </div>

          {filteredMatches.length > 0 ? (
            <div className="grid grid-cols-1 gap-3">
              {filteredMatches.map((m) => (
                <div
                  key={m.match_id}
                  className="p-4 rounded-2xl border border-white/10 bg-neutral-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-neutral-400 font-medium">
                        {m.competition_name}
                      </span>
                      <span className="text-neutral-600">•</span>
                      <span className="text-xs text-violet-300 font-mono">
                        {m.round_name}
                      </span>
                      {m.is_verified ? (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-400">
                          <ShieldCheck className="w-3 h-3" /> Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-400">
                          <ShieldAlert className="w-3 h-3" /> Unverified
                        </span>
                      )}
                    </div>

                    <div className="text-sm font-bold text-white flex items-center gap-2">
                      <span>vs {m.opponent_name}</span>
                      {m.team_name && (
                        <span className="text-xs text-neutral-400 font-normal">
                          (playing for {m.team_name})
                        </span>
                      )}
                    </div>

                    {m.venue_name && (
                      <div className="text-[11px] text-neutral-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {m.venue_name}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-4 self-end sm:self-center">
                    {m.home_score !== null && m.away_score !== null ? (
                      <div className="flex items-center gap-2.5">
                        <span className="text-base font-mono font-black text-white">
                          {m.home_score} - {m.away_score}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            m.outcome === 'win'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : m.outcome === 'loss'
                              ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                              : 'bg-neutral-800 text-neutral-300 border border-neutral-700'
                          }`}
                        >
                          {m.outcome}
                        </span>
                      </div>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded text-xs font-medium bg-neutral-800 text-neutral-400">
                        Upcoming
                      </span>
                    )}

                    <Link
                      href={`/leaderboards/${m.slug}`}
                      className="p-2 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white"
                      title="View Competition"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 rounded-3xl border border-dashed border-white/10 text-neutral-400 text-sm">
              No matching records found.
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Team Affiliations */}
      {activeTab === 'teams' && (
        <div className="space-y-4">
          <div className="text-xs text-neutral-400 px-1">
            Verified team affiliations across competitions. Past team history is preserved permanently when competitors transfer.
          </div>

          {teams.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {teams.map((team) => {
                const isCurrent = !team.left_at;
                return (
                  <div
                    key={team.id}
                    className="p-5 rounded-2xl border border-white/10 bg-neutral-900/60 flex items-start gap-4"
                  >
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-600 to-blue-700 flex items-center justify-center font-bold text-white text-lg shrink-0">
                      {team.team_name.charAt(0)}
                    </div>
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-bold text-white truncate text-base">
                          {team.team_name}
                        </h4>
                        {isCurrent ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            Current Team
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-neutral-800 text-neutral-400">
                            Former
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-400">
                        Role: <span className="text-white capitalize">{team.role}</span>
                        {team.jersey_number !== null && (
                          <span> • #{team.jersey_number}</span>
                        )}
                      </p>
                      <div className="text-[11px] text-neutral-500 pt-1">
                        Affiliation: {new Date(team.joined_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                        {team.left_at ? ` - ${new Date(team.left_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}` : ' (Present)'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 rounded-3xl border border-dashed border-white/10 text-neutral-400 text-sm">
              No team affiliations logged.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
