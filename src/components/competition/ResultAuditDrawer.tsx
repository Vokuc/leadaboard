'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, 
  History, 
  CheckCircle2, 
  AlertTriangle, 
  Ban, 
  ArrowRight, 
  FileText, 
  ExternalLink,
  ShieldAlert,
  Loader2,
  Clock
} from 'lucide-react';
import { ResultAuditEntry, ResultEntityType, ResultStatus } from '@/types';
import { ResultAuditService } from '@/lib/competition/audit/service';

interface ResultAuditDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  leaderboardId: string;
  entityType: ResultEntityType;
  entityId: string;
  title: string;
  currentHomeScore?: number;
  currentAwayScore?: number;
  currentPoints?: number;
  canManage: boolean;
  onResultUpdated?: () => void;
}

export function ResultAuditDrawer(props: ResultAuditDrawerProps) {
  if (!props.isOpen) return null;
  return (
    <ResultAuditDrawerInner
      {...props}
      key={`${props.entityType}-${props.entityId}`}
    />
  );
}

function ResultAuditDrawerInner({
  onClose,
  leaderboardId,
  entityType,
  entityId,
  title,
  currentHomeScore = 0,
  currentAwayScore = 0,
  currentPoints = 0,
  canManage,
  onResultUpdated,
}: ResultAuditDrawerProps) {
  const [history, setHistory] = useState<ResultAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'timeline' | 'correct' | 'dispute'>('timeline');

  // Correction Form State
  const [newHomeScore, setNewHomeScore] = useState(currentHomeScore);
  const [newAwayScore, setNewAwayScore] = useState(currentAwayScore);
  const [newPoints, setNewPoints] = useState(currentPoints);
  const [correctionReason, setCorrectionReason] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [forceDownstreamReset, setForceDownstreamReset] = useState(false);
  const [savingCorrection, setSavingCorrection] = useState(false);

  // Dispute Form State
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeEvidenceUrl, setDisputeEvidenceUrl] = useState('');
  const [savingDispute, setSavingDispute] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const records = await ResultAuditService.getAuditHistoryForEntity(entityType, entityId);
      setHistory(records);
    } catch (err: unknown) {
      console.error('Failed to load audit history:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load audit history.');
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    let ignore = false;
    ResultAuditService.getAuditHistoryForEntity(entityType, entityId)
      .then((records) => {
        if (!ignore) {
          setHistory(records);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          console.error('Failed to load audit history:', err);
          setErrorMessage(err instanceof Error ? err.message : 'Failed to load audit history.');
          setLoading(false);
        }
      });
    return () => {
      ignore = true;
    };
  }, [entityType, entityId]);

  const handleApplyCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCorrection(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (correctionReason.trim().length < 3) {
        throw new Error('A descriptive reason (at least 3 characters) is required for correcting a result.');
      }

      const evidenceUrls = evidenceUrl.trim() ? [evidenceUrl.trim()] : [];

      if (entityType === 'fixture_result') {
        await ResultAuditService.correctFixtureResult({
          leaderboardId,
          fixtureId: entityId,
          newHomeScore,
          newAwayScore,
          reason: correctionReason.trim(),
          evidenceUrls,
        });
      } else if (entityType === 'score_event') {
        await ResultAuditService.correctScoreEvent({
          leaderboardId,
          scoreEventId: entityId,
          newPoints,
          reason: correctionReason.trim(),
          evidenceUrls,
        });
      } else if (entityType === 'tournament_match') {
        await ResultAuditService.correctTournamentMatch({
          leaderboardId,
          matchId: entityId,
          newHomeScore,
          newAwayScore,
          reason: correctionReason.trim(),
          evidenceUrls,
          forceDownstreamReset,
        });
      }

      setSuccessMessage('Result successfully corrected and audit event recorded.');
      setCorrectionReason('');
      setEvidenceUrl('');
      await loadHistory();
      if (onResultUpdated) onResultUpdated();
      setActiveTab('timeline');
    } catch (err: unknown) {
      console.error(err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save correction.');
    } finally {
      setSavingCorrection(false);
    }
  };

  const handleFileDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingDispute(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (disputeReason.trim().length < 5) {
        throw new Error('A detailed dispute explanation (at least 5 characters) is required.');
      }

      const evidenceUrls = disputeEvidenceUrl.trim() ? [disputeEvidenceUrl.trim()] : [];

      await ResultAuditService.disputeResult({
        leaderboardId,
        entityType,
        entityId,
        reason: disputeReason.trim(),
        evidenceUrls,
      });

      setSuccessMessage('Dispute registered. An organizer will review and resolve it.');
      setDisputeReason('');
      setDisputeEvidenceUrl('');
      await loadHistory();
      if (onResultUpdated) onResultUpdated();
      setActiveTab('timeline');
    } catch (err: unknown) {
      console.error(err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to file dispute.');
    } finally {
      setSavingDispute(false);
    }
  };

  const handleResolveDispute = async (decision: 'approve' | 'reject') => {
    setErrorMessage(null);
    try {
      const reason = window.prompt(`Enter resolution explanation to ${decision} this dispute:`);
      if (!reason || reason.trim().length < 3) {
        alert('A resolution reason is required.');
        return;
      }

      await ResultAuditService.resolveDispute({
        leaderboardId,
        entityType,
        entityId,
        auditEntryId: history[0]?.id || '',
        decision,
        resolutionReason: reason.trim(),
      });

      setSuccessMessage(`Dispute ${decision === 'approve' ? 'approved' : 'rejected'}.`);
      await loadHistory();
      if (onResultUpdated) onResultUpdated();
    } catch (err: unknown) {
      console.error(err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to resolve dispute.');
    }
  };

  const handleVoidResult = async () => {
    if (!window.confirm('Are you sure you want to VOID this result? It will no longer count in standings.')) {
      return;
    }
    const reason = window.prompt('Enter reason for voiding this result:');
    if (!reason || reason.trim().length < 3) {
      alert('A reason is required to void a result.');
      return;
    }

    try {
      await ResultAuditService.voidResult({
        leaderboardId,
        entityType,
        entityId,
        reason: reason.trim(),
      });
      setSuccessMessage('Result voided.');
      await loadHistory();
      if (onResultUpdated) onResultUpdated();
    } catch (err: unknown) {
      console.error(err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to void result.');
    }
  };

  const getStatusBadge = (status: ResultStatus) => {
    switch (status) {
      case 'approved':
      case 'confirmed':
        return <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20"><CheckCircle2 className="h-3 w-3" /> Approved</span>;
      case 'disputed':
        return <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-500/20"><AlertTriangle className="h-3 w-3" /> Disputed</span>;
      case 'voided':
        return <span className="inline-flex items-center gap-1 rounded-md bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-400 border border-red-500/20"><Ban className="h-3 w-3" /> Voided</span>;
      default:
        return <span className="inline-flex items-center gap-1 rounded-md bg-neutral-800 px-2 py-0.5 text-[10px] font-bold text-neutral-300">{status}</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-white/10 bg-neutral-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 p-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600/20 text-violet-400 border border-violet-500/30">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Trustworthy Result History</h3>
              <p className="text-xs text-neutral-400">{title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-white/5 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/5 bg-neutral-950/40 px-5 pt-2">
          <button
            onClick={() => setActiveTab('timeline')}
            className={`border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
              activeTab === 'timeline'
                ? 'border-violet-500 text-violet-300'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            Audit Trail ({history.length})
          </button>
          {canManage && (
            <button
              onClick={() => setActiveTab('correct')}
              className={`border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
                activeTab === 'correct'
                  ? 'border-violet-500 text-violet-300'
                  : 'border-transparent text-neutral-400 hover:text-white'
              }`}
            >
              Correct Result
            </button>
          )}
          <button
            onClick={() => setActiveTab('dispute')}
            className={`border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
              activeTab === 'dispute'
                ? 'border-amber-500 text-amber-300'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            Flag Dispute
          </button>
        </div>

        {/* Alert Messages */}
        {errorMessage && (
          <div className="mx-5 mt-4 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
            <ShieldAlert className="h-4 w-4 shrink-0 text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="mx-5 mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'timeline' && (
            <div className="space-y-4">
              {loading ? (
                <div className="flex h-48 items-center justify-center text-neutral-500">
                  <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
                </div>
              ) : history.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-xs text-neutral-400">
                  No revision history found. Result is currently in its initial recorded state.
                </div>
              ) : (
                history.map((entry, index) => {
                  const isLatest = index === 0;
                  return (
                    <div
                      key={entry.id}
                      className={`relative rounded-xl border p-4 transition-all ${
                        isLatest
                          ? 'border-violet-500/30 bg-violet-950/10'
                          : 'border-white/5 bg-neutral-950/30 opacity-80'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold capitalize text-white">
                            {entry.action} by {entry.actor_name || 'System'}
                          </span>
                          <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-neutral-400">
                            {entry.actor_role}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(entry.status)}
                          <span className="flex items-center gap-1 text-[10px] text-neutral-500">
                            <Clock className="h-3 w-3" />
                            {new Date(entry.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* Payloads Diff */}
                      <div className="mt-3 rounded-lg border border-white/5 bg-black/40 p-2.5 font-mono text-xs">
                        {entry.previous_payload ? (
                          <div className="flex items-center gap-2 text-neutral-400">
                            <span className="text-red-400/90 line-through">
                              {JSON.stringify(entry.previous_payload)}
                            </span>
                            <ArrowRight className="h-3.5 w-3.5 text-neutral-500 shrink-0" />
                            <span className="text-emerald-400 font-semibold">
                              {JSON.stringify(entry.proposed_payload)}
                            </span>
                          </div>
                        ) : (
                          <div className="text-neutral-300">
                            Initial Record: <span className="text-emerald-400">{JSON.stringify(entry.proposed_payload)}</span>
                          </div>
                        )}
                      </div>

                      {/* Mandatory Reason */}
                      {entry.reason && (
                        <div className="mt-2.5 flex items-start gap-1.5 text-xs text-neutral-300">
                          <FileText className="h-3.5 w-3.5 shrink-0 text-violet-400 mt-0.5" />
                          <span className="italic">&ldquo;{entry.reason}&rdquo;</span>
                        </div>
                      )}

                      {/* Evidence Attachment */}
                      {entry.evidence_urls && entry.evidence_urls.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2 pt-1 border-t border-white/5">
                          {entry.evidence_urls.map((url, uidx) => (
                            <a
                              key={uidx}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded bg-neutral-800 px-2 py-1 text-[11px] text-cyan-400 hover:text-cyan-300 hover:underline"
                            >
                              <ExternalLink className="h-3 w-3" /> Evidence #{uidx + 1}
                            </a>
                          ))}
                        </div>
                      )}

                      {/* Organizer Dispute Action Bar if status is disputed */}
                      {canManage && entry.status === 'disputed' && isLatest && (
                        <div className="mt-3.5 flex items-center gap-2 pt-2 border-t border-white/10">
                          <span className="text-xs text-amber-300 font-semibold">Pending Dispute:</span>
                          <button
                            onClick={() => void handleResolveDispute('approve')}
                            className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors"
                          >
                            Approve Dispute
                          </button>
                          <button
                            onClick={() => void handleResolveDispute('reject')}
                            className="rounded-lg bg-neutral-800 px-2.5 py-1 text-xs font-semibold text-neutral-300 hover:bg-neutral-700 transition-colors"
                          >
                            Reject Dispute
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {/* Void action footer for organizers */}
              {canManage && history.length > 0 && (
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => void handleVoidResult()}
                    className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300 hover:underline"
                  >
                    <Ban className="h-3.5 w-3.5" /> Void this entire result
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'correct' && canManage && (
            <form onSubmit={handleApplyCorrection} className="space-y-4">
              <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 text-xs text-violet-300">
                Authorized corrections append a permanent audit event. The previous score remains preserved in the history log.
              </div>

              {entityType === 'score_event' ? (
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1.5">New Points Value</label>
                  <input
                    type="number"
                    value={newPoints}
                    onChange={(e) => setNewPoints(Number(e.target.value) || 0)}
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                    required
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1.5">New Home Score</label>
                    <input
                      type="number"
                      min={0}
                      value={newHomeScore}
                      onChange={(e) => setNewHomeScore(Number(e.target.value) || 0)}
                      className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1.5">New Away Score</label>
                    <input
                      type="number"
                      min={0}
                      value={newAwayScore}
                      onChange={(e) => setNewAwayScore(Number(e.target.value) || 0)}
                      className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                      required
                    />
                  </div>
                </div>
              )}

              {entityType === 'tournament_match' && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-amber-200">
                    <input
                      type="checkbox"
                      checked={forceDownstreamReset}
                      onChange={(e) => setForceDownstreamReset(e.target.checked)}
                      className="rounded border-amber-500/50 bg-neutral-900 text-amber-500 focus:ring-0"
                    />
                    <span>Force reset downstream match if winner changes and subsequent round was already played</span>
                  </label>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                  Reason for Correction <span className="text-red-400">*</span>
                </label>
                <textarea
                  rows={3}
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  placeholder="e.g. Scorekeeper entered inverted scores; verified by referee match sheet."
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                  Evidence Attachment URL (Optional)
                </label>
                <input
                  type="url"
                  value={evidenceUrl}
                  onChange={(e) => setEvidenceUrl(e.target.value)}
                  placeholder="https://... photo of scorecard or referee confirmation"
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('timeline')}
                  className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-neutral-300 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCorrection}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
                >
                  {savingCorrection && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save Correction
                </button>
              </div>
            </form>
          )}

          {activeTab === 'dispute' && (
            <form onSubmit={handleFileDispute} className="space-y-4">
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-200">
                Disputing flags this result for organizer investigation. Standings will note the pending dispute until an organizer approves or resolves it.
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                  Dispute Explanation <span className="text-red-400">*</span>
                </label>
                <textarea
                  rows={4}
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  placeholder="Explain why this result is disputed (e.g. wrong score recorded, ineligible player, timer malfunction)..."
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                  Evidence Attachment URL (Optional)
                </label>
                <input
                  type="url"
                  value={disputeEvidenceUrl}
                  onChange={(e) => setDisputeEvidenceUrl(e.target.value)}
                  placeholder="https://... photo of scoresheet or video link"
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('timeline')}
                  className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-neutral-300 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingDispute}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
                >
                  {savingDispute && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Submit Dispute
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
