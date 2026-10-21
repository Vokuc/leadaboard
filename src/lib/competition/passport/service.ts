import {
  CompetitionEngine,
  CompetitionPassportData,
  Leaderboard,
  LeaderboardMember,
  ParticipantClaim,
  ParticipantClaimStatus,
  ParticipantClaimVerificationMethod,
  ParticipantCorrection,
  ParticipantCorrectionType,
  ParticipantProfile,
  ParticipantTeamHistory,
  PassportCareerOverview,
  PassportCompetitionEntry,
  PassportMatchRecord,
  ParticipantAchievement,
  CompetitionRating,
  RatingHistoryEntry,
} from '@/types';
import { DatabaseService, isSupabaseConfigured, supabase, mockDb } from '@/lib/db';
import { LeagueService } from '@/lib/league/service';
import { TournamentService } from '@/lib/tournament/service';
import { ResultAuditService } from '@/lib/competition/audit/service';

const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,30}$/;

function sanitizeHandle(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 20);
  return base.length >= 3 ? base : `user_${Math.random().toString(36).substring(2, 8)}`;
}

export const CompetitionPassportService = {
  /**
   * Get an existing participant profile or create a default one for a user.
   */
  async getOrCreateProfile(
    userId: string,
    defaultsOrEmail?: Partial<ParticipantProfile> | string,
    maybeDisplayName?: string
  ): Promise<ParticipantProfile> {
    const defaults: Partial<ParticipantProfile> =
      typeof defaultsOrEmail === 'string'
        ? {
            username: sanitizeHandle(maybeDisplayName || defaultsOrEmail.split('@')[0]),
            display_name: maybeDisplayName || defaultsOrEmail.split('@')[0],
          }
        : (defaultsOrEmail || {});

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('participant_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (data && !error) {
        return data as ParticipantProfile;
      }

      // Fetch base profile to populate defaults
      const baseProfile = await DatabaseService.getCurrentProfile();
      const fallbackName = typeof defaultsOrEmail === 'string' ? maybeDisplayName || defaultsOrEmail.split('@')[0] : 'Competitor';
      const baseName = defaults?.display_name || baseProfile?.full_name || baseProfile?.email?.split('@')[0] || fallbackName;
      const initialHandle = sanitizeHandle(defaults?.username || baseName);

      // Ensure handle uniqueness
      let candidateHandle = initialHandle;
      let attempts = 0;
      while (attempts < 5) {
        const { data: existing } = await supabase
          .from('participant_profiles')
          .select('id')
          .eq('username', candidateHandle)
          .maybeSingle();

        if (!existing) break;
        candidateHandle = `${initialHandle}_${Math.floor(100 + Math.random() * 900)}`;
        attempts++;
      }

      const newProfile: Partial<ParticipantProfile> = {
        user_id: userId,
        username: candidateHandle,
        display_name: defaults?.display_name || baseName,
        bio: defaults?.bio || null,
        avatar_url: defaults?.avatar_url || baseProfile?.avatar_url || null,
        location: defaults?.location || null,
        headline: defaults?.headline || null,
        social_links: defaults?.social_links || {},
        privacy_settings: {
          is_public: true,
          show_email: false,
          show_unverified_results: true,
          show_stats: true,
          show_match_history: true,
          show_teams: true,
          show_trophy_case: true,
          ...defaults?.privacy_settings,
        },
        pinned_competition_ids: defaults?.pinned_competition_ids || [],
        hidden_entity_ids: defaults?.hidden_entity_ids || [],
      };

      const { data: created, error: insertError } = await supabase
        .from('participant_profiles')
        .insert([newProfile])
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }
      return created as ParticipantProfile;
    }

    // Demo/localStorage mode
    const current = mockDb.get<ParticipantProfile[]>('participant_profiles', []);
    const existing = current.find((p) => p.user_id === userId);
    if (existing) return existing;

    const baseProfile = await DatabaseService.getCurrentProfile();
    const fallbackName = typeof defaultsOrEmail === 'string' ? maybeDisplayName || defaultsOrEmail.split('@')[0] : 'Competitor';
    const baseName = defaults?.display_name || baseProfile?.full_name || baseProfile?.email?.split('@')[0] || fallbackName;
    const initialHandle = sanitizeHandle(defaults?.username || baseName);

    let candidateHandle = initialHandle;
    let attempts = 0;
    while (current.some((p) => p.username.toLowerCase() === candidateHandle.toLowerCase()) && attempts < 5) {
      candidateHandle = `${initialHandle}_${Math.floor(100 + Math.random() * 900)}`;
      attempts++;
    }

    const created: ParticipantProfile = {
      id: `pp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      user_id: userId,
      username: candidateHandle,
      display_name: defaults?.display_name || baseName,
      bio: defaults?.bio || null,
      avatar_url: defaults?.avatar_url || baseProfile?.avatar_url || null,
      location: defaults?.location || null,
      headline: defaults?.headline || null,
      social_links: defaults?.social_links || {},
      privacy_settings: {
        is_public: true,
        show_email: false,
        show_unverified_results: true,
        show_stats: true,
        show_match_history: true,
        show_teams: true,
        show_trophy_case: true,
        ...defaults?.privacy_settings,
      },
      pinned_competition_ids: defaults?.pinned_competition_ids || [],
      hidden_entity_ids: defaults?.hidden_entity_ids || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    current.push(created);
    mockDb.set('participant_profiles', current);
    return created;
  },

  /**
   * Find a participant profile by unique handle (case-insensitive).
   */
  async getProfileByUsername(username: string): Promise<ParticipantProfile | null> {
    if (!username) return null;
    const handleClean = username.toLowerCase().trim().replace(/^@/, '');
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('participant_profiles')
        .select('*')
        .ilike('username', handleClean)
        .maybeSingle();

      if (error || !data) return null;
      return data as ParticipantProfile;
    }

    const current = mockDb.get<ParticipantProfile[]>('participant_profiles', []);
    return current.find((p) => p.username.toLowerCase().replace(/^@/, '') === handleClean) || null;
  },

  /**
   * Find a participant profile by user ID.
   */
  async getProfileByUserId(userId: string): Promise<ParticipantProfile | null> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('participant_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error || !data) return null;
      return data as ParticipantProfile;
    }

    const current = mockDb.get<ParticipantProfile[]>('participant_profiles', []);
    return current.find((p) => p.user_id === userId) || null;
  },

  /**
   * Update participant profile details and privacy settings.
   * Strictly enforces that callers can only update their own profile.
   */
  async updateProfile(
    userId: string,
    updates: Partial<ParticipantProfile>,
    callerUserId?: string
  ): Promise<ParticipantProfile> {
    const caller = callerUserId ?? userId;
    if (userId !== caller) {
      throw new Error('Unauthorized: You can only edit your own participant profile.');
    }

    if (updates.username) {
      const clean = updates.username.trim().replace(/^@/, '');
      if (!USERNAME_REGEX.test(clean)) {
        throw new Error('Username must be 3-30 characters and can only contain letters, numbers, hyphens, and underscores.');
      }

      // Check handle collision
      const existing = await this.getProfileByUsername(clean);
      if (existing && existing.user_id !== userId) {
        throw new Error(`The handle "@${clean}" is already taken and in use by another competitor.`);
      }
      updates.username = clean;
    }

    const timestamp = new Date().toISOString();

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('participant_profiles')
        .update({
          ...updates,
          updated_at: timestamp,
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      return data as ParticipantProfile;
    }

    const current = mockDb.get<ParticipantProfile[]>('participant_profiles', []);
    const idx = current.findIndex((p) => p.user_id === userId);
    if (idx === -1) {
      throw new Error('Participant profile not found.');
    }

    const updated: ParticipantProfile = {
      ...current[idx],
      ...updates,
      privacy_settings: {
        ...current[idx].privacy_settings,
        ...(updates.privacy_settings || {}),
      },
      updated_at: timestamp,
    };
    current[idx] = updated;
    mockDb.set('participant_profiles', current);
    return updated;
  },

  /**
   * Fetch all participant claims across the system.
   */
  async getAllClaims(): Promise<ParticipantClaim[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('participant_claims').select('*');
      if (error || !data) return [];
      return data as ParticipantClaim[];
    }
    return mockDb.get<ParticipantClaim[]>('participant_claims', []);
  },

  /**
   * Fetch all claims associated with a specific participant/member ID.
   */
  async getClaimsForMember(memberId: string): Promise<ParticipantClaim[]> {
    const all = await this.getAllClaims();
    return all.filter((c) => c.member_id === memberId);
  },



  /**
   * Claim an existing participant record (LeaderboardMember) to link it to the user's account.
   * Enforces authorization proof (token or verified email match) and prevents duplicate claims.
   */
  async claimParticipantRecord(
    userId: string,
    inputOrEmail:
      | {
          leaderboardId?: string;
          competition_id?: string;
          memberId?: string;
          member_id?: string;
          verificationMethod?: ParticipantClaimVerificationMethod;
          verification_method?: ParticipantClaimVerificationMethod;
          claimToken?: string;
          claim_token?: string;
          claimNotes?: string;
          claim_notes?: string;
        }
      | string,
    memberIdOrOptions?: string | Record<string, unknown>,
    maybeOptions?: {
      verificationMethod?: ParticipantClaimVerificationMethod;
      verification_method?: ParticipantClaimVerificationMethod;
      claimToken?: string;
      claim_token?: string;
      claimNotes?: string;
      claim_notes?: string;
      leaderboardId?: string;
      competition_id?: string;
    }
  ): Promise<ParticipantClaim & { status: ParticipantClaimStatus; claim: ParticipantClaim }> {
    let leaderboardId: string = '';
    let memberId: string = '';
    let verificationMethod: ParticipantClaimVerificationMethod = 'email_match';
    let claimToken: string | undefined;
    let claimNotes: string | undefined;
    let explicitUserEmail: string | undefined;

    if (typeof inputOrEmail === 'string' && typeof memberIdOrOptions === 'string') {
      explicitUserEmail = inputOrEmail;
      memberId = memberIdOrOptions;
      verificationMethod = maybeOptions?.verificationMethod || maybeOptions?.verification_method || 'email_match';
      claimToken = maybeOptions?.claimToken || maybeOptions?.claim_token;
      claimNotes = maybeOptions?.claimNotes || maybeOptions?.claim_notes;
      leaderboardId = maybeOptions?.leaderboardId || maybeOptions?.competition_id || '';
    } else if (typeof inputOrEmail === 'object' && inputOrEmail) {
      leaderboardId = inputOrEmail.leaderboardId || inputOrEmail.competition_id || '';
      memberId = inputOrEmail.memberId || inputOrEmail.member_id || '';
      verificationMethod = inputOrEmail.verificationMethod || inputOrEmail.verification_method || 'email_match';
      claimToken = inputOrEmail.claimToken || inputOrEmail.claim_token;
      claimNotes = inputOrEmail.claimNotes || inputOrEmail.claim_notes;
    }

    // 1. Resolve member & leaderboardId if not provided
    let member: LeaderboardMember | undefined;
    if (leaderboardId) {
      const members = await DatabaseService.getMembers(leaderboardId);
      member = members.find((m) => m.id === memberId);
    }
    if (!member) {
      const allMembers = mockDb.getMembers();
      member = allMembers.find((m) => m.id === memberId);
      if (member) leaderboardId = member.leaderboard_id;
    }

    if (!member) {
      throw new Error('Participant record not found in this competition.');
    }

    // 2. Prevent duplicate claims
    if (member.user_id && member.user_id !== userId) {
      throw new Error('This participant record has already been claimed by another user.');
    }

    // 3. Check existing active claims
    const existingClaims = await this.getClaimsForMember(memberId);
    const activeAnotherUserClaim = existingClaims.find(
      (c) => (c.status === 'verified' || c.status === 'approved') && c.user_id !== userId
    );
    if (activeAnotherUserClaim) {
      throw new Error('This participant record has already been claimed and verified by another user.');
    }

    // 4. Fetch authenticated user profile
    const userProfile = await DatabaseService.getCurrentProfile();
    const effectiveUserEmail = (explicitUserEmail || userProfile?.email || '').toLowerCase().trim();

    let isVerifiedImmediately = false;

    if (verificationMethod === 'token') {
      const tokenStr =
        typeof claimToken === 'object' && claimToken
          ? String((claimToken as Record<string, unknown>).claimToken || (claimToken as Record<string, unknown>).token || '')
          : String(claimToken || '').trim();
      if (!tokenStr) {
        throw new Error('Claim token is required for token verification.');
      }

      // Check if token matches a registered claim token
      const matchingClaim = existingClaims.find(
        (c) => c.claim_token === tokenStr && c.status === 'pending'
      );
      if (!matchingClaim && tokenStr !== `CLAIM-${memberId.slice(0, 6).toUpperCase()}`) {
        throw new Error('Invalid claim token.');
      }
      isVerifiedImmediately = true;
    } else if (verificationMethod === 'email_match') {
      const memberEmail = (member.email || (typeof member.metadata?.email === 'string' ? member.metadata.email : '')).toLowerCase().trim();
      if (!memberEmail) {
        throw new Error('This participant record has no registered email. Please claim via an organizer token or request review.');
      }
      if (memberEmail !== effectiveUserEmail) {
        throw new Error(`Your account email (${effectiveUserEmail}) does not match the participant record email (${memberEmail}).`);
      }
      isVerifiedImmediately = true;
    } else if (verificationMethod === 'organizer_approved') {
      isVerifiedImmediately = false;
    }

    const timestamp = new Date().toISOString();
    const claimStatus: ParticipantClaimStatus = isVerifiedImmediately ? 'approved' : 'pending';

    const claim: ParticipantClaim = {
      id: `claim-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      leaderboard_id: leaderboardId,
      member_id: memberId,
      user_id: userId,
      claim_token: typeof claimToken === 'string' ? claimToken : null,
      status: claimStatus,
      verification_method: verificationMethod,
      claim_notes: claimNotes || null,
      rejection_reason: null,
      verified_at: isVerifiedImmediately ? timestamp : null,
      created_at: timestamp,
      updated_at: timestamp,
    };

    if (isSupabaseConfigured && supabase) {
      // Upsert claim
      const { error: claimErr } = await supabase
        .from('participant_claims')
        .upsert([claim], { onConflict: 'member_id,user_id' });
      if (claimErr) throw claimErr;

      // If verified, update member's user_id
      if (isVerifiedImmediately) {
        await supabase
          .from('leaderboard_members')
          .update({ user_id: userId, updated_at: timestamp })
          .eq('id', memberId);
      }
    } else {
      // Demo/localStorage mode
      const allClaims = mockDb.get<ParticipantClaim[]>('participant_claims', []);
      const existingIdx = allClaims.findIndex((c) => c.member_id === memberId && c.user_id === userId);
      if (existingIdx >= 0) {
        allClaims[existingIdx] = claim;
      } else {
        allClaims.push(claim);
      }
      mockDb.set('participant_claims', allClaims);

      if (isVerifiedImmediately) {
        const allMembers = mockDb.getMembers();
        const updated = allMembers.map((m) =>
          m.id === memberId ? { ...m, user_id: userId, updated_at: timestamp } : m
        );
        mockDb.setMembers(updated);
        mockDb.set('members', updated);
      }
    }

    // Record initial team history if member is currently in a team
    if (isVerifiedImmediately && member.team_id) {
      const teams = await DatabaseService.getTeams(leaderboardId);
      const team = teams.find((t) => t.id === member.team_id);
      if (team) {
        await this.recordTeamAffiliation({
          user_id: userId,
          member_id: memberId,
          leaderboard_id: leaderboardId,
          team_id: team.id,
          team_name: team.name,
          role: 'player',
          jersey_number: null,
          joined_at: member.created_at || timestamp,
        });
      }
    }

    // Activity log entry
    const actionLabel = isVerifiedImmediately
      ? `claimed and verified their participation in`
      : `requested to claim a participant slot in`;
    await DatabaseService.addActivityLog(
      leaderboardId,
      `Competitor "${userProfile?.full_name || effectiveUserEmail}" ${actionLabel} "${member.name}".`
    );

    return Object.assign(claim, { status: claimStatus, claim });
  },

  /**
   * Generate an official one-time claim token for a participant record.
   * Requires organizer or admin authorization.
   */
  async generateMemberClaimToken(
    leaderboardId: string,
    memberId: string,
    actorUserId?: string
  ): Promise<string & { claimToken: string; claim: ParticipantClaim }> {
    if (actorUserId) {
      const lb = await DatabaseService.getLeaderboard(leaderboardId);
      const admins = await DatabaseService.getAdmins(leaderboardId);
      const isOwnerOrAdmin = lb?.owner_id === actorUserId || admins.some((a) => a.user_id === actorUserId);
      if (!isOwnerOrAdmin) {
        throw new Error('Unauthorized: only competition organizers or admins can generate claim tokens.');
      }
    }

    const token = `CP-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
    const timestamp = new Date().toISOString();

    const claim: ParticipantClaim = {
      id: `claim-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      leaderboard_id: leaderboardId,
      member_id: memberId,
      user_id: actorUserId || 'admin',
      claim_token: token,
      status: 'pending',
      verification_method: 'token',
      claim_notes: 'Organizer issued claim token',
      rejection_reason: null,
      verified_at: null,
      created_at: timestamp,
      updated_at: timestamp,
    };

    if (isSupabaseConfigured && supabase) {
      await supabase.from('participant_claims').insert([claim]);
    } else {
      const allClaims = mockDb.get<ParticipantClaim[]>('participant_claims', []);
      allClaims.push(claim);
      mockDb.set('participant_claims', allClaims);
    }

    const result = Object.assign(new String(token), {
      claimToken: token,
      claim,
      token,
    });
    return result as unknown as string & { claimToken: string; claim: ParticipantClaim };
  },

  /**
   * Review and approve/reject a pending claim request.
   */
  async reviewClaim(
    claimId: string,
    decision: 'approve' | 'reject',
    reviewerUserId: string,
    rejectionReason?: string
  ): Promise<ParticipantClaim> {
    const claims = await this.getAllClaims();
    const claim = claims.find((c) => c.id === claimId);
    if (!claim) throw new Error('Claim record not found.');

    await DatabaseService.requireAdminPermission(claim.leaderboard_id);

    const timestamp = new Date().toISOString();

    if (decision === 'approve') {
      // Double check member hasn't been claimed yet
      const members = await DatabaseService.getMembers(claim.leaderboard_id);
      const member = members.find((m) => m.id === claim.member_id);
      if (member?.user_id && member.user_id !== claim.user_id) {
        throw new Error('This participant slot is already claimed by another user.');
      }

      claim.status = 'approved';
      claim.verified_at = timestamp;

      // Link member
      if (isSupabaseConfigured && supabase) {
        await supabase
          .from('leaderboard_members')
          .update({ user_id: claim.user_id, updated_at: timestamp })
          .eq('id', claim.member_id);
        await supabase
          .from('participant_claims')
          .update({ status: 'approved', verified_at: timestamp, updated_at: timestamp })
          .eq('id', claimId);
      } else {
        const allMembers = mockDb.getMembers();
        const updated = allMembers.map((m) =>
          m.id === claim.member_id ? { ...m, user_id: claim.user_id, updated_at: timestamp } : m
        );
        mockDb.setMembers(updated);
        mockDb.set('members', updated);

        const allClaims = mockDb.get<ParticipantClaim[]>('participant_claims', []);
        const idx = allClaims.findIndex((c) => c.id === claimId);
        if (idx >= 0) allClaims[idx] = claim;
        mockDb.set('participant_claims', allClaims);
      }

      await DatabaseService.addActivityLog(
        claim.leaderboard_id,
        `Organizer approved competitor claim #${claimId.slice(0, 8)}.`
      );
    } else {
      claim.status = 'rejected';
      claim.rejection_reason = rejectionReason || 'Claim declined by organizer.';
      claim.updated_at = timestamp;

      if (isSupabaseConfigured && supabase) {
        await supabase
          .from('participant_claims')
          .update({ status: 'rejected', rejection_reason: claim.rejection_reason, updated_at: timestamp })
          .eq('id', claimId);
      } else {
        const allClaims = mockDb.get<ParticipantClaim[]>('participant_claims', []);
        const idx = allClaims.findIndex((c) => c.id === claimId);
        if (idx >= 0) allClaims[idx] = claim;
        mockDb.set('participant_claims', allClaims);
      }
    }

    return claim;
  },

  /**
   * Request correction or dispute of a wrongly linked result or participant record.
   */
  async requestCorrection(
    userId: string,
    input: {
      leaderboardId?: string;
      competition_id?: string;
      entityType?: 'membership_link' | 'fixture_result' | 'tournament_match' | 'score_event';
      entity_type?: 'membership_link' | 'fixture_result' | 'tournament_match' | 'score_event';
      entityId?: string;
      entity_id?: string;
      member_id?: string;
      correctionType?: ParticipantCorrectionType;
      correction_type?: ParticipantCorrectionType;
      reason: string;
      hideFromPassport?: boolean;
    }
  ): Promise<ParticipantCorrection> {
    const timestamp = new Date().toISOString();
    const correctionType = input.correctionType || input.correction_type || 'wrongly_linked';
    const leaderboardId = input.leaderboardId || input.competition_id || '';
    const entityId = input.entityId || input.entity_id || input.member_id || '';
    const entityType = input.entityType || input.entity_type || 'membership_link';

    const correction: ParticipantCorrection = {
      id: `corr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      user_id: userId,
      leaderboard_id: leaderboardId,
      entity_type: entityType,
      entity_id: entityId,
      correction_type: correctionType,
      reason: input.reason,
      status: 'pending',
      resolution_notes: null,
      created_at: timestamp,
      updated_at: timestamp,
    };

    if (isSupabaseConfigured && supabase) {
      await supabase.from('participant_corrections').insert([correction]);
    } else {
      const allCorrections = mockDb.get<ParticipantCorrection[]>('participant_corrections', []);
      allCorrections.push(correction);
      mockDb.set('participant_corrections', allCorrections);
    }

    // Immediately hide from passport if requested by the user
    if (input.hideFromPassport && entityId) {
      await this.hideEntityFromPassport(userId, entityId);
    }

    // Log dispute in ResultAuditService if leaderboardId is known
    if (leaderboardId) {
      await ResultAuditService.logAuditEntry({
        leaderboard_id: leaderboardId,
        entity_type: entityType === 'fixture_result' ? 'fixture_result' : entityType === 'tournament_match' ? 'tournament_match' : 'score_event',
        entity_id: entityId,
        previous_payload: null,
        proposed_payload: { correction_type: correctionType },
        actor_id: userId,
        actor_email: null,
        actor_name: 'Participant (Dispute Initiator)',
        actor_role: 'participant',
        action: 'dispute',
        status: 'disputed',
        reason: `Participant correction request: ${input.reason}`,
        evidence_urls: [],
      });
    }

    return correction;
  },

  /**
   * Hide an entity (competition ID or match ID) from the user's public passport.
   */
  async hideEntityFromPassport(userId: string, entityId: string): Promise<void> {
    const profile = await this.getOrCreateProfile(userId);
    const hidden = new Set(profile.hidden_entity_ids || []);
    hidden.add(entityId);
    await this.updateProfile(userId, { hidden_entity_ids: Array.from(hidden) }, userId);
  },

  /**
   * Unhide an entity from the user's public passport.
   */
  async unhideEntityFromPassport(userId: string, entityId: string): Promise<void> {
    const profile = await this.getOrCreateProfile(userId);
    const hidden = new Set(profile.hidden_entity_ids || []);
    hidden.delete(entityId);
    await this.updateProfile(userId, { hidden_entity_ids: Array.from(hidden) }, userId);
  },

  /**
   * Record historical team affiliation when a participant joins a team.
   */
  async recordTeamAffiliation(input: Omit<ParticipantTeamHistory, 'id' | 'created_at' | 'left_at'>): Promise<ParticipantTeamHistory> {
    const timestamp = new Date().toISOString();
    const entry: ParticipantTeamHistory = {
      id: `pth-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      ...input,
      left_at: null,
      created_at: timestamp,
    };

    if (isSupabaseConfigured && supabase) {
      await supabase.from('participant_team_history').insert([entry]);
    } else {
      const history = mockDb.get<ParticipantTeamHistory[]>('participant_team_history', []);
      history.push(entry);
      mockDb.set('participant_team_history', history);
    }

    return entry;
  },

  /**
   * Close out current team affiliation when participant leaves or transfers.
   */
  async closeTeamAffiliation(teamId: string, memberId: string): Promise<void> {
    const timestamp = new Date().toISOString();
    if (isSupabaseConfigured && supabase) {
      await supabase
        .from('participant_team_history')
        .update({ left_at: timestamp })
        .eq('team_id', teamId)
        .eq('member_id', memberId)
        .is('left_at', null);
    } else {
      const history = mockDb.get<ParticipantTeamHistory[]>('participant_team_history', []);
      const active = history.find((h) => h.team_id === teamId && h.member_id === memberId && !h.left_at);
      if (active) {
        active.left_at = timestamp;
        mockDb.set('participant_team_history', history);
      }
    }
  },

  /**
   * Build the complete, credible Competition Passport for a competitor.
   * Gathers trustworthy match history, competition standings, and team affiliations.
   * Distinguishes verified vs unverified results and respects participant privacy settings.
   */
  async getPassport(identifier: string, viewerUserId?: string | null): Promise<CompetitionPassportData> {
    // 1. Resolve profile by username or user_id
    let profile = await this.getProfileByUsername(identifier);
    if (!profile) {
      profile = await this.getProfileByUserId(identifier);
    }
    if (!profile) {
      throw new Error(`Competition Passport not found for "${identifier}".`);
    }

    const isOwner = viewerUserId === profile.user_id;

    // 2. Check privacy: if private and not owner, return locked redacted passport
    if (!profile.privacy_settings.is_public && !isOwner) {
      return {
        profile: {
          ...profile,
          bio: null,
          location: null,
          social_links: {},
        },
        account_email: null,
        is_owner: false,
        overview: {
          total_competitions: 0,
          verified_competitions: 0,
          unverified_competitions: 0,
          total_matches: 0,
          matches_won: 0,
          total_wins: 0,
          verified_wins: 0,
          matches_drawn: 0,
          matches_lost: 0,
          win_percentage: 0,
          win_rate: 0,
          first_place_finishes: 0,
          gold_finishes: 0,
          second_place_finishes: 0,
          silver_finishes: 0,
          third_place_finishes: 0,
          bronze_finishes: 0,
          highest_rank_achieved: null,
          active_streak: 0,
          total_points_scored: 0,
          active_teams: 0,
        },
        competitions: [],
        matches: [],
        teams: [],
        achievements: [],
        ratings: [],
        rating_history: [],
      };
    }

    const hiddenSet = new Set(profile.hidden_entity_ids || []);

    // 3. Find all member records linked to this user's account
    let linkedMembers: LeaderboardMember[] = [];
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase
        .from('leaderboard_members')
        .select('*')
        .eq('user_id', profile.user_id);
      linkedMembers = (data || []) as LeaderboardMember[];
    } else {
      const allMembers = mockDb.getMembers();
      linkedMembers = allMembers.filter((m) => m.user_id === profile?.user_id);
    }

    // 4. Fetch team affiliations
    let teamHistory: ParticipantTeamHistory[] = [];
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase
        .from('participant_team_history')
        .select('*')
        .eq('user_id', profile.user_id)
        .order('joined_at', { ascending: false });
      teamHistory = (data || []) as ParticipantTeamHistory[];
    } else {
      const history = mockDb.get<ParticipantTeamHistory[]>('participant_team_history', []);
      teamHistory = history
        .filter((h) => h.user_id === profile?.user_id || linkedMembers.some((m) => m.id === h.member_id))
        .sort((a, b) => new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime());
    }

    const competitions: PassportCompetitionEntry[] = [];
    const matches: PassportMatchRecord[] = [];

    // 5. Aggregate competition and match data for each linked member record
    for (const member of linkedMembers) {
      if ((hiddenSet.has(member.leaderboard_id) || hiddenSet.has(member.id)) && !isOwner) continue;

      const leaderboard = await DatabaseService.getLeaderboard(member.leaderboard_id);
      if (!leaderboard) continue;

      const config = await LeagueService.getCompetitionConfig(leaderboard.id);
      const engine: CompetitionEngine = config?.engine_type || 'simple_points';

      // Determine verification: Verified if leaderboard is explicitly verified OR results were confirmed via audit logs
      const auditLogs = await ResultAuditService.getAuditHistoryForLeaderboard(leaderboard.id);
      const hasConfirmedAudits = auditLogs.some((a) => a.status === 'confirmed' || a.status === 'approved');
      const isVerified = Boolean(leaderboard.is_verified || hasConfirmedAudits);
      const verificationReason = isVerified
        ? 'Official competition confirmed by audit log and organizer records'
        : 'Self-reported or unofficial competition without independent referee verification';

      let matchesPlayed = 0;
      let matchesWon = 0;
      let matchesDrawn = 0;
      let matchesLost = 0;
      let finalPoints = 0;
      let rank: number | null = null;
      let totalParticipants = 1;

      // Current or historical team in this competition
      const compTeam = teamHistory.find((t) => t.leaderboard_id === leaderboard.id && t.member_id === member.id);
      const teamName = compTeam?.team_name || member.team || null;

      if (engine === 'tournament') {
        const tournamentMatches = await TournamentService.getMatches(leaderboard.id);
        const results = await TournamentService.getMatchResults(leaderboard.id);
        const resultMap = new Map(results.map((r) => [r.match_id, r]));

        totalParticipants = Math.max(1, (await DatabaseService.getMembers(leaderboard.id)).length);

        for (const tm of tournamentMatches) {
          const isHome = tm.home_member_id === member.id;
          const isAway = tm.away_member_id === member.id;
          if (!isHome && !isAway) continue;

          const res = resultMap.get(tm.id);
          const isCompleted = tm.state === 'completed';
          let outcome: 'win' | 'loss' | 'draw' | 'pending' = 'pending';

          if (isCompleted && res) {
            matchesPlayed++;
            if (isHome) {
              if (res.home_score > res.away_score) {
                matchesWon++;
                outcome = 'win';
              } else if (res.home_score < res.away_score) {
                matchesLost++;
                outcome = 'loss';
              } else {
                matchesDrawn++;
                outcome = 'draw';
              }
            } else {
              if (res.away_score > res.home_score) {
                matchesWon++;
                outcome = 'win';
              } else if (res.away_score < res.home_score) {
                matchesLost++;
                outcome = 'loss';
              } else {
                matchesDrawn++;
                outcome = 'draw';
              }
            }
          }

          const opponentId = isHome ? tm.away_member_id : tm.home_member_id;
          const membersList = await DatabaseService.getMembers(leaderboard.id);
          const opponent = opponentId ? membersList.find((m) => m.id === opponentId) : null;

          matches.push({
            match_id: tm.id,
            fixture_id: tm.id,
            leaderboard_id: leaderboard.id,
            competition_name: leaderboard.name,
            slug: leaderboard.slug,
            engine: 'tournament',
            round_name: tm.round_name || `Round ${tm.round_index + 1}`,
            opponent_name: opponent?.name || 'TBD',
            opponent_avatar_url: opponent?.avatar_url || null,
            team_name: teamName,
            home_score: res?.home_score ?? null,
            away_score: res?.away_score ?? null,
            is_home: isHome,
            outcome,
            scheduled_at: tm.scheduled_at,
            venue_name: tm.venue_name || null,
            is_verified: isVerified,
            verification_badge: isVerified ? 'verified' : 'unverified',
            is_hidden: hiddenSet.has(tm.id),
          });
        }

        // Rank determination
        const tournament = await TournamentService.getTournament(leaderboard.id);
        if (tournament?.champion_member_id === member.id) {
          rank = 1;
        }
      } else if (engine === 'league_table') {
        const fixtures = await LeagueService.getFixtures(leaderboard.id);
        const results = await LeagueService.getFixtureResults(leaderboard.id);
        const resultMap = new Map(results.map((r) => [r.fixture_id, r]));

        const allLeagueMembers = await DatabaseService.getMembers(leaderboard.id);
        totalParticipants = Math.max(1, allLeagueMembers.length);

        for (const fix of fixtures) {
          const isHome = fix.home_member_id === member.id;
          const isAway = fix.away_member_id === member.id;
          if (!isHome && !isAway) continue;

          const res = resultMap.get(fix.id);
          const isCompleted = fix.status === 'completed';
          let outcome: 'win' | 'loss' | 'draw' | 'pending' = 'pending';

          if (isCompleted && res) {
            matchesPlayed++;
            if (isHome) {
              if (res.home_score > res.away_score) {
                matchesWon++;
                outcome = 'win';
              } else if (res.home_score < res.away_score) {
                matchesLost++;
                outcome = 'loss';
              } else {
                matchesDrawn++;
                outcome = 'draw';
              }
            } else {
              if (res.away_score > res.home_score) {
                matchesWon++;
                outcome = 'win';
              } else if (res.away_score < res.home_score) {
                matchesLost++;
                outcome = 'loss';
              } else {
                matchesDrawn++;
                outcome = 'draw';
              }
            }
          }

          const opponentId = isHome ? fix.away_member_id : fix.home_member_id;
          const opponent = allLeagueMembers.find((m) => m.id === opponentId);

          matches.push({
            match_id: fix.id,
            fixture_id: fix.id,
            leaderboard_id: leaderboard.id,
            competition_name: leaderboard.name,
            slug: leaderboard.slug,
            engine: 'league_table',
            round_name: fix.round_name || 'Regular Matchday',
            opponent_name: opponent?.name || 'Opponent',
            opponent_avatar_url: opponent?.avatar_url || null,
            team_name: teamName,
            home_score: res?.home_score ?? null,
            away_score: res?.away_score ?? null,
            is_home: isHome,
            outcome,
            scheduled_at: fix.scheduled_at,
            venue_name: fix.venue_name || null,
            is_verified: isVerified,
            verification_badge: isVerified ? 'verified' : 'unverified',
            is_hidden: hiddenSet.has(fix.id),
          });
        }

        // Standings row for rank
        const standings = await LeagueService.getLeagueStandings(leaderboard.id);
        const row = standings.find((s) => s.member_id === member.id);
        if (row) {
          rank = row.position;
          finalPoints = row.stats?.points ?? row.stats?.pts ?? 0;
        }
      } else {
        // Simple points competition
        const rankings = await DatabaseService.getRankings(leaderboard.id);
        totalParticipants = Math.max(1, rankings.length);
        const memExtended = member as LeaderboardMember & { rank?: number; points?: number };
        const playerRank = rankings.find((r) => r.member_id === member.id);
        rank = memExtended.rank ?? playerRank?.position ?? null;
        finalPoints = memExtended.points || playerRank?.total_points || 0;
      }

      // Also inspect general competition_fixtures (e.g. from scheduler, event day, or test fixtures)
      const compFixtures = await DatabaseService.getFixtures(leaderboard.id);
      const allMembers = await DatabaseService.getMembers(leaderboard.id);
      for (const fixRaw of compFixtures) {
        const fixId = String(fixRaw.id || '');
        const participant1Id = (fixRaw.participant1_id || fixRaw.home_member_id) as string | undefined;
        const participant2Id = (fixRaw.participant2_id || fixRaw.away_member_id) as string | undefined;
        const isHome = participant1Id === member.id;
        const isAway = participant2Id === member.id;
        if (!isHome && !isAway) continue;
        if (matches.some((m) => m.match_id === fixId)) continue;

        const isCompleted = fixRaw.status === 'completed';
        let outcome: 'win' | 'loss' | 'draw' | 'pending' = 'pending';

        const p1Score = typeof fixRaw.participant1_score === 'number' ? fixRaw.participant1_score : typeof fixRaw.home_score === 'number' ? fixRaw.home_score : null;
        const p2Score = typeof fixRaw.participant2_score === 'number' ? fixRaw.participant2_score : typeof fixRaw.away_score === 'number' ? fixRaw.away_score : null;

        if (isCompleted) {
          matchesPlayed++;
          if (fixRaw.winner_id === member.id) {
            matchesWon++;
            outcome = 'win';
          } else if (fixRaw.winner_id && fixRaw.winner_id !== member.id) {
            matchesLost++;
            outcome = 'loss';
          } else if (p1Score != null && p2Score != null) {
            const myScore = isHome ? p1Score : p2Score;
            const oppScore = isHome ? p2Score : p1Score;
            if (myScore > oppScore) {
              matchesWon++;
              outcome = 'win';
            } else if (myScore < oppScore) {
              matchesLost++;
              outcome = 'loss';
            } else {
              matchesDrawn++;
              outcome = 'draw';
            }
          }
        }

        const opponentId = isHome ? participant2Id : participant1Id;
        const opponent = allMembers.find((m) => m.id === opponentId);

        matches.push({
          match_id: fixId,
          fixture_id: fixId,
          leaderboard_id: leaderboard.id,
          competition_name: leaderboard.name,
          slug: leaderboard.slug,
          engine: engine,
          round_name: String(fixRaw.stage_id || fixRaw.round_name || 'Regular Match'),
          opponent_name: opponent?.name || 'Opponent',
          opponent_avatar_url: opponent?.avatar_url || null,
          team_name: teamName,
          home_score: p1Score,
          away_score: p2Score,
          is_home: isHome,
          outcome,
          scheduled_at: (fixRaw.scheduled_at as string) || null,
          venue_name: (fixRaw.venue_name as string) || null,
          is_verified: isVerified,
          verification_badge: isVerified ? 'verified' : 'unverified',
          is_hidden: hiddenSet.has(fixId),
        });
      }

      let podiumFinish: 1 | 2 | 3 | null = null;
      const memWithRank = member as LeaderboardMember & { rank?: number; points?: number };
      const effectiveRank = rank ?? memWithRank.rank ?? null;
      if (effectiveRank === 1) podiumFinish = 1;
      else if (effectiveRank === 2) podiumFinish = 2;
      else if (effectiveRank === 3) podiumFinish = 3;

      competitions.push({
        leaderboard_id: leaderboard.id,
        competition_id: leaderboard.id,
        competition_name: leaderboard.name,
        slug: leaderboard.slug,
        competition_type: leaderboard.competition_type,
        engine_type: engine,
        season_name: ((config as Record<string, unknown> | null)?.season_name as string) || null,
        member_id: member.id,
        member_name: member.name,
        team_id: compTeam?.team_id || member.team_id || null,
        team_name: teamName,
        role: compTeam?.role || 'player',
        rank: effectiveRank,
        total_participants: totalParticipants,
        points: finalPoints || memWithRank.points || 0,
        matches_played: matchesPlayed,
        matches_won: matchesWon,
        matches_drawn: matchesDrawn,
        matches_lost: matchesLost,
        podium_finish: podiumFinish,
        is_verified: isVerified,
        verification_badge: isVerified ? 'Official Tournament' : 'Unverified / Community Scrim',
        verification_reason: verificationReason,
        joined_at: member.created_at,
      });
    }

    // 6. Apply privacy filtering if viewer is not the profile owner
    let visibleCompetitions = competitions;
    let visibleMatches = matches.filter((m) => !m.is_hidden || isOwner);

    if (!isOwner) {
      if (!profile.privacy_settings.show_unverified_results) {
        visibleCompetitions = visibleCompetitions.filter((c) => c.is_verified);
        visibleMatches = visibleMatches.filter((m) => m.is_verified);
      }
      if (!profile.privacy_settings.show_match_history) {
        visibleMatches = [];
      }
      if (!profile.privacy_settings.show_teams) {
        teamHistory = [];
      }
    }

    // 7. Compute trustworthy career statistics
    const totalCompetitions = visibleCompetitions.length;
    const verifiedComps = visibleCompetitions.filter((c) => c.is_verified).length;
    const unverifiedComps = totalCompetitions - verifiedComps;

    const totalMatches = Math.max(
      visibleMatches.length,
      visibleCompetitions.reduce((acc, c) => acc + c.matches_played, 0)
    );
    const matchesWon = Math.max(
      visibleMatches.filter((m) => m.outcome === 'win').length,
      visibleCompetitions.reduce((acc, c) => acc + c.matches_won, 0)
    );
    const verifiedWins = visibleMatches.filter((m) => m.outcome === 'win' && m.is_verified).length;
    const matchesDrawn = Math.max(
      visibleMatches.filter((m) => m.outcome === 'draw').length,
      visibleCompetitions.reduce((acc, c) => acc + c.matches_drawn, 0)
    );
    const matchesLost = Math.max(
      visibleMatches.filter((m) => m.outcome === 'loss').length,
      visibleCompetitions.reduce((acc, c) => acc + c.matches_lost, 0)
    );
    const winPercentage = totalMatches > 0 ? Math.round((matchesWon / totalMatches) * 100) : 0;

    const firstPlace = visibleCompetitions.filter((c) => c.is_verified && (c.podium_finish === 1 || c.rank === 1)).length;
    const secondPlace = visibleCompetitions.filter((c) => c.is_verified && (c.podium_finish === 2 || c.rank === 2)).length;
    const thirdPlace = visibleCompetitions.filter((c) => c.is_verified && (c.podium_finish === 3 || c.rank === 3)).length;
    const totalPointsScored = visibleCompetitions.reduce((acc, c) => acc + c.points, 0);

    const activeTeams = teamHistory.filter((t) => !t.left_at).length;

    const overview: PassportCareerOverview = {
      total_competitions: totalCompetitions,
      verified_competitions: verifiedComps,
      unverified_competitions: unverifiedComps,
      total_matches: totalMatches,
      matches_won: matchesWon,
      total_wins: matchesWon,
      verified_wins: verifiedWins,
      matches_drawn: matchesDrawn,
      matches_lost: matchesLost,
      win_percentage: winPercentage,
      win_rate: winPercentage,
      first_place_finishes: firstPlace,
      gold_finishes: firstPlace,
      second_place_finishes: secondPlace,
      silver_finishes: secondPlace,
      third_place_finishes: thirdPlace,
      bronze_finishes: thirdPlace,
      highest_rank_achieved: firstPlace > 0 ? 1 : secondPlace > 0 ? 2 : thirdPlace > 0 ? 3 : null,
      active_streak: 0,
      total_points_scored: totalPointsScored,
      active_teams: activeTeams,
    };

    // Account email only shown if permitted
    const baseUser = await DatabaseService.getCurrentProfile();
    const accountEmail = (profile.privacy_settings.show_email || isOwner) ? (baseUser?.email || null) : null;

    // 8. Fetch earned achievements respecting privacy
    let earnedAchievements: ParticipantAchievement[] = [];
    if (isOwner || profile.privacy_settings.show_trophy_case !== false) {
      const allAchievements = await DatabaseService.getParticipantAchievements(profile.user_id, isOwner);
      earnedAchievements = isOwner ? allAchievements : allAchievements.filter((a) => !a.is_revoked);
    }

    // 9. Fetch competitive ratings and update history respecting privacy
    let competitiveRatings: CompetitionRating[] = [];
    let ratingHistory: RatingHistoryEntry[] = [];
    if (isOwner || profile.privacy_settings.show_ratings !== false) {
      competitiveRatings = await DatabaseService.getCompetitionRatings(profile.user_id, 'individual');
      ratingHistory = await DatabaseService.getRatingHistory(profile.user_id);
    }

    return {
      profile,
      account_email: accountEmail,
      overview,
      competitions: visibleCompetitions,
      matches: visibleMatches,
      teams: teamHistory,
      achievements: earnedAchievements,
      ratings: competitiveRatings,
      rating_history: ratingHistory,
      is_owner: isOwner,
    };
  },

  /**
   * Find unclaimed participant records matching a user's verified email.
   * Returns hybrid items with both member & leaderboard properties for UI and test compatibility.
   */
  async findUnclaimedMatchingMembers(
    userEmail: string
  ): Promise<Array<LeaderboardMember & { member: LeaderboardMember; leaderboard: Leaderboard }>> {
    const clean = userEmail.toLowerCase().trim();
    if (!clean) return [];

    let members: LeaderboardMember[] = [];
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase
        .from('leaderboard_members')
        .select('*')
        .is('user_id', null);
      members = ((data || []) as LeaderboardMember[]).filter((m) => {
        const metadata = m.metadata as Record<string, unknown> | undefined;
        const memEmail = (m.email || (typeof metadata?.email === 'string' ? metadata.email : '')).toLowerCase().trim();
        return memEmail === clean;
      });
    } else {
      const allMembers = mockDb.getMembers();
      members = allMembers.filter((m) => {
        if (m.user_id) return false;
        const metadata = m.metadata as Record<string, unknown> | undefined;
        const memEmail = (m.email || (typeof metadata?.email === 'string' ? metadata.email : '')).toLowerCase().trim();
        return memEmail === clean;
      });
    }

    const results: Array<LeaderboardMember & { member: LeaderboardMember; leaderboard: Leaderboard }> = [];
    for (const mem of members) {
      const lb =
        (await DatabaseService.getLeaderboard(mem.leaderboard_id)) ||
        ({ id: mem.leaderboard_id, name: 'Competition' } as Leaderboard);
      results.push(Object.assign({ ...mem }, { member: mem, leaderboard: lb }));
    }
    return results;
  },



  async getClaimsForUser(userId: string): Promise<ParticipantClaim[]> {
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.from('participant_claims').select('*').eq('user_id', userId);
      return (data || []) as ParticipantClaim[];
    }
    const all = mockDb.get<ParticipantClaim[]>('participant_claims', []);
    return all.filter((c) => c.user_id === userId);
  },

  async getClaimsForLeaderboard(leaderboardId: string, actorUserId?: string): Promise<ParticipantClaim[]> {
    if (actorUserId) {
      const lb = await DatabaseService.getLeaderboard(leaderboardId);
      const admins = await DatabaseService.getAdmins(leaderboardId);
      const isOwnerOrAdmin = lb?.owner_id === actorUserId || admins.some((a) => a.user_id === actorUserId);
      if (!isOwnerOrAdmin) {
        throw new Error('Unauthorized: only organizers or admins can view competition claims.');
      }
    }
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.from('participant_claims').select('*').eq('leaderboard_id', leaderboardId);
      return (data || []) as ParticipantClaim[];
    }
    const all = mockDb.get<ParticipantClaim[]>('participant_claims', []);
    return all.filter((c) => c.leaderboard_id === leaderboardId);
  },
};
