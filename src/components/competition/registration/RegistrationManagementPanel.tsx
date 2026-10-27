'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  CompetitionRegistration,
  CompetitionRegistrationConfig,
  Leaderboard,
  LeaderboardMember,
  RegistrationStatus,
  RefundPolicy,
  Team,
} from '@/types';
import { CompetitionRegistrationService } from '@/lib/competition/registration/service';
import {
  Check,
  CheckCircle2,
  Clock,
  Coins,
  Copy,
  CreditCard,
  ExternalLink,
  Filter,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Sliders,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  X,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';

interface RegistrationManagementPanelProps {
  leaderboard: Leaderboard;
  members: LeaderboardMember[];
  teams?: Team[];
  onMembersUpdated?: () => void;
}

export function RegistrationManagementPanel({
  leaderboard,
  members,
  teams = [],
  onMembersUpdated,
}: RegistrationManagementPanelProps) {
  const [config, setConfig] = useState<CompetitionRegistrationConfig | null>(null);
  const [registrations, setRegistrations] = useState<CompetitionRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Status Filter & Search
  const [statusFilter, setStatusFilter] = useState<'all' | RegistrationStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Config Form State
  const [isEnabled, setIsEnabled] = useState(false);
  const [capacity, setCapacity] = useState<string>('');
  const [opensAt, setOpensAt] = useState<string>('');
  const [closesAt, setClosesAt] = useState<string>('');
  const [requireApproval, setRequireApproval] = useState(true);
  const [allowWaitlist, setAllowWaitlist] = useState(true);
  const [allowTeamRegistration, setAllowTeamRegistration] = useState(false);
  const [allowedDomains, setAllowedDomains] = useState<string>('');
  const [eligibilityNotes, setEligibilityNotes] = useState<string>('');
  const [entryFee, setEntryFee] = useState<string>('');
  const [currency, setCurrency] = useState<string>('NGN');
  const [paymentDeadline, setPaymentDeadline] = useState<string>('');
  const [refundPolicy, setRefundPolicy] = useState<string>('no_refunds');

  // Modals
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [rejectingReg, setRejectingReg] = useState<CompetitionRegistration | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Invite Form
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteTeamId, setInviteTeamId] = useState('');
  const [inviteNotes, setInviteNotes] = useState('');
  const [createdInviteUrl, setCreatedInviteUrl] = useState<string | null>(null);
  const [creatingInvite, setCreatingInvite] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [cfg, regs] = await Promise.all([
        CompetitionRegistrationService.getConfig(leaderboard.id),
        CompetitionRegistrationService.getRegistrations(leaderboard.id),
      ]);
      setConfig(cfg);
      setRegistrations(regs);

      // Populate config form
      setIsEnabled(cfg.is_enabled);
      setCapacity(cfg.capacity !== null && cfg.capacity !== undefined ? cfg.capacity.toString() : '');
      setOpensAt(cfg.opens_at ? cfg.opens_at.slice(0, 16) : '');
      setClosesAt(cfg.closes_at ? cfg.closes_at.slice(0, 16) : '');
      setRequireApproval(cfg.require_approval);
      setAllowWaitlist(cfg.allow_waitlist);
      setAllowTeamRegistration(cfg.allow_team_registration);
      setAllowedDomains((cfg.eligibility_rules?.allowed_domains || []).join(', '));
      setEligibilityNotes(cfg.eligibility_rules?.notes || '');
      setEntryFee(cfg.entry_fee ? (cfg.entry_fee / 100).toString() : '');
      setCurrency(cfg.currency || 'NGN');
      setPaymentDeadline(cfg.payment_deadline ? cfg.payment_deadline.slice(0, 16) : '');
      setRefundPolicy(cfg.refund_policy || 'no_refunds');
    } catch (err) {
      console.error(err);
      setErrorMessage('Failed to load registration data.');
    } finally {
      setLoading(false);
    }
  }, [leaderboard.id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    setErrorMessage(null);
    try {
      const parsedCapacity = capacity.trim() ? parseInt(capacity.trim(), 10) : null;
      if (parsedCapacity !== null && (isNaN(parsedCapacity) || parsedCapacity < 1)) {
        throw new Error('Capacity must be a positive number or left blank for unlimited.');
      }

      const domainList = allowedDomains
        .split(',')
        .map((d) => d.trim().replace(/^@/, ''))
        .filter(Boolean);

      const parsedEntryFee = entryFee.trim() ? Math.round(parseFloat(entryFee.trim()) * 100) : null;

      const updated = await CompetitionRegistrationService.saveConfig(leaderboard.id, {
        is_enabled: isEnabled,
        capacity: parsedCapacity,
        opens_at: opensAt ? new Date(opensAt).toISOString() : null,
        closes_at: closesAt ? new Date(closesAt).toISOString() : null,
        require_approval: requireApproval,
        allow_waitlist: allowWaitlist,
        allow_team_registration: allowTeamRegistration,
        eligibility_rules: {
          allowed_domains: domainList,
          notes: eligibilityNotes.trim(),
        },
        entry_fee: parsedEntryFee,
        currency: currency.toUpperCase(),
        payment_deadline: paymentDeadline ? new Date(paymentDeadline).toISOString() : null,
        refund_policy: refundPolicy as RefundPolicy,
      });

      setConfig(updated);
      setShowConfigModal(false);
      showToast('Registration settings updated.');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save registration configuration.');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleStatusChange = async (
    reg: CompetitionRegistration,
    newStatus: RegistrationStatus,
    reason?: string
  ) => {
    try {
      await CompetitionRegistrationService.updateRegistrationStatus(reg.id, newStatus, reason);
      showToast(`Entrant "${reg.participant_name}" marked as ${newStatus}.`);
      void loadData();
      if (onMembersUpdated) onMembersUpdated();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : `Failed to update status to ${newStatus}.`);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingReg) return;
    await handleStatusChange(rejectingReg, 'rejected', rejectionReason.trim());
    setRejectingReg(null);
    setRejectionReason('');
  };

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim()) return;
    setCreatingInvite(true);
    setErrorMessage(null);
    try {
      const { claimToken } = await CompetitionRegistrationService.createInvite(leaderboard.id, {
        participantName: inviteName.trim(),
        participantEmail: inviteEmail.trim(),
        teamId: inviteTeamId || null,
        notes: inviteNotes.trim() || null,
      });

      const host = typeof window !== 'undefined' ? window.location.origin : '';
      const claimUrl = `${host}/leaderboards/${leaderboard.slug}?claim=${claimToken}`;
      setCreatedInviteUrl(claimUrl);
      showToast('Invite link generated!');
      void loadData();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to create invite.');
    } finally {
      setCreatingInvite(false);
    }
  };

  const copyToClipboard = (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(text);
      showToast('Link copied to clipboard!');
    }
  };

  // Metrics calculation
  const totalCount = registrations.length;
  const confirmedCount = registrations.filter((r) => r.status === 'confirmed' || r.status === 'approved').length;
  const pendingCount = registrations.filter((r) => r.status === 'pending').length;
  const waitlistCount = registrations.filter((r) => r.status === 'waitlisted').length;
  const maxCapacity = config?.capacity || null;
  const capacityPct = maxCapacity ? Math.min(100, Math.round((confirmedCount / maxCapacity) * 100)) : null;

  // Filtered registrations
  const filteredRegistrations = registrations
    .filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = r.participant_name.toLowerCase().includes(query);
        const matchesEmail = r.participant_email.toLowerCase().includes(query);
        return matchesName || matchesEmail;
      }
      return true;
    })
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const getStatusBadge = (status: RegistrationStatus) => {
    switch (status) {
      case 'confirmed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" /> Confirmed
          </span>
        );
      case 'pending_payment':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3" /> Payment Pending
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <UserCheck className="w-3 h-3" /> Approved
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3" /> Pending Review
          </span>
        );
      case 'waitlisted':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Clock className="w-3 h-3" /> Waitlisted
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
            <XCircle className="w-3 h-3" /> Rejected
          </span>
        );
      case 'withdrawn':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-neutral-800 text-neutral-400 border border-neutral-700">
            <UserX className="w-3 h-3" /> Withdrawn
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast & Error Alerts */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 p-4 rounded-xl shadow-2xl border text-sm flex items-center gap-2.5 bg-emerald-500/10 border-emerald-500/30 text-emerald-400 animate-bounce">
          <Check className="w-4 h-4 text-emerald-400" />
          {toastMessage}
        </div>
      )}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center justify-between">
          <span>{errorMessage}</span>
          <button type="button" onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Banner: Status & Action Header */}
      <div className="glass p-6 rounded-2xl border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                config?.is_enabled
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-neutral-800 text-neutral-400 border-neutral-700'
              }`}
            >
              {config?.is_enabled ? 'Registration Active' : 'Registration Disabled'}
            </span>
            {config?.require_approval ? (
              <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded uppercase tracking-wider">
                Manual Approval
              </span>
            ) : (
              <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded uppercase tracking-wider">
                Instant Confirmation
              </span>
            )}
            {config?.entry_fee && config.entry_fee > 0 && (
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded uppercase tracking-wider">
                Paid: {(config.entry_fee / 100).toLocaleString()} {config.currency || 'NGN'}
              </span>
            )}
          </div>
          <h2 className="text-lg font-bold text-white">Participant Registration & Roster Flow</h2>
          <p className="text-xs text-neutral-400 mt-1 max-w-xl">
            Collect competitor applications, review eligibility, enforce capacity limits, and manage waitlists.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/dashboard/leaderboards/${leaderboard.id}/finance`}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-emerald-500/30 bg-emerald-950/20 hover:bg-emerald-900/30 text-emerald-300 text-xs font-semibold transition-all cursor-pointer"
          >
            <Coins className="w-3.5 h-3.5" /> Finance & Ledger
          </Link>
          <button
            type="button"
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-lg transition-all cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" /> Invite Entrant
          </button>
          <button
            type="button"
            onClick={() => setShowConfigModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-neutral-800 hover:border-neutral-700 bg-neutral-900 text-neutral-200 hover:text-white text-xs font-semibold transition-all cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5" /> Configuration
          </button>
          <button
            type="button"
            onClick={() => void loadData()}
            title="Refresh"
            className="p-2 rounded-xl border border-neutral-800 hover:border-neutral-700 bg-neutral-900 text-neutral-400 hover:text-white text-xs transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass p-4 rounded-xl border border-white/5">
          <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">Confirmed Entrants</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-bold text-white">{confirmedCount}</span>
            {maxCapacity && (
              <span className="text-xs text-neutral-400">/ {maxCapacity} ({capacityPct}%)</span>
            )}
          </div>
          {maxCapacity && (
            <div className="w-full bg-neutral-800 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  capacityPct! >= 100 ? 'bg-red-500' : capacityPct! >= 80 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, capacityPct!)}%` }}
              />
            </div>
          )}
        </div>

        <div className="glass p-4 rounded-xl border border-white/5">
          <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">Pending Review</span>
          <h3 className="text-xl font-bold mt-1 text-amber-400">{pendingCount}</h3>
          <span className="text-[11px] text-neutral-500">Awaiting approval</span>
        </div>

        <div className="glass p-4 rounded-xl border border-white/5">
          <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">On Waitlist</span>
          <h3 className="text-xl font-bold mt-1 text-purple-400">{waitlistCount}</h3>
          <span className="text-[11px] text-neutral-500">Auto-overflow slots</span>
        </div>

        <div className="glass p-4 rounded-xl border border-white/5">
          <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">Total Applications</span>
          <h3 className="text-xl font-bold mt-1 text-cyan-400">{totalCount}</h3>
          <span className="text-[11px] text-neutral-500">Across all statuses</span>
        </div>
      </div>

      {/* Roster & Applicants Management Table */}
      <div className="glass rounded-2xl border border-white/5 overflow-hidden">
        {/* Filter & Search Header */}
        <div className="p-4 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-neutral-950/40">
          <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar">
            {(
              [
                { key: 'all', label: `All (${totalCount})` },
                { key: 'pending', label: `Pending (${pendingCount})` },
                { key: 'confirmed', label: `Confirmed (${confirmedCount})` },
                { key: 'waitlisted', label: `Waitlist (${waitlistCount})` },
                { key: 'rejected', label: 'Rejected' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  statusFilter === tab.key ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-neutral-900 border border-white/5 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-violet-500"
            />
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/5 bg-neutral-900/30 text-neutral-500 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Applicant</th>
                <th className="py-3 px-4">Private Email</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Applied Date</th>
                <th className="py-3 px-4">Notes / Claim</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredRegistrations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-neutral-500">
                    <Users className="w-6 h-6 mx-auto mb-2 opacity-40" />
                    No registrations found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredRegistrations.map((reg) => (
                  <tr key={reg.id} className="hover:bg-white/[0.01] transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-white">
                      <div>{reg.participant_name}</div>
                      {reg.team_id && (
                        <div className="text-[11px] text-violet-400">
                          {teams.find((t) => t.id === reg.team_id)?.name || 'Team Entrant'}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-neutral-400 font-mono text-[11px]">
                      {reg.participant_email}
                    </td>
                    <td className="py-3.5 px-4">
                      {getStatusBadge(reg.status)}
                      {reg.payment_status && (
                        <div className="mt-1">
                          {reg.payment_status === 'succeeded' && (
                            <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                              Paid
                            </span>
                          )}
                          {reg.payment_status === 'pending' && (
                            <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                              Payment Due
                            </span>
                          )}
                          {reg.payment_status === 'refunded' && (
                            <span className="text-[10px] text-rose-400 font-bold bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
                              Refunded
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-neutral-400">
                      {new Date(reg.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3.5 px-4 text-neutral-400 text-[11px] max-w-xs">
                      {reg.claim_token && (
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="font-mono text-[10px] bg-neutral-900 px-1.5 py-0.5 rounded border border-white/5">
                            {reg.claim_token}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const host = typeof window !== 'undefined' ? window.location.origin : '';
                              copyToClipboard(`${host}/leaderboards/${leaderboard.slug}?claim=${reg.claim_token}`);
                            }}
                            title="Copy claim link"
                            className="text-violet-400 hover:text-white"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      {reg.rejection_reason && (
                        <span className="text-red-400 italic">Reason: {reg.rejection_reason}</span>
                      )}
                      {reg.notes && !reg.rejection_reason && <span>{reg.notes}</span>}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {reg.status === 'pending' && (
                          <>
                            <button
                              type="button"
                              onClick={() => void handleStatusChange(reg, 'approved')}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-500/30 text-[11px] font-semibold transition-colors"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleStatusChange(reg, 'waitlisted')}
                              className="px-2.5 py-1 rounded-lg bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 border border-purple-500/30 text-[11px] font-semibold transition-colors"
                            >
                              Waitlist
                            </button>
                            <button
                              type="button"
                              onClick={() => setRejectingReg(reg)}
                              className="px-2.5 py-1 rounded-lg bg-red-600/20 text-red-300 hover:bg-red-600/30 border border-red-500/30 text-[11px] font-semibold transition-colors"
                            >
                              Reject
                            </button>
                          </>
                        )}

                        {reg.status === 'approved' && (
                          <>
                            <button
                              type="button"
                              onClick={() => void handleStatusChange(reg, 'confirmed')}
                              className="px-2.5 py-1 rounded-lg bg-cyan-600/20 text-cyan-300 hover:bg-cyan-600/30 border border-cyan-500/30 text-[11px] font-semibold transition-colors"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setRejectingReg(reg)}
                              className="px-2.5 py-1 rounded-lg bg-red-600/20 text-red-300 hover:bg-red-600/30 border border-red-500/30 text-[11px] font-semibold transition-colors"
                            >
                              Reject
                            </button>
                          </>
                        )}

                        {reg.status === 'waitlisted' && (
                          <>
                            <button
                              type="button"
                              onClick={() => void handleStatusChange(reg, 'approved')}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-500/30 text-[11px] font-semibold transition-colors"
                            >
                              Promote & Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => setRejectingReg(reg)}
                              className="px-2.5 py-1 rounded-lg bg-red-600/20 text-red-300 hover:bg-red-600/30 border border-red-500/30 text-[11px] font-semibold transition-colors"
                            >
                              Reject
                            </button>
                          </>
                        )}

                        {reg.status === 'rejected' && (
                          <button
                            type="button"
                            onClick={() => void handleStatusChange(reg, 'pending')}
                            className="px-2.5 py-1 rounded-lg bg-neutral-800 text-neutral-300 hover:text-white text-[11px] font-semibold transition-colors"
                          >
                            Re-open
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Configuration Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-neutral-800 bg-neutral-950 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-violet-400" />
                <h3 className="font-bold text-sm text-white">Registration Settings</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="text-neutral-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="mt-4 space-y-4 text-xs">
              <label className="flex items-center justify-between p-3 rounded-xl bg-neutral-900 border border-white/5 cursor-pointer">
                <div>
                  <div className="font-semibold text-white">Enable Registration</div>
                  <div className="text-[11px] text-neutral-400">Allow participants to register on public pages</div>
                </div>
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={(e) => setIsEnabled(e.target.checked)}
                  className="w-4 h-4 accent-violet-600 rounded"
                />
              </label>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-neutral-400 mb-1">Max Participant Capacity</label>
                  <input
                    type="number"
                    placeholder="Unlimited"
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-white/5 text-white placeholder-neutral-500 focus:outline-none focus:border-violet-500"
                  />
                  <span className="text-[10px] text-neutral-500">Leave blank for unlimited</span>
                </div>

                <div>
                  <label className="block text-neutral-400 mb-1">Approval Requirement</label>
                  <select
                    value={requireApproval ? 'manual' : 'auto'}
                    onChange={(e) => setRequireApproval(e.target.value === 'manual')}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-white/5 text-white focus:outline-none focus:border-violet-500"
                  >
                    <option value="manual">Require Manual Approval</option>
                    <option value="auto">Auto-Approve / Instant Confirm</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-neutral-400 mb-1">Opens At</label>
                  <input
                    type="datetime-local"
                    value={opensAt}
                    onChange={(e) => setOpensAt(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-white/5 text-white focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-neutral-400 mb-1">Closes At</label>
                  <input
                    type="datetime-local"
                    value={closesAt}
                    onChange={(e) => setClosesAt(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-white/5 text-white focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              {/* Competition Financial & Pricing Settings */}
              <div className="p-3.5 rounded-xl bg-violet-950/20 border border-violet-500/20 space-y-3">
                <div className="font-semibold text-violet-300 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5" /> Entry Fee & Refund Rules
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-neutral-400 mb-1">Entry Price</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00 (Free)"
                      value={entryFee}
                      onChange={(e) => setEntryFee(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-white/5 text-white font-mono placeholder-neutral-500 focus:outline-none focus:border-violet-500"
                    />
                    <span className="text-[10px] text-neutral-500">Leave blank or 0 for free</span>
                  </div>

                  <div>
                    <label className="block text-neutral-400 mb-1">Currency</label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-white/5 text-white focus:outline-none focus:border-violet-500"
                    >
                      <option value="NGN">NGN (Nigerian Naira - ₦)</option>
                      <option value="USD">USD (US Dollar - $)</option>
                      <option value="GHS">GHS (Ghanaian Cedi - GH₵)</option>
                      <option value="KES">KES (Kenyan Shilling - KSh)</option>
                      <option value="GBP">GBP (British Pound - £)</option>
                      <option value="EUR">EUR (Euro - €)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-neutral-400 mb-1">Payment Deadline</label>
                    <input
                      type="datetime-local"
                      value={paymentDeadline}
                      onChange={(e) => setPaymentDeadline(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-white/5 text-white focus:outline-none focus:border-violet-500"
                    />
                  </div>

                  <div>
                    <label className="block text-neutral-400 mb-1">Refund Policy</label>
                    <select
                      value={refundPolicy}
                      onChange={(e) => setRefundPolicy(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-white/5 text-white focus:outline-none focus:border-violet-500"
                    >
                      <option value="no_refunds">No Refunds</option>
                      <option value="flexible_24h">Flexible (24h before event)</option>
                      <option value="before_start">Until event starts</option>
                      <option value="organizer_discretion">Organizer Discretion</option>
                    </select>
                  </div>
                </div>
              </div>

              <label className="flex items-center justify-between p-3 rounded-xl bg-neutral-900 border border-white/5 cursor-pointer">
                <div>
                  <div className="font-semibold text-white">Enable Waitlist</div>
                  <div className="text-[11px] text-neutral-400">Automatically place applicants on waitlist when full</div>
                </div>
                <input
                  type="checkbox"
                  checked={allowWaitlist}
                  onChange={(e) => setAllowWaitlist(e.target.checked)}
                  className="w-4 h-4 accent-violet-600 rounded"
                />
              </label>

              <div>
                <label className="block text-neutral-400 mb-1">Allowed Email Domains (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. university.edu, company.com"
                  value={allowedDomains}
                  onChange={(e) => setAllowedDomains(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-white/5 text-white placeholder-neutral-500 focus:outline-none focus:border-violet-500"
                />
                <span className="text-[10px] text-neutral-500">Comma-separated; leave empty for any email domain</span>
              </div>

              <div>
                <label className="block text-neutral-400 mb-1">Eligibility Notes & Guidelines</label>
                <textarea
                  rows={2}
                  placeholder="Provide registration rules or instructions for applicants..."
                  value={eligibilityNotes}
                  onChange={(e) => setEligibilityNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-white/5 text-white placeholder-neutral-500 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-3.5 py-2 rounded-xl border border-neutral-800 text-neutral-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingConfig}
                  className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 font-semibold text-white"
                >
                  {savingConfig ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite Entrant Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-950 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-violet-400" />
                <h3 className="font-bold text-sm text-white">Invite / Claim Entrant</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowInviteModal(false);
                  setCreatedInviteUrl(null);
                }}
                className="text-neutral-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createdInviteUrl ? (
              <div className="mt-4 space-y-4 text-xs">
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                  <div className="font-bold text-sm mb-1">Invitation Link Ready!</div>
                  <p className="text-[11px] text-neutral-300">
                    Share this link with {inviteName}. When they sign in, their spot will be claimed without creating duplicate records.
                  </p>
                </div>

                <div className="flex items-center gap-2 p-2 rounded-xl bg-neutral-900 border border-white/5">
                  <input
                    type="text"
                    readOnly
                    value={createdInviteUrl}
                    className="w-full bg-transparent text-white font-mono text-[11px] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(createdInviteUrl)}
                    className="px-3 py-1.5 rounded-lg bg-violet-600 text-white font-semibold flex items-center gap-1 shrink-0"
                  >
                    <Copy className="w-3 h-3" /> Copy
                  </button>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowInviteModal(false);
                      setCreatedInviteUrl(null);
                      setInviteName('');
                      setInviteEmail('');
                    }}
                    className="px-4 py-2 rounded-xl bg-neutral-800 text-white font-semibold"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateInvite} className="mt-4 space-y-4 text-xs">
                <div>
                  <label className="block text-neutral-400 mb-1">Participant Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Jordan Vance"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-white/5 text-white placeholder-neutral-500 focus:outline-none focus:border-violet-500"
                  />
                </div>

                <div>
                  <label className="block text-neutral-400 mb-1">Participant Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="jordan@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-white/5 text-white placeholder-neutral-500 focus:outline-none focus:border-violet-500"
                  />
                </div>

                {teams.length > 0 && (
                  <div>
                    <label className="block text-neutral-400 mb-1">Team Affiliation (Optional)</label>
                    <select
                      value={inviteTeamId}
                      onChange={(e) => setInviteTeamId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-white/5 text-white focus:outline-none focus:border-violet-500"
                    >
                      <option value="">No Team / Independent</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-neutral-400 mb-1">Notes (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Wildcard invite"
                    value={inviteNotes}
                    onChange={(e) => setInviteNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-white/5 text-white placeholder-neutral-500 focus:outline-none focus:border-violet-500"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="px-3.5 py-2 rounded-xl border border-neutral-800 text-neutral-300 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingInvite}
                    className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 font-semibold text-white"
                  >
                    {creatingInvite ? 'Generating...' : 'Create Invite Link'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Reject Entrant Modal */}
      {rejectingReg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-950 p-6 shadow-2xl">
            <h3 className="font-bold text-sm text-white">Reject Registration</h3>
            <p className="text-xs text-neutral-400 mt-1">
              Provide an optional reason for rejecting &quot;{rejectingReg.participant_name}&quot;. They will be notified.
            </p>

            <div className="mt-4 space-y-3 text-xs">
              <textarea
                rows={3}
                placeholder="e.g. Ineligible category, capacity limit reached, etc."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-white/5 text-white placeholder-neutral-500 focus:outline-none focus:border-violet-500"
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejectingReg(null)}
                  className="px-3.5 py-2 rounded-xl border border-neutral-800 text-neutral-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReject}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 font-semibold text-white"
                >
                  Confirm Rejection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
