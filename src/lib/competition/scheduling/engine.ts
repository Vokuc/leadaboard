import {
  CompetitionScheduleConfig,
  CompetitionVenue,
  LeaderboardMember,
  ParticipantBlackout,
  ScheduleConflictExplanation,
  ScheduledSlotProposal,
  SchedulePreviewResult,
} from '@/types';

export interface SchedulerInputMatch {
  id: string;
  entityType: 'fixture' | 'tournament_match';
  homeMemberId: string | null;
  awayMemberId: string | null;
  roundName: string;
  roundIndex: number;
  matchIndex?: number;
  isCompleted?: boolean;
  scheduledAt?: string | null;
  scheduledEndAt?: string | null;
  venueId?: string | null;
  venueName?: string | null;
  courtField?: string | null;
}

export interface TimeSlot {
  startIso: string;
  endIso: string;
  venueId: string | null;
  venueName: string | null;
  courtField: string | null;
}

/**
 * Generate standard Berger (cyclic) round-robin pairings for participants.
 * Handles both even and odd participant counts (using a BYE slot).
 */
export function generateRoundRobinPairings(
  memberIds: string[],
  options?: { doubleRoundRobin?: boolean }
): Array<{
  roundIndex: number;
  roundName: string;
  homeMemberId: string;
  awayMemberId: string;
  isBye: boolean;
}> {
  if (memberIds.length < 2) {
    return [];
  }

  const isOdd = memberIds.length % 2 !== 0;
  // If odd, append a dummy BYE token
  const rotation: Array<string | null> = [...memberIds];
  if (isOdd) {
    rotation.push(null);
  }

  const n = rotation.length;
  const totalRounds = n - 1;
  const matchesPerRound = n / 2;
  const singleLegPairings: Array<{
    roundIndex: number;
    roundName: string;
    homeMemberId: string;
    awayMemberId: string;
    isBye: boolean;
  }> = [];

  for (let r = 0; r < totalRounds; r += 1) {
    const roundNumber = r + 1;
    const roundName = `Round ${roundNumber}`;

    for (let m = 0; m < matchesPerRound; m += 1) {
      const home = rotation[m];
      const away = rotation[n - 1 - m];

      // Alternate home/away for the fixed 0th element to balance home/away games
      const swap = m === 0 && r % 2 === 1;
      const actualHome = swap ? away : home;
      const actualAway = swap ? home : away;

      if (!actualHome || !actualAway) {
        // BYE fixture
        const playingMember = actualHome || actualAway;
        if (playingMember) {
          singleLegPairings.push({
            roundIndex: roundNumber,
            roundName,
            homeMemberId: playingMember,
            awayMemberId: 'BYE',
            isBye: true,
          });
        }
      } else {
        singleLegPairings.push({
          roundIndex: roundNumber,
          roundName,
          homeMemberId: actualHome,
          awayMemberId: actualAway,
          isBye: false,
        });
      }
    }

    // Rotate elements 1 to n-1 clockwise
    const fixed = rotation[0];
    const last = rotation[n - 1];
    const rotatedRest = [last, ...rotation.slice(1, n - 1)];
    rotation.splice(0, rotation.length, fixed, ...rotatedRest);
  }

  if (!options?.doubleRoundRobin) {
    return singleLegPairings;
  }

  // Second half with reversed fixtures
  const doubleLegPairings = [...singleLegPairings];
  for (const pairing of singleLegPairings) {
    const reverseRoundIndex = pairing.roundIndex + totalRounds;
    doubleLegPairings.push({
      roundIndex: reverseRoundIndex,
      roundName: `Round ${reverseRoundIndex}`,
      homeMemberId: pairing.awayMemberId,
      awayMemberId: pairing.homeMemberId,
      isBye: pairing.isBye,
    });
  }

  return doubleLegPairings;
}

/**
 * Parses "HH:mm" time string into minutes from midnight.
 */
export function timeStringToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map((val) => parseInt(val, 10) || 0);
  return h * 60 + m;
}

/**
 * Formats minutes from midnight to "HH:mm" string.
 */
