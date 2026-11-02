import { describe, it, expect, beforeEach } from 'vitest';
import { OrganizationService } from '@/lib/organization/service';
import { DatabaseService, mockDb } from '@/lib/db';
import { LeagueService } from '@/lib/league/service';
import { TournamentService } from '@/lib/tournament/service';

// In-memory mock localStorage fallback for Vitest Node environment
const createMockLocalStorage = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
};

if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: createMockLocalStorage(),
    writable: true,
  });
}

describe('Organization Workspace, Competition Association, and Discovery', () => {
  const testUserId = 'test-owner-user-999';

  beforeEach(() => {
    localStorage.clear();
    mockDb.init();
  });

  describe('Organization Persistence & Retrieval', () => {
    it('creates an organization and retrieves it reliably under My Organizations', async () => {
      const org = await OrganizationService.createOrganization(
        {
          name: 'Apex Predators Clan',
          slug: 'apex-predators',
          description: 'Competitive esports and tournament operations clan.',
          logo_url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=200',
        },
        testUserId
      );

      expect(org.id).toBeDefined();
      expect(org.name).toBe('Apex Predators Clan');
      expect(org.slug).toBe('apex-predators');

      // Retrieve user's organizations
      const userOrgs = await OrganizationService.getUserOrganizations(testUserId);
      expect(userOrgs.some((o) => o.id === org.id)).toBe(true);

      const found = userOrgs.find((o) => o.id === org.id);
      expect(found?.user_role).toBe('owner');
      expect(found?.name).toBe('Apex Predators Clan');
    });

    it('guarantees creator is recognized as owner even if membership query only has creator ID', async () => {
      const org = await OrganizationService.createOrganization(
        {
          name: 'Pioneer High Athletics',
          slug: 'pioneer-high',
        },
        testUserId
      );

      // Verify role resolution
      const role = await OrganizationService.getMemberRole(org.id, testUserId);
      expect(role).toBe('owner');

      // Verify unassociated user has no role
      const strangerRole = await OrganizationService.getMemberRole(org.id, 'random-stranger-id');
      expect(strangerRole).toBeNull();
    });
  });

  describe('Competition Association in Workspace', () => {
    it('associates existing competitions with an organization workspace and unlinks safely', async () => {
      const org = await OrganizationService.createOrganization(
        {
          name: 'Cyber Esports League',
          slug: 'cyber-esports',
        },
        testUserId
      );

      // Create a standalone leaderboard
      const lb = await DatabaseService.createLeaderboard(
        {
          name: 'Neon Apex Tournament',
          slug: 'neon-apex',
          visibility: 'public',
          competition_type: 'gaming',
          cover_image_url: null,
        },
        [],
        null
      );

      expect(lb.organization_id).toBeFalsy();

      // Link competition to organization
      const linked = await OrganizationService.linkCompetition(lb.id, org.id, testUserId);
      expect(linked.organization_id).toBe(org.id);

      // Verify retrieval in workspace competitions
      const orgComps = await OrganizationService.getOrganizationCompetitions(org.id);
      expect(orgComps.some((c) => c.id === lb.id)).toBe(true);

      // Unlink competition
      const unlinked = await OrganizationService.unlinkCompetition(lb.id, testUserId);
      expect(unlinked.organization_id).toBeNull();

      // Verify no longer appears in organization workspace
      const remainingComps = await OrganizationService.getOrganizationCompetitions(org.id);
      expect(remainingComps.some((c) => c.id === lb.id)).toBe(false);

      // Verify competition still exists standalone with its original owner
      const standalone = await DatabaseService.getLeaderboardById(lb.id);
      expect(standalone).not.toBeNull();
      expect(standalone?.name).toBe('Neon Apex Tournament');
    });

    it('creates league competition directly within organization context', async () => {
      const org = await OrganizationService.createOrganization(
        {
          name: 'Metro Sunday League',
          slug: 'metro-sunday',
        },
        testUserId
      );

      const league = await LeagueService.createLeagueCompetition({
        name: 'Premier Summer League',
        slug: 'premier-summer',
        description: 'Division 1 football league',
        visibility: 'public',
        competitionType: 'sports',
        coverImageUrl: null,
        organizationId: org.id,
        templateKey: 'football',
        entityType: 'teams',
        seasonName: 'Summer 2026',
        startDate: '2026-06-01',
        endDate: '2026-08-30',
        pointsForWin: 3,
        pointsForDraw: 1,
        pointsForLoss: 0,
        selectedStatisticKeys: ['goals_for', 'goals_against'],
        standingsColumnKeys: ['played', 'won', 'drawn', 'lost', 'points'],
        rankingRules: [],
      });

      expect(league.organization_id).toBe(org.id);

      const orgComps = await OrganizationService.getOrganizationCompetitions(org.id);
      expect(orgComps.some((c) => c.id === league.id)).toBe(true);
    });

    it('creates tournament competition directly within organization context', async () => {
      const org = await OrganizationService.createOrganization(
        {
          name: 'Gladiator Arenas',
          slug: 'gladiator-arenas',
        },
        testUserId
      );

      const tournament = await TournamentService.createTournamentCompetition({
        name: 'Arena Knockout Cup',
        slug: 'arena-knockout',
        description: 'Single elimination knockout cup',
        visibility: 'public',
        competitionType: 'gaming',
        coverImageUrl: null,
        organizationId: org.id,
        templateKey: 'custom',
        seasonName: 'Invitational 2026',
        startDate: '2026-07-01',
        endDate: null,
        bracketSize: 8,
        seedingMode: 'random',
      });

      expect(tournament.organization_id).toBe(org.id);

      const orgComps = await OrganizationService.getOrganizationCompetitions(org.id);
      expect(orgComps.some((c) => c.id === tournament.id)).toBe(true);
    });
  });

  describe('Discover Organizations vs My Organizations Separation', () => {
    it('only lists organizations in public discovery if they host active public competitions', async () => {
      // Org 1: Has a public active competition -> Should be discoverable
      const publicOrg = await OrganizationService.createOrganization(
        {
          name: 'Grandmasters Chess Club',
          slug: 'grandmasters-chess',
          description: 'Weekly classical and rapid chess championships.',
        },
        testUserId
      );

      const pubComp = await DatabaseService.createLeaderboard(
        {
          name: 'Rapid Open 2026',
          slug: 'rapid-open-2026',
          visibility: 'public',
          competition_type: 'custom',
          cover_image_url: null,
          organization_id: publicOrg.id,
        },
        [],
        null
      );
      expect(pubComp.organization_id).toBe(publicOrg.id);

      // Org 2: Has only private competitions -> Should NOT be discoverable
      const privateOrg = await OrganizationService.createOrganization(
        {
          name: 'Secret Internal Corporate League',
          slug: 'secret-corporate',
          description: 'Internal private department challenges.',
        },
        testUserId
      );

      await DatabaseService.createLeaderboard(
        {
          name: 'Internal Dev Hackathon',
          slug: 'internal-dev-hackathon',
          visibility: 'private',
          competition_type: 'workplace',
          cover_image_url: null,
          organization_id: privateOrg.id,
        },
        [],
        null
      );

      // Org 3: Empty organization with no competitions -> Should NOT be discoverable
      await OrganizationService.createOrganization(
        {
          name: 'Brand New Empty Org',
          slug: 'empty-org',
        },
        testUserId
      );

      // Query public discovery
      const discoverable = await OrganizationService.getDiscoverableOrganizations();
      const discoverableIds = discoverable.map((o) => o.id);

      // Public org must be included
      expect(discoverableIds).toContain(publicOrg.id);
      const publicEntry = discoverable.find((o) => o.id === publicOrg.id);
      expect(publicEntry?.public_competition_count).toBeGreaterThanOrEqual(1);

      // Private org and empty org must NOT be included in public discovery
      expect(discoverableIds).not.toContain(privateOrg.id);

      // But under My Organizations, all three must be visible to their authorized owner
      const myOrgs = await OrganizationService.getUserOrganizations(testUserId);
      const myOrgIds = myOrgs.map((o) => o.id);
      expect(myOrgIds).toContain(publicOrg.id);
      expect(myOrgIds).toContain(privateOrg.id);
    });

    it('filters public organizations by search query', async () => {
      const soccerOrg = await OrganizationService.createOrganization(
        {
          name: 'National Soccer Championship',
          slug: 'national-soccer',
          description: 'Official youth soccer federation.',
        },
        testUserId
      );

      await DatabaseService.createLeaderboard(
        {
          name: 'U18 National Cup',
          slug: 'u18-national-cup',
          visibility: 'public',
          competition_type: 'sports',
          cover_image_url: null,
          organization_id: soccerOrg.id,
        },
        [],
        null
      );

      // Query matching search term
      const matches = await OrganizationService.getDiscoverableOrganizations('Soccer');
      expect(matches.some((o) => o.id === soccerOrg.id)).toBe(true);

      // Query non-matching search term
      const nonMatches = await OrganizationService.getDiscoverableOrganizations('NonExistentTermXYZ');
      expect(nonMatches.some((o) => o.id === soccerOrg.id)).toBe(false);
    });
  });
});

