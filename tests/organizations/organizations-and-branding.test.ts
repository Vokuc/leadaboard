import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DatabaseService } from '@/lib/db';
import { OrganizationService } from '@/lib/organization/service';

// Mock localStorage and window in node test environment
const store: Record<string, string> = {};
global.window = {
  location: { origin: 'http://localhost' },
} as unknown as Window & typeof globalThis;
global.localStorage = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => {
    store[key] = value;
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    for (const key in store) {
      delete store[key];
    }
  },
} as unknown as Storage;

describe('Organizations and White-Label Competitions', () => {
  const aliceId = 'user-alice-owner';
  const bobId = 'user-bob-admin';
  const charlieId = 'user-charlie-manager';
  const davidId = 'user-david-viewer';
  const eveId = 'user-eve-outsider';

  beforeEach(() => {
    localStorage.clear();
    DatabaseService.initialize();

    vi.spyOn(DatabaseService, 'getCurrentProfile').mockImplementation(async () => {
      return {
        id: aliceId,
        email: 'alice@apex.gg',
        full_name: 'Alice Mercer',
        role: 'super_admin',
        avatar_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });
  });

  describe('Organization Creation & Owner Assignment', () => {
    it('creates an organization and automatically assigns creator as owner', async () => {
      const org = await OrganizationService.createOrganization(
        {
          name: 'Apex Esports Academy',
          description: 'Premier collegiate gaming club',
        },
        aliceId
      );

      expect(org).toBeDefined();
      expect(org.id).toBeDefined();
      expect(org.name).toBe('Apex Esports Academy');
      expect(org.slug).toBe('apex-esports-academy');
      expect(org.owner_id).toBe(aliceId);
      expect(org.created_by).toBe(aliceId);

      // Verify membership
      const role = await OrganizationService.getMemberRole(org.id, aliceId);
      expect(role).toBe('owner');

      const members = await OrganizationService.getMembers(org.id);
      expect(members.length).toBe(1);
      expect(members[0].user_id).toBe(aliceId);
      expect(members[0].role).toBe('owner');
    });

    it('generates a unique slug when duplicates exist', async () => {
      const org1 = await OrganizationService.createOrganization(
        { name: 'Velocity Track Club', slug: 'velocity-track' },
        aliceId
      );
      const org2 = await OrganizationService.createOrganization(
        { name: 'Velocity Track Club', slug: 'velocity-track' },
        bobId
      );

      expect(org1.slug).toBe('velocity-track');
      expect(org2.slug).toMatch(/^velocity-track-[a-z0-9]{4}$/);
    });
  });

  describe('Role-Based Membership and Permissions', () => {
    let testOrgId: string;

    beforeEach(async () => {
      const org = await OrganizationService.createOrganization(
        { name: 'Metro Basketball League' },
        aliceId
      );
      testOrgId = org.id;

      // Add Bob as admin, Charlie as manager, David as viewer
      const invBob = await OrganizationService.inviteMember(
        testOrgId,
        aliceId,
        'bob@test.com',
        'admin'
      );
      await OrganizationService.acceptInvitation(invBob.token, bobId);

      const invCharlie = await OrganizationService.inviteMember(
        testOrgId,
        aliceId,
        'charlie@test.com',
        'manager'
      );
      await OrganizationService.acceptInvitation(invCharlie.token, charlieId);

      const invDavid = await OrganizationService.inviteMember(
        testOrgId,
        aliceId,
        'david@test.com',
        'viewer'
      );
      await OrganizationService.acceptInvitation(invDavid.token, davidId);
    });

    it('allows owner and admin to invite new members', async () => {
      // Alice (owner) invites
      const inv1 = await OrganizationService.inviteMember(
        testOrgId,
        aliceId,
        'coach1@test.com',
        'manager'
      );
      expect(inv1.status).toBe('pending');

      // Bob (admin) invites
      const inv2 = await OrganizationService.inviteMember(
        testOrgId,
        bobId,
        'coach2@test.com',
        'viewer'
      );
      expect(inv2.status).toBe('pending');
    });

    it('blocks managers and viewers from inviting members', async () => {
      // Charlie (manager)
      await expect(
        OrganizationService.inviteMember(testOrgId, charlieId, 'someone@test.com', 'viewer')
      ).rejects.toThrow(/Permission denied/);

      // David (viewer)
      await expect(
        OrganizationService.inviteMember(testOrgId, davidId, 'someone@test.com', 'viewer')
      ).rejects.toThrow(/Permission denied/);
    });

    it('allows owner and admin to update roles', async () => {
      // Bob (admin) updates Charlie (manager) to admin
      const updated = await OrganizationService.updateMemberRole(
        testOrgId,
        bobId,
        charlieId,
        'admin'
      );
      expect(updated.role).toBe('admin');
    });

    it('prevents demoting or removing the sole owner of an organization', async () => {
      // Bob (admin) tries to demote Alice (sole owner)
      await expect(
        OrganizationService.updateMemberRole(testOrgId, bobId, aliceId, 'admin')
      ).rejects.toThrow(/Only organization owners can grant or revoke the owner role/);

      // Alice (owner) tries to demote herself when she is the sole owner
      await expect(
        OrganizationService.updateMemberRole(testOrgId, aliceId, aliceId, 'admin')
      ).rejects.toThrow(/Cannot demote the sole organization owner/);

      // Bob tries to remove Alice
      await expect(
        OrganizationService.removeMember(testOrgId, bobId, aliceId)
      ).rejects.toThrow(/Cannot remove the sole owner/);
    });

    it('allows removing a non-owner member and logs audit trail', async () => {
      await OrganizationService.removeMember(testOrgId, aliceId, davidId);
      const members = await OrganizationService.getMembers(testOrgId);
      expect(members.find((m) => m.user_id === davidId)).toBeUndefined();

      const auditLogs = await OrganizationService.getAuditLogs(testOrgId, aliceId);
      const removeEvent = auditLogs.find((l) => l.action === 'member.removed');
      expect(removeEvent).toBeDefined();
      expect(removeEvent?.actor_id).toBe(aliceId);
    });
  });

  describe('Competition Association & Ownership Protection', () => {
    let testOrgId: string;
    let aliceCompetitionId: string;

    beforeEach(async () => {
      const org = await OrganizationService.createOrganization(
        { name: 'Tri-State Sports Alliance' },
        aliceId
      );
      testOrgId = org.id;

      // Alice creates an individually owned competition (organization_id is null)
      const lb = await DatabaseService.createLeaderboard(
        {
          name: 'Summer Open Tennis',
          slug: 'summer-open-tennis',
          visibility: 'public',
          competition_type: 'sports',
        },
        [],
        null
      );
      aliceCompetitionId = lb.id;

      // Add Charlie as manager in Tri-State Sports Alliance
      const invCharlie = await OrganizationService.inviteMember(
        testOrgId,
        aliceId,
        'charlie@test.com',
        'manager'
      );
      await OrganizationService.acceptInvitation(invCharlie.token, charlieId);
    });

    it('safely links a competition to an organization preserving original owner_id', async () => {
      const lbBefore = await DatabaseService.getLeaderboardById(aliceCompetitionId);
      const originalOwner = lbBefore?.owner_id;
      expect(originalOwner).toBeDefined();

      // Alice links competition to organization
      const linked = await OrganizationService.linkCompetition(
        aliceCompetitionId,
        testOrgId,
        aliceId
      );

      expect(linked.organization_id).toBe(testOrgId);
      // Ownership MUST remain unchanged
      expect(linked.owner_id).toBe(originalOwner);

      // Verify organization manager can now manage this competition via database service
      const canCharlieManage = await DatabaseService.canManageLeaderboard(
        charlieId,
        aliceCompetitionId
      );
      expect(canCharlieManage).toBe(true);

      // Verify audit log
      const logs = await OrganizationService.getAuditLogs(testOrgId, aliceId);
      const linkLog = logs.find((l) => l.action === 'competition.linked');
      expect(linkLog).toBeDefined();
    });

    it('unlinks a competition from organization back to personal workspace preserving owner_id', async () => {
      await OrganizationService.linkCompetition(aliceCompetitionId, testOrgId, aliceId);

      const unlinked = await OrganizationService.unlinkCompetition(
        aliceCompetitionId,
        aliceId
      );

      expect(unlinked.organization_id).toBeNull();
      // Charlie (manager in org) can no longer manage this personal competition
      const canCharlieManage = await DatabaseService.canManageLeaderboard(
        charlieId,
        aliceCompetitionId
      );
      expect(canCharlieManage).toBe(false);
    });

    it('blocks non-members and non-admins from linking competitions', async () => {
      await expect(
        OrganizationService.linkCompetition(aliceCompetitionId, testOrgId, eveId)
      ).rejects.toThrow(/Permission denied/);
    });
  });

  describe('Cross-Organization Isolation', () => {
    let orgAId: string;
    let orgBId: string;
    let compAId: string;
    let compBId: string;

    beforeEach(async () => {
      // Org A owned by Alice
      const orgA = await OrganizationService.createOrganization({ name: 'Alpha Clan' }, aliceId);
      orgAId = orgA.id;

      // Org B owned by Bob
      const orgB = await OrganizationService.createOrganization({ name: 'Beta Clan' }, bobId);
      orgBId = orgB.id;

      // Competition in Org A (created by Alice)
      const lbA = await DatabaseService.createLeaderboard(
        {
          name: 'Alpha Scrims',
          slug: 'alpha-scrims',
          visibility: 'private',
          competition_type: 'gaming',
        },
        [],
        null
      );
      compAId = lbA.id;
      await OrganizationService.linkCompetition(compAId, orgAId, aliceId);

      // Competition in Org B (created by Bob)
      vi.spyOn(DatabaseService, 'getCurrentProfile').mockResolvedValueOnce({
        id: bobId,
        email: 'bob@beta.gg',
        full_name: 'Bob Admin',
        role: 'super_admin',
        avatar_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const lbB = await DatabaseService.createLeaderboard(
        {
          name: 'Beta Tourney',
          slug: 'beta-tourney',
          visibility: 'private',
          competition_type: 'gaming',
        },
        [],
        null
      );
      compBId = lbB.id;
      await OrganizationService.linkCompetition(compBId, orgBId, bobId);
    });

    it('strictly isolates competition management across organizations', async () => {
      // Alice cannot manage Org B's competition
      const canAliceManageB = await DatabaseService.canManageLeaderboard(aliceId, compBId);
      expect(canAliceManageB).toBe(false);

      // Bob cannot manage Org A's competition
      const canBobManageA = await DatabaseService.canManageLeaderboard(bobId, compAId);
      expect(canBobManageA).toBe(false);
    });

    it('strictly isolates audit logs and members across organizations', async () => {
      // Bob cannot view Org A's audit logs
      await expect(OrganizationService.getAuditLogs(orgAId, bobId)).rejects.toThrow(
        /Access denied/
      );

      // Alice cannot view Org B's audit logs
      await expect(OrganizationService.getAuditLogs(orgBId, aliceId)).rejects.toThrow(
        /Access denied/
      );
    });
  });

  describe('Configurable Branding & Custom Domain Architecture', () => {
    let testOrgId: string;

    beforeEach(async () => {
      const org = await OrganizationService.createOrganization(
        { name: 'Apex Athletics' },
        aliceId
      );
      testOrgId = org.id;
    });

    it('updates organization branding with name, logo, and colors', async () => {
      const updated = await OrganizationService.updateBranding(
        testOrgId,
        aliceId,
        {
          primary_color: '#3b82f6',
          secondary_color: '#1d4ed8',
          accent_color: '#10b981',
          logo_url: 'https://example.com/apex-logo.svg',
        }
      );

      expect(updated.logo_url).toBe('https://example.com/apex-logo.svg');
      expect(updated.primary_color).toBe('#3b82f6');
      expect(updated.secondary_color).toBe('#1d4ed8');
      expect(updated.accent_color).toBe('#10b981');

      // Verify audit trail logged
      const logs = await OrganizationService.getAuditLogs(testOrgId, aliceId);
      const brandLog = logs.find((l) => l.action === 'branding.updated');
      expect(brandLog).toBeDefined();
      expect(brandLog?.actor_id).toBe(aliceId);
    });

    it('configures custom domain with safe non-deceptive pending status and DNS challenge instructions', async () => {
      const result = await OrganizationService.configureCustomDomain(
        testOrgId,
        aliceId,
        'leaderboards.apexathletics.com'
      );

      expect(result.organization.custom_domain).toBe('leaderboards.apexathletics.com');
      // Crucial: Must start in 'pending' status without falsely claiming live/active status
      expect(result.organization.domain_status).toBe('pending');
      expect(result.verification).toBeDefined();
      expect(result.verification.cname_target).toBe('cname.leaderboardos.com');
      expect(result.verification.txt_record).toBe(
        '_leaderboardos-challenge.leaderboards.apexathletics.com'
      );
      expect(result.verification.token).toMatch(/^lb_verify_/);

      // Verify audit trail logged
      const logs = await OrganizationService.getAuditLogs(testOrgId, aliceId);
      const domainLog = logs.find((l) => l.action === 'domain.configured');
      expect(domainLog).toBeDefined();
    });

    it('safely verifies custom domain challenge', async () => {
      await OrganizationService.configureCustomDomain(
        testOrgId,
        aliceId,
        'tournaments.apexathletics.com'
      );

      const verification = await OrganizationService.verifyCustomDomain(testOrgId, aliceId);
      expect(verification.domain_status).toBe('verified');
      expect(verification.verified).toBe(true);
    });
  });
});
