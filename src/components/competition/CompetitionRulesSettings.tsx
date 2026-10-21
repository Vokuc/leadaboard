'use client';

import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Save, 
  ArrowUp, 
  ArrowDown, 
  Trash2, 
  Plus, 
  AlertCircle, 
  CheckCircle2, 
  History,
  RotateCcw
} from 'lucide-react';
import { 
  CompetitionEngine, 
  CompetitionRules, 
  TieBreakerCriterionType, 
  TieBreakerRule 
} from '@/types';
import { CompetitionRulesService } from '@/lib/competition/rules/service';
import { getDefaultTieBreakersForEngine } from '@/lib/competition/rules/defaults';

interface CompetitionRulesSettingsProps {
  leaderboardId: string;
  engine: CompetitionEngine;
  onSaved?: () => void;
}

const AVAILABLE_TIE_BREAKERS: { type: TieBreakerCriterionType; label: string; direction: 'desc' | 'asc' }[] = [
  { type: 'points', label: 'Points', direction: 'desc' },
  { type: 'goal_difference', label: 'Goal Difference', direction: 'desc' },
  { type: 'goals_for', label: 'Goals For / Scored', direction: 'desc' },
  { type: 'goals_against', label: 'Goals Against / Conceded', direction: 'asc' },
  { type: 'head_to_head', label: 'Head-to-Head Record', direction: 'desc' },
  { type: 'earliest_score', label: 'Earliest Score Achieved', direction: 'asc' },
  { type: 'latest_score', label: 'Latest Score Achieved', direction: 'desc' },
  { type: 'alphabetical', label: 'Alphabetical Order', direction: 'asc' },
];