export function minutesToTimeString(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Construct an ISO timestamp given a local YYYY-MM-DD date, HH:mm time, and timezone.
 */
export function createIsoTimestamp(dateStr: string, timeStr: string, timezone: string): string {
  // Try to use Intl / Date to resolve local time in specified timezone
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hours, minutes] = timeStr.split(':').map(Number);

    // Approximate UTC anchor
    const utcGuess = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));

    // Get time in target timezone for this UTC point
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(utcGuess);
    const getPart = (type: string) => {
      const found = parts.find((p) => p.type === type);
      return found ? parseInt(found.value, 10) : 0;
    };

    const targetYear = getPart('year');
    const targetMonth = getPart('month');
    const targetDay = getPart('day');
    let targetHour = getPart('hour');
    if (targetHour === 24) targetHour = 0;
    const targetMinute = getPart('minute');

    const targetTimeInUtc = Date.UTC(targetYear, targetMonth - 1, targetDay, targetHour, targetMinute, 0);
    const offsetMs = targetTimeInUtc - utcGuess.getTime();

    // The actual UTC time matching local time is utcGuess - offsetMs
    const actualUtc = new Date(utcGuess.getTime() - offsetMs);
    return actualUtc.toISOString();
  } catch {
    // Fallback to UTC if timezone is invalid
    return new Date(`${dateStr}T${timeStr}:00.000Z`).toISOString();
  }
}

/**
 * Generate all available discrete time slots across the competition period and venues.
 */
export function generatePlayableSlots(
  config: CompetitionScheduleConfig,
  venues: CompetitionVenue[]
): TimeSlot[] {
  const activeVenues = venues.filter((v) => v.is_active);
  const effectiveVenues: Array<{ id: string | null; name: string | null; courtField: string | null }> =
    activeVenues.length > 0
      ? activeVenues.map((v) => ({ id: v.id, name: v.name, courtField: v.court_field || null }))
      : [{ id: null, name: 'Default Court', courtField: null }];

  const slots: TimeSlot[] = [];

  const startDate = new Date(`${config.start_date}T00:00:00Z`);
  const endDate = new Date(`${config.end_date}T23:59:59Z`);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate > endDate) {
    return [];
  }

  const startMin = timeStringToMinutes(config.daily_start_time || '09:00');
  const endMin = timeStringToMinutes(config.daily_end_time || '18:00');
  const matchDuration = Math.max(15, config.match_duration_minutes || 60);
  const buffer = Math.max(0, config.buffer_minutes || 15);
  const step = matchDuration + buffer;

  const playableDaysSet = new Set(
    (config.playable_days || [1, 2, 3, 4, 5, 6, 0]).map((d) => (d === 7 ? 0 : d))
  );

  const curDate = new Date(startDate);
  // Cap at 365 days max to prevent infinite loops
  let daysCount = 0;

  while (curDate <= endDate && daysCount < 366) {
    const dayOfWeek = curDate.getUTCDay(); // 0 is Sunday, 1 is Monday, ...
    if (playableDaysSet.has(dayOfWeek)) {
      const year = curDate.getUTCFullYear();
      const month = String(curDate.getUTCMonth() + 1).padStart(2, '0');
      const day = String(curDate.getUTCDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      for (let curMin = startMin; curMin + matchDuration <= endMin; curMin += step) {
        const slotStartStr = minutesToTimeString(curMin);
        const slotEndStr = minutesToTimeString(curMin + matchDuration);

        const startIso = createIsoTimestamp(dateStr, slotStartStr, config.timezone);
        const endIso = createIsoTimestamp(dateStr, slotEndStr, config.timezone);

        for (const venue of effectiveVenues) {
          slots.push({
            startIso,
            endIso,
            venueId: venue.id,
            venueName: venue.name,
            courtField: venue.courtField,
          });
        }
      }
    }

    curDate.setUTCDate(curDate.getUTCDate() + 1);
    daysCount += 1;
  }

  // Sort chronologically
  slots.sort((a, b) => a.startIso.localeCompare(b.startIso));
  return slots;
}

/**
 * Check if a proposed time window overlaps with a participant's blackout periods.
 */
