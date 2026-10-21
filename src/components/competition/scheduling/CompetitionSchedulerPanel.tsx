'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  Save,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Layers,
  XCircle,
  Building,
} from 'lucide-react';
import { CompetitionSchedulingService } from '@/lib/competition/scheduling/service';
import {
  CompetitionVenue,
  Leaderboard,
  LeaderboardMember,
  ParticipantBlackout,
  ScheduleConflictExplanation,
  SchedulePreviewResult,
} from '@/types';

interface CompetitionSchedulerPanelProps {
  leaderboard: Leaderboard;
  engine: 'league_table' | 'tournament';
  members: LeaderboardMember[];
  onScheduleCommitted?: () => void;
}

const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Asia/Dubai',
  'Africa/Lagos',
  'Africa/Johannesburg',
  'Australia/Sydney',
];

const DAYS_OF_WEEK = [
  { day: 1, label: 'Mon' },
  { day: 2, label: 'Tue' },
  { day: 3, label: 'Wed' },
  { day: 4, label: 'Thu' },
  { day: 5, label: 'Fri' },
  { day: 6, label: 'Sat' },
  { day: 0, label: 'Sun' },
];

export function CompetitionSchedulerPanel({
  leaderboard,
  engine,
  members,
  onScheduleCommitted,
}: CompetitionSchedulerPanelProps) {
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Venues state
  const [venues, setVenues] = useState<CompetitionVenue[]>([]);
  const [newVenueName, setNewVenueName] = useState('');
  const [newVenueCourt, setNewVenueCourt] = useState('');
  const [newVenueLocation, setNewVenueLocation] = useState('');
  const [newVenueCapacity, setNewVenueCapacity] = useState<string>('');
  const [addingVenue, setAddingVenue] = useState(false);

  // Config state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [playableDays, setPlayableDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 0]);
  const [dailyStartTime, setDailyStartTime] = useState('09:00');
  const [dailyEndTime, setDailyEndTime] = useState('18:00');
  const [matchDuration, setMatchDuration] = useState(60);
  const [bufferMinutes, setBufferMinutes] = useState(15);
  const [restIntervalMinutes, setRestIntervalMinutes] = useState(120);
  const [blackouts, setBlackouts] = useState<ParticipantBlackout[]>([]);
  const [doubleRoundRobin, setDoubleRoundRobin] = useState(false);

  // Blackout form state
  const [blackoutMemberId, setBlackoutMemberId] = useState('');
  const [blackoutStart, setBlackoutStart] = useState('');
  const [blackoutEnd, setBlackoutEnd] = useState('');
  const [blackoutReason, setBlackoutReason] = useState('');

  // Preview state
  const [previewResult, setPreviewResult] = useState<SchedulePreviewResult | null>(null);

  // Reschedule dialog state
  const [rescheduleTarget, setRescheduleTarget] = useState<{
    id: string;
    title: string;
    currentStart: string | null;
    currentEnd: string | null;
    currentVenueId: string | null;
    currentVenueName: string | null;
    currentCourt: string | null;
  } | null>(null);
  const [rescheduleStart, setRescheduleStart] = useState('');
  const [rescheduleEnd, setRescheduleEnd] = useState('');
  const [rescheduleVenueId, setRescheduleVenueId] = useState('');
  const [rescheduleConflicts, setRescheduleConflicts] = useState<ScheduleConflictExplanation[]>([]);
  const [rescheduling, setRescheduling] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [fetchedVenues, fetchedConfig] = await Promise.all([
        CompetitionSchedulingService.getVenues(leaderboard.id),
        CompetitionSchedulingService.getScheduleConfig(leaderboard.id),
      ]);

      setVenues(fetchedVenues);

      if (fetchedConfig) {
        setStartDate(fetchedConfig.start_date);
        setEndDate(fetchedConfig.end_date);
        setTimezone(fetchedConfig.timezone || 'UTC');
        setPlayableDays(fetchedConfig.playable_days || [1, 2, 3, 4, 5, 6, 0]);
        setDailyStartTime(fetchedConfig.daily_start_time || '09:00');
        setDailyEndTime(fetchedConfig.daily_end_time || '18:00');
        setMatchDuration(fetchedConfig.match_duration_minutes || 60);
        setBufferMinutes(fetchedConfig.buffer_minutes || 15);
        setRestIntervalMinutes(fetchedConfig.rest_interval_minutes || 120);
        setBlackouts(fetchedConfig.participant_availability || []);
      } else {
        // Defaults based on current date
        const today = new Date();
        const nextMonth = new Date(today);
        nextMonth.setDate(today.getDate() + 30);

        setStartDate(today.toISOString().slice(0, 10));
        setEndDate(nextMonth.toISOString().slice(0, 10));
        try {
          const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
          if (detectedTz) setTimezone(detectedTz);
        } catch {
          setTimezone('UTC');
        }
      }
    } catch (err) {
      console.error('Failed to load scheduling data:', err);
      showToast(err instanceof Error ? err.message : 'Failed to load scheduling settings', 'error');
    } finally {
      setLoading(false);
    }
  }, [leaderboard.id]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadData();
    });
  }, [loadData]);

  // Venue actions
  const handleAddVenue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVenueName.trim()) return;

    setAddingVenue(true);
    try {
      const created = await CompetitionSchedulingService.createVenue({
        leaderboardId: leaderboard.id,
        name: newVenueName.trim(),
        courtField: newVenueCourt.trim() || null,
        location: newVenueLocation.trim() || null,
        capacity: newVenueCapacity ? parseInt(newVenueCapacity, 10) : null,
      });

      setVenues((prev) => [...prev, created]);
      setNewVenueName('');
      setNewVenueCourt('');
      setNewVenueLocation('');
      setNewVenueCapacity('');
      showToast(`Venue "${created.name}" added successfully`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to add venue', 'error');
    } finally {
      setAddingVenue(false);
    }
  };

  const handleDeleteVenue = async (id: string, name: string) => {
    try {
      await CompetitionSchedulingService.deleteVenue(id);
      setVenues((prev) => prev.filter((v) => v.id !== id));
      showToast(`Venue "${name}" removed`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to remove venue', 'error');
    }
  };

  // Blackout actions
  const handleAddBlackout = (e: React.FormEvent) => {
    e.preventDefault();
    if (!blackoutMemberId || !blackoutStart || !blackoutEnd) {
      showToast('Please select a participant and date range for the blackout window', 'error');
      return;
    }

    const newBlackout: ParticipantBlackout = {
      member_id: blackoutMemberId,
      start_date: new Date(blackoutStart).toISOString(),
      end_date: new Date(blackoutEnd).toISOString(),
      reason: blackoutReason.trim() || 'Scheduled unavailability',
    };

    setBlackouts((prev) => [...prev, newBlackout]);
    setBlackoutMemberId('');
    setBlackoutStart('');
    setBlackoutEnd('');
    setBlackoutReason('');
  };

  const handleRemoveBlackout = (index: number) => {
    setBlackouts((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Save config
  const handleSaveConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!startDate || !endDate) {
      showToast('Please enter valid start and end dates', 'error');
      return;
    }

    setSavingConfig(true);
    try {
      await CompetitionSchedulingService.saveScheduleConfig({
        leaderboard_id: leaderboard.id,
        start_date: startDate,
        end_date: endDate,
        timezone,
        playable_days: playableDays,
        daily_start_time: dailyStartTime,
        daily_end_time: dailyEndTime,
        match_duration_minutes: matchDuration,
        buffer_minutes: bufferMinutes,
        rest_interval_minutes: restIntervalMinutes,
        participant_availability: blackouts,
        auto_assign_venues: true,
      });

      showToast('Schedule settings saved successfully');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save settings', 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  // Preview schedule
  const handleGeneratePreview = async () => {
    setPreviewing(true);
    setPreviewResult(null);

    try {
      // Auto-save configuration first
      await CompetitionSchedulingService.saveScheduleConfig({
        leaderboard_id: leaderboard.id,
        start_date: startDate,
        end_date: endDate,
        timezone,
        playable_days: playableDays,
        daily_start_time: dailyStartTime,
        daily_end_time: dailyEndTime,
        match_duration_minutes: matchDuration,
        buffer_minutes: bufferMinutes,
        rest_interval_minutes: restIntervalMinutes,
        participant_availability: blackouts,
        auto_assign_venues: true,
      });

      let result: SchedulePreviewResult;
      if (engine === 'league_table') {
        result = await CompetitionSchedulingService.previewLeagueSchedule(leaderboard.id, {
          doubleRoundRobin,
        });
      } else {
        result = await CompetitionSchedulingService.previewTournamentSchedule(leaderboard.id);
      }

      setPreviewResult(result);
      if (result.has_conflicts) {
        showToast(`Schedule generated with ${result.conflicts.length} conflict(s). Review explanations below.`, 'error');
      } else {
        showToast(`Schedule preview generated: ${result.scheduled_items.length} match(es) ready to commit!`);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to generate schedule preview', 'error');
    } finally {
      setPreviewing(false);
    }
  };

  // Commit schedule
  const handleCommitSchedule = async () => {
    if (!previewResult) return;
    setCommitting(true);

    try {
      if (engine === 'league_table') {
        await CompetitionSchedulingService.commitLeagueSchedule(leaderboard.id, previewResult);
      } else {
        await CompetitionSchedulingService.commitTournamentSchedule(leaderboard.id, previewResult);
      }

      showToast('Schedule successfully committed! Fixtures and calendar updated.');
      setPreviewResult(null);
      if (onScheduleCommitted) {
        onScheduleCommitted();
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to commit schedule', 'error');
    } finally {
      setCommitting(false);
    }
  };

  // Reschedule handler
  const handleOpenReschedule = (target: {
    id: string;
    title: string;
    currentStart: string | null;
    currentEnd: string | null;
    currentVenueId: string | null;
    currentVenueName: string | null;
    currentCourt: string | null;
  }) => {
    setRescheduleTarget(target);
    setRescheduleStart(target.currentStart ? new Date(target.currentStart).toISOString().slice(0, 16) : '');
    setRescheduleEnd(target.currentEnd ? new Date(target.currentEnd).toISOString().slice(0, 16) : '');
    setRescheduleVenueId(target.currentVenueId || '');
    setRescheduleConflicts([]);
  };

  const handleApplyReschedule = async () => {
    if (!rescheduleTarget || !rescheduleStart || !rescheduleEnd) {
      showToast('Please provide valid start and end dates/times', 'error');
      return;
    }

    setRescheduling(true);
    try {
      const selectedVenue = venues.find((v) => v.id === rescheduleVenueId);
      const startIso = new Date(rescheduleStart).toISOString();
      const endIso = new Date(rescheduleEnd).toISOString();

      if (engine === 'league_table') {
        const res = await CompetitionSchedulingService.rescheduleFixture({
          fixtureId: rescheduleTarget.id,
          scheduledAt: startIso,
          scheduledEndAt: endIso,
          venueId: selectedVenue?.id || null,
          venueName: selectedVenue?.name || null,
          courtField: selectedVenue?.court_field || null,
        });

        setRescheduleConflicts(res.conflicts);
        if (res.conflicts.length > 0) {
          showToast(`Rescheduled with conflicts: ${res.conflicts[0].reason}`, 'error');
        } else {
          showToast('Fixture rescheduled cleanly with zero conflicts.');
          setRescheduleTarget(null);
          if (onScheduleCommitted) onScheduleCommitted();
        }
      } else {
        const res = await CompetitionSchedulingService.rescheduleTournamentMatch({
          matchId: rescheduleTarget.id,
          scheduledAt: startIso,
          scheduledEndAt: endIso,
          venueId: selectedVenue?.id || null,
          venueName: selectedVenue?.name || null,
          courtField: selectedVenue?.court_field || null,
        });

        setRescheduleConflicts(res.conflicts);
        if (res.conflicts.length > 0) {
          showToast(`Rescheduled with conflicts: ${res.conflicts[0].reason}`, 'error');
        } else {
          showToast('Match rescheduled cleanly with zero conflicts.');
          setRescheduleTarget(null);
          if (onScheduleCommitted) onScheduleCommitted();
        }
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to reschedule', 'error');
    } finally {
      setRescheduling(false);
    }
  };

  const formatLocalDateTime = (isoString: string | null) => {
    if (!isoString) return 'TBD';
    try {
      const date = new Date(isoString);
      return new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        month: 'short',
        day: 'numeric',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(date);
    } catch {
      return isoString;
    }
  };

  const toggleDay = (day: number) => {
    setPlayableDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  if (loading) {
    return (
      <div className="glass rounded-2xl p-8 text-center text-sm text-neutral-400">
        Loading scheduler settings and venues...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold shadow-2xl backdrop-blur-md transition-all ${
            toast.type === 'error'
              ? 'border border-red-500/30 bg-red-950/90 text-red-200'
              : 'border border-emerald-500/30 bg-emerald-950/90 text-emerald-200'
          }`}
        >
          {toast.type === 'error' ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          {toast.message}
        </div>
      )}

      {/* Header Banner */}
      <div className="glass rounded-2xl border border-white/5 p-6 shadow-xl">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-violet-400">
              <Calendar className="h-4 w-4" /> Automated Competition Scheduler
            </div>
            <h2 className="mt-1 text-xl font-bold text-white">
              {engine === 'league_table' ? 'League Fixture Scheduler' : 'Tournament Match Scheduler'}
            </h2>
            <p className="mt-1 text-xs text-neutral-400">
              Configure playable days, time windows, venues, turnaround rest, and blackout constraints to generate a collision-free calendar.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => void handleGeneratePreview()}
              disabled={previewing || savingConfig}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-violet-600/25 transition hover:bg-violet-500 disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              {previewing ? 'Evaluating Constraints...' : 'Generate Schedule Preview'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Left Column: Schedule Rules & Time Windows */}
        <div className="space-y-6">
          <form onSubmit={handleSaveConfig} className="glass rounded-2xl border border-white/5 p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <Clock className="h-4 w-4 text-violet-400" /> Date Range & Time Windows
              </div>
              <button
                type="submit"
                disabled={savingConfig}
                className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-neutral-200 transition hover:border-neutral-500 hover:text-white disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" /> {savingConfig ? 'Saving...' : 'Save Settings'}
              </button>
            </div>

            {/* Date Range */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-neutral-300">Competition Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-2 text-xs text-white focus:border-violet-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-neutral-300">Competition End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-2 text-xs text-white focus:border-violet-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            {/* Timezone */}
            <div>
              <label className="text-xs font-semibold text-neutral-300">Competition Timezone</label>
              <div className="mt-1.5 flex gap-2">
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-2 text-xs text-white focus:border-violet-500 focus:outline-none"
                >
                  {COMMON_TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Or enter custom timezone"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="hidden w-1/2 rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-2 text-xs text-white sm:block"
                />
              </div>
            </div>

            {/* Playable Days of the Week */}
            <div>
              <label className="text-xs font-semibold text-neutral-300">Playable Days</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map(({ day, label }) => {
                  const active = playableDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        active
                          ? 'bg-violet-600 text-white'
                          : 'border border-neutral-800 bg-neutral-950/50 text-neutral-400 hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Daily Hours Window */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-neutral-300">Daily Window Start</label>
                <input
                  type="time"
                  value={dailyStartTime}
                  onChange={(e) => setDailyStartTime(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-2 text-xs text-white focus:border-violet-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-neutral-300">Daily Window End</label>
                <input
                  type="time"
                  value={dailyEndTime}
                  onChange={(e) => setDailyEndTime(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-2 text-xs text-white focus:border-violet-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Durations & Buffers */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="text-xs font-semibold text-neutral-300">Match Duration (min)</label>
                <input
                  type="number"
                  min={15}
                  step={5}
                  value={matchDuration}
                  onChange={(e) => setMatchDuration(parseInt(e.target.value, 10) || 60)}
                  className="mt-1.5 w-full rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-neutral-300">Venue Buffer (min)</label>
                <input
                  type="number"
                  min={0}
                  step={5}
                  value={bufferMinutes}
                  onChange={(e) => setBufferMinutes(parseInt(e.target.value, 10) || 15)}
                  className="mt-1.5 w-full rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-neutral-300">Participant Rest (min)</label>
                <input
                  type="number"
                  min={0}
                  step={15}
                  value={restIntervalMinutes}
                  onChange={(e) => setRestIntervalMinutes(parseInt(e.target.value, 10) || 120)}
                  className="mt-1.5 w-full rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            {engine === 'league_table' && (
              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="double-round-robin"
                  checked={doubleRoundRobin}
                  onChange={(e) => setDoubleRoundRobin(e.target.checked)}
                  className="h-4 w-4 rounded border-neutral-800 bg-neutral-900 text-violet-600 focus:ring-0"
                />
                <label htmlFor="double-round-robin" className="text-xs font-medium text-neutral-300">
                  Double Round-Robin (home & away legs for each pair)
                </label>
              </div>
            )}
          </form>

          {/* Participant Availability / Blackout Constraints */}
          <div className="glass rounded-2xl border border-white/5 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <XCircle className="h-4 w-4 text-amber-400" /> Participant Availability & Blackouts
              </div>
              <span className="text-[11px] text-neutral-500">{blackouts.length} blackout(s)</span>
            </div>

            <form onSubmit={handleAddBlackout} className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <select
                  value={blackoutMemberId}
                  onChange={(e) => setBlackoutMemberId(e.target.value)}
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-2 text-xs text-white"
                >
                  <option value="">Select participant or team...</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} {m.team ? `(${m.team})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] text-neutral-400">Unavailable From</label>
                <input
                  type="datetime-local"
                  value={blackoutStart}
                  onChange={(e) => setBlackoutStart(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-950/70 px-2.5 py-1.5 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[11px] text-neutral-400">Unavailable To</label>
                <input
                  type="datetime-local"
                  value={blackoutEnd}
                  onChange={(e) => setBlackoutEnd(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-950/70 px-2.5 py-1.5 text-xs text-white"
                />
              </div>

              <div className="sm:col-span-2 flex gap-2">
                <input
                  type="text"
                  placeholder="Reason (e.g. Travel, Exams, Medical)"
                  value={blackoutReason}
                  onChange={(e) => setBlackoutReason(e.target.value)}
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-2 text-xs text-white"
                />
                <button
                  type="submit"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-neutral-800 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-700"
                >
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              </div>
            </form>

            {blackouts.length > 0 && (
              <div className="space-y-2 pt-2">
                {blackouts.map((b, idx) => {
                  const memberName = members.find((m) => m.id === b.member_id)?.name || 'Participant';
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-xl border border-white/5 bg-black/30 px-3 py-2 text-xs"
                    >
                      <div>
                        <div className="font-semibold text-white">{memberName}</div>
                        <div className="text-[11px] text-neutral-400">
                          {new Date(b.start_date).toLocaleDateString()} - {new Date(b.end_date).toLocaleDateString()} ({b.reason || 'Blackout'})
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveBlackout(idx)}
                        className="text-neutral-500 transition hover:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Venue Entity Management */}
        <div className="space-y-6">
          <div className="glass rounded-2xl border border-white/5 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <Building className="h-4 w-4 text-emerald-400" /> Venues, Courts & Pitches
              </div>
              <span className="text-[11px] text-neutral-500">{venues.length} active venue(s)</span>
            </div>

            <p className="text-xs text-neutral-400">
              Matches will be assigned across these venues during playable hours. Multiple venues allow concurrent match scheduling without overlap.
            </p>

            <form onSubmit={handleAddVenue} className="space-y-3 rounded-xl border border-white/5 bg-black/20 p-4">
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  type="text"
                  placeholder="Venue name (e.g. Center Arena)"
                  value={newVenueName}
                  onChange={(e) => setNewVenueName(e.target.value)}
                  className="rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-2 text-xs text-white"
                  required
                />
                <input
                  type="text"
                  placeholder="Court/Pitch (e.g. Court 1)"
                  value={newVenueCourt}
                  onChange={(e) => setNewVenueCourt(e.target.value)}
                  className="rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  type="text"
                  placeholder="Location or address (optional)"
                  value={newVenueLocation}
                  onChange={(e) => setNewVenueLocation(e.target.value)}
                  className="rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-2 text-xs text-white"
                />
                <input
                  type="number"
                  placeholder="Capacity (optional)"
                  value={newVenueCapacity}
                  onChange={(e) => setNewVenueCapacity(e.target.value)}
                  className="rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-2 text-xs text-white"
                />
              </div>

              <button
                type="submit"
                disabled={addingVenue || !newVenueName.trim()}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" /> {addingVenue ? 'Adding...' : 'Add Venue'}
              </button>
            </form>

            <div className="space-y-2 pt-2">
              {venues.length === 0 ? (
                <div className="rounded-xl border border-dashed border-neutral-800 p-4 text-center text-xs text-neutral-500">
                  No venues added yet. A virtual default court will be used for slot generation.
                </div>
              ) : (
                venues.map((venue) => (
                  <div
                    key={venue.id}
                    className="flex items-center justify-between rounded-xl border border-white/5 bg-black/30 p-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2 font-semibold text-white">
                        <span>{venue.name}</span>
                        {venue.court_field && (
                          <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-400">
                            {venue.court_field}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-[11px] text-neutral-400">
                        {venue.location || 'No location specified'}{' '}
                        {venue.capacity ? `• Cap: ${venue.capacity.toLocaleString()}` : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDeleteVenue(venue.id, venue.name)}
                      className="text-neutral-500 transition hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Preview & Commitment Section */}
      {previewResult && (
        <div className="glass rounded-2xl border border-violet-500/20 bg-neutral-950/60 p-6 shadow-2xl space-y-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-violet-400">
                <Layers className="h-4 w-4" /> Deterministic Schedule Preview
              </div>
              <h3 className="mt-1 text-lg font-bold text-white">Review Before Committing</h3>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPreviewResult(null)}
                className="rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs font-semibold text-neutral-300 hover:text-white"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => void handleCommitSchedule()}
                disabled={committing || !previewResult.can_commit}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-500 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                {committing ? 'Committing Fixtures...' : 'Commit Schedule to Live Calendar'}
              </button>
            </div>
          </div>

          {/* Metrics summary */}
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-white/5 bg-black/30 p-3">
              <div className="text-[10px] uppercase text-neutral-500">Total Matches</div>
              <div className="mt-1 text-xl font-bold text-white">{previewResult.total_items}</div>
            </div>
            <div className="rounded-xl border border-white/5 bg-black/30 p-3">
              <div className="text-[10px] uppercase text-emerald-400">Scheduled Slots</div>
              <div className="mt-1 text-xl font-bold text-emerald-300">{previewResult.scheduled_items.length}</div>
            </div>
            <div className="rounded-xl border border-white/5 bg-black/30 p-3">
              <div className="text-[10px] uppercase text-amber-400">Unscheduled / BYE</div>
              <div className="mt-1 text-xl font-bold text-amber-300">{previewResult.unscheduled_items.length}</div>
            </div>
            <div className="rounded-xl border border-white/5 bg-black/30 p-3">
              <div className="text-[10px] uppercase text-red-400">Conflicts Detected</div>
              <div className="mt-1 text-xl font-bold text-red-300">{previewResult.conflicts.length}</div>
            </div>
          </div>

          {/* Conflicts banner */}
          {previewResult.conflicts.length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-950/30 p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                <AlertTriangle className="h-4 w-4" /> Unscheduled Fixture Explanations & Constraints
              </div>
              <div className="space-y-1.5 text-xs text-neutral-300">
                {previewResult.conflicts.map((c, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold">•</span>
                    <span>
                      <strong className="text-white">{c.round_name}: {c.home_name} vs {c.away_name}</strong> — {c.reason}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Proposed slots table */}
          <div className="overflow-x-auto rounded-xl border border-white/5 bg-black/25">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-neutral-950/70 text-neutral-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Round</th>
                  <th className="px-4 py-3">Fixture / Match</th>
                  <th className="px-4 py-3">Scheduled Time</th>
                  <th className="px-4 py-3">Venue / Court</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-neutral-300">
                {previewResult.scheduled_items.map((slot, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-semibold text-white">{slot.round_name}</td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-white">{slot.home_name}</span> vs{' '}
                      <span className="font-semibold text-white">{slot.away_name}</span>
                    </td>
                    <td className="px-4 py-3 text-neutral-300">
                      {formatLocalDateTime(slot.scheduled_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{slot.venue_name || 'Assigned Court'}</div>
                      {slot.court_field && <div className="text-[10px] text-neutral-500">{slot.court_field}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                        {slot.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          handleOpenReschedule({
                            id: slot.entity_id,
                            title: `${slot.home_name} vs ${slot.away_name}`,
                            currentStart: slot.scheduled_at,
                            currentEnd: slot.scheduled_end_at,
                            currentVenueId: slot.venue_id,
                            currentVenueName: slot.venue_name,
                            currentCourt: slot.court_field,
                          })
                        }
                        className="rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-1 text-[11px] font-medium text-neutral-300 hover:text-white hover:border-violet-500/50"
                      >
                        Reschedule
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-neutral-950 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div>
                <div className="text-xs font-bold uppercase text-violet-400">Reschedule Match</div>
                <h3 className="mt-0.5 text-base font-bold text-white">{rescheduleTarget.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setRescheduleTarget(null)}
                className="text-neutral-500 hover:text-white"
              >
                ✕
              </button>
            </div>

            {rescheduleConflicts.length > 0 && (
              <div className="rounded-xl border border-red-500/30 bg-red-950/40 p-3 text-xs text-red-300 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-red-400">
                  <AlertCircle className="h-4 w-4" /> Detected Conflicts:
                </div>
                {rescheduleConflicts.map((c, i) => (
                  <div key={i}>• {c.reason}</div>
                ))}
              </div>
            )}

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-neutral-300">New Start Date & Time</label>
                <input
                  type="datetime-local"
                  value={rescheduleStart}
                  onChange={(e) => setRescheduleStart(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-white"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-neutral-300">New End Date & Time</label>
                <input
                  type="datetime-local"
                  value={rescheduleEnd}
                  onChange={(e) => setRescheduleEnd(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-white"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-neutral-300">Select Venue</label>
                <select
                  value={rescheduleVenueId}
                  onChange={(e) => setRescheduleVenueId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-white"
                >
                  <option value="">Choose venue...</option>
                  {venues.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} {v.court_field ? `(${v.court_field})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRescheduleTarget(null)}
                className="rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-2 text-xs font-semibold text-neutral-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleApplyReschedule()}
                disabled={rescheduling || !rescheduleStart || !rescheduleEnd}
                className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-violet-600/25 hover:bg-violet-500 disabled:opacity-50"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {rescheduling ? 'Checking Conflicts...' : 'Validate & Reschedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
