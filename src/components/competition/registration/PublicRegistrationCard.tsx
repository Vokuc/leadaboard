'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  CompetitionRegistration,
  CompetitionRegistrationConfig,
  Leaderboard,
  Team,
} from '@/types';
import { CompetitionRegistrationService } from '@/lib/competition/registration/service';
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Lock,
  LogIn,
  ShieldAlert,
  Sparkles,
  Trophy,
  UserCheck,
  UserX,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';

interface PublicRegistrationCardProps {
  leaderboard: Leaderboard;
  teams?: Team[];
  onRegistrationUpdated?: () => void;
}

export function PublicRegistrationCard({
  leaderboard,
  teams = [],
  onRegistrationUpdated,
}: PublicRegistrationCardProps) {
  const { profile, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  const claimToken = searchParams.get('claim');

  const [config, setConfig] = useState<CompetitionRegistrationConfig | null>(null);
  const [existingReg, setExistingReg] = useState<CompetitionRegistration | null>(null);
  const [registrations, setRegistrations] = useState<CompetitionRegistration[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [participantName, setParticipantName] = useState('');
  const [participantEmail, setParticipantEmail] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [cfg, allRegs] = await Promise.all([
        CompetitionRegistrationService.getConfig(leaderboard.id),
        CompetitionRegistrationService.getRegistrations(leaderboard.id),
      ]);
      setConfig(cfg);
      setRegistrations(allRegs);

      if (profile) {
        const userReg = await CompetitionRegistrationService.getUserRegistration(leaderboard.id, profile.id);
        setExistingReg(userReg);
        setParticipantName(profile.full_name || '');
        setParticipantEmail(profile.email || '');
      }
    } catch (err) {
      console.error('Failed to load registration details:', err);
    } finally {
      setLoading(false);
    }
  }, [leaderboard.id, profile]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Handle Participant Registration Submission
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const created = await CompetitionRegistrationService.registerParticipant({
        leaderboardId: leaderboard.id,
        userId: profile.id,
        participantName: participantName.trim(),
        participantEmail: participantEmail.trim(),
        teamId: selectedTeamId || null,
        notes: notes.trim() || null,
      });

      setExistingReg(created);
      if (created.status === 'confirmed') {
        setSuccessMessage('Registration confirmed! You have been placed on the competition roster.');
      } else if (created.status === 'approved') {
        setSuccessMessage('Registration approved! Welcome to the competition.');
      } else if (created.status === 'waitlisted') {
        setSuccessMessage('Capacity reached. You have been placed on the priority waitlist.');
      } else {
        setSuccessMessage('Registration submitted successfully! The organizer will review your application.');
      }

      void loadData();
      if (onRegistrationUpdated) onRegistrationUpdated();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Claim Invite
  const handleClaim = async () => {
    if (!profile || !claimToken) return;
    setClaiming(true);
    setErrorMessage(null);
    try {
      const claimed = await CompetitionRegistrationService.claimRegistration(
        claimToken,
        profile.id,
        profile.email,
        profile.full_name || 'Competitor'
      );
      setExistingReg(claimed);
      setSuccessMessage('Invitation claimed successfully! You are officially confirmed for this competition.');
      void loadData();
      if (onRegistrationUpdated) onRegistrationUpdated();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to claim invitation.');
    } finally {
      setClaiming(false);
    }
  };

  // Handle Withdraw
  const handleWithdraw = async () => {
    if (!profile || !existingReg) return;
    if (!confirm('Are you sure you want to withdraw your registration from this competition?')) return;
    setWithdrawing(true);
    setErrorMessage(null);
    try {
      const updated = await CompetitionRegistrationService.withdrawRegistration(existingReg.id, profile.id);
      setExistingReg(updated);
      setSuccessMessage('Your registration has been withdrawn.');
      void loadData();
      if (onRegistrationUpdated) onRegistrationUpdated();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to withdraw registration.');
    } finally {
      setWithdrawing(false);
    }
  };

  if (loading) {
    return null;
  }

  // If registration is not enabled and there's no claim token, do not render
  if (!config?.is_enabled && !claimToken) {
    return null;
  }

  const activeConfirmed = registrations.filter((r) => r.status === 'confirmed' || r.status === 'approved').length;
  const maxCapacity = config?.capacity || null;
  const isCapacityFull = maxCapacity !== null && activeConfirmed >= maxCapacity;

  // Check window timing
  const now = new Date();
  const isFuture = config?.opens_at ? now < new Date(config.opens_at) : false;
  const isExpired = config?.closes_at ? now > new Date(config.closes_at) : false;

  return (
    <div className="glass rounded-2xl border border-violet-500/20 bg-gradient-to-b from-violet-950/20 to-neutral-950/60 p-6 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-48 h-48 bg-violet-600/10 blur-[60px] pointer-events-none" />

      {/* Header Badge & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-violet-500/10 text-violet-300 border border-violet-500/30">
              <Sparkles className="w-3 h-3" /> Registration Open
            </span>
            {config?.require_approval ? (
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 bg-neutral-900 px-2 py-0.5 rounded border border-white/5">
                Review Required
              </span>
            ) : (
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                Instant Confirmation
              </span>
            )}
          </div>
          <h3 className="text-lg font-bold text-white">Join the Competition</h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            Register your entrant details to participate in &quot;{leaderboard.name}&quot;.
          </p>
        </div>

        {/* Capacity / Window Badges */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {maxCapacity && (
            <div className="px-3 py-1.5 rounded-xl bg-neutral-900 border border-white/5 text-neutral-300">
              <span className="text-neutral-500 mr-1.5">Capacity:</span>
              <span className="font-bold text-white">{activeConfirmed}</span> / {maxCapacity}
              {isCapacityFull && (
                <span className="ml-1.5 text-purple-400 font-semibold">(Waitlist Active)</span>
              )}
            </div>
          )}
          {config?.closes_at && (
            <div className="px-3 py-1.5 rounded-xl bg-neutral-900 border border-white/5 text-neutral-300">
              <span className="text-neutral-500 mr-1.5">Deadline:</span>
              <span className="font-semibold text-white">
                {new Date(config.closes_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Alerts */}
      {errorMessage && (
        <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center justify-between">
          <span>{errorMessage}</span>
          <button type="button" onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-white">
            <XCircle className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center justify-between">
          <span>{successMessage}</span>
          <button type="button" onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-white">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Special Invite / Claim Banner */}
      {claimToken && (!existingReg || existingReg.status === 'withdrawn') && (
        <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-violet-900/30 to-purple-900/30 border border-violet-500/40">
          <div className="flex items-center gap-2 text-violet-300 font-bold text-sm">
            <Trophy className="w-4 h-4 text-violet-400" /> Competition Invitation Received!
          </div>
          <p className="text-xs text-neutral-300 mt-1">
            You hold an invitation token (<span className="font-mono text-violet-300">{claimToken}</span>). Claim your reserved slot now.
          </p>

          <div className="mt-3">
            {profile ? (
              <button
                type="button"
                onClick={handleClaim}
                disabled={claiming}
                className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-lg transition-all cursor-pointer"
              >
                {claiming ? 'Claiming slot...' : 'Claim My Invitation Spot'}
              </button>
            ) : (
              <Link
                href={`/login?next=/leaderboards/${leaderboard.slug}?claim=${claimToken}`}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-lg transition-all"
              >
                <LogIn className="w-3.5 h-3.5" /> Sign in to Claim Spot
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Participant Status View (If already registered) */}
      {existingReg && existingReg.status !== 'withdrawn' ? (
        <div className="mt-4 p-5 rounded-xl bg-neutral-900/80 border border-white/5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold">Your Application</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm font-bold text-white">{existingReg.participant_name}</span>
                {existingReg.status === 'confirmed' && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Confirmed
                  </span>
                )}
                {existingReg.status === 'approved' && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 inline-flex items-center gap-1">
                    <UserCheck className="w-3 h-3" /> Approved
                  </span>
                )}
                {existingReg.status === 'pending' && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Pending Review
                  </span>
                )}
                {existingReg.status === 'waitlisted' && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" /> On Waitlist
                  </span>
                )}
                {existingReg.status === 'rejected' && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 inline-flex items-center gap-1">
                    <XCircle className="w-3 h-3" /> Rejected
                  </span>
                )}
              </div>
            </div>

            {(existingReg.status === 'pending' ||
              existingReg.status === 'approved' ||
              existingReg.status === 'waitlisted') && (
              <button
                type="button"
                onClick={handleWithdraw}
                disabled={withdrawing}
                className="px-3 py-1.5 rounded-xl border border-neutral-800 hover:border-red-500/30 text-neutral-400 hover:text-red-400 text-xs font-semibold transition-colors"
              >
                {withdrawing ? 'Withdrawing...' : 'Withdraw Registration'}
              </button>
            )}
          </div>

          <div className="text-xs text-neutral-400 pt-2 border-t border-white/5">
            {existingReg.status === 'confirmed' && (
              <p className="text-emerald-300">
                You are registered and placed in the competition standings and fixture pool.
              </p>
            )}
            {existingReg.status === 'approved' && (
              <p className="text-cyan-300">
                The organizer has accepted your entry. You will be scheduled when matchdays begin.
              </p>
            )}
            {existingReg.status === 'pending' && (
              <p className="text-amber-300">
                Your application is currently under review. You will receive an in-app notification once decided.
              </p>
            )}
            {existingReg.status === 'waitlisted' && (
              <p className="text-purple-300">
                You are on the priority waitlist. If a participant withdraws, spots will automatically open.
              </p>
            )}
            {existingReg.status === 'rejected' && (
              <p className="text-red-300">
                {existingReg.rejection_reason || 'Your registration was not accepted for this event.'}
              </p>
            )}
          </div>
        </div>
      ) : (
        /* Registration Form for Authenticated or Unauthenticated */
        <div className="mt-4">
          {profile ? (
            <form onSubmit={handleRegister} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-neutral-400 mb-1">Competitor Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Your display name"
                    value={participantName}
                    onChange={(e) => setParticipantName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-white/5 text-white placeholder-neutral-500 focus:outline-none focus:border-violet-500"
                  />
                </div>

                <div>
                  <label className="block text-neutral-400 mb-1">Contact Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="your@email.com"
                    value={participantEmail}
                    onChange={(e) => setParticipantEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-white/5 text-white placeholder-neutral-500 focus:outline-none focus:border-violet-500"
                  />
                  <span className="text-[10px] text-neutral-500">Kept strictly private from public tables</span>
                </div>
              </div>

              {config?.allow_team_registration && teams.length > 0 && (
                <div>
                  <label className="block text-neutral-400 mb-1">Team Affiliation</label>
                  <select
                    value={selectedTeamId}
                    onChange={(e) => setSelectedTeamId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-white/5 text-white focus:outline-none focus:border-violet-500"
                  >
                    <option value="">Compete as Individual / Independent</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-neutral-400 mb-1">Notes / Experience (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Preferred role, seed rating, club name"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-white/5 text-white placeholder-neutral-500 focus:outline-none focus:border-violet-500"
                />
              </div>

              {config?.eligibility_rules?.notes && (
                <div className="p-3 rounded-xl bg-neutral-900/60 border border-white/5 text-[11px] text-neutral-400">
                  <span className="font-semibold text-neutral-300">Eligibility Criteria:</span>{' '}
                  {config.eligibility_rules.notes}
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-neutral-500">
                  {isCapacityFull
                    ? 'Note: Capacity is full. You will be added to the waitlist.'
                    : config?.require_approval
                    ? 'Applications are subject to organizer confirmation.'
                    : 'Instant registration — immediate roster placement.'}
                </span>

                <button
                  type="submit"
                  disabled={submitting || isFuture || isExpired}
                  className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs shadow-lg transition-all cursor-pointer disabled:opacity-50"
                >
                  {submitting
                    ? 'Submitting...'
                    : isCapacityFull
                    ? 'Join Waitlist'
                    : 'Register for Competition'}
                </button>
              </div>
            </form>
          ) : (
            <div className="p-6 rounded-xl bg-neutral-900/60 border border-white/5 text-center flex flex-col items-center gap-3">
              <Lock className="w-6 h-6 text-violet-400" />
              <div>
                <h4 className="text-sm font-bold text-white">Sign in to Register</h4>
                <p className="text-xs text-neutral-400 mt-1 max-w-sm">
                  Competitors must sign in to submit registrations, receive schedule reminders, and track their standing.
                </p>
              </div>
              <Link
                href={`/login?next=/leaderboards/${leaderboard.slug}`}
                className="mt-1 flex items-center gap-2 px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-lg transition-all"
              >
                <LogIn className="w-3.5 h-3.5" /> Sign In / Create Account
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