export function isParticipantBlackedOut(
  memberId: string | null,
  startIso: string,
  endIso: string,
  blackouts: ParticipantBlackout[]
): { blackedOut: boolean; reason?: string } {
  if (!memberId) {
    return { blackedOut: false };
  }

  const slotStart = new Date(startIso).getTime();
  const slotEnd = new Date(endIso).getTime();

  for (const blackout of blackouts) {
    if (blackout.member_id === memberId) {
      const bStart = new Date(blackout.start_date).getTime();
      const bEnd = new Date(blackout.end_date).getTime();

      if (slotStart < bEnd && slotEnd > bStart) {
        return {
          blackedOut: true,
          reason: blackout.reason || `Participant unavailable during blackout (${blackout.start_date.slice(0, 10)})`,
        };
      }
    }
  }

  return { blackedOut: false };
}

/**
 * Check if two time ranges overlap (optionally including buffer).
 */
export function rangesOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number,
  bufferMs = 0
): boolean {
  return startA < endB + bufferMs && endA + bufferMs > startB;
}

/**
 * Core Scheduling Engine:
 * Deterministically schedules a collection of matches into available time slots
 * subject to rest intervals, venue availability, and participant blackout constraints.
 */
export function scheduleMatches(
  matches: SchedulerInputMatch[],
  config: CompetitionScheduleConfig,
  venues: CompetitionVenue[],
  members: LeaderboardMember[]
): SchedulePreviewResult {
  const memberNameMap = new Map(members.map((m) => [m.id, m.name]));
  const getMemberName = (id: string | null) => (id ? memberNameMap.get(id) || 'Unknown' : 'TBD');

  const availableSlots = generatePlayableSlots(config, venues);
  const restIntervalMs = (config.rest_interval_minutes || 0) * 60 * 1000;
  const bufferMs = (config.buffer_minutes || 0) * 60 * 1000;

  // Track assignments:
  // participantId -> Array of { start: number, end: number, matchId: string }
  const participantSchedules = new Map<string, Array<{ start: number; end: number; matchId: string }>>();
  // venueKey (venueId or venueName) -> Array of { start: number, end: number, matchId: string }
  const venueSchedules = new Map<string, Array<{ start: number; end: number; matchId: string }>>();

  const registerParticipantMatch = (memberId: string | null, start: number, end: number, matchId: string) => {
    if (!memberId || memberId === 'BYE') return;
    const existing = participantSchedules.get(memberId) || [];
    existing.push({ start, end, matchId });
    participantSchedules.set(memberId, existing);
  };

  const registerVenueMatch = (venueKey: string, start: number, end: number, matchId: string) => {
    const existing = venueSchedules.get(venueKey) || [];
    existing.push({ start, end, matchId });
    venueSchedules.set(venueKey, existing);
  };

  // 1. Preserve and register already completed or live matches as immutable constraints
  const scheduledProposals: ScheduledSlotProposal[] = [];
  const unscheduledItems: SchedulePreviewResult['unscheduled_items'] = [];
  const conflicts: ScheduleConflictExplanation[] = [];

  const unassignedMatches: SchedulerInputMatch[] = [];

  for (const match of matches) {
    if (match.isCompleted && match.scheduledAt && match.scheduledEndAt) {
      const startMs = new Date(match.scheduledAt).getTime();
      const endMs = new Date(match.scheduledEndAt).getTime();
      const venueKey = match.venueId || match.venueName || 'default';

      registerParticipantMatch(match.homeMemberId, startMs, endMs, match.id);
      registerParticipantMatch(match.awayMemberId, startMs, endMs, match.id);
      registerVenueMatch(venueKey, startMs, endMs, match.id);

      scheduledProposals.push({
        entity_id: match.id,
        entity_type: match.entityType,
        home_member_id: match.homeMemberId,
        away_member_id: match.awayMemberId,
        home_name: getMemberName(match.homeMemberId),
        away_name: getMemberName(match.awayMemberId),
        round_name: match.roundName,
        round_index: match.roundIndex,
        match_index: match.matchIndex,
        scheduled_at: match.scheduledAt,
        scheduled_end_at: match.scheduledEndAt,
        venue_id: match.venueId || null,
        venue_name: match.venueName || null,
        court_field: match.courtField || null,
        timezone: config.timezone,
        status: 'scheduled',
        conflict_reason: null,
      });
    } else {
      unassignedMatches.push(match);
    }
  }

  // 2. Sort unassigned matches logically:
  // For knockout, lower round_index must be scheduled first!
  // For round robin, roundIndex first, then match order.
  unassignedMatches.sort((a, b) => {
    if (a.roundIndex !== b.roundIndex) {
      return a.roundIndex - b.roundIndex;
    }
    return (a.matchIndex ?? 0) - (b.matchIndex ?? 0);
  });

  // Track max completion time per round for knockout tournaments
  const roundMaxEndTimes = new Map<number, number>();

  // Helper to check if slot is valid for a match
  const isSlotValidForMatch = (
    match: SchedulerInputMatch,
    slot: TimeSlot
  ): { valid: boolean; reason?: string; type?: ScheduleConflictExplanation['type'] } => {
    const slotStart = new Date(slot.startIso).getTime();
    const slotEnd = new Date(slot.endIso).getTime();

    // Check knockout round prerequisite: round r must occur after round r-1
    if (match.entityType === 'tournament_match' && match.roundIndex > 1) {
      const priorRoundMaxEnd = roundMaxEndTimes.get(match.roundIndex - 1);
      if (priorRoundMaxEnd && slotStart < priorRoundMaxEnd + restIntervalMs) {
        return {
          valid: false,
          reason: `Round ${match.roundIndex} match cannot precede Round ${match.roundIndex - 1} (+ rest interval)`,
          type: 'rest_interval_violation',
        };
      }
    }

    // Check venue conflict
    const venueKey = slot.venueId || slot.venueName || 'default';
    const venueMatches = venueSchedules.get(venueKey) || [];
    for (const vm of venueMatches) {
      if (rangesOverlap(slotStart, slotEnd, vm.start, vm.end, bufferMs)) {
        return {
          valid: false,
          reason: `Venue ${slot.venueName || 'Court'} is already occupied at this time`,
          type: 'venue_overlap',
        };
      }
    }

    // Check participant blackout
    const homeBlackout = isParticipantBlackedOut(
      match.homeMemberId,
      slot.startIso,
      slot.endIso,
      config.participant_availability || []
    );
    if (homeBlackout.blackedOut) {
      return {
        valid: false,
        reason: `${getMemberName(match.homeMemberId)} is unavailable: ${homeBlackout.reason}`,
        type: 'blackout_window',
      };
    }

    const awayBlackout = isParticipantBlackedOut(
      match.awayMemberId,
      slot.startIso,
      slot.endIso,
      config.participant_availability || []
    );
    if (awayBlackout.blackedOut) {
      return {
        valid: false,
        reason: `${getMemberName(match.awayMemberId)} is unavailable: ${awayBlackout.reason}`,
        type: 'blackout_window',
      };
    }

    // Check participant match overlap & rest interval
    const checkParticipant = (memberId: string | null, name: string) => {
      if (!memberId || memberId === 'BYE') return null;
      const pMatches = participantSchedules.get(memberId) || [];
      for (const pm of pMatches) {
        // Direct overlap
        if (rangesOverlap(slotStart, slotEnd, pm.start, pm.end, 0)) {
          return {
            valid: false,
            reason: `${name} already has an overlapping match scheduled`,
            type: 'participant_overlap' as const,
          };
        }
        // Rest interval violation
        if (restIntervalMs > 0 && rangesOverlap(slotStart, slotEnd, pm.start, pm.end, restIntervalMs)) {
          return {
            valid: false,
            reason: `${name} requires at least ${config.rest_interval_minutes}m rest between matches`,
            type: 'rest_interval_violation' as const,
          };
        }
      }
      return null;
    };

    const homeConflict = checkParticipant(match.homeMemberId, getMemberName(match.homeMemberId));
    if (homeConflict) return homeConflict;

    const awayConflict = checkParticipant(match.awayMemberId, getMemberName(match.awayMemberId));
    if (awayConflict) return awayConflict;

    return { valid: true };
  };

  // 3. Assign each unassigned match to the earliest valid slot
  const slotSearchStartIndex = 0;

  for (const match of unassignedMatches) {
    // If it's a BYE match (e.g. awayMemberId is 'BYE' or null in knockout), handle accordingly
    if (match.awayMemberId === 'BYE') {
      unscheduledItems.push({
        entity_id: match.id,
        home_member_id: match.homeMemberId,
        away_member_id: null,
        home_name: getMemberName(match.homeMemberId),
        away_name: 'BYE',
        round_name: match.roundName,
        reason: 'BYE fixture (no game scheduled)',
      });
      continue;
    }

    let assignedSlot: TimeSlot | null = null;
    let lastFailureReason = 'Exceeded competition date range: no available venue time slots remain';
    let lastFailureType: ScheduleConflictExplanation['type'] = 'exceeded_range';

    // Find first compatible slot
    for (let i = slotSearchStartIndex; i < availableSlots.length; i += 1) {
      const slot = availableSlots[i];
      const check = isSlotValidForMatch(match, slot);
      if (check.valid) {
        assignedSlot = slot;
        break;
      } else {
        lastFailureReason = check.reason || lastFailureReason;
        if (check.type) lastFailureType = check.type;
      }
    }

    if (assignedSlot) {
      const startMs = new Date(assignedSlot.startIso).getTime();
      const endMs = new Date(assignedSlot.endIso).getTime();
      const venueKey = assignedSlot.venueId || assignedSlot.venueName || 'default';

      registerParticipantMatch(match.homeMemberId, startMs, endMs, match.id);
      registerParticipantMatch(match.awayMemberId, startMs, endMs, match.id);
      registerVenueMatch(venueKey, startMs, endMs, match.id);

      const curRoundMax = roundMaxEndTimes.get(match.roundIndex) || 0;
      if (endMs > curRoundMax) {
        roundMaxEndTimes.set(match.roundIndex, endMs);
      }

      scheduledProposals.push({
        entity_id: match.id,
        entity_type: match.entityType,
        home_member_id: match.homeMemberId,
        away_member_id: match.awayMemberId,
        home_name: getMemberName(match.homeMemberId),
        away_name: getMemberName(match.awayMemberId),
        round_name: match.roundName,
        round_index: match.roundIndex,
        match_index: match.matchIndex,
        scheduled_at: assignedSlot.startIso,
        scheduled_end_at: assignedSlot.endIso,
        venue_id: assignedSlot.venueId,
        venue_name: assignedSlot.venueName,
        court_field: assignedSlot.courtField,
        timezone: config.timezone,
        status: 'scheduled',
        conflict_reason: null,
      });
    } else {
      unscheduledItems.push({
        entity_id: match.id,
        home_member_id: match.homeMemberId,
        away_member_id: match.awayMemberId,
        home_name: getMemberName(match.homeMemberId),
        away_name: getMemberName(match.awayMemberId),
        round_name: match.roundName,
        reason: lastFailureReason,
      });

      conflicts.push({
        entity_id: match.id,
        home_name: getMemberName(match.homeMemberId),
        away_name: getMemberName(match.awayMemberId),
        round_name: match.roundName,
        reason: lastFailureReason,
        type: lastFailureType,
      });
    }
  }

  return {
    total_items: matches.length,
    scheduled_items: scheduledProposals,
    unscheduled_items: unscheduledItems,
    conflicts,
    has_conflicts: conflicts.length > 0,
    can_commit: scheduledProposals.length > 0,
  };
}

