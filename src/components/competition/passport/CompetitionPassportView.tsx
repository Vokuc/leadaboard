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
  Medal,
  TrendingUp,
  Info,
  History,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
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
  const {
    profile,
    overview,
    competitions,
    matches,
    teams,
    achievements = [],
    ratings = [],
    rating_history = [],
    account_email,
  } = passport;

  const [activeTab, setActiveTab] = useState<'overview' | 'competitions' | 'matches' | 'achievements' | 'ratings' | 'teams'>('overview');
  const [matchFilter, setMatchFilter] = useState<'all' | 'verified'>('all');
  const [achievementCategoryFilter, setAchievementCategoryFilter] = useState<string>('all');
  const [ratingScopeFilter, setRatingScopeFilter] = useState<string>('all');
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
          onClick={() => setActiveTab('achievements')}
          className={`px-4 py-2.5 font-bold rounded-t-xl transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'achievements'
              ? 'bg-neutral-900 border-t-2 border-violet-500 text-white'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Medal className="w-4 h-4 text-purple-400" />
          Achievements ({achievements.filter((a) => !a.is_revoked).length})
        </button>
        <button
          onClick={() => setActiveTab('ratings')}
          className={`px-4 py-2.5 font-bold rounded-t-xl transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'ratings'
              ? 'bg-neutral-900 border-t-2 border-violet-500 text-white'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          Competitive Ratings ({ratings.length})
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

          {/* Earned Achievements Spotlight */}
          <div className="rounded-3xl border border-white/10 bg-neutral-900/60 p-6 sm:p-8 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Medal className="w-5 h-5 text-purple-400" />
                  Unlocked Badges & Achievements
                </h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Milestones and verified achievements evaluated from competitive history
                </p>
              </div>
              {achievements.length > 0 && (
                <button
                  onClick={() => setActiveTab('achievements')}
                  className="text-xs font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer transition"
                >
                  View All ({achievements.filter((a) => !a.is_revoked).length})
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {achievements.filter((a) => !a.is_revoked).length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {achievements
                  .filter((a) => !a.is_revoked)
                  .slice(0, 3)
                  .map((a) => (
                    <div
                      key={a.id}
                      className="p-4 rounded-2xl bg-neutral-950/70 border border-purple-500/20 hover:border-purple-500/40 transition flex items-start gap-3.5"
                    >
                      <div className="w-11 h-11 rounded-xl bg-purple-500/20 text-2xl flex items-center justify-center shrink-0 border border-purple-500/30">
                        {a.achievement?.badge_icon || '🏆'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="font-bold text-white text-sm truncate">
                            {a.achievement?.name || a.achievement_id}
                          </h4>
                          <span className="text-[10px] font-mono font-bold text-purple-300 bg-purple-500/20 px-1.5 py-0.5 rounded">
                            +{a.achievement?.points_reward ?? 50} pts
                          </span>
                        </div>
                        <p className="text-xs text-neutral-400 line-clamp-2 mt-0.5">
                          {a.achievement?.description || 'Earned through competitive excellence.'}
                        </p>
                        <div className="text-[10px] text-neutral-500 mt-1.5 font-medium truncate">
                          {a.provenance?.competition_name || 'Official Competition'}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-center py-8 rounded-2xl border border-dashed border-white/10 text-neutral-400 text-xs">
                No achievements unlocked yet. Play matches, score wins, or build streaks to earn badges!
              </div>
            )}
          </div>

          {/* Competitive Rating Highlights */}
          <div className="rounded-3xl border border-white/10 bg-neutral-900/60 p-6 sm:p-8 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                  Head-to-Head Competitive Ratings (Elo)
                </h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Scope-isolated ratings evaluated transparently against opponents in verified head-to-head matches
                </p>
              </div>
              {ratings.length > 0 && (
                <button
                  onClick={() => setActiveTab('ratings')}
                  className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer transition"
                >
                  View Details & History
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {ratings.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {ratings.map((r) => (
                  <div
                    key={r.id}
                    className="p-4 rounded-2xl bg-neutral-950/70 border border-emerald-500/20 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs uppercase font-mono font-bold text-emerald-400 tracking-wider">
                          {r.game_type || r.competition_type}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-neutral-800 text-neutral-300 border border-neutral-700">
                          {r.season_id || 'All-Time'}
                        </span>
                      </div>
                      <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-3xl font-black text-white">{r.current_rating}</span>
                        <span className="text-xs font-semibold text-neutral-400">Elo</span>
                      </div>
                      <div className="text-[11px] text-neutral-400 mt-1 flex items-center gap-2">
                        <span>Peak: <strong className="text-emerald-300">{r.peak_rating}</strong></span>
                        <span>•</span>
                        <span>Record: <strong className="text-white">{r.wins}W-{r.losses}L</strong></span>
                      </div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-white/5 text-[10px] text-neutral-500 font-mono flex items-center justify-between">
                      <span>{r.region || 'Global'}</span>
                      <span className="capitalize">{r.entity_type}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 rounded-2xl border border-dashed border-white/10 text-neutral-400 text-xs">
                No head-to-head rating established yet. Complete verified matches in eligible competitions to receive your Elo rating.
              </div>
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

      {/* Tab: Achievements Showcase */}
      {activeTab === 'achievements' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/5">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Medal className="w-5 h-5 text-purple-400" />
                Unlocked Badges & Career Milestones
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Evaluated authoritatively from real match results and competition standings. Provenance is preserved permanently.
              </p>
            </div>

            {/* Filter by Category */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              {['all', 'victory', 'streak', 'milestone', 'participation', 'mastery'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setAchievementCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-xl font-semibold capitalize cursor-pointer transition ${
                    achievementCategoryFilter === cat
                      ? 'bg-purple-600 text-white'
                      : 'bg-neutral-900 text-neutral-400 hover:text-white border border-white/5'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Achievements Summary Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5">
              <span className="text-[11px] text-neutral-400 font-medium">Earned Badges</span>
              <div className="text-2xl font-black text-white mt-1">
                {achievements.filter((a) => !a.is_revoked).length}
              </div>
            </div>
            <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5">
              <span className="text-[11px] text-neutral-400 font-medium">Achievement Points</span>
              <div className="text-2xl font-black text-purple-400 mt-1">
                {achievements
                  .filter((a) => !a.is_revoked)
                  .reduce((acc, a) => acc + (a.achievement?.points_reward || 50), 0)}
              </div>
            </div>
            <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5">
              <span className="text-[11px] text-neutral-400 font-medium">Rare / Epic / Legendary</span>
              <div className="text-2xl font-black text-amber-300 mt-1">
                {
                  achievements.filter(
                    (a) =>
                      !a.is_revoked &&
                      (a.achievement?.rarity === 'rare' ||
                        a.achievement?.rarity === 'epic' ||
                        a.achievement?.rarity === 'legendary')
                  ).length
                }
              </div>
            </div>
            <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5">
              <span className="text-[11px] text-neutral-400 font-medium">Audit Provenance</span>
              <div className="text-xs font-semibold text-emerald-400 mt-2 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> 100% Verified
              </div>
            </div>
          </div>

          {/* Grid of Achievements */}
          {(() => {
            const filtered = achievements.filter((a) => {
              if (achievementCategoryFilter === 'all') return true;
              return a.achievement?.category === achievementCategoryFilter;
            });

            if (filtered.length === 0) {
              return (
                <div className="text-center py-16 rounded-3xl border border-dashed border-white/10 text-neutral-400 text-sm">
                  No achievements in this category yet. Keep competing to unlock milestones!
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((award) => {
                  const def = award.achievement;
                  const rarity = def?.rarity || 'common';
                  const isRevoked = award.is_revoked;

                  const rarityStyles =
                    rarity === 'legendary'
                      ? 'border-amber-400/50 bg-gradient-to-br from-amber-500/10 via-neutral-900 to-neutral-950 shadow-lg shadow-amber-500/10'
                      : rarity === 'epic'
                      ? 'border-purple-400/50 bg-gradient-to-br from-purple-500/10 via-neutral-900 to-neutral-950 shadow-md shadow-purple-500/10'
                      : rarity === 'rare'
                      ? 'border-blue-400/40 bg-gradient-to-br from-blue-500/10 via-neutral-900 to-neutral-950'
                      : rarity === 'uncommon'
                      ? 'border-emerald-400/40 bg-neutral-900/80'
                      : 'border-white/10 bg-neutral-900/60';

                  return (
                    <div
                      key={award.id}
                      className={`relative p-5 rounded-3xl border flex flex-col justify-between transition overflow-hidden ${
                        isRevoked ? 'opacity-50 border-red-500/30 bg-red-950/10' : rarityStyles
                      }`}
                    >
                      <div>
                        {/* Top header with badge and rarity */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl shadow-inner">
                            {def?.badge_icon || '🏆'}
                          </div>
                          <div className="flex flex-col items-end gap-1.5">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                rarity === 'legendary'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : rarity === 'epic'
                                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                  : rarity === 'rare'
                                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                  : rarity === 'uncommon'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                              }`}
                            >
                              {rarity}
                            </span>
                            <span className="text-xs font-mono font-bold text-purple-300 bg-purple-500/15 px-2 py-0.5 rounded-md">
                              +{def?.points_reward ?? 50} pts
                            </span>
                          </div>
                        </div>

                        {/* Title and description */}
                        <div className="mt-4 space-y-1">
                          <h3
                            className={`font-black text-lg text-white ${
                              isRevoked ? 'line-through text-neutral-500' : ''
                            }`}
                          >
                            {def?.name || award.achievement_id}
                          </h3>
                          <p className="text-xs text-neutral-300 leading-relaxed">
                            {def?.description}
                          </p>
                        </div>
                      </div>

                      {/* Provenance Box */}
                      <div className="mt-5 pt-3 border-t border-white/5 space-y-1.5 text-[11px] text-neutral-400 font-medium">
                        {award.provenance?.competition_name && (
                          <div className="truncate flex items-center gap-1.5">
                            <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span className="text-neutral-300 truncate">
                              {award.provenance.competition_name}
                            </span>
                          </div>
                        )}
                        {award.provenance?.opponent_name && (
                          <div className="truncate flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                            <span>vs {award.provenance.opponent_name}</span>
                            {award.provenance.score_summary && (
                              <span className="font-mono text-white text-[10px]">
                                ({award.provenance.score_summary})
                              </span>
                            )}
                          </div>
                        )}
                        <div className="flex items-center justify-between text-[10px] text-neutral-500 pt-1">
                          <span>
                            Unlocked:{' '}
                            {new Date(award.awarded_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                          <span className="capitalize">{def?.category || 'milestone'}</span>
                        </div>

                        {/* Revoked Warning if applicable */}
                        {isRevoked && (
                          <div className="mt-3 p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-[11px] flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                            <div>
                              <strong className="block font-bold">Award Revoked:</strong>
                              <span>{award.revocation_reason || 'Administrative correction.'}</span>
                              {award.revocation_audit_id && (
                                <span className="block text-[9px] text-neutral-500 font-mono mt-0.5">
                                  Audit: {award.revocation_audit_id}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* Tab: Competitive Ratings (Elo) */}
      {activeTab === 'ratings' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/5">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                Competitive Ratings & Match Elo
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Head-to-head performance ratings calculated deterministically with strict scope isolation across games, seasons, and regions.
              </p>
            </div>

            {/* Scope Selector if multiple ratings */}
            {ratings.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                <button
                  onClick={() => setRatingScopeFilter('all')}
                  className={`px-3 py-1.5 rounded-xl font-semibold cursor-pointer transition ${
                    ratingScopeFilter === 'all'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-neutral-900 text-neutral-400 hover:text-white border border-white/5'
                  }`}
                >
                  All Scopes
                </button>
                {ratings.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setRatingScopeFilter(r.scope_key)}
                    className={`px-3 py-1.5 rounded-xl font-semibold cursor-pointer transition truncate max-w-[140px] ${
                      ratingScopeFilter === r.scope_key
                        ? 'bg-emerald-600 text-white'
                        : 'bg-neutral-900 text-neutral-400 hover:text-white border border-white/5'
                    }`}
                  >
                    {r.game_type || r.competition_type}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Active Scopes Grid */}
          {ratings.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ratings
                .filter((r) => ratingScopeFilter === 'all' || r.scope_key === ratingScopeFilter)
                .map((r) => {
                  const winRate =
                    r.matches_played > 0 ? Math.round((r.wins / r.matches_played) * 100) : 0;
                  const tier =
                    r.current_rating >= 2000
                      ? { label: 'Grandmaster', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40' }
                      : r.current_rating >= 1800
                      ? { label: 'Master', badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40' }
                      : r.current_rating >= 1600
                      ? { label: 'Diamond', badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' }
                      : r.current_rating >= 1400
                      ? { label: 'Gold', badge: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' }
                      : r.current_rating >= 1200
                      ? { label: 'Silver', badge: 'bg-slate-400/20 text-slate-200 border-slate-400/40' }
                      : { label: 'Bronze', badge: 'bg-orange-700/20 text-orange-300 border-orange-700/40' };

                  return (
                    <div
                      key={r.id}
                      className="p-6 rounded-3xl border border-white/10 bg-neutral-900/70 shadow-xl flex flex-col justify-between space-y-6"
                    >
                      <div>
                        {/* Scope Header */}
                        <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-3">
                          <div className="space-y-0.5">
                            <span className="text-xs uppercase font-mono font-bold text-emerald-400 tracking-wider">
                              {r.game_type || r.competition_type}
                            </span>
                            <div className="text-[11px] text-neutral-400">
                              Format: <span className="capitalize text-white font-medium">{r.entity_type}</span> • Region: <span className="text-white font-medium">{r.region || 'Global'}</span>
                            </div>
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${tier.badge}`}>
                            {tier.label}
                          </span>
                        </div>

                        {/* Rating Display */}
                        <div className="mt-5 flex items-baseline justify-between">
                          <div className="space-y-1">
                            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                              Current Elo Rating
                            </span>
                            <div className="text-4xl font-black text-white tracking-tight flex items-baseline gap-2">
                              {r.current_rating}
                              <span className="text-xs font-normal text-neutral-400">PTS</span>
                            </div>
                          </div>
                          <div className="text-right space-y-1">
                            <span className="text-xs font-semibold text-neutral-400">Win Rate</span>
                            <div className="text-2xl font-black text-emerald-400">{winRate}%</div>
                          </div>
                        </div>

                        {/* Rating Bounds & Record */}
                        <div className="mt-5 grid grid-cols-3 gap-2 p-3 rounded-2xl bg-white/[0.02] border border-white/5 text-center">
                          <div>
                            <span className="text-[10px] text-neutral-400 font-medium block">Peak Rating</span>
                            <span className="text-sm font-bold text-emerald-300 mt-0.5 block">{r.peak_rating}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-neutral-400 font-medium block">Lowest Rating</span>
                            <span className="text-sm font-bold text-neutral-300 mt-0.5 block">{r.lowest_rating}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-neutral-400 font-medium block">Record (W-L-D)</span>
                            <span className="text-sm font-bold text-white mt-0.5 block">
                              {r.wins}-{r.losses}-{r.draws}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Scope canonical tag */}
                      <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-neutral-400">
                        <span className="font-mono text-[10px] text-neutral-500 truncate">
                          Scope: {r.scope_key}
                        </span>
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Verified Isolated
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className="text-center py-16 rounded-3xl border border-dashed border-white/10 text-neutral-400 text-sm">
              No competitive ratings recorded yet. Compete in official head-to-head fixtures to calculate your Elo rating.
            </div>
          )}

          {/* Rating Engine Transparency & Architecture Box */}
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-neutral-900 via-neutral-900/90 to-neutral-950 p-6 sm:p-8 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Info className="w-4 h-4 text-emerald-400" />
              Rating Mechanics & Transparency Guarantees
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-neutral-300">
              <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1.5">
                <strong className="text-white block font-bold">1. Strict Scope Isolation</strong>
                <p className="text-neutral-400 leading-relaxed">
                  Competitions are never measured on an arbitrary universal scale. Your Chess rating will never influence your Football, Tennis, or Esports ratings.
                </p>
              </div>
              <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1.5">
                <strong className="text-white block font-bold">2. Pure Deterministic Elo</strong>
                <p className="text-neutral-400 leading-relaxed">
                  Baseline starts at 1200. Expected win probability is calculated via standard logistic curve:{' '}
                  <code className="text-emerald-400 font-mono text-[11px]">E = 1 / (1 + 10^((R_opp - R)/400))</code>.
                </p>
              </div>
              <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1.5">
                <strong className="text-white block font-bold">3. Adaptive K-Factor Scaling</strong>
                <p className="text-neutral-400 leading-relaxed">
                  K=40 for provisional competitors (&lt;10 matches), K=32 for standard competition, and K=16 for elite master tier (&ge;2000) for stability.
                </p>
              </div>
              <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1.5">
                <strong className="text-white block font-bold">4. Drift-Free Deterministic Replay</strong>
                <p className="text-neutral-400 leading-relaxed">
                  If historical match results are corrected or voided by referees, all ratings recalculate from baseline 1200 without compounding rounding error.
                </p>
              </div>
            </div>
          </div>

          {/* Rating Update History Ledger */}
          <div className="rounded-3xl border border-white/10 bg-neutral-900/60 p-6 sm:p-8 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <History className="w-4 h-4 text-emerald-400" />
                  Rating Update History & Transactions
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Complete ledger of historical rating calculations, expected outcomes, and referee corrections
                </p>
              </div>
            </div>

            {rating_history.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-neutral-400 text-[11px] font-mono uppercase">
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Competition & Opponent</th>
                      <th className="py-2.5 px-3">Outcome</th>
                      <th className="py-2.5 px-3">Expected</th>
                      <th className="py-2.5 px-3">K-Factor</th>
                      <th className="py-2.5 px-3">Rating Change</th>
                      <th className="py-2.5 px-3">New Rating</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {rating_history.map((entry) => {
                      const isPositive = entry.rating_change > 0;
                      const isNegative = entry.rating_change < 0;

                      return (
                        <tr key={entry.id} className="hover:bg-white/[0.02] transition">
                          <td className="py-3 px-3 text-neutral-400 font-mono">
                            {new Date(entry.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-semibold text-white truncate max-w-[180px]">
                              {entry.competition_name || 'Tournament'}
                            </div>
                            <div className="text-[11px] text-neutral-400 truncate">
                              vs {entry.opponent_name || 'Opponent'}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                entry.actual_score === 1
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : entry.actual_score === 0.5
                                  ? 'bg-neutral-800 text-neutral-300'
                                  : 'bg-red-500/20 text-red-300'
                              }`}
                            >
                              {entry.actual_score === 1
                                ? 'Win'
                                : entry.actual_score === 0.5
                                ? 'Draw'
                                : 'Loss'}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono text-neutral-300">
                            {(entry.expected_score * 100).toFixed(1)}%
                          </td>
                          <td className="py-3 px-3 font-mono text-neutral-400">
                            {entry.k_factor}
                          </td>
                          <td className="py-3 px-3 font-mono font-bold">
                            <span
                              className={`inline-flex items-center gap-0.5 ${
                                isPositive
                                  ? 'text-emerald-400'
                                  : isNegative
                                  ? 'text-red-400'
                                  : 'text-neutral-400'
                              }`}
                            >
                              {isPositive ? (
                                <ArrowUpRight className="w-3.5 h-3.5" />
                              ) : isNegative ? (
                                <ArrowDownRight className="w-3.5 h-3.5" />
                              ) : (
                                <Minus className="w-3.5 h-3.5" />
                              )}
                              {isPositive ? `+${entry.rating_change}` : entry.rating_change}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-white">
                            {entry.new_rating}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${
                                entry.status === 'applied'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                  : entry.status === 'recalculated'
                                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                                  : 'bg-red-500/10 text-red-400 border border-red-500/30'
                              }`}
                            >
                              {entry.status.replace('_', ' ')}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-neutral-400 text-center py-6">
                No rating history transactions logged yet.
              </p>
            )}
          </div>
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
