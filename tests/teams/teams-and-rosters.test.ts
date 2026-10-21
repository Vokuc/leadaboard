import { describe, expect, it, vi, beforeEach } from 'vitest';
import { DatabaseService, generateShortCode } from '@/lib/db';

// Mock localStorage and window in node test environment
const store: Record<string, string> = {};
global.window = {
  location: { origin: 'http://localhost' }
} as unknown as Window & typeof globalThis;
global.localStorage = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => {
    for (const key in store) {
      delete store[key];
    }
  }
} as unknown as Storage;

describe('First-Class Teams and Rosters', () => {
  let mockUser: { id: string; email: string; full_name: string; role: 'member' | 'admin' | 'billing_admin' | 'super_admin' } | null = null;
  const boardId = 'lb-gaming-1';
  const otherBoardId = 'lb-workplace-1';
  const ownerId = 'creator-user-id';
  const unauthorizedUserId = 'regular-user-id';

  beforeEach(() => {
    localStorage.clear();
    DatabaseService.initialize();

    // Default to authorized owner
    mockUser = {
      id: ownerId,
      email: 'creator@leaderboardos.com',
      full_name: 'Alex Mercer',
      role: 'super_admin'
    };

    vi.spyOn(DatabaseService, 'getCurrentProfile').mockImplementation(async () => {
      if (!mockUser) return null;
      return {
        ...mockUser,
        avatar_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    });
  });

  describe('Short Code Generation Helper', () => {
    it('generates acronyms for multi-word team names', () => {
      expect(generateShortCode('Team Rogue')).toBe('TR');
      expect(generateShortCode('Sales - North America')).toBe('SNA');
      expect(generateShortCode('Red Bull Racing')).toBe('RBR');
    });

    it('generates clean uppercase prefixes for single-word names', () => {
      expect(generateShortCode('Ninjas')).toBe('NINJ');
      expect(generateShortCode('Fox')).toBe('FOX');
      expect(generateShortCode('A')).toBe('A');
    });
  });

  describe('Normalized Team Entity CRUD', () => {
    it('creates a new team scoped to the competition with short code and logo', async () => {
      const team = await DatabaseService.createTeam(boardId, {
        name: 'Vanguard Elite',
        short_code: 'VE',
        logo_url: 'https://example.com/logo.png',
      });

      expect(team).toBeDefined();
      expect(team.id).toBeDefined();
      expect(team.leaderboard_id).toBe(boardId);
      expect(team.name).toBe('Vanguard Elite');
      expect(team.short_code).toBe('VE');
      expect(team.logo_url).toBe('https://example.com/logo.png');

      const allTeams = await DatabaseService.getTeams(boardId);
      expect(allTeams.some(t => t.id === team.id)).toBe(true);
    });

    it('automatically generates short code if not provided', async () => {
      const team = await DatabaseService.createTeam(boardId, {
        name: 'Shadow Strikers',
      });

      expect(team.short_code).toBe('SS');
    });

    it('enforces uniqueness of team name within the competition scope', async () => {
      await DatabaseService.createTeam(boardId, { name: 'Alpha Squad' });

      await expect(
        DatabaseService.createTeam(boardId, { name: 'Alpha Squad' })
      ).rejects.toThrow(/already exists/i);

      // Case-insensitive duplicate check
      await expect(
        DatabaseService.createTeam(boardId, { name: 'alpha squad' })
      ).rejects.toThrow(/already exists/i);
    });

    it('allows identical team names across different competitions', async () => {
      const team1 = await DatabaseService.createTeam(boardId, { name: 'Omega Squad' });
      const team2 = await DatabaseService.createTeam(otherBoardId, { name: 'Omega Squad' });

      expect(team1.id).not.toBe(team2.id);
      expect(team1.leaderboard_id).toBe(boardId);
      expect(team2.leaderboard_id).toBe(otherBoardId);
    });

    it('updates a team and synchronizes legacy member free-text team field', async () => {
      const team = await DatabaseService.createTeam(boardId, { name: 'Original Name' });
      
      // Create member assigned to this team
      const member = await DatabaseService.addMember(boardId, {
        name: 'Player One',
        email: 'p1@test.com',
        avatar_url: null,
        team_id: team.id,
        team: team.name,
        notes: null
      });

      expect(member.team).toBe('Original Name');
      expect(member.team_id).toBe(team.id);

      // Rename team
      const updated = await DatabaseService.updateTeam(team.id, {
        name: 'Renamed Titans',
        short_code: 'RT'
      });

      expect(updated.name).toBe('Renamed Titans');
      expect(updated.short_code).toBe('RT');

      // Verify member record was automatically synchronized
      const members = await DatabaseService.getMembers(boardId);
      const updatedMember = members.find(m => m.id === member.id);
      expect(updatedMember?.team).toBe('Renamed Titans');
    });

    it('deleting a team unassigns members without deleting the participants', async () => {
      const team = await DatabaseService.createTeam(boardId, { name: 'Temporary Team' });
      const member = await DatabaseService.addMember(boardId, {
        name: 'Roster Guy',
        email: 'guy@test.com',
        avatar_url: null,
        team_id: team.id,
        team: team.name,
        notes: null
      });

      await DatabaseService.deleteTeam(team.id);

      const teams = await DatabaseService.getTeams(boardId);
      expect(teams.some(t => t.id === team.id)).toBe(false);

      const members = await DatabaseService.getMembers(boardId);
      const survivingMember = members.find(m => m.id === member.id);
      expect(survivingMember).toBeDefined();
      expect(survivingMember?.team_id).toBeNull();
    });
  });

  describe('Roster Membership and Roles', () => {
    it('assigns participants to a team with roles (captain, player, substitute) and jersey numbers', async () => {
      const team = await DatabaseService.createTeam(boardId, { name: 'Challenger FC' });
      
      const captain = await DatabaseService.addMember(boardId, {
        name: 'Captain Jack',
        email: 'jack@test.com',
        avatar_url: null,
        team: null,
        notes: null
      });

      const player = await DatabaseService.addMember(boardId, {
        name: 'Striker Sam',
        email: 'sam@test.com',
        avatar_url: null,
        team: null,
        notes: null
      });

      const sub = await DatabaseService.addMember(boardId, {
        name: 'Bench Ben',
        email: 'ben@test.com',
        avatar_url: null,
        team: null,
        notes: null
      });

      // Add to roster
      const tm1 = await DatabaseService.addTeamMember(team.id, captain.id, 'captain', 10);
      const tm2 = await DatabaseService.addTeamMember(team.id, player.id, 'player', 7);
      const tm3 = await DatabaseService.addTeamMember(team.id, sub.id, 'substitute', 23);

      expect(tm1.role).toBe('captain');
      expect(tm1.jersey_number).toBe(10);
      expect(tm2.role).toBe('player');
      expect(tm2.jersey_number).toBe(7);
      expect(tm3.role).toBe('substitute');
      expect(tm3.jersey_number).toBe(23);

      // Verify getTeamWithRoster returns full roster breakdown
      const withRoster = await DatabaseService.getTeamWithRoster(team.id);
      expect(withRoster).toBeDefined();
      expect(withRoster?.member_count).toBe(3);
      expect(withRoster?.members.length).toBe(3);
    });

    it('prevents duplicate membership: a participant cannot join multiple teams in the same competition', async () => {
      const teamA = await DatabaseService.createTeam(boardId, { name: 'Red Team' });
      const teamB = await DatabaseService.createTeam(boardId, { name: 'Blue Team' });

      const member = await DatabaseService.addMember(boardId, {
        name: 'Dual Player',
        email: 'dual@test.com',
        avatar_url: null,
        team: null,
        notes: null
      });

      await DatabaseService.addTeamMember(teamA.id, member.id, 'player');

      // Attempt to join Team B
      await expect(
        DatabaseService.addTeamMember(teamB.id, member.id, 'player')
      ).rejects.toThrow(/already assigned to another team/i);
    });

    it('prevents adding the same participant twice to the same team', async () => {
      const team = await DatabaseService.createTeam(boardId, { name: 'Solo Squad' });
      const member = await DatabaseService.addMember(boardId, {
        name: 'Solo Player',
        email: 'solo@test.com',
        avatar_url: null,
        team: null,
        notes: null
      });

      await DatabaseService.addTeamMember(team.id, member.id, 'player');

      await expect(
        DatabaseService.addTeamMember(team.id, member.id, 'captain')
      ).rejects.toThrow(/already a member of this team roster/i);
    });

    it('allows updating roster roles and jersey numbers', async () => {
      const team = await DatabaseService.createTeam(boardId, { name: 'Role Changers' });
      const member = await DatabaseService.addMember(boardId, {
        name: 'Evolving Player',
        email: 'evolving@test.com',
        avatar_url: null,
        team: null,
        notes: null
      });

      await DatabaseService.addTeamMember(team.id, member.id, 'player', 99);
      
      // Promote to captain and change jersey number
      const updated = await DatabaseService.updateTeamMemberRole(team.id, member.id, 'captain', 1);
      expect(updated.role).toBe('captain');
      expect(updated.jersey_number).toBe(1);
    });

    it('removes member from roster cleanly', async () => {
      const team = await DatabaseService.createTeam(boardId, { name: 'Departures FC' });
      const member = await DatabaseService.addMember(boardId, {
        name: 'Leaving Player',
        email: 'leaving@test.com',
        avatar_url: null,
        team: null,
        notes: null
      });

      await DatabaseService.addTeamMember(team.id, member.id, 'player');
      expect((await DatabaseService.getTeamMembers(team.id)).length).toBe(1);

      await DatabaseService.removeTeamMember(team.id, member.id);
      expect((await DatabaseService.getTeamMembers(team.id)).length).toBe(0);

      // Participant is now free to join another team
      const otherTeam = await DatabaseService.createTeam(boardId, { name: 'New Haven' });
      await expect(
        DatabaseService.addTeamMember(otherTeam.id, member.id, 'player')
      ).resolves.toBeDefined();
    });
  });

  describe('Non-Destructive Backfill / Lazy Migration Strategy', () => {
    it('backfills legacy free-text team names into normalized teams and roster memberships', async () => {
      // Add members with free-text team names without normalized team entities
      await DatabaseService.addMember(boardId, {
        name: 'Legacy Member 1',
        email: 'lm1@test.com',
        avatar_url: null,
        team: 'Legacy Dragons',
        notes: null
      });

      await DatabaseService.addMember(boardId, {
        name: 'Legacy Member 2',
        email: 'lm2@test.com',
        avatar_url: null,
        team: 'Legacy Dragons',
        notes: null
      });

      await DatabaseService.addMember(boardId, {
        name: 'Legacy Member 3',
        email: 'lm3@test.com',
        avatar_url: null,
        team: 'Legacy Phoenix',
        notes: null
      });

      // Run backfill
      const backfillResult = await DatabaseService.backfillTeams(boardId);
      expect(backfillResult.createdTeams).toBeGreaterThanOrEqual(2);
      expect(backfillResult.linkedMembers).toBeGreaterThanOrEqual(3);

      // Verify normalized teams were created
      const teams = await DatabaseService.getTeams(boardId);
      const dragons = teams.find(t => t.name === 'Legacy Dragons');
      const phoenix = teams.find(t => t.name === 'Legacy Phoenix');

      expect(dragons).toBeDefined();
      expect(dragons?.short_code).toBe('LD');
      expect(phoenix).toBeDefined();
      expect(phoenix?.short_code).toBe('LP');

      // Verify roster memberships were populated
      const dragonsRoster = await DatabaseService.getTeamMembers(dragons!.id);
      expect(dragonsRoster.length).toBe(2);
      expect(dragonsRoster.every(tm => tm.role === 'player')).toBe(true);

      // Repeatable / idempotent: running backfill again creates 0 new teams
      const secondBackfill = await DatabaseService.backfillTeams(boardId);
      expect(secondBackfill.createdTeams).toBe(0);
      expect(secondBackfill.linkedMembers).toBe(0);
    });

    it('preserves existing results and ranking calculations', async () => {
      const rankingsBefore = await DatabaseService.getRankings(boardId);
      await DatabaseService.backfillTeams(boardId);
      const rankingsAfter = await DatabaseService.getRankings(boardId);

      expect(rankingsAfter.length).toBe(rankingsBefore.length);
      for (let i = 0; i < rankingsBefore.length; i++) {
        expect(rankingsAfter[i].member_id).toBe(rankingsBefore[i].member_id);
        expect(rankingsAfter[i].total_points).toBe(rankingsBefore[i].total_points);
      }
    });
  });

  describe('Authorization and Permission Checks', () => {
    it('blocks unauthenticated users from creating teams', async () => {
      mockUser = null;
      await expect(
        DatabaseService.createTeam(boardId, { name: 'Hacker Team' })
      ).rejects.toThrow(/unauthenticated/i);
    });

    it('blocks non-admin users from creating or modifying teams', async () => {
      mockUser = {
        id: unauthorizedUserId,
        email: 'random@test.com',
        full_name: 'Regular User',
        role: 'member'
      };

      await expect(
        DatabaseService.createTeam(boardId, { name: 'Unauthorized Team' })
      ).rejects.toThrow(/permission denied/i);
    });

    it('blocks unauthorized users from modifying team rosters', async () => {
      const team = await DatabaseService.createTeam(boardId, { name: 'Admin Team' });
      const member = await DatabaseService.addMember(boardId, {
        name: 'Test Member',
        email: null,
        avatar_url: null,
        team: null,
        notes: null
      });

      // Switch to non-admin
      mockUser = {
        id: unauthorizedUserId,
        email: 'random@test.com',
        full_name: 'Regular User',
        role: 'member'
      };

      await expect(
        DatabaseService.addTeamMember(team.id, member.id, 'player')
      ).rejects.toThrow(/permission denied/i);

      await expect(
        DatabaseService.deleteTeam(team.id)
      ).rejects.toThrow(/permission denied/i);
    });
  });
});