/**
 * Validate conflicts introduced by a manual edit or rescheduling.
 */
export function detectManualScheduleConflict(
  targetMatchId: string,
  proposedStartIso: string,
  proposedEndIso: string,
  proposedVenueId: string | null,
  proposedVenueName: string | null,
  allMatches: Array<{
    id: string;
    home_member_id: string | null;
    away_member_id: string | null;
    scheduled_at: string | null;
    scheduled_end_at?: string | null;
    venue_id?: string | null;
    venue_name?: string | null;
    scheduling_status?: string | null;
  }>,
  config: CompetitionScheduleConfig,
  members: LeaderboardMember[]
): ScheduleConflictExplanation[] {
  const memberNameMap = new Map(members.map((m) => [m.id, m.name]));
  const getMemberName = (id: string | null) => (id ? memberNameMap.get(id) || 'Unknown' : 'TBD');

  const target = allMatches.find((m) => m.id === targetMatchId);
  if (!target) return [];

  const conflicts: ScheduleConflictExplanation[] = [];
  const targetStart = new Date(proposedStartIso).getTime();
  const targetEnd = new Date(proposedEndIso).getTime();

  if (isNaN(targetStart) || isNaN(targetEnd) || targetStart >= targetEnd) {
    conflicts.push({
      entity_id: targetMatchId,
      home_name: getMemberName(target.home_member_id),
      away_name: getMemberName(target.away_member_id),
      round_name: 'Rescheduled Match',
      reason: 'Invalid start/end time: start time must be before end time.',
      type: 'manual_conflict',
    });
    return conflicts;
  }

  // Check blackout
  const homeBlackout = isParticipantBlackedOut(
    target.home_member_id,
    proposedStartIso,
    proposedEndIso,
    config.participant_availability || []
  );
  if (homeBlackout.blackedOut) {
    conflicts.push({
      entity_id: targetMatchId,
      home_name: getMemberName(target.home_member_id),
      away_name: getMemberName(target.away_member_id),
      round_name: 'Rescheduled Match',
      reason: `${getMemberName(target.home_member_id)} has a blackout constraint: ${homeBlackout.reason}`,
      type: 'blackout_window',
    });
  }

  const awayBlackout = isParticipantBlackedOut(
    target.away_member_id,
    proposedStartIso,
    proposedEndIso,
    config.participant_availability || []
  );
  if (awayBlackout.blackedOut) {
    conflicts.push({
      entity_id: targetMatchId,
      home_name: getMemberName(target.home_member_id),
      away_name: getMemberName(target.away_member_id),
      round_name: 'Rescheduled Match',
      reason: `${getMemberName(target.away_member_id)} has a blackout constraint: ${awayBlackout.reason}`,
      type: 'blackout_window',
    });
  }

  const bufferMs = (config.buffer_minutes || 0) * 60 * 1000;
  const restIntervalMs = (config.rest_interval_minutes || 0) * 60 * 1000;

  for (const other of allMatches) {
    if (other.id === targetMatchId) continue;
    if (other.scheduling_status === 'cancelled') continue;
    if (!other.scheduled_at || !other.scheduled_end_at) continue;

    const otherStart = new Date(other.scheduled_at).getTime();
    const otherEnd = new Date(other.scheduled_end_at).getTime();

    // 1. Venue conflict
    const sameVenue =
      (proposedVenueId && other.venue_id && proposedVenueId === other.venue_id) ||
      (proposedVenueName && other.venue_name && proposedVenueName.toLowerCase() === other.venue_name.toLowerCase());

    if (sameVenue && rangesOverlap(targetStart, targetEnd, otherStart, otherEnd, bufferMs)) {
      conflicts.push({
        entity_id: targetMatchId,
        home_name: getMemberName(target.home_member_id),
        away_name: getMemberName(target.away_member_id),
        round_name: 'Rescheduled Match',
        reason: `Venue conflict with match between ${getMemberName(other.home_member_id)} and ${getMemberName(other.away_member_id)} on the same court/venue.`,
        type: 'venue_overlap',
      });
    }

    // 2. Participant overlaps & rest interval violations
    const checkParticipant = (memberId: string | null, label: string) => {
      if (!memberId || memberId === 'BYE') return;
      const otherHasMember = other.home_member_id === memberId || other.away_member_id === memberId;
      if (!otherHasMember) return;

      if (rangesOverlap(targetStart, targetEnd, otherStart, otherEnd, 0)) {
        conflicts.push({
          entity_id: targetMatchId,
          home_name: getMemberName(target.home_member_id),
          away_name: getMemberName(target.away_member_id),
          round_name: 'Rescheduled Match',
          reason: `Direct schedule overlap: ${label} is also playing against ${other.home_member_id === memberId ? getMemberName(other.away_member_id) : getMemberName(other.home_member_id)} at this time.`,
          type: 'participant_overlap',
        });
      } else if (restIntervalMs > 0 && rangesOverlap(targetStart, targetEnd, otherStart, otherEnd, restIntervalMs)) {
        conflicts.push({
          entity_id: targetMatchId,
          home_name: getMemberName(target.home_member_id),
          away_name: getMemberName(target.away_member_id),
          round_name: 'Rescheduled Match',
          reason: `Rest interval violation: ${label} has another match within the required ${config.rest_interval_minutes}m rest interval.`,
          type: 'rest_interval_violation',
        });
      }
    };

    checkParticipant(target.home_member_id, getMemberName(target.home_member_id));
    checkParticipant(target.away_member_id, getMemberName(target.away_member_id));
  }

  return conflicts;
}
