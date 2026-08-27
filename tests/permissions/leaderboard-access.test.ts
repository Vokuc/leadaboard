import { describe, expect, it, vi, beforeEach } from 'vitest';
import { DatabaseService } from '@/lib/db';
import { LeagueService } from '@/lib/league/service';

// Mock localStorage and window in node test environment
const store: Record<string, string> = {};
global.window = {
  location: { origin: 'http://localhost' }
} as any;
global.localStorage = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => {
    for (const key in store) {
      delete store[key];
    }
  }
} as any;

describe('Leaderboard Permissions', () => {
  let mockUser: { id: string; email: string; full_name: string; role: 'member' | 'admin' | 'billing_admin' | 'super_admin' } | null = null;
  const boardId = 'lb-gaming-1'; // Default gaming board seeded in mock DB
  const ownerId = 'creator-user-id'; // Default owner seeded in mock DB
  const adminId = 'admin-user-id';
  const otherUserId = 'other-user-id';

  beforeEach(() => {
    localStorage.clear();
    DatabaseService.initialize();

    // Setup active mock user resolver
    vi.spyOn(DatabaseService, 'getCurrentProfile').mockImplementation(async () => {
      if (!mockUser) return null;
      return {
        ...mockUser,
        avatar_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    });

    // Reset admins database list in mock localStorage
    localStorage.setItem('leagueboard_leaderboard_admins', JSON.stringify([]));
  });

  describe('Unauthenticated User', () => {
    beforeEach(() => {
      mockUser = null;
    });

    it('blocks leaderboard updates', async () => {
      await expect(DatabaseService.updateLeaderboard(boardId, { name: 'New Title' }))
        .rejects.toThrow('Unauthenticated');
    });

    it('blocks member modifications', async () => {
      await expect(DatabaseService.addMember(boardId, { name: 'Player X', email: null, avatar_url: null, team: null, notes: null }))
        .rejects.toThrow('Unauthenticated');
    });

    it('blocks score additions', async () => {
      await expect(DatabaseService.addScoreEvent(boardId, 'mem-g1', { rule_id: null, points: 50, reason: 'Custom win' }))
        .rejects.toThrow('Unauthenticated');
    });
  });

  describe('Ordinary Authenticated User', () => {
    beforeEach(() => {
      mockUser = { id: otherUserId, email: 'user@example.com', full_name: 'Normal User', role: 'member' };
    });

    it('blocks leaderboard updates', async () => {
      await expect(DatabaseService.updateLeaderboard(boardId, { name: 'New Title' }))
        .rejects.toThrow('Permission denied');
    });

    it('blocks leaderboard deletion', async () => {
      await expect(DatabaseService.deleteLeaderboard(boardId))
        .rejects.toThrow('Permission denied');
    });

    it('blocks member modifications', async () => {
      await expect(DatabaseService.addMember(boardId, { name: 'Player X', email: null, avatar_url: null, team: null, notes: null }))
        .rejects.toThrow('Permission denied');
    });

    it('blocks scoring rule creations', async () => {
      await expect(DatabaseService.addScoringRule(boardId, { event_name: 'Kill streak 10', points: 30, description: null }))
        .rejects.toThrow('Permission denied');
    });

    it('blocks score additions', async () => {
      await expect(DatabaseService.addScoreEvent(boardId, 'mem-g1', { rule_id: null, points: 50, reason: 'Custom win' }))
        .rejects.toThrow('Permission denied');
    });

    it('blocks admin modifications', async () => {
      await expect(DatabaseService.addAdmin(boardId, 'other-id'))
        .rejects.toThrow('Permission denied');
    });
  });

  describe('Authorized Leaderboard Admin', () => {
    beforeEach(async () => {
      // Temporarily become owner to add adminId as admin
      mockUser = { id: ownerId, email: 'creator@leagueboard.com', full_name: 'Alex Mercer', role: 'super_admin' };
      await DatabaseService.addAdmin(boardId, adminId);

      // Now switch user context to the Admin
      mockUser = { id: adminId, email: 'admin@example.com', full_name: 'Leaderboard Manager', role: 'member' };
    });

    it('allows editing leaderboard details', async () => {
      const updated = await DatabaseService.updateLeaderboard(boardId, { name: 'Updated Title' });
      expect(updated.name).toBe('Updated Title');
    });

    it('allows adding and managing participants', async () => {
      const member = await DatabaseService.addMember(boardId, {
        name: 'New Player',
        email: 'new@example.com',
        avatar_url: null,
        team: 'Red Team',
        notes: null
      });
      expect(member.name).toBe('New Player');
    });

    it('allows adding score events', async () => {
      const event = await DatabaseService.addScoreEvent(boardId, 'mem-g1', {
        rule_id: 'rule-g1',
        points: 30,
        reason: 'Win Match'
      });
      expect(event.points).toBe(30);
    });

    it('blocks deleting the leaderboard', async () => {
      await expect(DatabaseService.deleteLeaderboard(boardId))
        .rejects.toThrow('Only the leaderboard owner can perform this action');
    });

    it('blocks managing other admins', async () => {
      await expect(DatabaseService.addAdmin(boardId, 'another-id'))
        .rejects.toThrow('Only the leaderboard owner can perform this action');
    });
  });

  describe('Leaderboard Owner', () => {
    beforeEach(() => {
      mockUser = { id: ownerId, email: 'creator@leagueboard.com', full_name: 'Alex Mercer', role: 'super_admin' };
    });

    it('allows editing details', async () => {
      const updated = await DatabaseService.updateLeaderboard(boardId, { name: 'Owner Title' });
      expect(updated.name).toBe('Owner Title');
    });

    it('allows adding admins', async () => {
      const newAdmin = await DatabaseService.addAdmin(boardId, adminId);
      expect(newAdmin.user_id).toBe(adminId);
    });

    it('allows removing admins', async () => {
      await DatabaseService.addAdmin(boardId, adminId);
      await DatabaseService.removeAdmin(boardId, adminId);
      const list = await DatabaseService.getAdmins(boardId);
      expect(list.some(la => la.user_id === adminId)).toBe(false);
    });

    it('allows deleting the leaderboard', async () => {
      await DatabaseService.deleteLeaderboard(boardId);
      const list = await DatabaseService.getLeaderboards();
      expect(list.some(lb => lb.id === boardId)).toBe(false);
    });
  });
});
