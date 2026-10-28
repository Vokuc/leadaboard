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
  CreditCard,
  Download,
  ExternalLink,
  Lock,
  LogIn,
  Printer,
  Receipt,
  RotateCcw,
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

interface PaymentReceipt {
  receiptNumber: string;
  reference: string;
  amount: number;
  currency: string;
  paidAt: string;
  participantName: string;
  participantEmail: string;
  competitionName: string;
  organizerName?: string;
  refundPolicy: string;
}

function formatMinorUnits(amount: number, currency = 'NGN'): string {
  const major = (amount / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const currencySymbols: Record<string, string> = {
    NGN: '₦',
    USD: '$',
    GBP: '£',
    EUR: '€',
    GHS: 'GH₵',
    KES: 'KSh',
  };

  const symbol = currencySymbols[currency.toUpperCase()] || `${currency} `;
  return `${symbol}${major}`;
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
  const redirectPaymentRef = searchParams.get('reference');
  const isRegisteredRedirect = searchParams.get('registered') === 'true';
  const isDemoVerify = searchParams.get('demo_verify') === '1';

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
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Receipt Modal State
  const [receiptData, setReceiptData] = useState<PaymentReceipt | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

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

  // Handle Automatic Payment Verification Callback from Provider Redirect
  useEffect(() => {
    if (!redirectPaymentRef || !isRegisteredRedirect || verifyingPayment) return;

    let isCancelled = false;
    async function verifyIncomingPayment() {
      setVerifyingPayment(true);
      try {
        const res = await fetch(`/api/competitions/${leaderboard.id}/registration/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reference: redirectPaymentRef,
            demoVerify: isDemoVerify,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Payment verification failed.');

        if (!isCancelled) {
          setSuccessMessage('Payment verified successfully! You are officially registered.');
          if (data.receipt) {
            setReceiptData(data.receipt);
            setShowReceiptModal(true);
          }
          void loadData();
          if (onRegistrationUpdated) onRegistrationUpdated();
          // Clean URL params cleanly without page reload
          if (typeof window !== 'undefined') {
            const cleanUrl = window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
          }
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          setErrorMessage(err instanceof Error ? err.message : 'Failed to verify payment reference.');
        }
      } finally {
        if (!isCancelled) setVerifyingPayment(false);
      }
    }

    void verifyIncomingPayment();
    return () => {
      isCancelled = true;
    };
  }, [redirectPaymentRef, isRegisteredRedirect, isDemoVerify, leaderboard.id, loadData, onRegistrationUpdated]);

  // Handle Participant Registration Submission
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const isPaid = Boolean(config?.entry_fee && config.entry_fee > 0);

    try {
      if (isPaid) {
        // Paid registration flow: Call server checkout
        const res = await fetch(`/api/competitions/${leaderboard.id}/registration/checkout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            participantName: participantName.trim(),
            participantEmail: participantEmail.trim(),
            teamId: selectedTeamId || null,
            notes: notes.trim() || null,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Checkout initiation failed.');

        const result = data.result;
        if (result.checkoutUrl) {
          // Redirect to Paystack or test mode checkout URL
          window.location.href = result.checkoutUrl;
          return;
        }

        setExistingReg(result.registration);
        setSuccessMessage('Registration created! Complete payment to secure your entrant slot.');
      } else {
        // Free registration flow
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
      }

      void loadData();
      if (onRegistrationUpdated) onRegistrationUpdated();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  // Resume Pending Payment
  const handleResumePayment = async () => {
    if (!existingReg || !profile) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/competitions/${leaderboard.id}/registration/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantName: existingReg.participant_name,
          participantEmail: existingReg.participant_email,
          teamId: existingReg.team_id,
          notes: existingReg.notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to resume payment.');
      if (data.result?.checkoutUrl) {
        window.location.href = data.result.checkoutUrl;
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to resume checkout.');
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

  // Check window timing & deadlines
  const now = new Date();
  const isFuture = config?.opens_at ? now < new Date(config.opens_at) : false;
  const isExpired = config?.closes_at ? now > new Date(config.closes_at) : false;
  const isPaymentExpired = config?.payment_deadline ? now > new Date(config.payment_deadline) : false;

  const entryFeeMinor = config?.entry_fee || 0;
  const currency = config?.currency || 'NGN';
  const isPaidCompetition = entryFeeMinor > 0;

  const refundPolicyLabels: Record<string, string> = {
    no_refunds: 'No Refunds',
    flexible_24h: 'Flexible (24h before event)',
    before_start: 'Until competition starts',
    organizer_discretion: 'Organizer discretion',
  };

  return (
    <div id="registration" className="glass rounded-2xl border border-violet-500/20 bg-gradient-to-b from-violet-950/20 to-neutral-950/60 p-6 shadow-2xl relative overflow-hidden scroll-mt-24">
      <div className="absolute top-0 right-0 w-48 h-48 bg-violet-600/10 blur-[60px] pointer-events-none" />

      {/* Header Badge & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-violet-500/10 text-violet-300 border border-violet-500/30">
              <Sparkles className="w-3 h-3" /> Registration Open
            </span>

            {/* Entry Fee Badge */}
            {isPaidCompetition ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                <CreditCard className="w-3 h-3" /> Entry Fee: {formatMinorUnits(entryFeeMinor, currency)}
              </span>
            ) : (
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                Free Entry
              </span>
            )}

            {config?.require_approval ? (
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 bg-neutral-900 px-2 py-0.5 rounded border border-white/5">
                Review Required
              </span>
            ) : (
              <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                Instant Confirmation
              </span>
            )}
          </div>
          <h3 className="text-lg font-bold text-white">Join the Competition</h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            Register your entrant details to participate in &quot;{leaderboard.name}&quot;.
          </p>
        </div>

        {/* Capacity / Deadline / Refund Policy Badges */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {maxCapacity && (
            <div className="px-3 py-1.5 rounded-xl bg-neutral-900 border border-white/5 text-neutral-300">
              <span className="text-neutral-500 mr-1.5">Capacity:</span>
              <span className="font-bold text-white">{activeConfirmed}</span> / {maxCapacity}
              {isCapacityFull && (
                <span className="ml-1.5 text-purple-400 font-semibold">(Waitlist Active)</span>
              )}
            </div>
          )}
          {config?.payment_deadline && (
            <div className="px-3 py-1.5 rounded-xl bg-neutral-900 border border-white/5 text-neutral-300">
              <span className="text-neutral-500 mr-1.5">Pay By:</span>
              <span className="font-semibold text-white">
                {new Date(config.payment_deadline).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
          )}
          {isPaidCompetition && config?.refund_policy && (
            <div className="px-3 py-1.5 rounded-xl bg-neutral-900 border border-white/5 text-neutral-400">
              <span className="text-neutral-500 mr-1.5">Refund:</span>
              <span className="text-neutral-300 font-medium">
                {refundPolicyLabels[config.refund_policy] || config.refund_policy}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Verification Loading Banner */}
      {verifyingPayment && (
        <div className="mt-4 p-3 rounded-xl bg-violet-950/40 border border-violet-500/40 text-violet-200 text-xs flex items-center gap-2">
          <Clock className="w-4 h-4 text-violet-400 animate-spin" />
          <span>Verifying your secure payment with provider... Please wait.</span>
        </div>
      )}

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
              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                <span className="text-sm font-bold text-white">{existingReg.participant_name}</span>

                {existingReg.status === 'confirmed' && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Confirmed
                  </span>
                )}
                {existingReg.status === 'pending_payment' && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Payment Pending
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

            <div className="flex flex-wrap items-center gap-2">
              {/* Receipt View Button for Confirmed Paid Registrations */}
              {existingReg.payment_reference && (
                <button
                  type="button"
                  onClick={() => {
                    setReceiptData({
                      receiptNumber: `REC-${(existingReg.payment_reference || '').slice(0, 12)}`,
                      reference: existingReg.payment_reference || '',
                      amount: existingReg.amount_paid || entryFeeMinor,
                      currency: existingReg.currency || currency,
                      paidAt: existingReg.paid_at || existingReg.created_at,
                      participantName: existingReg.participant_name,
                      participantEmail: existingReg.participant_email,
                      competitionName: leaderboard.name,
                      refundPolicy: config?.refund_policy || 'no_refunds',
                    });
                    setShowReceiptModal(true);
                  }}
                  className="px-3 py-1.5 rounded-xl border border-violet-500/30 bg-violet-950/30 hover:bg-violet-900/40 text-violet-300 text-xs font-semibold inline-flex items-center gap-1.5 transition-all"
                >
                  <Receipt className="w-3.5 h-3.5" /> View Receipt
                </button>
              )}

              {/* Resume Payment Button if pending_payment */}
              {existingReg.status === 'pending_payment' && (
                <button
                  type="button"
                  onClick={handleResumePayment}
                  disabled={submitting || isPaymentExpired}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg inline-flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <CreditCard className="w-3.5 h-3.5" /> Complete Payment Now
                </button>
              )}

              {(existingReg.status === 'pending' ||
                existingReg.status === 'pending_payment' ||
                existingReg.status === 'approved' ||
                existingReg.status === 'waitlisted') && (
                <button
                  type="button"
                  onClick={handleWithdraw}
                  disabled={withdrawing}
                  className="px-3 py-1.5 rounded-xl border border-neutral-800 hover:border-red-500/30 text-neutral-400 hover:text-red-400 text-xs font-semibold transition-colors"
                >
                  {withdrawing ? 'Withdrawing...' : 'Withdraw'}
                </button>
              )}
            </div>
          </div>

          <div className="text-xs text-neutral-400 pt-2 border-t border-white/5">
            {existingReg.status === 'confirmed' && (
              <p className="text-emerald-300">
                You are registered and placed in the competition standings and fixture pool.
              </p>
            )}
            {existingReg.status === 'pending_payment' && (
              <p className="text-amber-300">
                Your entrant spot is reserved pending verified payment of {formatMinorUnits(entryFeeMinor, currency)}.
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

              {/* Price Confirmation Callout for Paid Competitions */}
              {isPaidCompetition && (
                <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-between text-neutral-300">
                  <div className="flex items-center gap-2.5">
                    <CreditCard className="w-4 h-4 text-emerald-400" />
                    <div>
                      <span className="font-semibold text-white block">Paid Competition Entry</span>
                      <span className="text-[11px] text-neutral-400">
                        Secure checkout powered by server-side verification.
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold font-mono text-emerald-400">
                      {formatMinorUnits(entryFeeMinor, currency)}
                    </span>
                    <span className="block text-[10px] text-neutral-500">Gross entry fee</span>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <span className="text-[11px] text-neutral-500">
                  {isCapacityFull
                    ? 'Note: Capacity is full. You will be added to the waitlist.'
                    : config?.require_approval
                    ? 'Applications are subject to organizer confirmation.'
                    : 'Instant registration — immediate roster placement.'}
                </span>

                <button
                  type="submit"
                  disabled={submitting || isFuture || isExpired || (isPaidCompetition && isPaymentExpired)}
                  className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs shadow-lg transition-all cursor-pointer disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                >
                  {submitting ? (
                    'Processing...'
                  ) : isCapacityFull ? (
                    'Join Waitlist'
                  ) : isPaidCompetition ? (
                    <>
                      <CreditCard className="w-3.5 h-3.5" /> Proceed to Secure Payment ({formatMinorUnits(entryFeeMinor, currency)})
                    </>
                  ) : (
                    'Register for Competition'
                  )}
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
                href={`/login?next=${encodeURIComponent(`/leaderboards/${leaderboard.slug}?register=true#registration`)}`}
                className="mt-1 flex items-center gap-2 px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-lg transition-all"
              >
                <LogIn className="w-3.5 h-3.5" /> Sign In / Create Account
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Official Payment Receipt Modal */}
      {showReceiptModal && receiptData && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass w-full max-w-md rounded-2xl border border-violet-500/30 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Payment Receipt</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowReceiptModal(false)}
                className="text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-4 rounded-xl bg-neutral-900 border border-white/5 space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-neutral-500">Receipt No:</span>
                <span className="font-mono font-bold text-white">{receiptData.receiptNumber}</span>
              </div>

              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-neutral-500">Reference:</span>
                <span className="font-mono text-neutral-300">{receiptData.reference}</span>
              </div>

              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-neutral-500">Competition:</span>
                <span className="font-semibold text-white">{receiptData.competitionName}</span>
              </div>

              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-neutral-500">Entrant:</span>
                <span className="font-medium text-white">{receiptData.participantName}</span>
              </div>

              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-neutral-500">Email:</span>
                <span className="text-neutral-300">{receiptData.participantEmail}</span>
              </div>

              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-neutral-500">Paid At:</span>
                <span className="text-neutral-300">
                  {new Date(receiptData.paidAt).toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-sm font-bold text-neutral-400">Total Amount:</span>
                <span className="text-base font-extrabold font-mono text-emerald-400">
                  {formatMinorUnits(receiptData.amount, receiptData.currency)}
                </span>
              </div>
            </div>

            <div className="text-[11px] text-neutral-400">
              <span className="font-semibold text-neutral-300">Refund Policy: </span>
              {refundPolicyLabels[receiptData.refundPolicy] || receiptData.refundPolicy}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') window.print();
                }}
                className="px-4 py-2 rounded-xl bg-neutral-900 text-neutral-300 text-xs font-semibold hover:bg-neutral-800 inline-flex items-center gap-1.5 transition-colors"
              >
                <Printer className="w-3.5 h-3.5" /> Print Receipt
              </button>
              <button
                type="button"
                onClick={() => setShowReceiptModal(false)}
                className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-lg transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
