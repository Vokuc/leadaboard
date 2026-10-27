'use client';

import { DatabaseService, isSupabaseConfigured, supabase } from '@/lib/db';
import {
  CompetitionRegistration,
  CompetitionRegistrationConfig,
  RegistrationStatus,
} from '@/types';
import { CompetitionNotificationService } from '../notifications/service';
import {
  detectDuplicateRegistration,
  evaluateCapacityStatus,
  validateEligibility,
  validateRegistrationWindow,
  validateStatusTransition,
} from './validation';

const CONFIGS_STORAGE_KEY = 'competition_registration_configs';
const REGISTRATIONS_STORAGE_KEY = 'competition_registrations';

const inMemoryStore = new Map<string, string>();

function getStorageBackend() {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  if (typeof localStorage !== 'undefined') {
    return localStorage;
  }
  return null;
}

function localGet<T>(key: string, defaults: T): T {
  const backend = getStorageBackend();
  let value: string | null = null;
  if (backend) {
    value = backend.getItem(`leaderboardos_${key}`);
  } else {
    value = inMemoryStore.get(`leaderboardos_${key}`) || null;
  }

  if (!value) {
    localSet(key, defaults);
    return defaults;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return defaults;
  }
}

function localSet<T>(key: string, value: T): void {
  const backend = getStorageBackend();
  const serialized = JSON.stringify(value);
  if (backend) {
    backend.setItem(`leaderboardos_${key}`, serialized);
  } else {
    inMemoryStore.set(`leaderboardos_${key}`, serialized);
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function generateClaimToken(): string {
  return 'clm_' + Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
}

export interface RegisterParticipantInput {
  leaderboardId: string;
  userId?: string | null;
  participantName: string;
  participantEmail: string;
  teamId?: string | null;
  notes?: string | null;
  initialStatus?: RegistrationStatus;
  paymentReference?: string;
  paymentStatus?: import('@/types').RegistrationPaymentStatus;
}

export const CompetitionRegistrationService = {
  /**
   * Retrieves registration configuration for a competition.
   * Returns a safe default if no configuration has been created yet.
   */
  async getConfig(leaderboardId: string): Promise<CompetitionRegistrationConfig> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('competition_registration_configs')
        .select('*')
        .eq('leaderboard_id', leaderboardId)
        .maybeSingle();

      if (!error && data) {
        return data as CompetitionRegistrationConfig;
      }
    } else {
      const allConfigs = localGet<CompetitionRegistrationConfig[]>(CONFIGS_STORAGE_KEY, []);
      const found = allConfigs.find((c) => c.leaderboard_id === leaderboardId);
      if (found) return found;
    }

    // Default configuration for competitions without explicit setup
    return {
      id: `config-${leaderboardId}`,
      leaderboard_id: leaderboardId,
      is_enabled: false,
      capacity: null,
      opens_at: null,
      closes_at: null,
      require_approval: true,
      allow_waitlist: true,
      allow_team_registration: false,
      eligibility_rules: {
        allowed_domains: [],
        min_age: null,
        notes: '',
      },
      entry_fee: null,
      currency: 'NGN',
      payment_deadline: null,
      refund_policy: 'no_refunds',
      platform_fee_percent: 5,
      prize_pool_percentage: 0,
      guaranteed_prize_pool: null,
      payout_status: 'unconfigured',
      created_at: nowIso(),
      updated_at: nowIso(),
    };
  },

  /**
   * Saves or updates registration configuration for a competition.
   */
  async saveConfig(
    leaderboardId: string,
    updates: Partial<Omit<CompetitionRegistrationConfig, 'id' | 'leaderboard_id' | 'created_at' | 'updated_at'>>
  ): Promise<CompetitionRegistrationConfig> {
    const current = await this.getConfig(leaderboardId);
    const updated: CompetitionRegistrationConfig = {
      ...current,
      ...updates,
      updated_at: nowIso(),
    };

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('competition_registration_configs')
        .upsert(
          {
            leaderboard_id: leaderboardId,
            is_enabled: updated.is_enabled,
            capacity: updated.capacity,
            opens_at: updated.opens_at,
            closes_at: updated.closes_at,
            require_approval: updated.require_approval,
            allow_waitlist: updated.allow_waitlist,
            allow_team_registration: updated.allow_team_registration,
            eligibility_rules: updated.eligibility_rules,
            entry_fee: updated.entry_fee ?? null,
            currency: updated.currency ?? 'NGN',
            payment_deadline: updated.payment_deadline ?? null,
            refund_policy: updated.refund_policy ?? 'no_refunds',
            platform_fee_percent: updated.platform_fee_percent ?? 5,
            prize_pool_percentage: updated.prize_pool_percentage ?? 0,
            guaranteed_prize_pool: updated.guaranteed_prize_pool ?? null,
            payout_status: updated.payout_status ?? 'unconfigured',
            updated_at: updated.updated_at,
          },
          { onConflict: 'leaderboard_id' }
        )
        .select()
        .single();

      if (error) throw error;
      return data as CompetitionRegistrationConfig;
    }

    const allConfigs = localGet<CompetitionRegistrationConfig[]>(CONFIGS_STORAGE_KEY, []);
    const filtered = allConfigs.filter((c) => c.leaderboard_id !== leaderboardId);
    localSet(CONFIGS_STORAGE_KEY, [...filtered, updated]);
    return updated;
  },

  /**
   * Fetches all registrations for a leaderboard.
   */
  async getRegistrations(leaderboardId: string): Promise<CompetitionRegistration[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('competition_registrations')
        .select('*')
        .eq('leaderboard_id', leaderboardId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as CompetitionRegistration[];
    }

    const all = localGet<CompetitionRegistration[]>(REGISTRATIONS_STORAGE_KEY, []);
    return all.filter((r) => r.leaderboard_id === leaderboardId);
  },

  /**
   * Fetches registration for an authenticated user on a specific leaderboard.
   */
  async getUserRegistration(
    leaderboardId: string,
    userId: string
  ): Promise<CompetitionRegistration | null> {
    if (!userId) return null;

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('competition_registrations')
        .select('*')
        .eq('leaderboard_id', leaderboardId)
        .eq('user_id', userId)
        .not('status', 'eq', 'withdrawn')
        .maybeSingle();

      if (!error && data) return data as CompetitionRegistration;
      return null;
    }

    const all = localGet<CompetitionRegistration[]>(REGISTRATIONS_STORAGE_KEY, []);
    return (
      all.find(
        (r) =>
          r.leaderboard_id === leaderboardId &&
          r.user_id === userId &&
          r.status !== 'withdrawn'
      ) || null
    );
  },

  /**
   * Register a participant into a competition.
   * Performs server-side validation for dates, capacity, eligibility, and duplicate checks.
   */
  async registerParticipant(input: RegisterParticipantInput): Promise<CompetitionRegistration> {
    const { leaderboardId, userId, participantName, participantEmail, teamId, notes } = input;

    if (!participantName.trim()) {
      throw new Error('Participant name is required.');
    }
    if (!participantEmail.trim()) {
      throw new Error('Participant email is required.');
    }

    // 1. Validate registration window
    const config = await this.getConfig(leaderboardId);
    const windowValidation = validateRegistrationWindow(config);
    if (!windowValidation.valid) {
      throw new Error(windowValidation.error);
    }

    // 2. Validate participant eligibility
    const eligibilityValidation = validateEligibility(config, participantEmail);
    if (!eligibilityValidation.valid) {
      throw new Error(eligibilityValidation.error);
    }

    // 3. Prevent duplicate registrations
    const existingRegistrations = await this.getRegistrations(leaderboardId);
    const duplicateCheck = detectDuplicateRegistration(existingRegistrations, participantEmail, userId);
    if (duplicateCheck.isDuplicate) {
      throw new Error(duplicateCheck.error);
    }

    // 4. Validate capacity and determine target status
    const confirmedCount = existingRegistrations.filter(
      (r) => r.status === 'confirmed' || r.status === 'approved'
    ).length;

    const capacityEval = evaluateCapacityStatus(config, confirmedCount);
    if (capacityEval.error) {
      throw new Error(capacityEval.error);
    }

    const assignedStatus = input.initialStatus || capacityEval.targetStatus;
    let memberId: string | null = null;

    // 5. If auto-approved/confirmed (and not pending payment), link or create member record
    if (assignedStatus === 'confirmed' || assignedStatus === 'approved') {
      memberId = await this.syncMemberRecord(leaderboardId, {
        name: participantName.trim(),
        email: participantEmail.trim(),
        userId: userId || null,
        teamId: teamId || null,
      });
    }

    const newRegistration: CompetitionRegistration = {
      id: makeUuid(),
      leaderboard_id: leaderboardId,
      user_id: userId || null,
      member_id: memberId,
      team_id: teamId || null,
      participant_name: participantName.trim(),
      participant_email: participantEmail.trim(),
      status: assignedStatus,
      claim_token: null,
      claimed_at: null,
      rejection_reason: null,
      notes: notes?.trim() || null,
      payment_id: null,
      payment_status: input.paymentStatus || (assignedStatus === 'pending_payment' ? 'pending' : null),
      payment_reference: input.paymentReference || null,
      amount_paid: 0,
      currency: config.currency || 'NGN',
      paid_at: null,
      created_at: nowIso(),
      updated_at: nowIso(),
    };

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('competition_registrations')
        .insert({
          id: newRegistration.id,
          leaderboard_id: newRegistration.leaderboard_id,
          user_id: newRegistration.user_id,
          member_id: newRegistration.member_id,
          team_id: newRegistration.team_id,
          participant_name: newRegistration.participant_name,
          participant_email: newRegistration.participant_email,
          status: newRegistration.status,
          claim_token: newRegistration.claim_token,
          claimed_at: newRegistration.claimed_at,
          rejection_reason: newRegistration.rejection_reason,
          notes: newRegistration.notes,
          payment_id: newRegistration.payment_id,
          payment_status: newRegistration.payment_status,
          payment_reference: newRegistration.payment_reference,
          amount_paid: newRegistration.amount_paid,
          currency: newRegistration.currency,
          paid_at: newRegistration.paid_at,
          created_at: newRegistration.created_at,
          updated_at: newRegistration.updated_at,
        })
        .select()
        .single();

      if (error) throw error;
    } else {
      const all = localGet<CompetitionRegistration[]>(REGISTRATIONS_STORAGE_KEY, []);
      localSet(REGISTRATIONS_STORAGE_KEY, [...all, newRegistration]);
    }

    // 6. Notify the participant of registration status (skip if pending payment)
    if (userId && assignedStatus !== 'pending_payment') {
      const lb = await DatabaseService.getLeaderboard(leaderboardId);
      if (lb) {
        await CompetitionNotificationService.notifyRegistrationStatus({
          leaderboard_id: leaderboardId,
          competitionName: lb.name,
          user_id: userId,
          participant_email: participantEmail,
          status: assignedStatus as 'pending' | 'approved' | 'rejected' | 'waitlisted' | 'confirmed',
          slug: lb.slug,
        });
      }
    }

    return newRegistration;
  },

  /**
   * Confirms a paid registration upon verified transaction completion.
   * Promotes registration to approved or confirmed, creates member record, and assigns payment metadata.
   */
  async confirmPaidRegistration(
    registrationId: string,
    leaderboardId: string,
    paymentDetails: {
      paymentId: string;
      paymentReference: string;
      amountPaid: number;
      currency: string;
      paidAt: string;
    }
  ): Promise<CompetitionRegistration> {
    const reg = await this.getRegistrationById(registrationId, leaderboardId);
    if (!reg) throw new Error('Registration not found.');

    const config = await this.getConfig(leaderboardId);
    const targetStatus: RegistrationStatus = config.require_approval ? 'approved' : 'confirmed';

    let memberId = reg.member_id;
    if (!memberId) {
      memberId = await this.syncMemberRecord(leaderboardId, {
        name: reg.participant_name,
        email: reg.participant_email,
        userId: reg.user_id,
        teamId: reg.team_id,
      });
    }

    const updated: CompetitionRegistration = {
      ...reg,
      status: targetStatus,
      member_id: memberId,
      payment_id: paymentDetails.paymentId,
      payment_status: 'succeeded',
      payment_reference: paymentDetails.paymentReference,
      amount_paid: paymentDetails.amountPaid,
      currency: paymentDetails.currency,
      paid_at: paymentDetails.paidAt,
      updated_at: nowIso(),
    };

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('competition_registrations')
        .update({
          status: updated.status,
          member_id: updated.member_id,
          payment_id: updated.payment_id,
          payment_status: updated.payment_status,
          payment_reference: updated.payment_reference,
          amount_paid: updated.amount_paid,
          currency: updated.currency,
          paid_at: updated.paid_at,
          updated_at: updated.updated_at,
        })
        .eq('id', registrationId);

      if (error) throw error;
    } else {
      const all = localGet<CompetitionRegistration[]>(REGISTRATIONS_STORAGE_KEY, []);
      const nextList = all.map((r) => (r.id === registrationId ? updated : r));
      localSet(REGISTRATIONS_STORAGE_KEY, nextList);
    }

    if (updated.user_id) {
      const lb = await DatabaseService.getLeaderboard(leaderboardId);
      if (lb) {
        await CompetitionNotificationService.notifyRegistrationStatus({
          leaderboard_id: leaderboardId,
          competitionName: lb.name,
          user_id: updated.user_id,
          participant_email: updated.participant_email,
          status: targetStatus as 'pending' | 'approved' | 'rejected' | 'waitlisted' | 'confirmed',
          slug: lb.slug,
        });
      }
    }

    return updated;
  },

  /**
   * Marks a registration as refunded and deactivates participant membership.
   */
  async markRefunded(
    registrationId: string,
    leaderboardId: string
  ): Promise<CompetitionRegistration> {
    const reg = await this.getRegistrationById(registrationId, leaderboardId);
    if (!reg) throw new Error('Registration not found.');

    const updated: CompetitionRegistration = {
      ...reg,
      status: 'withdrawn',
      payment_status: 'refunded',
      updated_at: nowIso(),
    };

    if (isSupabaseConfigured && supabase) {
      await supabase
        .from('competition_registrations')
        .update({
          status: 'withdrawn',
          payment_status: 'refunded',
          updated_at: updated.updated_at,
        })
        .eq('id', registrationId);
    } else {
      const all = localGet<CompetitionRegistration[]>(REGISTRATIONS_STORAGE_KEY, []);
      localSet(
        REGISTRATIONS_STORAGE_KEY,
        all.map((r) => (r.id === registrationId ? updated : r))
      );
    }

    // Deactivate member in roster if exists
    if (reg.member_id) {
      try {
        await DatabaseService.updateMember(
          reg.member_id,
          { is_active: false },
          { skipAdminCheck: true }
        );
      } catch (err) {
        console.warn('Could not deactivate member for refunded registration:', err);
      }
    }

    return updated;
  },

  /**
   * Update status of an existing registration (Organizer approval, rejection, waitlist, or confirmation).
   */
  async updateRegistrationStatus(
    registrationId: string,
    nextStatus: RegistrationStatus,
    reason?: string | null
  ): Promise<CompetitionRegistration> {
    let registration: CompetitionRegistration | null = null;
    let allRegistrations: CompetitionRegistration[] = [];

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('competition_registrations')
        .select('*')
        .eq('id', registrationId)
        .single();

      if (error || !data) throw new Error('Registration not found.');
      registration = data as CompetitionRegistration;
      allRegistrations = await this.getRegistrations(registration.leaderboard_id);
    } else {
      allRegistrations = localGet<CompetitionRegistration[]>(REGISTRATIONS_STORAGE_KEY, []);
      registration = allRegistrations.find((r) => r.id === registrationId) || null;
      if (!registration) throw new Error('Registration not found.');
    }

    // 1. Validate status transition
    const transitionCheck = validateStatusTransition(registration.status, nextStatus);
    if (!transitionCheck.valid) {
      throw new Error(transitionCheck.error);
    }

    const leaderboardId = registration.leaderboard_id;
    const config = await this.getConfig(leaderboardId);

    // 2. Validate capacity limit when moving to approved or confirmed
    if (nextStatus === 'approved' || nextStatus === 'confirmed') {
      const activeConfirmed = allRegistrations.filter(
        (r) => r.id !== registrationId && (r.status === 'confirmed' || r.status === 'approved')
      ).length;

      if (config.capacity && config.capacity > 0 && activeConfirmed >= config.capacity) {
        throw new Error(
          `Cannot approve entrant: competition capacity of ${config.capacity} has been reached.`
        );
      }
    }

    // 3. Link or create member record if transitioning to approved/confirmed
    let memberId = registration.member_id;
    if (nextStatus === 'approved' || nextStatus === 'confirmed') {
      if (!memberId) {
        memberId = await this.syncMemberRecord(leaderboardId, {
          name: registration.participant_name,
          email: registration.participant_email,
          userId: registration.user_id,
          teamId: registration.team_id,
        });
      }
    }

    const updated: CompetitionRegistration = {
      ...registration,
      status: nextStatus,
      member_id: memberId,
      rejection_reason: nextStatus === 'rejected' ? reason || 'Application not accepted.' : null,
      updated_at: nowIso(),
    };

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('competition_registrations')
        .update({
          status: updated.status,
          member_id: updated.member_id,
          rejection_reason: updated.rejection_reason,
          updated_at: updated.updated_at,
        })
        .eq('id', registrationId)
        .select()
        .single();

      if (error) throw error;
    } else {
      const nextList = allRegistrations.map((r) => (r.id === registrationId ? updated : r));
      localSet(REGISTRATIONS_STORAGE_KEY, nextList);
    }

    // 4. Send notification if participant is a registered user
    if (updated.user_id) {
      const lb = await DatabaseService.getLeaderboard(leaderboardId);
      if (lb) {
        await CompetitionNotificationService.notifyRegistrationStatus({
          leaderboard_id: leaderboardId,
          competitionName: lb.name,
          user_id: updated.user_id,
          participant_email: updated.participant_email,
          status: nextStatus as 'pending' | 'approved' | 'rejected' | 'waitlisted' | 'confirmed',
          reason: updated.rejection_reason,
          slug: lb.slug,
        });
      }
    }

    return updated;
  },

  /**
   * Participant self-withdrawal.
   */
  async withdrawRegistration(registrationId: string, userId: string): Promise<CompetitionRegistration> {
    const all = isSupabaseConfigured && supabase
      ? await this.getRegistrations((await this.getRegistrationById(registrationId))?.leaderboard_id || '')
      : localGet<CompetitionRegistration[]>(REGISTRATIONS_STORAGE_KEY, []);

    const target = all.find((r) => r.id === registrationId);
    if (!target) throw new Error('Registration not found.');
    if (target.user_id !== userId) {
      throw new Error('You do not have permission to withdraw this registration.');
    }

    const updated = await this.updateRegistrationStatus(registrationId, 'withdrawn', 'Self-withdrawn by participant.');
    return updated;
  },

  /**
   * Create an organizer invite link with a unique claim token.
   */
  async createInvite(
    leaderboardId: string,
    input: { participantName: string; participantEmail: string; teamId?: string | null; notes?: string | null }
  ): Promise<{ registration: CompetitionRegistration; claimToken: string }> {
    const claimToken = generateClaimToken();

    // Check if participant already has a member record
    const existingMembers = await DatabaseService.getMembers(leaderboardId);
    const existingMember = existingMembers.find(
      (m) =>
        m.name.toLowerCase() === input.participantName.toLowerCase() ||
        (m.email && m.email.toLowerCase() === input.participantEmail.toLowerCase())
    );

    const newRegistration: CompetitionRegistration = {
      id: makeUuid(),
      leaderboard_id: leaderboardId,
      user_id: existingMember?.user_id || null,
      member_id: existingMember?.id || null,
      team_id: input.teamId || existingMember?.team_id || null,
      participant_name: input.participantName.trim(),
      participant_email: input.participantEmail.trim(),
      status: 'pending',
      claim_token: claimToken,
      claimed_at: null,
      rejection_reason: null,
      notes: input.notes?.trim() || 'Invited by organizer',
      created_at: nowIso(),
      updated_at: nowIso(),
    };

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('competition_registrations')
        .insert({
          id: newRegistration.id,
          leaderboard_id: newRegistration.leaderboard_id,
          user_id: newRegistration.user_id,
          member_id: newRegistration.member_id,
          team_id: newRegistration.team_id,
          participant_name: newRegistration.participant_name,
          participant_email: newRegistration.participant_email,
          status: newRegistration.status,
          claim_token: newRegistration.claim_token,
          claimed_at: newRegistration.claimed_at,
          notes: newRegistration.notes,
          created_at: newRegistration.created_at,
          updated_at: newRegistration.updated_at,
        })
        .select()
        .single();

      if (error) throw error;
      return { registration: data as CompetitionRegistration, claimToken };
    }

    const all = localGet<CompetitionRegistration[]>(REGISTRATIONS_STORAGE_KEY, []);
    localSet(REGISTRATIONS_STORAGE_KEY, [...all, newRegistration]);
    return { registration: newRegistration, claimToken };
  },

  /**
   * Claim an existing invite or pre-registered participant record.
   * Avoids creating duplicate participant identities by linking user_id to existing member.
   */
  async claimRegistration(
    claimToken: string,
    userId: string,
    userEmail: string,
    userName: string
  ): Promise<CompetitionRegistration> {
    let registration: CompetitionRegistration | null = null;

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('competition_registrations')
        .select('*')
        .eq('claim_token', claimToken)
        .maybeSingle();

      if (error || !data) throw new Error('Invalid or expired claim token.');
      registration = data as CompetitionRegistration;
    } else {
      const all = localGet<CompetitionRegistration[]>(REGISTRATIONS_STORAGE_KEY, []);
      registration = all.find((r) => r.claim_token === claimToken) || null;
      if (!registration) throw new Error('Invalid or expired claim token.');
    }

    if (registration.claimed_at) {
      throw new Error('This invitation has already been claimed.');
    }

    // Sync member record and attach user_id
    const memberId = await this.syncMemberRecord(registration.leaderboard_id, {
      name: userName || registration.participant_name,
      email: userEmail || registration.participant_email,
      userId,
      teamId: registration.team_id,
    });

    const updated: CompetitionRegistration = {
      ...registration,
      user_id: userId,
      member_id: memberId,
      status: 'confirmed',
      claimed_at: nowIso(),
      updated_at: nowIso(),
    };

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('competition_registrations')
        .update({
          user_id: updated.user_id,
          member_id: updated.member_id,
          status: updated.status,
          claimed_at: updated.claimed_at,
          updated_at: updated.updated_at,
        })
        .eq('id', registration.id)
        .select()
        .single();

      if (error) throw error;
    } else {
      const all = localGet<CompetitionRegistration[]>(REGISTRATIONS_STORAGE_KEY, []);
      const nextList = all.map((r) => (r.id === registration!.id ? updated : r));
      localSet(REGISTRATIONS_STORAGE_KEY, nextList);
    }

    // Send confirmation notification
    const lb = await DatabaseService.getLeaderboard(registration.leaderboard_id);
    if (lb) {
      await CompetitionNotificationService.notifyRegistrationStatus({
        leaderboard_id: registration.leaderboard_id,
        competitionName: lb.name,
        user_id: userId,
        participant_email: userEmail,
        status: 'confirmed',
        slug: lb.slug,
      });
    }

    return updated;
  },

  /**
   * Helper to fetch registration by ID.
   */
  async getRegistrationById(registrationId: string, leaderboardId?: string): Promise<CompetitionRegistration | null> {
    if (isSupabaseConfigured && supabase) {
      let query = supabase.from('competition_registrations').select('*').eq('id', registrationId);
      if (leaderboardId) {
        query = query.eq('leaderboard_id', leaderboardId);
      }
      const { data, error } = await query.maybeSingle();

      if (!error && data) return data as CompetitionRegistration;
      return null;
    }

    const all = localGet<CompetitionRegistration[]>(REGISTRATIONS_STORAGE_KEY, []);
    return all.find((r) => r.id === registrationId && (!leaderboardId || r.leaderboard_id === leaderboardId)) || null;
  },

  /**
   * Synchronize or create a LeaderboardMember record upon approved/confirmed registration.
   * Ensures existing participant identities are preserved without creating duplicates.
   */
  async syncMemberRecord(
    leaderboardId: string,
    params: { name: string; email: string; userId?: string | null; teamId?: string | null }
  ): Promise<string> {
    const { name, email, userId, teamId } = params;
    const existingMembers = await DatabaseService.getMembers(leaderboardId);

    // Look for matching member by email or name
    const matched = existingMembers.find(
      (m) =>
        (m.email && m.email.toLowerCase() === email.toLowerCase()) ||
        m.name.toLowerCase() === name.toLowerCase()
    );

    if (matched) {
      // Update existing member with user_id and activate if inactive
      if (userId && (!matched.user_id || !matched.is_active)) {
        await DatabaseService.updateMember(
          matched.id,
          {
            user_id: userId,
            is_active: true,
            team_id: teamId || matched.team_id,
          },
          { skipAdminCheck: true }
        );
      }
      return matched.id;
    }

    // Otherwise create new member
    const newMember = await DatabaseService.addMember(
      leaderboardId,
      {
        name,
        email: email || null,
        team: null,
        team_id: teamId || null,
        notes: 'Registered online',
        avatar_url: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(name)}`,
        user_id: userId || null,
      },
      { skipAdminCheck: true }
    );

    return newMember.id;
  },
};