export function CompetitionRulesSettings({
  leaderboardId,
  engine,
  onSaved,
}: CompetitionRulesSettingsProps) {
  const [rules, setRules] = useState<CompetitionRules | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Form states
  const [rankingOrder, setRankingOrder] = useState<'desc' | 'asc'>('desc');
  const [pointsForWin, setPointsForWin] = useState<number>(3);
  const [pointsForDraw, setPointsForDraw] = useState<number>(1);
  const [pointsForLoss, setPointsForLoss] = useState<number>(0);
  const [allowDraws, setAllowDraws] = useState<boolean>(true);
  const [allowNegativePoints, setAllowNegativePoints] = useState<boolean>(true);
  const [minPointsPerEvent, setMinPointsPerEvent] = useState<string>('');
  const [maxPointsPerEvent, setMaxPointsPerEvent] = useState<string>('');
  const [tieBreakers, setTieBreakers] = useState<TieBreakerRule[]>([]);
  const [selectedNewTb, setSelectedNewTb] = useState<string>('');

  useEffect(() => {
    let ignore = false;
    const loadRules = async () => {
      try {
        setLoading(true);
        const r = await CompetitionRulesService.getRules(leaderboardId);
        if (!ignore) {
          setRules(r);
          setRankingOrder(r.ranking_order || 'desc');
          setPointsForWin(r.points_config.points_for_win ?? 3);
          setPointsForDraw(r.points_config.points_for_draw ?? 1);
          setPointsForLoss(r.points_config.points_for_loss ?? 0);
          setAllowDraws(r.points_config.allow_draws ?? true);
          setAllowNegativePoints(r.points_config.allow_negative_points ?? true);
          setMinPointsPerEvent(r.points_config.min_points_per_event != null ? String(r.points_config.min_points_per_event) : '');
          setMaxPointsPerEvent(r.points_config.max_points_per_event != null ? String(r.points_config.max_points_per_event) : '');
          setTieBreakers(r.tie_breakers || []);
        }
      } catch (err) {
        console.error('Failed to load competition rules:', err);
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    void loadRules();
    return () => {
      ignore = true;
    };
  }, [leaderboardId]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => {
      setFeedback((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  };

  const handleMoveTieBreaker = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= tieBreakers.length) return;

    const updated = [...tieBreakers];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setTieBreakers(updated);
  };

  const handleRemoveTieBreaker = (index: number) => {
    setTieBreakers(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddTieBreaker = () => {
    if (!selectedNewTb) return;
    const option = AVAILABLE_TIE_BREAKERS.find(o => o.type === selectedNewTb);
    if (!option) return;

    if (tieBreakers.some(tb => tb.type === option.type)) {
      showToast(`"${option.label}" is already in the tie-breaker hierarchy.`, 'error');
      return;
    }

    setTieBreakers(prev => [
      ...prev,
      {
        type: option.type,
        label: option.label,
        direction: option.direction,
      },
    ]);
    setSelectedNewTb('');
  };

  const handleResetToDefaults = () => {
    const defaults = getDefaultTieBreakersForEngine(engine);
    setTieBreakers(defaults);
    if (engine === 'league_table') {
      setPointsForWin(3);
      setPointsForDraw(1);
      setPointsForLoss(0);
      setAllowDraws(true);
      setRankingOrder('desc');
    } else {
      setRankingOrder('desc');
      setAllowNegativePoints(true);
      setMinPointsPerEvent('');
      setMaxPointsPerEvent('');
    }
    showToast('Reset to default competition rules.');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tieBreakers.length === 0) {
      showToast('You must have at least one ranking rule or tie-breaker.', 'error');
      return;
    }

    try {
      setSaving(true);
      const minNum = minPointsPerEvent.trim() ? Number(minPointsPerEvent.trim()) : null;
      const maxNum = maxPointsPerEvent.trim() ? Number(maxPointsPerEvent.trim()) : null;

      const updated = await CompetitionRulesService.saveRules(leaderboardId, {
        ranking_order: rankingOrder,
        points_config: {
          points_for_win: pointsForWin,
          points_for_draw: pointsForDraw,
          points_for_loss: pointsForLoss,
          allow_draws: allowDraws,
          allow_negative_points: allowNegativePoints,
          min_points_per_event: minNum,
          max_points_per_event: maxNum,
        },
        tie_breakers: tieBreakers,
      });

      setRules(updated);
      showToast(`Competition rules updated successfully to Version ${updated.version}.`);
      onSaved?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save rules';
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-neutral-400 p-4">Loading competition rules...</div>;
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Toast */}
      {feedback && (
        <div className={`p-4 rounded-xl flex items-center gap-3 text-sm animate-fade-in ${
          feedback.type === 'error' ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
        }`}>
          {feedback.type === 'error' ? <AlertCircle className="w-5 h-5 shrink-0" /> : <CheckCircle2 className="w-5 h-5 shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-violet-400" />
            Configurable Scoring & Tie-Breaker Engine
          </h3>
          <p className="text-xs text-neutral-400 mt-1">
            Define point allocations, score bounds, tie-breaking criteria, and deterministic fallbacks.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {rules && (
            <span className="flex items-center gap-1.5 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs font-mono font-bold text-violet-300">
              <History className="w-3.5 h-3.5" />
              Active Version: v{rules.version}
            </span>
          )}
          <button
            type="button"
            onClick={handleResetToDefaults}
            className="flex items-center gap-1.5 rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-300 hover:text-white hover:border-neutral-700"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Defaults
          </button>
        </div>
      </div>

      {/* Engine-specific scoring settings */}
      {engine === 'league_table' ? (
        <div className="rounded-2xl border border-white/5 bg-black/25 p-5 space-y-4">
          <div className="font-bold text-white text-sm">League Match Points Allocation</div>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">Points for Win</label>
              <input
                type="number"
                value={pointsForWin}
                onChange={(e) => setPointsForWin(Number(e.target.value) || 0)}
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">Points for Draw</label>
              <input
                type="number"
                disabled={!allowDraws}
                value={allowDraws ? pointsForDraw : 0}
                onChange={(e) => setPointsForDraw(Number(e.target.value) || 0)}
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white disabled:opacity-40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">Points for Loss</label>
              <input
                type="number"
                value={pointsForLoss}
                onChange={(e) => setPointsForLoss(Number(e.target.value) || 0)}
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="allowDraws"
              checked={allowDraws}
              onChange={(e) => setAllowDraws(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-800 bg-neutral-950 text-violet-600 focus:ring-violet-500"
            />
            <label htmlFor="allowDraws" className="text-xs text-neutral-300 cursor-pointer">
              Allow draws / tied fixture results (if disabled, drawn scores are rejected on submission)
            </label>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/5 bg-black/25 p-5 space-y-4">
          <div className="font-bold text-white text-sm">Points & Scoring Behavior</div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">Ranking Goal / Direction</label>
              <select
                value={rankingOrder}
                onChange={(e) => setRankingOrder(e.target.value as 'desc' | 'asc')}
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white"
              >
                <option value="desc">Higher Points Rank Higher (Standard)</option>
                <option value="asc">Lower Points Rank Higher (e.g. Golf / Time trials)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">Score Deductions</label>
              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="allowNegative"
                  checked={allowNegativePoints}
                  onChange={(e) => setAllowNegativePoints(e.target.checked)}
                  className="h-4 w-4 rounded border-neutral-800 bg-neutral-950 text-violet-600 focus:ring-violet-500"
                />
                <label htmlFor="allowNegative" className="text-xs text-neutral-300 cursor-pointer">
                  Allow negative adjustments / penalties
                </label>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 pt-2 border-t border-white/5">
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">Min Points per Event (Optional)</label>
              <input
                type="number"
                placeholder="No lower bound"
                value={minPointsPerEvent}
                onChange={(e) => setMinPointsPerEvent(e.target.value)}
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">Max Points per Event (Optional)</label>
              <input
                type="number"
                placeholder="No upper bound"
                value={maxPointsPerEvent}
                onChange={(e) => setMaxPointsPerEvent(e.target.value)}
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* Ordered Tie-Breakers Hierarchy */}
      <div className="rounded-2xl border border-white/5 bg-black/25 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-bold text-white text-sm">Ordered Tie-Break Hierarchy</div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Criteria are evaluated sequentially from top to bottom whenever competitors have tied scores.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {tieBreakers.map((tb, idx) => (
            <div
              key={`${tb.type}-${idx}`}
              className="flex items-center justify-between rounded-xl border border-white/5 bg-neutral-900/70 px-4 py-2.5 text-sm"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-500/20 text-xs font-bold text-violet-300">
                  {idx + 1}
                </span>
                <div>
                  <span className="font-semibold text-white">{tb.label}</span>
                  <span className="ml-2 text-xs text-neutral-500">
                    ({tb.direction === 'asc' ? 'Lowest first' : 'Highest first'})
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => handleMoveTieBreaker(idx, 'up')}
                  className="rounded-lg p-1.5 text-neutral-400 hover:text-white hover:bg-white/5 disabled:opacity-20"
                  title="Move Up"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={idx === tieBreakers.length - 1}
                  onClick={() => handleMoveTieBreaker(idx, 'down')}
                  className="rounded-lg p-1.5 text-neutral-400 hover:text-white hover:bg-white/5 disabled:opacity-20"
                  title="Move Down"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveTieBreaker(idx)}
                  className="rounded-lg p-1.5 text-red-400 hover:bg-red-500/10"
                  title="Remove"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add Tie-Breaker */}
        <div className="flex items-center gap-3 pt-2">
          <select
            value={selectedNewTb}
            onChange={(e) => setSelectedNewTb(e.target.value)}
            className="rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs text-white"
          >
            <option value="">Select a tie-breaker criterion to add...</option>
            {AVAILABLE_TIE_BREAKERS.map((opt) => (
              <option
                key={opt.type}
                value={opt.type}
                disabled={tieBreakers.some(tb => tb.type === opt.type)}
              >
                {opt.label} {tieBreakers.some(tb => tb.type === opt.type) ? '(Already Added)' : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!selectedNewTb}
            onClick={handleAddTieBreaker}
            className="flex items-center gap-1.5 rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-300 hover:bg-violet-500/20 disabled:opacity-40"
          >
            <Plus className="w-4 h-4" />
            Add Criterion
          </button>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50 cursor-pointer shadow-lg shadow-violet-600/30"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving Rules...' : 'Save & Activate Rules'}
        </button>
      </div>
    </form>
  );
}
