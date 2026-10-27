'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  CompetitionFinancialSummary,
  CompetitionPayment,
  Leaderboard,
  LeaderboardMember,
} from '@/types';
import {
  AlertTriangle,
  ArrowDownLeft,
  CheckCircle2,
  Coins,
  DollarSign,
  FileSpreadsheet,
  Filter,
  Percent,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Trophy,
  UserCheck,
  Wallet,
  XCircle,
} from 'lucide-react';

interface FinanceManagementPanelProps {
  leaderboard: Leaderboard;
  members?: LeaderboardMember[];
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

export function FinanceManagementPanel({ leaderboard }: FinanceManagementPanelProps) {
  const [summary, setSummary] = useState<CompetitionFinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [reconciliationResult, setReconciliationResult] = useState<{
    balanced: boolean;
    discrepancy: number;
    checkedAt: string;
    details: {
      calculatedNet: number;
      actualBalance: number;
      totalCredits: number;
      totalDebits: number;
      grossPayments: number;
      totalRefunds: number;
    };
  } | null>(null);

  // Filter states for ledger table
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Refund Modal State
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [selectedPaymentForRefund, setSelectedPaymentForRefund] = useState<CompetitionPayment | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [processingRefund, setProcessingRefund] = useState(false);

  // Prize Allocation Modal State
  const [showPrizeModal, setShowPrizeModal] = useState(false);
  const [allocationsList, setAllocationsList] = useState<
    Array<{ rank: number; recipientName: string; amountMajor: string; notes: string }>
  >([
    { rank: 1, recipientName: '', amountMajor: '', notes: '1st Place Champion' },
    { rank: 2, recipientName: '', amountMajor: '', notes: 'Runner-up' },
    { rank: 3, recipientName: '', amountMajor: '', notes: '3rd Place Bronze' },
  ]);
  const [savingPrizes, setSavingPrizes] = useState(false);

  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadFinanceData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const res = await fetch(`/api/competitions/${leaderboard.id}/finance/ledger`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load financial records');
      setSummary(data.summary);
    } catch (err: unknown) {
      console.error(err);
      showToast(err instanceof Error ? err.message : 'Failed to load financial ledger.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [leaderboard.id]);

  useEffect(() => {
    let ignore = false;
    async function init() {
      try {
        const res = await fetch(`/api/competitions/${leaderboard.id}/finance/ledger`);
        const data = await res.json();
        if (!ignore && res.ok) {
          setSummary(data.summary);
        }
      } catch (err: unknown) {
        if (!ignore) {
          console.error(err);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }
    void init();
    return () => {
      ignore = true;
    };
  }, [leaderboard.id]);

  // Handle instant reconciliation
  const handleReconcile = async () => {
    setReconciling(true);
    try {
      const res = await fetch(`/api/competitions/${leaderboard.id}/finance/reconcile`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reconciliation failed.');
      setReconciliationResult(data.reconciliation);
      showToast(
        data.reconciliation.balanced
          ? 'Financial ledger is 100% reconciled and balanced.'
          : 'Warning: Discrepancy detected in ledger records.',
        data.reconciliation.balanced ? 'success' : 'error'
      );
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Reconciliation check failed.', 'error');
    } finally {
      setReconciling(false);
    }
  };

  // Handle refund submission
  const handleExecuteRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPaymentForRefund) return;

    setProcessingRefund(true);
    try {
      const parsedAmount = refundAmount.trim() ? Math.round(parseFloat(refundAmount.trim()) * 100) : undefined;
      const res = await fetch(`/api/competitions/${leaderboard.id}/finance/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registrationId: selectedPaymentForRefund.registration_id,
          reason: refundReason.trim() || 'Organizer initiated refund',
          amount: parsedAmount,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to process refund.');

      showToast(`Refund processed successfully: ${formatMinorUnits(data.refund.amount, data.refund.currency)}.`);
      setShowRefundModal(false);
      setSelectedPaymentForRefund(null);
      setRefundReason('');
      setRefundAmount('');
      void loadFinanceData(true);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Refund failed.', 'error');
    } finally {
      setProcessingRefund(false);
    }
  };

  // Handle prize allocation submission
  const handleSavePrizeAllocations = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPrizes(true);
    try {
      const validAllocations = allocationsList
        .filter((a) => a.recipientName.trim() && parseFloat(a.amountMajor) > 0)
        .map((a) => ({
          rankPosition: a.rank,
          recipientName: a.recipientName.trim(),
          amount: Math.round(parseFloat(a.amountMajor) * 100),
          notes: a.notes.trim() || undefined,
        }));

      if (validAllocations.length === 0) {
        throw new Error('Please enter at least one recipient name and positive prize amount.');
      }

      const res = await fetch(`/api/competitions/${leaderboard.id}/finance/prizes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allocations: validAllocations }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to allocate prize pool.');

      showToast('Prize pool allocations successfully posted to financial ledger.');
      setShowPrizeModal(false);
      void loadFinanceData(true);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Prize allocation failed.', 'error');
    } finally {
      setSavingPrizes(false);
    }
  };

  const currency = summary?.currency || 'NGN';

  // Filter ledger entries
  const filteredEntries = (summary?.entries || []).filter((entry) => {
    if (filterType !== 'all' && entry.entry_type !== filterType) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchDesc = entry.description.toLowerCase().includes(q);
      const matchRef = (entry.payment_reference || '').toLowerCase().includes(q);
      const matchType = entry.entry_type.toLowerCase().includes(q);
      return matchDesc || matchRef || matchType;
    }
    return true;
  });

  if (loading) {
    return (
      <div className="glass p-12 rounded-2xl flex flex-col items-center justify-center space-y-3">
        <RefreshCw className="w-8 h-8 text-violet-400 animate-spin" />
        <p className="text-sm text-neutral-400 font-medium">Loading competition ledger and financial metrics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-semibold backdrop-blur-md transition-all ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950/90 border border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/90 border border-rose-500/40 text-rose-200'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <XCircle className="w-4 h-4 text-rose-400" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-violet-500/10 text-violet-300 border border-violet-500/30">
              <Coins className="w-3 h-3" /> Financial Ledger
            </span>
            <span className="text-[10px] font-mono text-neutral-500 uppercase">
              Currency: {currency}
            </span>
          </div>
          <h2 className="text-xl font-bold text-white">Competition Revenue & Ledger</h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Real-time, double-entry accounting for entry fees, refunds, platform fees, and prize allocations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleReconcile}
            disabled={reconciling}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-white/5 text-xs font-semibold text-neutral-200 transition-all cursor-pointer disabled:opacity-50"
          >
            <ShieldCheck className={`w-3.5 h-3.5 ${reconciling ? 'animate-pulse text-amber-400' : 'text-emerald-400'}`} />
            {reconciling ? 'Auditing...' : 'Audit Reconciliation'}
          </button>

          <button
            type="button"
            onClick={() => setShowPrizeModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white shadow-lg transition-all cursor-pointer"
          >
            <Trophy className="w-3.5 h-3.5 text-violet-200" /> Allocate Prize Pool
          </button>

          <button
            type="button"
            onClick={() => loadFinanceData(true)}
            disabled={refreshing}
            className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-white/5 text-neutral-400 hover:text-white transition-all cursor-pointer"
            title="Refresh Ledger"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Reconciliation Alert Banner (if audited) */}
      {reconciliationResult && (
        <div
          className={`p-4 rounded-2xl border flex items-start justify-between gap-4 ${
            reconciliationResult.balanced
              ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
              : 'bg-amber-950/20 border-amber-500/30 text-amber-300'
          }`}
        >
          <div className="flex items-start gap-3">
            {reconciliationResult.balanced ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            )}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider">
                {reconciliationResult.balanced
                  ? 'Audit Passed: Zero Ledger Discrepancy'
                  : 'Ledger Audit Discrepancy Detected'}
              </h4>
              <p className="text-xs mt-1 text-neutral-300">
                Audited at {new Date(reconciliationResult.checkedAt).toLocaleTimeString()} • Gross Payments:{' '}
                {formatMinorUnits(reconciliationResult.details.grossPayments, currency)} • Total Refunds:{' '}
                {formatMinorUnits(reconciliationResult.details.totalRefunds, currency)} • Net Organizer Balance:{' '}
                {formatMinorUnits(reconciliationResult.details.actualBalance, currency)}.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setReconciliationResult(null)}
            className="text-neutral-500 hover:text-white text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Gross Revenue */}
        <div className="glass p-4 rounded-xl border border-white/5 relative overflow-hidden">
          <div className="flex items-center justify-between text-neutral-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Gross Fees</span>
            <DollarSign className="w-3.5 h-3.5 text-violet-400" />
          </div>
          <div className="text-lg font-bold text-white">
            {formatMinorUnits(summary?.gross_revenue || 0, currency)}
          </div>
          <span className="text-[10px] text-neutral-500 mt-1 block">
            {summary?.total_paid_registrations || 0} paid entrant{summary?.total_paid_registrations === 1 ? '' : 's'}
          </span>
        </div>

        {/* Provider Fees */}
        <div className="glass p-4 rounded-xl border border-white/5 relative overflow-hidden">
          <div className="flex items-center justify-between text-neutral-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Processing</span>
            <ArrowDownLeft className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-lg font-bold text-amber-300">
            {formatMinorUnits(summary?.provider_fees || 0, currency)}
          </div>
          <span className="text-[10px] text-neutral-500 mt-1 block">Paystack gateway fee</span>
        </div>

        {/* Platform Fees */}
        <div className="glass p-4 rounded-xl border border-white/5 relative overflow-hidden">
          <div className="flex items-center justify-between text-neutral-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Platform</span>
            <Percent className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-lg font-bold text-cyan-300">
            {formatMinorUnits(summary?.platform_fees || 0, currency)}
          </div>
          <span className="text-[10px] text-neutral-500 mt-1 block">LeaderboardOS platform fee</span>
        </div>

        {/* Refunds */}
        <div className="glass p-4 rounded-xl border border-white/5 relative overflow-hidden">
          <div className="flex items-center justify-between text-neutral-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Refunds</span>
            <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-lg font-bold text-rose-400">
            {formatMinorUnits(summary?.total_refunded || 0, currency)}
          </div>
          <span className="text-[10px] text-neutral-500 mt-1 block">
            {summary?.refund_count || 0} refunded participant{summary?.refund_count === 1 ? '' : 's'}
          </span>
        </div>

        {/* Prize Pool Allocated */}
        <div className="glass p-4 rounded-xl border border-white/5 relative overflow-hidden">
          <div className="flex items-center justify-between text-neutral-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Prize Pool</span>
            <Trophy className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-lg font-bold text-purple-300">
            {formatMinorUnits(summary?.prize_pool_allocated || 0, currency)}
          </div>
          <span className="text-[10px] text-neutral-500 mt-1 block">Accounting allocation</span>
        </div>

        {/* Net Available Balance */}
        <div className="glass p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20 relative overflow-hidden">
          <div className="flex items-center justify-between text-emerald-300 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Net Balance</span>
            <Wallet className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-lg font-extrabold text-emerald-400">
            {formatMinorUnits(summary?.organizer_balance || 0, currency)}
          </div>
          <span className="text-[10px] text-emerald-500 mt-1 block font-medium">Available organizer balance</span>
        </div>
      </div>

      {/* Prize Allocations Status Summary */}
      {(summary?.prize_allocations || []).length > 0 && (
        <div className="glass p-5 rounded-2xl border border-purple-500/20 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-purple-400" /> Active Prize Pool Allocations
            </h3>
            <span className="text-[11px] text-neutral-400">
              Total Allocated: <strong className="text-white">{formatMinorUnits(summary?.prize_pool_allocated || 0, currency)}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {summary?.prize_allocations?.map((alloc) => (
              <div key={alloc.id} className="p-3 rounded-xl bg-neutral-900/80 border border-white/5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Rank #{alloc.rank_position}</span>
                  <span className="text-xs font-mono font-bold text-purple-300">
                    {formatMinorUnits(alloc.amount, alloc.currency)}
                  </span>
                </div>
                <div className="text-xs text-neutral-300 mt-1 font-semibold truncate">
                  {alloc.recipient_name}
                </div>
                {alloc.notes && <div className="text-[10px] text-neutral-500 mt-0.5 truncate">{alloc.notes}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Double-Entry Ledger Table */}
      <div className="glass rounded-2xl border border-white/5 overflow-hidden shadow-xl">
        {/* Table Controls */}
        <div className="p-4 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-950/40">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-violet-400" /> Accounting Ledger History
            </h3>
            <span className="text-xs text-neutral-500 font-mono">({filteredEntries.length} records)</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Filter */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-500" />
              <input
                type="text"
                placeholder="Search reference or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-xl bg-neutral-900 border border-white/5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-violet-500 w-48 sm:w-64"
              />
            </div>

            {/* Type Filter */}
            <div className="flex items-center gap-1 bg-neutral-900 p-1 rounded-xl border border-white/5 text-xs">
              <Filter className="w-3.5 h-3.5 text-neutral-500 ml-1.5" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-transparent text-neutral-300 text-xs focus:outline-none cursor-pointer pr-2"
              >
                <option value="all" className="bg-neutral-900 text-white">All Entries</option>
                <option value="gross_entry_fee" className="bg-neutral-900 text-white">Entry Fees</option>
                <option value="provider_fee" className="bg-neutral-900 text-white">Provider Fees</option>
                <option value="platform_fee" className="bg-neutral-900 text-white">Platform Fees</option>
                <option value="refund_debit" className="bg-neutral-900 text-white">Refunds</option>
                <option value="prize_allocation_debit" className="bg-neutral-900 text-white">Prize Allocations</option>
              </select>
            </div>
          </div>
        </div>

        {/* Ledger Rows */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-900/60 text-neutral-400 font-semibold uppercase tracking-wider text-[10px] border-b border-white/5">
              <tr>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Reference</th>
                <th className="py-3 px-4 text-right">Debit</th>
                <th className="py-3 px-4 text-right">Credit</th>
                <th className="py-3 px-4 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-neutral-300">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-neutral-500">
                    No ledger entries match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry) => {
                  const credit = entry.credit_amount ?? (entry.amount > 0 ? entry.amount : 0);
                  const debit = entry.debit_amount ?? (entry.amount < 0 ? Math.abs(entry.amount) : 0);
                  const balance = entry.running_balance ?? entry.balance_after;

                  return (
                    <tr key={entry.id} className="hover:bg-neutral-900/40 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap text-neutral-400 font-mono text-[11px]">
                        {new Date(entry.created_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {(entry.entry_type === 'gross_entry_fee' || entry.entry_type === 'entry_fee_credit') && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Entry Fee
                          </span>
                        )}
                        {(entry.entry_type === 'provider_fee' || entry.entry_type === 'provider_fee_debit') && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Provider Fee
                          </span>
                        )}
                        {(entry.entry_type === 'platform_fee' || entry.entry_type === 'platform_fee_debit') && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                            Platform Fee
                          </span>
                        )}
                        {entry.entry_type === 'refund_debit' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            Refund
                          </span>
                        )}
                        {(entry.entry_type === 'prize_allocation_debit' || entry.entry_type === 'prize_allocation') && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                            Prize Allocation
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-white font-medium max-w-xs truncate">
                        {entry.description}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-neutral-400 whitespace-nowrap">
                        {entry.payment_reference || '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-rose-400 whitespace-nowrap">
                        {debit > 0 ? `-${formatMinorUnits(debit, entry.currency)}` : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-400 whitespace-nowrap">
                        {credit > 0 ? `+${formatMinorUnits(credit, entry.currency)}` : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-white whitespace-nowrap">
                        {formatMinorUnits(balance, entry.currency)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paid Participants & Refund Management */}
      <div className="glass rounded-2xl border border-white/5 overflow-hidden shadow-xl">
        <div className="p-4 border-b border-white/5 flex items-center justify-between bg-neutral-950/40">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-400" /> Paid Entrants & Receipt Verification
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Verified paid participants with direct refund processing and payment receipts.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-900/60 text-neutral-400 font-semibold uppercase tracking-wider text-[10px] border-b border-white/5">
              <tr>
                <th className="py-3 px-4">Participant</th>
                <th className="py-3 px-4">Reference</th>
                <th className="py-3 px-4">Provider</th>
                <th className="py-3 px-4 text-right">Amount Paid</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-neutral-300">
              {(summary?.payments || []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-neutral-500">
                    No payment records yet for this competition.
                  </td>
                </tr>
              ) : (
                (summary?.payments || []).map((p) => (
                  <tr key={p.id} className="hover:bg-neutral-900/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{p.participant_name}</div>
                      <div className="text-[11px] text-neutral-500">{p.participant_email}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-neutral-400">
                      {p.payment_reference}
                    </td>
                    <td className="py-3 px-4 capitalize text-neutral-400">
                      {p.provider}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-white">
                      {formatMinorUnits(p.amount, p.currency)}
                    </td>
                    <td className="py-3 px-4">
                      {p.status === 'succeeded' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Verified Paid
                        </span>
                      )}
                      {p.status === 'pending' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          Pending Payment
                        </span>
                      )}
                      {p.status === 'refunded' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          Refunded
                        </span>
                      )}
                      {p.status === 'failed' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                          Failed
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {p.status === 'succeeded' && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPaymentForRefund(p);
                            setRefundAmount((p.amount / 100).toString());
                            setShowRefundModal(true);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-rose-950/40 text-neutral-400 hover:text-rose-300 border border-white/5 hover:border-rose-500/30 text-[11px] font-semibold transition-all cursor-pointer inline-flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" /> Issue Refund
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Refund Modal */}
      {showRefundModal && selectedPaymentForRefund && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass w-full max-w-md rounded-2xl border border-rose-500/30 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-rose-400" /> Issue Entrant Refund
              </h3>
              <button
                type="button"
                onClick={() => setShowRefundModal(false)}
                className="text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleExecuteRefund} className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/20 text-neutral-300 space-y-1">
                <div className="text-white font-semibold">{selectedPaymentForRefund.participant_name}</div>
                <div className="text-neutral-400">{selectedPaymentForRefund.participant_email}</div>
                <div className="font-mono text-rose-300 pt-1">
                  Original Charge: {formatMinorUnits(selectedPaymentForRefund.amount, selectedPaymentForRefund.currency)}
                </div>
              </div>

              <div>
                <label className="block text-neutral-400 mb-1">Refund Amount ({selectedPaymentForRefund.currency})</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-white/5 text-white font-mono focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-neutral-400 mb-1">Reason for Refund *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Participant withdrew before tournament deadline"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-white/5 text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="text-[11px] text-neutral-500">
                Warning: Issuing this refund will debit the competition ledger, update the participant&apos;s status to withdrawn, and mark their roster entry inactive.
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowRefundModal(false)}
                  className="px-4 py-2 rounded-xl bg-neutral-900 text-neutral-300 text-xs font-semibold hover:bg-neutral-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingRefund}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg transition-all cursor-pointer disabled:opacity-50"
                >
                  {processingRefund ? 'Processing...' : 'Confirm & Issue Refund'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Prize Pool Allocation Modal */}
      {showPrizeModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass w-full max-w-lg rounded-2xl border border-purple-500/30 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Trophy className="w-4 h-4 text-purple-400" /> Allocate Prize Pool
              </h3>
              <button
                type="button"
                onClick={() => setShowPrizeModal(false)}
                className="text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePrizeAllocations} className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/20 text-neutral-300">
                <span className="font-semibold text-white">Available Organizer Balance: </span>
                <span className="font-mono font-bold text-emerald-400">
                  {formatMinorUnits(summary?.organizer_balance || 0, currency)}
                </span>
                <p className="text-[10px] text-neutral-400 mt-1">
                  Prize pool allocations deduct from your available net organizer balance as an accounting record.
                </p>
              </div>

              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {allocationsList.map((alloc, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-neutral-900 border border-white/5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">Rank #{alloc.rank}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setAllocationsList((prev) => prev.filter((_, i) => i !== idx));
                        }}
                        className="text-neutral-500 hover:text-rose-400 text-[10px]"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-neutral-400 block mb-0.5">Recipient Name</label>
                        <input
                          type="text"
                          placeholder="Player or Team Name"
                          value={alloc.recipientName}
                          onChange={(e) => {
                            const val = e.target.value;
                            setAllocationsList((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, recipientName: val } : item))
                            );
                          }}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-neutral-950 border border-white/5 text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-neutral-400 block mb-0.5">Amount ({currency})</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="5000.00"
                          value={alloc.amountMajor}
                          onChange={(e) => {
                            const val = e.target.value;
                            setAllocationsList((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, amountMajor: val } : item))
                            );
                          }}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-neutral-950 border border-white/5 text-white font-mono"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => {
                  setAllocationsList((prev) => [
                    ...prev,
                    {
                      rank: prev.length + 1,
                      recipientName: '',
                      amountMajor: '',
                      notes: `Rank #${prev.length + 1}`,
                    },
                  ]);
                }}
                className="w-full py-1.5 rounded-xl border border-dashed border-white/10 hover:border-violet-500/40 text-neutral-400 hover:text-white text-xs transition-colors"
              >
                + Add Another Placement
              </button>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowPrizeModal(false)}
                  className="px-4 py-2 rounded-xl bg-neutral-900 text-neutral-300 text-xs font-semibold hover:bg-neutral-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPrizes}
                  className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-lg transition-all cursor-pointer disabled:opacity-50"
                >
                  {savingPrizes ? 'Allocating...' : 'Post Prize Allocations'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
