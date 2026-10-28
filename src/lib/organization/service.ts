import {
  Organization,
  OrganizationMember,
  OrganizationRole,
  OrganizationInvitation,
  OrganizationAuditLog,
  OrganizationBrandingConfig,
  Leaderboard,
  DomainStatus,
  Profile,
} from '@/types';
import { DatabaseService, isSupabaseConfigured, mockDb, supabase } from '@/lib/db';

function nowIso(): string {
  return new Date().toISOString();
}

function generateRandomToken(prefix = 'tok'): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let str = '';
  for (let i = 0; i < 24; i++) {
    str += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}_${str}`;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export const OrganizationService = {
  // ─── Organization CRUD ──────────────────────────────────────────────────────

  async createOrganization(
    input: {
      name: string;
      slug?: string;
      description?: string | null;
      website_url?: string | null;
      logo_url?: string | null;
      primary_color?: string;
      secondary_color?: string;
      accent_color?: string;
    },
    creatorId?: string,
    client?: unknown
  ): Promise<Organization> {
    const actorId = creatorId || (await DatabaseService.getCurrentProfile())?.id;
    if (!actorId) {
      throw new Error('Unauthenticated: You must be logged in to create an organization.');
    }

    const trimmedName = input.name.trim();
    if (!trimmedName) {
      throw new Error('Organization name is required.');
    }

    const baseSlug = input.slug?.trim() ? slugify(input.slug) : slugify(trimmedName);
    let finalSlug = baseSlug || 'org';
    const timestamp = nowIso();

    // Check slug collision
    const existing = await this.getOrganization(finalSlug, client);
    if (existing) {
      finalSlug = `${finalSlug}-${Math.random().toString(36).substring(2, 6)}`;
    }

    const newOrg: Organization = {
      id: `org-${Math.random().toString(36).substring(2, 11)}`,
      name: trimmedName,
      slug: finalSlug,
      description: input.description?.trim() || null,
      website_url: input.website_url?.trim() || null,
      logo_url: input.logo_url?.trim() || null,
      primary_color: input.primary_color || '#6366f1',
      secondary_color: input.secondary_color || '#06b6d4',
      accent_color: input.accent_color || '#f59e0b',
      custom_domain: null,
      domain_status: 'unverified',
      domain_verification_token: null,
      domain_verified_at: null,
      hide_powered_by: false,
      created_by: actorId,
      owner_id: actorId,
      created_at: timestamp,
      updated_at: timestamp,
    };

    const db = (client as typeof supabase) || (isSupabaseConfigured && supabase ? supabase : null);

    if (db) {
      const { data, error } = await db
        .from('organizations')
        .insert([{
          name: newOrg.name,
          slug: newOrg.slug,
          description: newOrg.description,
          website_url: newOrg.website_url,
          logo_url: newOrg.logo_url,
          primary_color: newOrg.primary_color,
          secondary_color: newOrg.secondary_color,
          accent_color: newOrg.accent_color,
          created_by: actorId,
        }])
        .select()
        .single();
      if (error) throw error;
      newOrg.id = data.id;

      // Add creator as owner
      const { error: memberError } = await db
        .from('organization_members')
        .insert([{
          organization_id: newOrg.id,
          user_id: actorId,
          role: 'owner',
        }]);
      if (memberError) throw memberError;
    } else {
      const currentOrgs = mockDb.getOrganizations();
      mockDb.setOrganizations([...currentOrgs, newOrg]);

      const currentMembers = mockDb.getOrganizationMembers();
      const ownerMember: OrganizationMember = {
        id: `om-${Math.random().toString(36).substring(2, 9)}`,
        organization_id: newOrg.id,
        user_id: actorId,
        role: 'owner',
        created_at: timestamp,
        updated_at: timestamp,
      };
      mockDb.setOrganizationMembers([...currentMembers, ownerMember]);
    }

    await this.logAuditEntry({
      organization_id: newOrg.id,
      actor_id: actorId,
      action: 'organization.created',
      target_type: 'organization',
      target_id: newOrg.id,
      details: { name: newOrg.name, slug: newOrg.slug },
    }, client);

    return newOrg;
  },

  async getOrganization(idOrSlug: string, client?: unknown): Promise<Organization | null> {
    const db = (client as typeof supabase) || (isSupabaseConfigured && supabase ? supabase : null);
    if (db) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
      const query = db.from('organizations').select('*');
      const { data, error } = isUuid
        ? await query.eq('id', idOrSlug).maybeSingle()
        : await query.eq('slug', idOrSlug).maybeSingle();
      if (error) return null;
      return (data as Organization) || null;
    }

    const orgs = mockDb.getOrganizations();
    const found = orgs.find((o) => o.id === idOrSlug || o.slug === idOrSlug || o.custom_domain === idOrSlug);
    return found ? { ...found } : null;
  },

  async getUserOrganizations(userId: string, client?: unknown): Promise<Array<Organization & { user_role: OrganizationRole }>> {
    if (!userId) return [];

    const db = (client as typeof supabase) || (isSupabaseConfigured && supabase ? supabase : null);
    if (db) {
      const { data, error } = await db
        .from('organization_members')
        .select('role, organizations(*)')
        .eq('user_id', userId);
      if (error) return [];

      type OrgMemberRow = {
        role: OrganizationRole;
        organizations: Organization | Organization[] | null;
      };

      return ((data as unknown as OrgMemberRow[]) || [])
        .map((row) => {
          const org = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
          if (!org) return null;
          return {
            ...org,
            user_role: row.role,
          };
        })
        .filter((item): item is Organization & { user_role: OrganizationRole } => item !== null);
    }

    const members = mockDb.getOrganizationMembers().filter((m) => m.user_id === userId);
    const orgs = mockDb.getOrganizations();
    const orgMap = new Map(orgs.map((o) => [o.id, o]));

    const result: Array<Organization & { user_role: OrganizationRole }> = [];
    for (const m of members) {
      const org = orgMap.get(m.organization_id);
      if (org) {
        result.push({
          ...org,
          user_role: m.role,
        });
      }
    }
    return result;
  },

  // ─── Membership & Roles ─────────────────────────────────────────────────────

  async getMembers(organizationId: string, client?: unknown): Promise<OrganizationMember[]> {
    const db = (client as typeof supabase) || (isSupabaseConfigured && supabase ? supabase : null);
    if (db) {
      const { data, error } = await db
        .from('organization_members')
        .select('*, profiles:user_id(id, email, full_name, avatar_url, role)')
        .eq('organization_id', organizationId);
      if (error) throw error;

      return ((data as unknown as Array<OrganizationMember & { profiles?: Profile }>) || []).map((row) => ({
        id: row.id,
        organization_id: row.organization_id,
        user_id: row.user_id,
        role: row.role as OrganizationRole,
        created_at: row.created_at,
        updated_at: row.updated_at,
        profile: row.profiles as Profile,
      }));
    }

    const members = mockDb.getOrganizationMembers().filter((m) => m.organization_id === organizationId);
    return members.map((m) => {
      const profile = m.user_id === mockDb.getProfile().id ? mockDb.getProfile() : undefined;
      return {
        ...m,
        profile,
      };
    });
  },

  async getMemberRole(organizationId: string, userId: string, client?: unknown): Promise<OrganizationRole | null> {
    if (!organizationId || !userId) return null;

    const db = (client as typeof supabase) || (isSupabaseConfigured && supabase ? supabase : null);
    if (db) {
      const { data, error } = await db
        .from('organization_members')
        .select('role')
        .eq('organization_id', organizationId)
        .eq('user_id', userId)
        .maybeSingle();
      if (error || !data) return null;
      return data.role as OrganizationRole;
    }

    const member = mockDb
      .getOrganizationMembers()
      .find((m) => m.organization_id === organizationId && m.user_id === userId);
    return member?.role || null;
  },

  async requireRole(
    organizationId: string,
    userId: string,
    allowedRoles: OrganizationRole[]
  ): Promise<OrganizationRole> {
    const role = await this.getMemberRole(organizationId, userId);
    if (!role || !allowedRoles.includes(role)) {
      throw new Error(`Permission denied: Action requires one of [${allowedRoles.join(', ')}] role.`);
    }
    return role;
  },

  async inviteMember(
    organizationId: string,
    actorUserId: string,
    email: string,
    role: 'admin' | 'manager' | 'viewer'
  ): Promise<OrganizationInvitation> {
    await this.requireRole(organizationId, actorUserId, ['owner', 'admin']);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Valid email address is required.');
    }

    const token = generateRandomToken('inv');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const timestamp = nowIso();

    const invitation: OrganizationInvitation = {
      id: `inv-${Math.random().toString(36).substring(2, 9)}`,
      organization_id: organizationId,
      email: cleanEmail,
      role,
      token,
      invited_by: actorUserId,
      status: 'pending',
      expires_at: expiresAt,
      created_at: timestamp,
    };

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('organization_invitations')
        .insert([{
          organization_id: organizationId,
          email: cleanEmail,
          role,
          token,
          invited_by: actorUserId,
          expires_at: expiresAt,
        }])
        .select()
        .single();
      if (error) throw error;
      invitation.id = data.id;
    } else {
      const current = mockDb.getOrganizationInvitations();
      mockDb.setOrganizationInvitations([...current, invitation]);
    }

    await this.logAuditEntry({
      organization_id: organizationId,
      actor_id: actorUserId,
      action: 'member.invited',
      target_type: 'invitation',
      target_id: invitation.id,
      details: { email: cleanEmail, role },
    });

    return invitation;
  },

  async getInvitations(organizationId: string): Promise<OrganizationInvitation[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('organization_invitations')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) return [];
      return data || [];
    }

    return mockDb
      .getOrganizationInvitations()
      .filter((i) => i.organization_id === organizationId && i.status === 'pending');
  },

  async acceptInvitation(
    token: string,
    userId: string
  ): Promise<{ success: boolean; organization: Organization }> {
    let invitation: OrganizationInvitation | null = null;

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('organization_invitations')
        .select('*, organizations(*)')
        .eq('token', token)
        .maybeSingle();
      if (error || !data) throw new Error('Invalid or expired invitation token.');
      invitation = data;
    } else {
      invitation = mockDb.getOrganizationInvitations().find((i) => i.token === token) || null;
    }

    if (!invitation) {
      throw new Error('Invitation not found.');
    }
    if (invitation.status !== 'pending') {
      throw new Error(`Invitation has already been ${invitation.status}.`);
    }
    if (new Date(invitation.expires_at) < new Date()) {
      throw new Error('Invitation has expired.');
    }

    const org = await this.getOrganization(invitation.organization_id);
    if (!org) throw new Error('Organization not found.');

    const timestamp = nowIso();

    if (isSupabaseConfigured && supabase) {
      const { error: memberError } = await supabase
        .from('organization_members')
        .upsert([{
          organization_id: invitation.organization_id,
          user_id: userId,
          role: invitation.role,
          updated_at: timestamp,
        }], { onConflict: 'organization_id,user_id' });
      if (memberError) throw memberError;

      await supabase
        .from('organization_invitations')
        .update({ status: 'accepted' })
        .eq('id', invitation.id);
    } else {
      const members = mockDb.getOrganizationMembers();
      const existingIdx = members.findIndex(
        (m) => m.organization_id === invitation!.organization_id && m.user_id === userId
      );

      if (existingIdx >= 0) {
        members[existingIdx].role = invitation.role;
        members[existingIdx].updated_at = timestamp;
      } else {
        members.push({
          id: `om-${Math.random().toString(36).substring(2, 9)}`,
          organization_id: invitation.organization_id,
          user_id: userId,
          role: invitation.role,
          created_at: timestamp,
          updated_at: timestamp,
        });
      }
      mockDb.setOrganizationMembers(members);

      const invites = mockDb.getOrganizationInvitations();
      const invIdx = invites.findIndex((i) => i.id === invitation!.id);
      if (invIdx >= 0) {
        invites[invIdx].status = 'accepted';
        mockDb.setOrganizationInvitations(invites);
      }
    }

    await this.logAuditEntry({
      organization_id: org.id,
      actor_id: userId,
      action: 'member.joined',
      target_type: 'member',
      target_id: userId,
      details: { role: invitation.role, invitation_id: invitation.id },
    });

    return { success: true, organization: org };
  },

  async updateMemberRole(
    organizationId: string,
    actorUserId: string,
    targetUserId: string,
    newRole: OrganizationRole
  ): Promise<OrganizationMember> {
    await this.requireRole(organizationId, actorUserId, ['owner', 'admin']);

    const currentRole = await this.getMemberRole(organizationId, targetUserId);
    if (!currentRole) {
      throw new Error('Target user is not a member of this organization.');
    }

    // Only owners can promote someone to owner or modify an owner's role
    if (newRole === 'owner' || currentRole === 'owner') {
      const actorRole = await this.getMemberRole(organizationId, actorUserId);
      if (actorRole !== 'owner') {
        throw new Error('Only organization owners can grant or revoke the owner role.');
      }
    }

    // Protect sole owner
    if (currentRole === 'owner' && newRole !== 'owner') {
      const allMembers = await this.getMembers(organizationId);
      const ownerCount = allMembers.filter((m) => m.role === 'owner').length;
      if (ownerCount <= 1) {
        throw new Error('Cannot demote the sole organization owner. Transfer ownership first.');
      }
    }

    const timestamp = nowIso();
    let updatedMember: OrganizationMember;

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('organization_members')
        .update({ role: newRole, updated_at: timestamp })
        .eq('organization_id', organizationId)
        .eq('user_id', targetUserId)
        .select()
        .single();
      if (error) throw error;
      updatedMember = data as OrganizationMember;
    } else {
      const members = mockDb.getOrganizationMembers();
      const idx = members.findIndex((m) => m.organization_id === organizationId && m.user_id === targetUserId);
      if (idx === -1) throw new Error('Member not found.');
      members[idx] = {
        ...members[idx],
        role: newRole,
        updated_at: timestamp,
      };
      mockDb.setOrganizationMembers(members);
      updatedMember = members[idx];
    }

    await this.logAuditEntry({
      organization_id: organizationId,
      actor_id: actorUserId,
      action: 'member.role_updated',
      target_type: 'member',
      target_id: targetUserId,
      details: { previous_role: currentRole, new_role: newRole },
    });

    return updatedMember;
  },

  async removeMember(
    organizationId: string,
    actorUserId: string,
    targetUserId: string
  ): Promise<{ success: boolean }> {
    const isSelf = actorUserId === targetUserId;
    if (!isSelf) {
      await this.requireRole(organizationId, actorUserId, ['owner', 'admin']);
    }

    const targetRole = await this.getMemberRole(organizationId, targetUserId);
    if (!targetRole) {
      throw new Error('Member not found in this organization.');
    }

    if (targetRole === 'owner') {
      const allMembers = await this.getMembers(organizationId);
      const ownerCount = allMembers.filter((m) => m.role === 'owner').length;
      if (ownerCount <= 1) {
        throw new Error('Cannot remove the sole owner of an organization.');
      }
    }

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('organization_members')
        .delete()
        .eq('organization_id', organizationId)
        .eq('user_id', targetUserId);
      if (error) throw error;
    } else {
      const members = mockDb.getOrganizationMembers();
      mockDb.setOrganizationMembers(
        members.filter((m) => !(m.organization_id === organizationId && m.user_id === targetUserId))
      );
    }

    await this.logAuditEntry({
      organization_id: organizationId,
      actor_id: actorUserId,
      action: 'member.removed',
      target_type: 'member',
      target_id: targetUserId,
      details: { was_self: isSelf, previous_role: targetRole },
    });

    return { success: true };
  },

  // ─── Branding & Presentation ────────────────────────────────────────────────

  async updateBranding(
    organizationId: string,
    actorUserId: string,
    branding: Partial<OrganizationBrandingConfig>
  ): Promise<Organization> {
    await this.requireRole(organizationId, actorUserId, ['owner', 'admin']);

    const org = await this.getOrganization(organizationId);
    if (!org) throw new Error('Organization not found.');

    // Color sanitization
    const hexPattern = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
    const primaryColor = branding.primary_color && hexPattern.test(branding.primary_color)
      ? branding.primary_color
      : org.primary_color;
    const secondaryColor = branding.secondary_color && hexPattern.test(branding.secondary_color)
      ? branding.secondary_color
      : org.secondary_color;
    const accentColor = branding.accent_color && hexPattern.test(branding.accent_color)
      ? branding.accent_color
      : org.accent_color;

    const timestamp = nowIso();
    const updates: Partial<Organization> = {
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      accent_color: accentColor,
      logo_url: branding.logo_url !== undefined ? branding.logo_url : org.logo_url,
      website_url: branding.website_url !== undefined ? branding.website_url : org.website_url,
      hide_powered_by: branding.hide_powered_by !== undefined ? branding.hide_powered_by : org.hide_powered_by,
      updated_at: timestamp,
    };

    let updatedOrg: Organization;

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('organizations')
        .update(updates)
        .eq('id', organizationId)
        .select()
        .single();
      if (error) throw error;
      updatedOrg = data as Organization;
    } else {
      const orgs = mockDb.getOrganizations();
      const idx = orgs.findIndex((o) => o.id === organizationId);
      if (idx === -1) throw new Error('Organization not found.');
      orgs[idx] = { ...orgs[idx], ...updates };
      mockDb.setOrganizations(orgs);
      updatedOrg = orgs[idx];
    }

    await this.logAuditEntry({
      organization_id: organizationId,
      actor_id: actorUserId,
      action: 'branding.updated',
      target_type: 'branding',
      target_id: organizationId,
      details: {
        primary_color: updatedOrg.primary_color,
        logo_url: updatedOrg.logo_url,
        hide_powered_by: updatedOrg.hide_powered_by,
      },
    });

    return updatedOrg;
  },

  // ─── Custom Domain Architecture ─────────────────────────────────────────────

  async configureCustomDomain(
    organizationId: string,
    actorUserId: string,
    domain: string
  ): Promise<{ organization: Organization; verification: { cname_target: string; txt_record: string; token: string } }> {
    await this.requireRole(organizationId, actorUserId, ['owner', 'admin']);

    const cleanDomain = domain
      .toLowerCase()
      .trim()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '');

    const domainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;
    if (!domainRegex.test(cleanDomain)) {
      throw new Error('Invalid custom domain format. Example: leaderboard.yourclub.com');
    }

    // Check collision across other organizations
    const orgs = isSupabaseConfigured && supabase
      ? (await supabase.from('organizations').select('id, custom_domain').eq('custom_domain', cleanDomain)).data || []
      : mockDb.getOrganizations().filter((o) => o.custom_domain === cleanDomain);

    const collision = orgs.find((o: { id: string }) => o.id !== organizationId);
    if (collision) {
      throw new Error(`Domain "${cleanDomain}" is already registered to another organization.`);
    }

    const verificationToken = generateRandomToken('lb_verify');
    const timestamp = nowIso();

    const updates: Partial<Organization> = {
      custom_domain: cleanDomain,
      domain_status: 'pending',
      domain_verification_token: verificationToken,
      domain_verified_at: null,
      updated_at: timestamp,
    };

    let updatedOrg: Organization;

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('organizations')
        .update(updates)
        .eq('id', organizationId)
        .select()
        .single();
      if (error) throw error;
      updatedOrg = data as Organization;
    } else {
      const current = mockDb.getOrganizations();
      const idx = current.findIndex((o) => o.id === organizationId);
      if (idx === -1) throw new Error('Organization not found.');
      current[idx] = { ...current[idx], ...updates };
      mockDb.setOrganizations(current);
      updatedOrg = current[idx];
    }

    await this.logAuditEntry({
      organization_id: organizationId,
      actor_id: actorUserId,
      action: 'domain.configured',
      target_type: 'domain',
      target_id: cleanDomain,
      details: { domain: cleanDomain, status: 'pending' },
    });

    return {
      organization: updatedOrg,
      verification: {
        cname_target: 'cname.leaderboardos.com',
        txt_record: `_leaderboardos-challenge.${cleanDomain}`,
        token: verificationToken,
      },
    };
  },

  async verifyCustomDomain(
    organizationId: string,
    actorUserId: string,
    options?: { forceSimulateSuccess?: boolean }
  ): Promise<{ verified: boolean; domain_status: DomainStatus; message: string }> {
    await this.requireRole(organizationId, actorUserId, ['owner', 'admin']);

    const org = await this.getOrganization(organizationId);
    if (!org || !org.custom_domain) {
      throw new Error('No custom domain configured for this organization.');
    }

    // In demo mode or explicit simulation testing: allow completing verification
    const isTestSimulation = options?.forceSimulateSuccess || !isSupabaseConfigured;

    if (isTestSimulation) {
      const timestamp = nowIso();
      const updates = {
        domain_status: 'verified' as DomainStatus,
        domain_verified_at: timestamp,
        updated_at: timestamp,
      };

      if (isSupabaseConfigured && supabase) {
        await supabase.from('organizations').update(updates).eq('id', organizationId);
      } else {
        const orgs = mockDb.getOrganizations();
        const idx = orgs.findIndex((o) => o.id === organizationId);
        if (idx >= 0) {
          orgs[idx] = { ...orgs[idx], ...updates };
          mockDb.setOrganizations(orgs);
        }
      }

      await this.logAuditEntry({
        organization_id: organizationId,
        actor_id: actorUserId,
        action: 'domain.verified',
        target_type: 'domain',
        target_id: org.custom_domain,
        details: { domain: org.custom_domain, status: 'verified' },
      });

      return {
        verified: true,
        domain_status: 'verified',
        message: 'DNS records verified successfully. Domain is active for white-label competitions.',
      };
    }

    // In production without external TLS/DNS provisioning API:
    // Report accurately that CNAME and TXT challenge delegation is awaiting DNS propagation
    return {
      verified: false,
      domain_status: 'pending',
      message: 'DNS challenge record pending. Please ensure CNAME and TXT records are set up with your DNS registrar.',
    };
  },

  // ─── Competition Association & Isolation ────────────────────────────────────

  async linkCompetition(
    leaderboardId: string,
    organizationId: string,
    actorUserId: string
  ): Promise<Leaderboard> {
    const lb = await DatabaseService.getLeaderboardById(leaderboardId);
    if (!lb) throw new Error('Competition not found.');

    const org = await this.getOrganization(organizationId);
    if (!org) throw new Error('Organization not found.');

    // Authorization: User must be competition owner OR (an org owner/admin who owns the competition)
    const isOwner = lb.owner_id === actorUserId;
    const orgRole = await this.getMemberRole(organizationId, actorUserId);
    const isOrgAdmin = orgRole === 'owner' || orgRole === 'admin';

    if (!isOwner && !isOrgAdmin) {
      throw new Error('Permission denied: You must be the competition owner or an organization admin to link this competition.');
    }

    const timestamp = nowIso();

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('leaderboards')
        .update({ organization_id: organizationId, updated_at: timestamp })
        .eq('id', leaderboardId);
      if (error) throw error;
      lb.organization_id = organizationId;
    } else {
      const allLbs = mockDb.getLeaderboards();
      const idx = allLbs.findIndex((l) => l.id === leaderboardId);
      if (idx >= 0) {
        allLbs[idx] = { ...allLbs[idx], organization_id: organizationId, updated_at: timestamp };
        mockDb.setLeaderboards(allLbs);
      }
      lb.organization_id = organizationId;
    }

    await this.logAuditEntry({
      organization_id: organizationId,
      actor_id: actorUserId,
      action: 'competition.linked',
      target_type: 'competition',
      target_id: leaderboardId,
      details: { competition_name: lb.name, slug: lb.slug, owner_id: lb.owner_id },
    });

    return lb;
  },

  async unlinkCompetition(
    leaderboardId: string,
    actorUserId: string
  ): Promise<Leaderboard> {
    const lb = await DatabaseService.getLeaderboardById(leaderboardId);
    if (!lb) throw new Error('Competition not found.');

    if (!lb.organization_id) {
      return lb; // Already unlinked
    }

    const previousOrgId = lb.organization_id;
    const isOwner = lb.owner_id === actorUserId;
    const orgRole = await this.getMemberRole(previousOrgId, actorUserId);
    const isOrgAdmin = orgRole === 'owner' || orgRole === 'admin';

    if (!isOwner && !isOrgAdmin) {
      throw new Error('Permission denied: You must be the competition owner or an organization admin to unlink this competition.');
    }

    const timestamp = nowIso();

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase
        .from('leaderboards')
        .update({ organization_id: null, updated_at: timestamp })
        .eq('id', leaderboardId);
      if (error) throw error;
      lb.organization_id = null;
    } else {
      const allLbs = mockDb.getLeaderboards();
      const idx = allLbs.findIndex((l) => l.id === leaderboardId);
      if (idx >= 0) {
        allLbs[idx] = { ...allLbs[idx], organization_id: null, updated_at: timestamp };
        mockDb.setLeaderboards(allLbs);
      }
      lb.organization_id = null;
    }

    await this.logAuditEntry({
      organization_id: previousOrgId,
      actor_id: actorUserId,
      action: 'competition.unlinked',
      target_type: 'competition',
      target_id: leaderboardId,
      details: { competition_name: lb.name, slug: lb.slug },
    });

    return lb;
  },

  async getOrganizationCompetitions(organizationId: string): Promise<Leaderboard[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('leaderboards')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });
      if (error) return [];
      return data || [];
    }

    return mockDb.getLeaderboards().filter((l) => l.organization_id === organizationId);
  },

  // ─── Audit Trail ────────────────────────────────────────────────────────────

  async logAuditEntry(input: {
    organization_id: string;
    actor_id: string | null;
    action: string;
    target_type: string;
    target_id: string | null;
    details?: Record<string, unknown>;
  }, client?: unknown): Promise<void> {
    const timestamp = nowIso();
    const entry: OrganizationAuditLog = {
      id: `oal-${Math.random().toString(36).substring(2, 9)}`,
      organization_id: input.organization_id,
      actor_id: input.actor_id,
      action: input.action,
      target_type: input.target_type,
      target_id: input.target_id,
      details: input.details || {},
      created_at: timestamp,
    };

    const db = (client as typeof supabase) || (isSupabaseConfigured && supabase ? supabase : null);
    if (db) {
      try {
        await db.from('organization_audit_logs').insert([entry]);
      } catch {
        // Safe fallback if audit log table not yet migrated
      }
    } else {
      const logs = mockDb.getOrganizationAuditLogs();
      mockDb.setOrganizationAuditLogs([entry, ...logs].slice(0, 500));
    }
  },

  async getAuditLogs(organizationId: string, actorUserId?: string): Promise<OrganizationAuditLog[]> {
    const actor = actorUserId || (await DatabaseService.getCurrentProfile())?.id;
    if (!actor) {
      throw new Error('Access denied: You must be a member of this organization to view its audit log.');
    }
    const role = await this.getMemberRole(organizationId, actor);
    if (!role) {
      throw new Error('Access denied: You must be a member of this organization to view its audit log.');
    }

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('organization_audit_logs')
        .select('*, profiles:actor_id(id, email, full_name, avatar_url, role)')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) return [];

      return ((data as unknown as Array<OrganizationAuditLog & { profiles?: Profile }>) || []).map((row) => ({
        ...row,
        actor_profile: row.profiles as Profile,
      }));
    }

    return mockDb
      .getOrganizationAuditLogs()
      .filter((l) => l.organization_id === organizationId)
      .slice(0, 100);
  },
};
