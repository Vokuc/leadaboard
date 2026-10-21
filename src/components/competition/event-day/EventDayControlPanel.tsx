'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  EventDayMatch,
  EventDayOperatorRole,
  Leaderboard,
  CompetitionConfig,
} from '@/types';
import { EventDayService } from '@/lib/competition/event-day/service';
import { useAuth } from '@/context/AuthContext';
import {
  Play,
  CheckCircle,
  Plus,
  Minus,
  RefreshCw,
  Wifi,
  WifiOff,
  Shield,
  Clock,
  MapPin,
  AlertTriangle,
  Send,
  Eye,
  Calendar,
  Filter,
} from 'lucide-react';

interface EventDayControlPanelProps {
  leaderboard: Leaderboard;
  competitionConfig?: CompetitionConfig | null;
}

export function EventDayControlPanel({ leaderboard, competitionConfig }: EventDayControlPanelProps) {
  const { profile } = useAuth();

  const [matches, setMatches] = useState<EventDayMatch[]>([]);
  const [operatorRole, setOperatorRole] = useState<EventDayOperatorRole>('viewer');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [offlinePendingCount, setOfflinePendingCount] = useState<number>(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filters
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedVenue, setSelectedVenue] = useState<string>('all');

  // Working state for live scoring (in-memory per match)
  const [liveScores, setLiveScores] = useState<Record<string, { home: number; away: number }>>({});

  // Confirmation Modal State
  const [confirmModalMatch, setConfirmModalMatch] = useState<EventDayMatch | null>(null);
  const [finalizeReason, setFinalizeReason] = useState<string>('');
  const [submittingResult, setSubmittingResult] = useState<boolean>(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Monitor network status
  useEffect(() => {
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);

    const handleOnline = () => {
      setIsOnline(true);
      showToast('Network restored. Syncing offline updates...');
      void handleSyncOffline();
    };

    const handleOffline = () => {
      setIsOnline(false);
      showToast('Offline mode active. Updates will be saved locally.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [role, list] = await Promise.all([
        EventDayService.getUserRole(leaderboard.id, profile?.id),
        EventDayService.getTodayMatches(leaderboard.id, {
          date: selectedDate === 'all' ? undefined : selectedDate,
          status: selectedStatus === 'all' ? undefined : selectedStatus,
        }),
      ]);

      setOperatorRole(role);
      setMatches(list);

      // Initialize live score state from match values
      const initialScores: Record<string, { home: number; away: number }> = {};
      for (const m of list) {
        initialScores[m.id] = {
          home: m.home_score ?? 0,
          away: m.away_score ?? 0,
        };
      }
      setLiveScores(initialScores);

      const pending = EventDayService.getOfflineQueue();
      setOfflinePendingCount(pending.length);
    } catch (err) {
      console.error('Failed to load event day data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [leaderboard.id, profile?.id, selectedDate, selectedStatus]);

  useEffect(() => {
    void loadData();

    // Auto refresh every 8 seconds
    const interval = setInterval(() => {
      void loadData();
    }, 8000);

    return () => clearInterval(interval);
  }, [loadData]);

  const handleSyncOffline = async () => {
    try {
      const { processed, errors } = await EventDayService.flushOfflineQueue();
      setOfflinePendingCount(EventDayService.getOfflineQueue().length);
      if (processed > 0) {
        showToast(`Successfully synced ${processed} offline updates.`);
        void loadData();
      }
      if (errors.length > 0) {
        console.warn('Sync warnings:', errors);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Adjust score locally
  const adjustScore = (matchId: string, side: 'home' | 'away', delta: number) => {
    if (operatorRole === 'viewer') return;

    setLiveScores((prev) => {
      const current = prev[matchId] || { home: 0, away: 0 };
      const nextVal = Math.max(0, current[side] + delta);
      return {
        ...prev,
        [matchId]: {
          ...current,
          [side]: nextVal,
        },
      };
    });
  };

  // Start match
  const handleStartMatch = async (match: EventDayMatch) => {
    if (operatorRole === 'viewer') return;

    if (!isOnline) {
      EventDayService.queueOfflineAction({
        matchId: match.id,
        leaderboardId: leaderboard.id,
        engine: match.engine,
        actionType: 'start',
      });
      setOfflinePendingCount((c) => c + 1);
      showToast('Match start queued locally.');
      setMatches((prev) => prev.map((m) => (m.id === match.id ? { ...m, status: 'live', is_live: true } : m)));
      return;
    }

    try {
      await EventDayService.startMatch(leaderboard.id, match.id, match.engine, profile?.id);
      showToast(`Match started! Status is now LIVE.`);
      void loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start match';
      showToast(msg);
    }
  };

  // Update live score
  const handleUpdateLiveScore = async (match: EventDayMatch) => {
    if (operatorRole === 'viewer') return;
    const scores = liveScores[match.id] || { home: 0, away: 0 };

    if (!isOnline) {
      EventDayService.queueOfflineAction({
        matchId: match.id,
        leaderboardId: leaderboard.id,
        engine: match.engine,
        actionType: 'score_update',
        homeScore: scores.home,
        awayScore: scores.away,
      });
      setOfflinePendingCount((c) => c + 1);
      showToast('Live score update queued locally.');
      return;
    }

    try {
      await EventDayService.updateLiveScore(
        leaderboard.id,
        match.id,
        match.engine,
        scores.home,
        scores.away,
        profile?.id
      );
      showToast(`Score updated: ${scores.home} - ${scores.away}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update score';
      showToast(msg);
    }
  };

  // Finalize result with confirmation modal
  const handleConfirmFinalize = async () => {
    if (!confirmModalMatch || operatorRole === 'viewer') return;
    const match = confirmModalMatch;
    const scores = liveScores[match.id] || { home: 0, away: 0 };
    setSubmittingResult(true);

    if (!isOnline) {
      EventDayService.queueOfflineAction({
        matchId: match.id,
        leaderboardId: leaderboard.id,
        engine: match.engine,
        actionType: 'finalize',
        homeScore: scores.home,
        awayScore: scores.away,
        reason: finalizeReason || 'Event-Day official match finalization',
      });
      setOfflinePendingCount((c) => c + 1);
      setConfirmModalMatch(null);
      setSubmittingResult(false);
      showToast('Result finalization saved offline.');
      setMatches((prev) =>
        prev.map((m) =>
          m.id === match.id
            ? { ...m, status: 'completed', is_live: false, home_score: scores.home, away_score: scores.away }
            : m
        )
      );
      return;
    }

    try {
      await EventDayService.finalizeMatchResult(
        leaderboard.id,
        match.id,
        match.engine,
        scores.home,
        scores.away,
        finalizeReason || 'Event-Day official match finalization',
        profile?.id
      );
      showToast(`Match finalized! Scores updated in standings & bracket.`);
      setConfirmModalMatch(null);
      setFinalizeReason('');
      void loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to finalize match';
      showToast(msg);
    } finally {
      setSubmittingResult(false);
    }
  };

  const venuesList = useMemo(() => {
    const set = new Set<string>();
    matches.forEach((m) => {
      if (m.venue_name) set.add(m.venue_name);
    });
    return Array.from(set);
  }, [matches]);

  const displayedMatches = useMemo(() => {
    return matches.filter((m) => {
      if (selectedVenue !== 'all' && m.venue_name !== selectedVenue) return false;
      return true;
    });
  }, [matches, selectedVenue]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-neutral-400 space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin text-violet-500" />
        <p className="text-sm font-medium">Loading Event-Day schedule...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-xl bg-violet-950/95 border border-violet-500/40 text-violet-100 text-xs shadow-2xl animate-fade-in flex items-center gap-2 max-w-sm">
          <CheckCircle className="w-4 h-4 text-violet-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Sticky Header Bar */}
      <div className="sticky top-0 z-20 bg-neutral-950/90 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <Play className="w-5 h-5 fill-rose-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Event-Day Mode</h2>
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                {leaderboard.name} &bull; Mobile-First Match Operation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            {/* Operator Role Badge */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-neutral-900 border border-white/10">
              {operatorRole === 'organizer' && (
                <>
                  <Shield className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-amber-300">Organizer</span>
                </>
              )}
              {operatorRole === 'referee' && (
                <>
                  <Shield className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-cyan-300">Referee</span>
                </>
              )}
              {operatorRole === 'viewer' && (
                <>
                  <Eye className="w-3.5 h-3.5 text-neutral-400" />
                  <span className="text-neutral-400">Viewer Mode</span>
                </>
              )}
            </div>

            {/* Online / Offline Status Badge */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                isOnline
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-amber-500/10 border-amber-500/20 text-amber-400 animate-pulse'
              }`}
            >
              {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              <span>{isOnline ? 'Online' : 'Offline'}</span>
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => {
                setRefreshing(true);
                void loadData();
              }}
              aria-label="Refresh match schedule"
              className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-white/10 text-neutral-300 hover:text-white transition-all cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Offline Queue Bar if items pending */}
        {offlinePendingCount > 0 && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{offlinePendingCount} pending match action(s) saved locally.</span>
            </div>
            {isOnline && (
              <button
                type="button"
                onClick={() => void handleSyncOffline()}
                className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs transition-colors cursor-pointer"
              >
                Sync Now
              </button>
            )}
          </div>
        )}

        {/* Filters: Status, Date, Venue */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/5 text-xs">
          {/* Status Pills */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSelectedStatus('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                selectedStatus === 'all'
                  ? 'bg-white/20 text-white'
                  : 'text-neutral-400 hover:text-white bg-white/5'
              }`}
            >
              All Matches
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatus('live')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                selectedStatus === 'live'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                  : 'text-neutral-400 hover:text-white bg-white/5'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
              Live Now
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatus('scheduled')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                selectedStatus === 'scheduled'
                  ? 'bg-white/20 text-white'
                  : 'text-neutral-400 hover:text-white bg-white/5'
              }`}
            >
              Upcoming
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatus('completed')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                selectedStatus === 'completed'
                  ? 'bg-white/20 text-white'
                  : 'text-neutral-400 hover:text-white bg-white/5'
              }`}
            >
              Completed
            </button>
          </div>

          {/* Venue Selector */}
          {venuesList.length > 0 && (
            <div className="ml-auto flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-neutral-400" />
              <select
                value={selectedVenue}
                onChange={(e) => setSelectedVenue(e.target.value)}
                className="bg-neutral-900 border border-white/10 rounded-lg px-2 py-1 text-white text-xs focus:outline-none"
              >
                <option value="all">All Venues</option>
                {venuesList.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Match Cards List */}
      {displayedMatches.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-neutral-900/40 border border-white/5 text-neutral-400 space-y-2">
          <Calendar className="w-10 h-10 mx-auto text-neutral-600" />
          <p className="text-sm font-semibold text-neutral-300">No scheduled matches found for this filter.</p>
          <p className="text-xs">Generate schedules in the Competition Scheduler to operate matches on Event Day.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayedMatches.map((match) => {
            const isLive = match.is_live;
            const isCompleted = match.status === 'completed';
            const scores = liveScores[match.id] || {
              home: match.home_score ?? 0,
              away: match.away_score ?? 0,
            };

            return (
              <div
                key={match.id}
                className={`p-5 rounded-2xl border transition-all ${
                  isLive
                    ? 'bg-gradient-to-br from-rose-950/20 via-neutral-900 to-neutral-950 border-rose-500/40 shadow-xl shadow-rose-950/20'
                    : isCompleted
                    ? 'bg-neutral-900/60 border-white/5 opacity-80'
                    : 'bg-neutral-900/80 border-white/10 hover:border-white/20'
                }`}
              >
                {/* Match Header Info */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/5 text-xs text-neutral-400">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{match.round_name}</span>
                    {match.venue_name && (
                      <span className="flex items-center gap-1 text-neutral-300 bg-white/5 px-2 py-0.5 rounded-full">
                        <MapPin className="w-3 h-3 text-neutral-400" />
                        {match.venue_name} {match.court_field ? `(${match.court_field})` : ''}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {match.scheduled_at && (
                      <span className="flex items-center gap-1 font-mono text-[11px]">
                        <Clock className="w-3 h-3 text-neutral-400" />
                        {new Date(match.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}

                    {/* Status Pill */}
                    {isLive && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center gap-1 animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> LIVE
                      </span>
                    )}
                    {isCompleted && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                        FINAL
                      </span>
                    )}
                    {!isLive && !isCompleted && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white/5 text-neutral-400">
                        Scheduled
                      </span>
                    )}
                  </div>
                </div>

                {/* Match Center: Competitors & Big Touch Score Display */}
                <div className="grid grid-cols-7 items-center gap-2 py-6">
                  {/* Home Participant */}
                  <div className="col-span-3 text-center sm:text-right pr-2">
                    <h3 className="text-base sm:text-lg font-bold text-white truncate">
                      {match.home_participant.name}
                    </h3>
                    {match.home_participant.short_code && (
                      <span className="text-[11px] font-mono text-neutral-400 uppercase">
                        [{match.home_participant.short_code}]
                      </span>
                    )}
                  </div>

                  {/* Center Score Board with Touch Buttons */}
                  <div className="col-span-1 flex flex-col items-center justify-center">
                    <div className="flex items-center gap-2 sm:gap-3 bg-neutral-950/90 px-3 py-2 rounded-2xl border border-white/10 shadow-inner">
                      <span className="text-2xl sm:text-3xl font-mono font-black text-white min-w-[28px] text-center">
                        {scores.home}
                      </span>
                      <span className="text-sm font-bold text-neutral-500">-</span>
                      <span className="text-2xl sm:text-3xl font-mono font-black text-white min-w-[28px] text-center">
                        {scores.away}
                      </span>
                    </div>
                  </div>

                  {/* Away Participant */}
                  <div className="col-span-3 text-center sm:text-left pl-2">
                    <h3 className="text-base sm:text-lg font-bold text-white truncate">
                      {match.away_participant.name}
                    </h3>
                    {match.away_participant.short_code && (
                      <span className="text-[11px] font-mono text-neutral-400 uppercase">
                        [{match.away_participant.short_code}]
                      </span>
                    )}
                  </div>
                </div>

                {/* Operator Touch Controls (Mobile-First Tap Targets) */}
                {operatorRole !== 'viewer' && (
                  <div className="pt-4 border-t border-white/5 flex flex-wrap items-center justify-between gap-3">
                    {/* Live Score Increment / Decrement Buttons */}
                    {isLive && (
                      <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
                        {/* Home Controls */}
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => adjustScore(match.id, 'home', -1)}
                            className="w-10 h-10 rounded-xl bg-neutral-800 hover:bg-neutral-700 active:scale-95 text-white flex items-center justify-center font-bold text-base transition-transform cursor-pointer border border-white/5"
                            aria-label="Decrease home score"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => adjustScore(match.id, 'home', 1)}
                            className="w-10 h-10 rounded-xl bg-violet-600 hover:bg-violet-500 active:scale-95 text-white flex items-center justify-center font-bold text-base transition-transform cursor-pointer shadow-lg shadow-violet-600/30"
                            aria-label="Increase home score"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <span className="text-xs text-neutral-400 ml-1 font-semibold truncate max-w-[80px]">
                            {match.home_participant.name}
                          </span>
                        </div>

                        <div className="h-6 w-px bg-white/10 hidden sm:block" />

                        {/* Away Controls */}
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => adjustScore(match.id, 'away', -1)}
                            className="w-10 h-10 rounded-xl bg-neutral-800 hover:bg-neutral-700 active:scale-95 text-white flex items-center justify-center font-bold text-base transition-transform cursor-pointer border border-white/5"
                            aria-label="Decrease away score"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => adjustScore(match.id, 'away', 1)}
                            className="w-10 h-10 rounded-xl bg-violet-600 hover:bg-violet-500 active:scale-95 text-white flex items-center justify-center font-bold text-base transition-transform cursor-pointer shadow-lg shadow-violet-600/30"
                            aria-label="Increase away score"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <span className="text-xs text-neutral-400 ml-1 font-semibold truncate max-w-[80px]">
                            {match.away_participant.name}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Next Action Operators */}
                    <div className="flex items-center gap-2 ml-auto w-full sm:w-auto justify-end">
                      {!isLive && !isCompleted && (
                        <button
                          type="button"
                          onClick={() => void handleStartMatch(match)}
                          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-600/30 flex items-center gap-2 cursor-pointer w-full sm:w-auto justify-center"
                        >
                          <Play className="w-4 h-4 fill-white" /> Start Match
                        </button>
                      )}

                      {isLive && (
                        <>
                          <button
                            type="button"
                            onClick={() => void handleUpdateLiveScore(match)}
                            className="px-3 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold transition-all border border-white/10 flex items-center gap-1.5 cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5 text-neutral-300" /> Save Score
                          </button>

                          <button
                            type="button"
                            onClick={() => setConfirmModalMatch(match)}
                            className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 active:scale-95 text-white text-xs font-bold transition-all shadow-lg shadow-violet-600/30 flex items-center gap-1.5 cursor-pointer"
                          >
                            <CheckCircle className="w-4 h-4" /> Finalize Result
                          </button>
                        </>
                      )}

                      {isCompleted && (
                        <button
                          type="button"
                          onClick={() => setConfirmModalMatch(match)}
                          className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium transition-colors cursor-pointer"
                        >
                          Edit Result
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Result Finalization Confirmation Modal */}
      {confirmModalMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="bg-neutral-900 border border-white/15 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-violet-600/20 border border-violet-500/30 text-violet-400">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Confirm Official Result</h3>
                <p className="text-xs text-neutral-400">Consequential change confirmation</p>
              </div>
            </div>

            {/* Score Summary Box */}
            <div className="p-4 rounded-xl bg-neutral-950/80 border border-white/10 text-center space-y-2">
              <div className="text-xs text-neutral-400 font-medium">Final Score Submission</div>
              <div className="flex items-center justify-center gap-4 text-lg font-bold text-white">
                <span className="truncate max-w-[120px]">{confirmModalMatch.home_participant.name}</span>
                <span className="px-3 py-1 rounded-lg bg-violet-950/80 border border-violet-500/30 font-mono text-xl text-violet-300">
                  {liveScores[confirmModalMatch.id]?.home ?? 0} :{' '}
                  {liveScores[confirmModalMatch.id]?.away ?? 0}
                </span>
                <span className="truncate max-w-[120px]">{confirmModalMatch.away_participant.name}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Finalizing will officially record this result in the audit log, update standings or tournament
                brackets, and send live notifications to participants.
              </span>
            </div>

            {/* Reason input for audit trail */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300">
                Audit Note / Reason <span className="text-neutral-500">(Optional)</span>
              </label>
              <input
                type="text"
                value={finalizeReason}
                onChange={(e) => setFinalizeReason(e.target.value)}
                placeholder="e.g. Official full-time whistle, regular match play"
                className="w-full bg-neutral-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-violet-500"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setConfirmModalMatch(null)}
                disabled={submittingResult}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmFinalize()}
                disabled={submittingResult}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-500 active:scale-95 text-white shadow-lg shadow-violet-600/30 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {submittingResult ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Finalizing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-3.5 h-3.5" /> Confirm & Post Result
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
