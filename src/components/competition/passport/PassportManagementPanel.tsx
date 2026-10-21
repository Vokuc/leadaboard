'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ParticipantProfile,
  ParticipantClaim,
  LeaderboardMember,
  Leaderboard,
  ParticipantCorrectionType,
  ParticipantAchievement,
  CompetitionRating,
} from '@/types';
import { CompetitionPassportService } from '@/lib/competition/passport/service';
import { AchievementService } from '@/lib/competition/achievements/service';
import { CompetitionRatingsService } from '@/lib/competition/ratings/service';
import { useAuth } from '@/context/AuthContext';
import {
  User,
  Shield,
  KeyRound,
  FileQuestion,
  Send,
  ExternalLink,
  Sparkles,
  Save,
  Link2,
  Globe,
  Medal,
  RefreshCw,
} from 'lucide-react';

export const PassportManagementPanel: React.FC = () => {
  const { profile: authProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'privacy' | 'achievements' | 'claims' | 'disputes'>('profile');

  const [passportProfile, setPassportProfile] = useState<ParticipantProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Form states
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [headline, setHeadline] = useState('');
  const [location, setLocation] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [twitter, setTwitter] = useState('');
  const [discord, setDiscord] = useState('');
  const [github, setGithub] = useState('');
  const [website, setWebsite] = useState('');

  // Privacy states
  const [isPublic, setIsPublic] = useState(true);
  const [showEmail, setShowEmail] = useState(false);
  const [showUnverified, setShowUnverified] = useState(true);
  const [showStats, setShowStats] = useState(true);
  const [showMatchHistory, setShowMatchHistory] = useState(true);
  const [showTeams, setShowTeams] = useState(true);
  const [showTrophyCase, setShowTrophyCase] = useState(true);
  const [showRatings, setShowRatings] = useState(true);

  // Achievements & Ratings states
  const [userAchievements, setUserAchievements] = useState<ParticipantAchievement[]>([]);
  const [userRatings, setUserRatings] = useState<CompetitionRating[]>([]);
  const [syncingAchievements, setSyncingAchievements] = useState(false);

  // Claims states
  const [claims, setClaims] = useState<ParticipantClaim[]>([]);
  const [unclaimedMatches, setUnclaimedMatches] = useState<Array<{ member: LeaderboardMember; leaderboard: Leaderboard }>>([]);
  const [tokenLeaderboardId, setTokenLeaderboardId] = useState('');
  const [tokenMemberId, setTokenMemberId] = useState('');
  const [claimTokenInput, setClaimTokenInput] = useState('');
  const [claiming, setClaiming] = useState(false);

  // Request claim state
  const [reqLeaderboardId, setReqLeaderboardId] = useState('');
  const [reqMemberId, setReqMemberId] = useState('');
  const [reqNotes, setReqNotes] = useState('');
  const [requestingClaim, setRequestingClaim] = useState(false);

  // Dispute states
  const [disputeLeaderboardId, setDisputeLeaderboardId] = useState('');
  const [disputeEntityType, setDisputeEntityType] = useState<'membership_link' | 'fixture_result' | 'tournament_match' | 'score_event'>('fixture_result');
  const [disputeEntityId, setDisputeEntityId] = useState('');
  const [disputeCorrectionType, setDisputeCorrectionType] = useState<ParticipantCorrectionType>('wrongly_linked');
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeHideNow, setDisputeHideNow] = useState(true);
  const [submittingDispute, setSubmittingDispute] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadData = useCallback(async () => {
    if (!authProfile) return;
    setLoading(true);
    try {
      const p = await CompetitionPassportService.getOrCreateProfile(authProfile.id);
      setPassportProfile(p);
      setUsername(p.username);
      setDisplayName(p.display_name);
      setHeadline(p.headline || '');
      setLocation(p.location || '');
      setBio(p.bio || '');
      setAvatarUrl(p.avatar_url || '');
      setTwitter(p.social_links.twitter || '');
      setDiscord(p.social_links.discord || '');
      setGithub(p.social_links.github || '');
      setWebsite(p.social_links.website || '');

      setIsPublic(p.privacy_settings.is_public);
      setShowEmail(p.privacy_settings.show_email);
      setShowUnverified(p.privacy_settings.show_unverified_results);
      setShowStats(p.privacy_settings.show_stats);
      setShowMatchHistory(p.privacy_settings.show_match_history);
      setShowTeams(p.privacy_settings.show_teams);
      setShowTrophyCase(p.privacy_settings.show_trophy_case ?? true);
      setShowRatings(p.privacy_settings.show_ratings ?? true);

      // Load achievements & ratings
      const achs = await AchievementService.getParticipantAchievements(authProfile.id, true);
      setUserAchievements(achs);
      const rts = await CompetitionRatingsService.getRatingsForEntity(authProfile.id, 'individual');
      setUserRatings(rts);

      // Load claims
      const userClaims = await CompetitionPassportService.getClaimsForUser(authProfile.id);
      setClaims(userClaims);

      // Load matching unclaimed
      if (authProfile.email) {
        const matches = await CompetitionPassportService.findUnclaimedMatchingMembers(authProfile.email);
        setUnclaimedMatches(matches);
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to load passport profile.', 'error');
    } finally {
      setLoading(false);
    }
  }, [authProfile]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadData();
    });
  }, [loadData]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authProfile || !passportProfile) return;
    setSaving(true);
    try {
      const updated = await CompetitionPassportService.updateProfile(
        authProfile.id,
        {
          username: username.trim(),
          display_name: displayName.trim(),
          headline: headline.trim() || null,
          location: location.trim() || null,
          bio: bio.trim() || null,
          avatar_url: avatarUrl.trim() || null,
          social_links: {
            twitter: twitter.trim() || undefined,
            discord: discord.trim() || undefined,
            github: github.trim() || undefined,
            website: website.trim() || undefined,
          },
        },
        authProfile.id
      );
      setPassportProfile(updated);
      showToast('Passport profile updated successfully!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update profile.';
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePrivacy = async () => {
    if (!authProfile || !passportProfile) return;
    setSaving(true);
    try {
      const updated = await CompetitionPassportService.updateProfile(
        authProfile.id,
        {
          privacy_settings: {
            is_public: isPublic,
            show_email: showEmail,
            show_unverified_results: showUnverified,
            show_stats: showStats,
            show_match_history: showMatchHistory,
            show_teams: showTeams,
            show_trophy_case: showTrophyCase,
            show_ratings: showRatings,
          },
        },
        authProfile.id
      );
      setPassportProfile(updated);
      showToast('Privacy preferences updated successfully!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update privacy settings.';
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleClaimWithToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authProfile) return;
    if (!tokenLeaderboardId || !tokenMemberId || !claimTokenInput) {
      showToast('Please fill in all claim fields.', 'error');
      return;
    }
    setClaiming(true);
    try {
      await CompetitionPassportService.claimParticipantRecord(authProfile.id, {
        leaderboardId: tokenLeaderboardId.trim(),
        memberId: tokenMemberId.trim(),
        verificationMethod: 'token',
        claimToken: claimTokenInput.trim(),
      });
      showToast('Participant record verified and linked to your passport!');
      setTokenLeaderboardId('');
      setTokenMemberId('');
      setClaimTokenInput('');
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Claim failed.';
      showToast(msg, 'error');
    } finally {
      setClaiming(false);
    }
  };

  const handleClaimEmailMatch = async (match: { member: LeaderboardMember; leaderboard: Leaderboard }) => {
    if (!authProfile) return;
    try {
      await CompetitionPassportService.claimParticipantRecord(authProfile.id, {
        leaderboardId: match.leaderboard.id,
        memberId: match.member.id,
        verificationMethod: 'email_match',
      });
      showToast(`Linked "${match.member.name}" in ${match.leaderboard.name} to your passport!`);
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to link record.';
      showToast(msg, 'error');
    }
  };

  const handleRequestClaimReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authProfile) return;
    if (!reqLeaderboardId || !reqMemberId) {
      showToast('Please specify the competition and member ID.', 'error');
      return;
    }
    setRequestingClaim(true);
    try {
      await CompetitionPassportService.claimParticipantRecord(authProfile.id, {
        leaderboardId: reqLeaderboardId.trim(),
        memberId: reqMemberId.trim(),
        verificationMethod: 'organizer_approved',
        claimNotes: reqNotes.trim(),
      });
      showToast('Claim request submitted for organizer review!');
      setReqLeaderboardId('');
      setReqMemberId('');
      setReqNotes('');
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Request failed.';
      showToast(msg, 'error');
    } finally {
      setRequestingClaim(false);
    }
  };

  const handleUnhide = async (entityId: string) => {
    if (!authProfile) return;
    try {
      await CompetitionPassportService.unhideEntityFromPassport(authProfile.id, entityId);
      showToast('Item unhidden from your public passport.');
      loadData();
    } catch (err) {
      console.error(err);
      showToast('Failed to unhide item.', 'error');
    }
  };

  const handleSubmitDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authProfile) return;
    if (!disputeLeaderboardId || !disputeEntityId || !disputeReason) {
      showToast('Please provide competition ID, entity ID, and reason.', 'error');
      return;
    }
    setSubmittingDispute(true);
    try {
      await CompetitionPassportService.requestCorrection(authProfile.id, {
        leaderboardId: disputeLeaderboardId.trim(),
        entityType: disputeEntityType,
        entityId: disputeEntityId.trim(),
        correctionType: disputeCorrectionType,
        reason: disputeReason.trim(),
        hideFromPassport: disputeHideNow,
      });
      showToast('Correction request submitted and logged in audit trail!');
      setDisputeLeaderboardId('');
      setDisputeEntityId('');
      setDisputeReason('');
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit correction.';
      showToast(msg, 'error');
    } finally {
      setSubmittingDispute(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-neutral-400 text-sm">
        Loading Competition Passport controls...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 p-4 rounded-xl shadow-2xl border text-sm flex items-center gap-2.5 transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}
        >
          <div className={`w-2 h-2 rounded-full ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`} />
          {toast.message}
        </div>
      )}

      {/* Top Banner with Public Link */}
      {passportProfile && (
        <div className="p-5 rounded-3xl border border-violet-500/30 bg-gradient-to-r from-violet-950/40 via-neutral-900 to-neutral-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-600/20 text-violet-300 flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">
                Your Public Competition Passport is Active
              </h3>
              <p className="text-xs text-neutral-400">
                Share your handle: <span className="font-mono text-violet-300">@{passportProfile.username}</span>
              </p>
            </div>
          </div>

          <Link
            href={`/passport/${passportProfile.username}`}
            target="_blank"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs transition shrink-0"
          >
            <Globe className="w-3.5 h-3.5" />
            View Public Passport
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-white/10 gap-2 overflow-x-auto text-sm">
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-2.5 font-bold rounded-t-xl transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'profile'
              ? 'bg-neutral-900 border-t-2 border-violet-500 text-white'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <User className="w-4 h-4 text-violet-400" />
          Passport Profile
        </button>
        <button
          onClick={() => setActiveTab('privacy')}
          className={`px-4 py-2.5 font-bold rounded-t-xl transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'privacy'
              ? 'bg-neutral-900 border-t-2 border-violet-500 text-white'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Shield className="w-4 h-4 text-emerald-400" />
          Privacy Controls
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
          Achievements & Ratings ({userAchievements.filter((a) => !a.is_revoked).length})
        </button>
        <button
          onClick={() => setActiveTab('claims')}
          className={`px-4 py-2.5 font-bold rounded-t-xl transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'claims'
              ? 'bg-neutral-900 border-t-2 border-violet-500 text-white'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <KeyRound className="w-4 h-4 text-amber-400" />
          Claim Records ({claims.length})
        </button>
        <button
          onClick={() => setActiveTab('disputes')}
          className={`px-4 py-2.5 font-bold rounded-t-xl transition cursor-pointer flex items-center gap-2 ${
            activeTab === 'disputes'
              ? 'bg-neutral-900 border-t-2 border-violet-500 text-white'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <FileQuestion className="w-4 h-4 text-red-400" />
          Disputes & Corrections
        </button>
      </div>

      {/* Tab 1: Profile & Customization */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSaveProfile} className="p-6 rounded-3xl border border-white/10 bg-neutral-900/60 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1">
                Display Name <span className="text-violet-400">*</span>
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white text-sm focus:outline-none focus:border-violet-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1">
                Unique Handle (@username) <span className="text-violet-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-neutral-500 text-sm">@</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                  required
                  placeholder="handle"
                  className="w-full pl-8 pr-3.5 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white text-sm font-mono focus:outline-none focus:border-violet-500"
                />
              </div>
              <p className="text-[11px] text-neutral-500 mt-1">
                Your shareable link: /passport/{username || 'handle'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1">
                Competitive Headline / Role
              </label>
              <input
                type="text"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="e.g. Semi-Pro Striker | Valorant Duelist"
                className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white text-sm focus:outline-none focus:border-violet-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1">
                Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. London, UK / Global"
                className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white text-sm focus:outline-none focus:border-violet-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-300 mb-1">
              Avatar Image URL
            </label>
            <input
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white text-sm focus:outline-none focus:border-violet-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-300 mb-1">
              Biography & Athletic Background
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              placeholder="Tell the community about your competitive background, favorite games/sports, and achievements..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white text-sm focus:outline-none focus:border-violet-500 resize-none"
            />
          </div>

          {/* Social Links */}
          <div className="space-y-3 pt-2 border-t border-white/5">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Social Links & Gamer Handles
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={twitter}
                onChange={(e) => setTwitter(e.target.value)}
                placeholder="Twitter / X (e.g. @player)"
                className="px-3.5 py-2 rounded-xl bg-neutral-950 border border-white/10 text-white text-xs"
              />
              <input
                type="text"
                value={discord}
                onChange={(e) => setDiscord(e.target.value)}
                placeholder="Discord Tag (e.g. player#0001)"
                className="px-3.5 py-2 rounded-xl bg-neutral-950 border border-white/10 text-white text-xs"
              />
              <input
                type="text"
                value={github}
                onChange={(e) => setGithub(e.target.value)}
                placeholder="GitHub Username"
                className="px-3.5 py-2 rounded-xl bg-neutral-950 border border-white/10 text-white text-xs"
              />
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="Personal Website URL"
                className="px-3.5 py-2 rounded-xl bg-neutral-950 border border-white/10 text-white text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs transition cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      )}

      {/* Tab 2: Privacy Controls */}
      {activeTab === 'privacy' && (
        <div className="p-6 rounded-3xl border border-white/10 bg-neutral-900/60 space-y-6">
          <div>
            <h3 className="text-base font-bold text-white">
              Passport Privacy & Visibility Settings
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Control exactly what details appear on your public passport card.
            </p>
          </div>

          <div className="space-y-4">
            <label className="flex items-center justify-between p-4 rounded-2xl bg-neutral-950 border border-white/5 cursor-pointer">
              <div>
                <span className="font-bold text-sm text-white block">Public Passport</span>
                <span className="text-xs text-neutral-400">
                  Allow other competitors and recruiters to view your verified passport URL
                </span>
              </div>
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="w-5 h-5 accent-violet-600 rounded cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-4 rounded-2xl bg-neutral-950 border border-white/5 cursor-pointer">
              <div>
                <span className="font-bold text-sm text-white block">Show Account Email</span>
                <span className="text-xs text-neutral-400">
                  Display your verified contact email publicly on the passport
                </span>
              </div>
              <input
                type="checkbox"
                checked={showEmail}
                onChange={(e) => setShowEmail(e.target.checked)}
                className="w-5 h-5 accent-violet-600 rounded cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-4 rounded-2xl bg-neutral-950 border border-white/5 cursor-pointer">
              <div>
                <span className="font-bold text-sm text-white block">Show Unverified Competitions</span>
                <span className="text-xs text-neutral-400">
                  Display friendly/self-reported events in addition to verified official matches
                </span>
              </div>
              <input
                type="checkbox"
                checked={showUnverified}
                onChange={(e) => setShowUnverified(e.target.checked)}
                className="w-5 h-5 accent-violet-600 rounded cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-4 rounded-2xl bg-neutral-950 border border-white/5 cursor-pointer">
              <div>
                <span className="font-bold text-sm text-white block">Show Career Statistics</span>
                <span className="text-xs text-neutral-400">
                  Display your total points, win rate, and match breakdown
                </span>
              </div>
              <input
                type="checkbox"
                checked={showStats}
                onChange={(e) => setShowStats(e.target.checked)}
                className="w-5 h-5 accent-violet-600 rounded cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-4 rounded-2xl bg-neutral-950 border border-white/5 cursor-pointer">
              <div>
                <span className="font-bold text-sm text-white block">Show Match-by-Match History</span>
                <span className="text-xs text-neutral-400">
                  Expose chronological match log and individual fixture scores
                </span>
              </div>
              <input
                type="checkbox"
                checked={showMatchHistory}
                onChange={(e) => setShowMatchHistory(e.target.checked)}
                className="w-5 h-5 accent-violet-600 rounded cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-4 rounded-2xl bg-neutral-950 border border-white/5 cursor-pointer">
              <div>
                <span className="font-bold text-sm text-white block">Show Historical Team Rosters</span>
                <span className="text-xs text-neutral-400">
                  Display current and historical club/team affiliations
                </span>
              </div>
              <input
                type="checkbox"
                checked={showTeams}
                onChange={(e) => setShowTeams(e.target.checked)}
                className="w-5 h-5 accent-violet-600 rounded cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-4 rounded-2xl bg-neutral-950 border border-white/5 cursor-pointer">
              <div>
                <span className="font-bold text-sm text-white block">Show Trophy Case & Badges</span>
                <span className="text-xs text-neutral-400">
                  Display earned achievements, milestone badges, and tournament trophies on your public passport
                </span>
              </div>
              <input
                type="checkbox"
                checked={showTrophyCase}
                onChange={(e) => setShowTrophyCase(e.target.checked)}
                className="w-5 h-5 accent-violet-600 rounded cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-4 rounded-2xl bg-neutral-950 border border-white/5 cursor-pointer">
              <div>
                <span className="font-bold text-sm text-white block">Show Competitive Elo Ratings</span>
                <span className="text-xs text-neutral-400">
                  Display your calculated Elo rating and match performance ledger in verified competitions
                </span>
              </div>
              <input
                type="checkbox"
                checked={showRatings}
                onChange={(e) => setShowRatings(e.target.checked)}
                className="w-5 h-5 accent-violet-600 rounded cursor-pointer"
              />
            </label>
          </div>

          {/* Hidden entities */}
          {passportProfile && passportProfile.hidden_entity_ids.length > 0 && (
            <div className="pt-4 border-t border-white/5 space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Individually Hidden Records ({passportProfile.hidden_entity_ids.length})
              </h4>
              <p className="text-xs text-neutral-400">
                You have hidden these items from your public passport view. You can unhide them at any time:
              </p>
              <div className="space-y-2">
                {passportProfile.hidden_entity_ids.map((id) => (
                  <div
                    key={id}
                    className="p-3 rounded-xl bg-neutral-950 border border-white/5 flex items-center justify-between"
                  >
                    <span className="font-mono text-xs text-neutral-300 truncate">ID: {id}</span>
                    <button
                      onClick={() => handleUnhide(id)}
                      className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-white transition"
                    >
                      Unhide
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              onClick={handleSavePrivacy}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Updating...' : 'Save Privacy Settings'}
            </button>
          </div>
        </div>
      )}

      {/* Tab: Achievements & Ratings Management */}
      {activeTab === 'achievements' && (
        <div className="space-y-6">
          {/* Header Action Card */}
          <div className="p-6 rounded-3xl border border-white/10 bg-neutral-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Medal className="w-5 h-5 text-purple-400" />
                Achievement Sync & Competitive Ratings
              </h3>
              <p className="text-xs text-neutral-400 mt-1 max-w-xl">
                Achievements are evaluated authoritatively from your verified matches and standings. Trigger an automatic scan at any time to unlock newly earned badges.
              </p>
            </div>
            <button
              onClick={async () => {
                if (!authProfile) return;
                setSyncingAchievements(true);
                try {
                  const newlyAwarded = await AchievementService.evaluateParticipantAchievements(authProfile.id);
                  if (newlyAwarded.length > 0) {
                    showToast(`Unlocked ${newlyAwarded.length} new achievement${newlyAwarded.length > 1 ? 's' : ''}!`);
                  } else {
                    showToast('All achievements are current with your match history.');
                  }
                  const updatedAchs = await AchievementService.getParticipantAchievements(authProfile.id, true);
                  setUserAchievements(updatedAchs);
                  const updatedRts = await CompetitionRatingsService.getRatingsForEntity(authProfile.id, 'individual');
                  setUserRatings(updatedRts);
                } catch (err: unknown) {
                  const msg = err instanceof Error ? err.message : 'Sync failed.';
                  showToast(msg, 'error');
                } finally {
                  setSyncingAchievements(false);
                }
              }}
              disabled={syncingAchievements}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition cursor-pointer shrink-0 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${syncingAchievements ? 'animate-spin' : ''}`} />
              {syncingAchievements ? 'Scanning History...' : 'Evaluate & Sync Badges'}
            </button>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-neutral-900/40 border border-white/5">
              <span className="text-xs text-neutral-400 font-medium">Earned Badges</span>
              <div className="text-3xl font-black text-white mt-1">
                {userAchievements.filter((a) => !a.is_revoked).length}
              </div>
            </div>
            <div className="p-5 rounded-2xl bg-neutral-900/40 border border-white/5">
              <span className="text-xs text-neutral-400 font-medium">Total Badge Points</span>
              <div className="text-3xl font-black text-purple-400 mt-1">
                {userAchievements
                  .filter((a) => !a.is_revoked)
                  .reduce((acc, a) => acc + (a.achievement?.points_reward || 50), 0)}
              </div>
            </div>
            <div className="p-5 rounded-2xl bg-neutral-900/40 border border-white/5">
              <span className="text-xs text-neutral-400 font-medium">Active Elo Ratings</span>
              <div className="text-3xl font-black text-emerald-400 mt-1">
                {userRatings.length}
              </div>
            </div>
          </div>

          {/* Earned Badges Showcase */}
          <div className="p-6 rounded-3xl border border-white/10 bg-neutral-900/60 space-y-4">
            <h4 className="font-bold text-sm text-white">Your Earned Achievements</h4>
            {userAchievements.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {userAchievements.map((award) => (
                  <div
                    key={award.id}
                    className={`p-4 rounded-2xl border flex items-start gap-3 ${
                      award.is_revoked
                        ? 'bg-red-950/10 border-red-500/20 opacity-60'
                        : 'bg-neutral-950 border-white/5'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-xl flex items-center justify-center shrink-0">
                      {award.achievement?.badge_icon || '🏆'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`font-bold text-xs text-white truncate ${award.is_revoked ? 'line-through' : ''}`}>
                          {award.achievement?.name || award.achievement_id}
                        </span>
                        <span className="text-[10px] font-mono text-purple-300 font-bold">
                          +{award.achievement?.points_reward ?? 50} pts
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-400 mt-0.5 line-clamp-1">
                        {award.achievement?.description}
                      </p>
                      {award.is_revoked && (
                        <div className="text-[10px] text-red-400 font-semibold mt-1">
                          Revoked: {award.revocation_reason}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-neutral-400 py-4 text-center">
                No achievements recorded yet. Click &quot;Evaluate &amp; Sync Badges&quot; above to scan your history.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Claim Participation Records */}
      {activeTab === 'claims' && (
        <div className="space-y-6">
          {/* Discovered Matching Unclaimed Records */}
          {unclaimedMatches.length > 0 && (
            <div className="p-6 rounded-3xl border border-violet-500/30 bg-violet-950/20 space-y-4">
              <div className="flex items-center gap-3 text-violet-300">
                <Sparkles className="w-5 h-5" />
                <h3 className="font-bold text-white text-base">
                  Discovered Roster Records Matching Your Account Email
                </h3>
              </div>
              <p className="text-xs text-neutral-300">
                We found existing competition entries registered under <span className="font-mono text-white">{authProfile?.email}</span>. Click to link them to your passport:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {unclaimedMatches.map((m) => (
                  <div
                    key={m.member.id}
                    className="p-4 rounded-2xl bg-neutral-900 border border-white/10 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-sm text-white">{m.member.name}</div>
                      <div className="text-xs text-neutral-400">{m.leaderboard.name}</div>
                    </div>
                    <button
                      onClick={() => handleClaimEmailMatch(m)}
                      className="px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition"
                    >
                      Link to Passport
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Claim with Organizer Token */}
          <form onSubmit={handleClaimWithToken} className="p-6 rounded-3xl border border-white/10 bg-neutral-900/60 space-y-4">
            <div className="flex items-center gap-3">
              <KeyRound className="w-5 h-5 text-amber-400" />
              <div>
                <h3 className="font-bold text-white text-base">
                  Claim with Organizer Token
                </h3>
                <p className="text-xs text-neutral-400">
                  If an organizer gave you an official claim token (e.g. CP-XXXX), enter it below to immediately link the record.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                value={tokenLeaderboardId}
                onChange={(e) => setTokenLeaderboardId(e.target.value)}
                placeholder="Competition ID"
                required
                className="px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white text-xs"
              />
              <input
                type="text"
                value={tokenMemberId}
                onChange={(e) => setTokenMemberId(e.target.value)}
                placeholder="Participant Member ID"
                required
                className="px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white text-xs"
              />
              <input
                type="text"
                value={claimTokenInput}
                onChange={(e) => setClaimTokenInput(e.target.value)}
                placeholder="Claim Token (CP-XXXX)"
                required
                className="px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white text-xs font-mono"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={claiming}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition cursor-pointer"
              >
                <Link2 className="w-4 h-4" />
                {claiming ? 'Verifying...' : 'Verify & Claim Slot'}
              </button>
            </div>
          </form>

          {/* Request Claim Review */}
          <form onSubmit={handleRequestClaimReview} className="p-6 rounded-3xl border border-white/10 bg-neutral-900/60 space-y-4">
            <div className="flex items-center gap-3">
              <Send className="w-5 h-5 text-cyan-400" />
              <div>
                <h3 className="font-bold text-white text-base">
                  Request Roster Slot Review
                </h3>
                <p className="text-xs text-neutral-400">
                  Played under a gamer tag or offline alias without an email? Request an organizer to verify and link you.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={reqLeaderboardId}
                onChange={(e) => setReqLeaderboardId(e.target.value)}
                placeholder="Competition ID"
                required
                className="px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white text-xs"
              />
              <input
                type="text"
                value={reqMemberId}
                onChange={(e) => setReqMemberId(e.target.value)}
                placeholder="Member ID or Name"
                required
                className="px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white text-xs"
              />
            </div>

            <textarea
              value={reqNotes}
              onChange={(e) => setReqNotes(e.target.value)}
              rows={2}
              placeholder="Explain how you can be identified by the organizer..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white text-xs resize-none"
            />

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={requestingClaim}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition cursor-pointer"
              >
                <Send className="w-4 h-4" />
                {requestingClaim ? 'Submitting...' : 'Submit Claim Request'}
              </button>
            </div>
          </form>

          {/* Active Claims Table */}
          <div className="p-6 rounded-3xl border border-white/10 bg-neutral-900/60 space-y-4">
            <h3 className="font-bold text-white text-base">Your Claim Submissions</h3>
            {claims.length > 0 ? (
              <div className="space-y-2">
                {claims.map((c) => (
                  <div
                    key={c.id}
                    className="p-3.5 rounded-xl bg-neutral-950 border border-white/5 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-mono text-xs text-white">Member ID: {c.member_id}</div>
                      <div className="text-[11px] text-neutral-500">Method: {c.verification_method}</div>
                    </div>
                    <div>
                      <span
                        className={`px-2.5 py-1 rounded text-xs font-bold uppercase ${
                          c.status === 'verified' || c.status === 'approved'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : c.status === 'pending'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            : 'bg-red-500/10 text-red-400 border border-red-500/30'
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-neutral-400">No active claims found.</p>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Disputes & Corrections */}
      {activeTab === 'disputes' && (
        <form onSubmit={handleSubmitDispute} className="p-6 rounded-3xl border border-white/10 bg-neutral-900/60 space-y-5">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <FileQuestion className="w-5 h-5 text-red-400" />
              Request Correction of Wrongly Linked Results
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Spotted a score error, duplicate account, or match that wasn&apos;t you? File a formal correction request.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1">
                Competition ID <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={disputeLeaderboardId}
                onChange={(e) => setDisputeLeaderboardId(e.target.value)}
                required
                placeholder="e.g. lb-sports-1"
                className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1">
                Entity ID (Match ID / Member ID) <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={disputeEntityId}
                onChange={(e) => setDisputeEntityId(e.target.value)}
                required
                placeholder="e.g. fix-101"
                className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1">
                Entity Type
              </label>
              <select
                value={disputeEntityType}
                onChange={(e) => setDisputeEntityType(e.target.value as typeof disputeEntityType)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white text-xs"
              >
                <option value="fixture_result">League Fixture Result</option>
                <option value="tournament_match">Tournament Match</option>
                <option value="score_event">Points Score Event</option>
                <option value="membership_link">Roster Membership Link</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-300 mb-1">
                Correction Type
              </label>
              <select
                value={disputeCorrectionType}
                onChange={(e) => setDisputeCorrectionType(e.target.value as ParticipantCorrectionType)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white text-xs"
              >
                <option value="wrongly_linked">Wrongly Linked (Not me)</option>
                <option value="wrong_score">Incorrect Match Score Recorded</option>
                <option value="wrong_team">Wrong Team Affiliation</option>
                <option value="duplicate_profile">Duplicate Profile Merged</option>
                <option value="remove_from_passport">Remove from my Passport</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-300 mb-1">
              Detailed Reason & Evidence <span className="text-red-400">*</span>
            </label>
            <textarea
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              rows={3}
              required
              placeholder="Explain the discrepancy and provide evidence or reference link..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-white/10 text-white text-xs resize-none"
            />
          </div>

          <label className="flex items-center gap-3 p-3.5 rounded-xl bg-neutral-950 border border-white/5 cursor-pointer">
            <input
              type="checkbox"
              checked={disputeHideNow}
              onChange={(e) => setDisputeHideNow(e.target.checked)}
              className="w-4 h-4 accent-red-600 rounded"
            />
            <span className="text-xs text-neutral-300">
              Immediately hide this item from my public passport while under review
            </span>
          </label>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submittingDispute}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition cursor-pointer"
            >
              <FileQuestion className="w-4 h-4" />
              {submittingDispute ? 'Submitting Dispute...' : 'File Correction Request'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
