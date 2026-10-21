import {
  AchievementDefinition,
  ParticipantAchievement,
} from '@/types';
import { DatabaseService } from '@/lib/db';
import { CompetitionPassportService } from '@/lib/competition/passport/service';
import { ResultAuditService } from '@/lib/competition/audit/service';

export const AchievementService = {
  /**
   * Get all active achievement definitions.
   */
  async getDefinitions(): Promise<AchievementDefinition[]> {
    return DatabaseService.getAchievementDefinitions();
  },

  /**
   * Get an achievement definition by key/ID.
   */
  async getDefinition(id: string): Promise<AchievementDefinition | null> {
    const defs = await DatabaseService.getAchievementDefinitions();
    return defs.find((d) => d.id === id) || null;
  },

  /**
   * Create or update a custom achievement definition.
   */
  async createDefinition(
    def: Omit<AchievementDefinition, 'created_at' | 'updated_at'>,
    actorUserId?: string
  ): Promise<AchievementDefinition> {
    if (actorUserId) {
      const profile = await DatabaseService.getProfile(actorUserId);
      if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
        throw new Error('Unauthorized: only administrators can create achievement definitions.');
      }
    }

    const timestamp = new Date().toISOString();
    const newDef: AchievementDefinition = {
      ...def,
      created_at: timestamp,
      updated_at: timestamp,
    };

    const saved = await DatabaseService.saveAchievementDefinition(newDef);
    return saved;
  },

  /**
   * Get all achievements awarded to a participant.
   */
  async getParticipantAchievements(
    userId: string,
    includeRevoked = false
  ): Promise<ParticipantAchievement[]> {
    return DatabaseService.getParticipantAchievements(userId, includeRevoked);
  },

  /**
   * Idempotently award an achievement to a participant.
   * If the achievement has already been awarded and is not revoked, returns the existing record.
   */
  async awardAchievement(input: {
    achievementId: string;
    userId: string;
    memberId?: string | null;
    leaderboardId?: string | null;
    provenance: {
      match_id?: string;
      fixture_id?: string;
      competition_name?: string;
      score_summary?: string;
      opponent_name?: string;
      triggered_by?: string;
      notes?: string;
    };
  }): Promise<ParticipantAchievement> {
    const { achievementId, userId, memberId, leaderboardId, provenance } = input;

    // Verify achievement definition exists
    const def = await this.getDefinition(achievementId);
    if (!def) {
      throw new Error(`Achievement definition "${achievementId}" does not exist.`);
    }

    // Check for existing active award (idempotency check)
    const existingAwards = await DatabaseService.getParticipantAchievements(userId, true);
    const existing = existingAwards.find(
      (a) =>
        a.achievement_id === achievementId &&
        (a.leaderboard_id || null) === (leaderboardId || null) &&
        !a.is_revoked
    );
    if (existing) {
      return existing;
    }

    const timestamp = new Date().toISOString();
    const award: ParticipantAchievement = {
      id: `ach-award-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      achievement_id: achievementId,
      user_id: userId,
      member_id: memberId || null,
      leaderboard_id: leaderboardId || null,
      awarded_at: timestamp,
      provenance,
      is_revoked: false,
      revoked_at: null,
      revocation_reason: null,
      revocation_audit_id: null,
      created_at: timestamp,
      updated_at: timestamp,
      achievement: def,
    };

    const saved = await DatabaseService.awardParticipantAchievement(award);

    // Optional activity log if linked to a leaderboard
    if (leaderboardId) {
      try {
        await DatabaseService.addActivityLog(
          leaderboardId,
          `Competitor unlocked achievement: ${def.name} (${def.description})`
        );
      } catch (logErr) {
        console.warn('Failed to log achievement activity:', logErr);
      }
    }

    return saved;
  },

  /**
   * Revoke an awarded achievement with audit history and provenance preservation.
   */
  async revokeAchievement(
    awardId: string,
    reason: string,
    actorUserId?: string
  ): Promise<ParticipantAchievement> {
    if (!reason || !reason.trim()) {
      throw new Error('Revocation reason is required.');
    }

    if (actorUserId) {
      const profile = await DatabaseService.getProfile(actorUserId);
      if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
        throw new Error('Unauthorized: only administrators or referees can revoke achievements.');
      }
    }

    const auditId = `audit-revocation-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const timestamp = new Date().toISOString();

    const updated = await DatabaseService.updateParticipantAchievement(awardId, {
      is_revoked: true,
      revoked_at: timestamp,
      revocation_reason: reason.trim(),
      revocation_audit_id: auditId,
    });

    // Record audit entry
    try {
      if (updated.leaderboard_id) {
        await ResultAuditService.logAuditEntry({
          leaderboard_id: updated.leaderboard_id,
          entity_type: 'score_event',
          entity_id: awardId,
          previous_payload: { status: 'awarded', achievement_id: updated.achievement_id },
          proposed_payload: { status: 'revoked', reason },
          actor_id: actorUserId || null,
          actor_email: null,
          actor_name: 'Administrator',
          actor_role: 'admin',
          action: 'void',
          status: 'approved',
          reason: `Achievement revoked: ${reason.trim()}`,
          evidence_urls: [],
        });
      }
    } catch (auditErr) {
      console.warn('Could not record audit entry for achievement revocation:', auditErr);
    }

    return updated;
  },

  /**
   * Restore a previously revoked achievement.
   */
  async restoreAchievement(awardId: string, actorUserId?: string): Promise<ParticipantAchievement> {
    if (actorUserId) {
      const profile = await DatabaseService.getProfile(actorUserId);
      if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
        throw new Error('Unauthorized: only administrators can restore achievements.');
      }
    }

    return DatabaseService.updateParticipantAchievement(awardId, {
      is_revoked: false,
      revoked_at: null,
      revocation_reason: null,
      revocation_audit_id: null,
    });
  },

  /**
   * Evaluate a participant's authoritative match and competition history to award qualified achievements.
   * Server-side evaluated from real records, idempotent, and non-duplicating.
   */
  async evaluateParticipantAchievements(userId: string): Promise<ParticipantAchievement[]> {
    const passportProfile = await CompetitionPassportService.getProfileByUserId(userId);
    if (!passportProfile) {
      return [];
    }

    // Retrieve authoritative passport data (aggregates all linked competitions and matches)
    const passport = await CompetitionPassportService.getPassport(passportProfile.username, userId);
    const { competitions, matches } = passport;

    const awarded: ParticipantAchievement[] = [];
    const existingAwards = await this.getParticipantAchievements(userId, false);
    const existingKeys = new Set(existingAwards.map((a) => a.achievement_id));

    // Sort completed matches chronologically for streak and milestone analysis
    const completedMatches = matches
      .filter((m) => m.outcome !== 'pending')
      .sort((a, b) => new Date(a.scheduled_at || 0).getTime() - new Date(b.scheduled_at || 0).getTime());

    // 1. Debutant: First competition completed
    if (competitions.length >= 1 && !existingKeys.has('first_competition')) {
      const firstComp = competitions[0];
      const award = await this.awardAchievement({
        achievementId: 'first_competition',
        userId,
        leaderboardId: firstComp.leaderboard_id,
        provenance: {
          competition_name: firstComp.competition_name,
          triggered_by: 'competition_participation',
          notes: `Participated in ${firstComp.competition_name}`,
        },
      });
      awarded.push(award);
    }

    // 2. First Victory: First match win
    const firstWin = completedMatches.find((m) => m.outcome === 'win');
    if (firstWin && !existingKeys.has('first_win')) {
      const scoreStr =
        firstWin.home_score != null && firstWin.away_score != null
          ? `${firstWin.home_score} - ${firstWin.away_score}`
          : 'Win';
      const award = await this.awardAchievement({
        achievementId: 'first_win',
        userId,
        leaderboardId: firstWin.leaderboard_id,
        provenance: {
          match_id: firstWin.match_id,
          competition_name: firstWin.competition_name,
          score_summary: scoreStr,
          opponent_name: firstWin.opponent_name,
          triggered_by: 'match_win',
          notes: `Won against ${firstWin.opponent_name} (${scoreStr})`,
        },
      });
      awarded.push(award);
    }

    // 3. Undisputed Champion: Finished 1st place in a competition
    const championship = competitions.find((c) => c.podium_finish === 1 || c.rank === 1);
    if (championship && !existingKeys.has('champion')) {
      const award = await this.awardAchievement({
        achievementId: 'champion',
        userId,
        leaderboardId: championship.leaderboard_id,
        provenance: {
          competition_name: championship.competition_name,
          triggered_by: 'champion_finish',
          notes: `Won 1st place in ${championship.competition_name}`,
        },
      });
      awarded.push(award);
    }

    // 4. Consecutive Win Streaks (3 and 5)
    let currentStreak = 0;
    let maxStreak = 0;
    let streakLeaderboardId: string | undefined;
    let streakMatchId: string | undefined;

    for (const m of completedMatches) {
      if (m.outcome === 'win') {
        currentStreak++;
        if (currentStreak > maxStreak) {
          maxStreak = currentStreak;
          streakLeaderboardId = m.leaderboard_id;
          streakMatchId = m.match_id;
        }
      } else {
        currentStreak = 0;
      }
    }

    if (maxStreak >= 3 && !existingKeys.has('win_streak_3')) {
      const award = await this.awardAchievement({
        achievementId: 'win_streak_3',
        userId,
        leaderboardId: streakLeaderboardId,
        provenance: {
          match_id: streakMatchId,
          triggered_by: 'win_streak',
          notes: `Achieved a streak of ${maxStreak} consecutive wins`,
        },
      });
      awarded.push(award);
    }

    if (maxStreak >= 5 && !existingKeys.has('win_streak_5')) {
      const award = await this.awardAchievement({
        achievementId: 'win_streak_5',
        userId,
        leaderboardId: streakLeaderboardId,
        provenance: {
          match_id: streakMatchId,
          triggered_by: 'win_streak',
          notes: `Achieved a streak of ${maxStreak} consecutive wins`,
        },
      });
      awarded.push(award);
    }

    // 5. Match Count Milestones: 10 and 25
    if (completedMatches.length >= 10 && !existingKeys.has('matches_10')) {
      const m10 = completedMatches[9];
      const award = await this.awardAchievement({
        achievementId: 'matches_10',
        userId,
        leaderboardId: m10.leaderboard_id,
        provenance: {
          match_id: m10.match_id,
          triggered_by: 'match_count_milestone',
          notes: `Completed 10 official competitive matches`,
        },
      });
      awarded.push(award);
    }

    if (completedMatches.length >= 25 && !existingKeys.has('matches_25')) {
      const m25 = completedMatches[24];
      const award = await this.awardAchievement({
        achievementId: 'matches_25',
        userId,
        leaderboardId: m25.leaderboard_id,
        provenance: {
          match_id: m25.match_id,
          triggered_by: 'match_count_milestone',
          notes: `Completed 25 official competitive matches`,
        },
      });
      awarded.push(award);
    }

    // 6. Cross-Arena Veteran: 5 distinct competitions
    if (competitions.length >= 5 && !existingKeys.has('competitions_5')) {
      const comp5 = competitions[4];
      const award = await this.awardAchievement({
        achievementId: 'competitions_5',
        userId,
        leaderboardId: comp5.leaderboard_id,
        provenance: {
          triggered_by: 'competition_count_milestone',
          notes: `Competed across ${competitions.length} distinct competitions`,
        },
      });
      awarded.push(award);
    }

    // 7. Clean Sheet: Won while conceding 0 points/goals
    const cleanSheetMatch = completedMatches.find((m) => {
      if (m.outcome !== 'win') return false;
      if (m.is_home && m.away_score === 0) return true;
      if (!m.is_home && m.home_score === 0) return true;
      return false;
    });

    if (cleanSheetMatch && !existingKeys.has('clean_sheet')) {
      const scoreStr = `${cleanSheetMatch.home_score ?? 0} - ${cleanSheetMatch.away_score ?? 0}`;
      const award = await this.awardAchievement({
        achievementId: 'clean_sheet',
        userId,
        leaderboardId: cleanSheetMatch.leaderboard_id,
        provenance: {
          match_id: cleanSheetMatch.match_id,
          competition_name: cleanSheetMatch.competition_name,
          score_summary: scoreStr,
          opponent_name: cleanSheetMatch.opponent_name,
          triggered_by: 'clean_sheet_victory',
          notes: `Shutout victory against ${cleanSheetMatch.opponent_name} (${scoreStr})`,
        },
      });
      awarded.push(award);
    }

    // 8. Podium Regular: Top 3 finish in 3 distinct competitions
    const podiumCount = competitions.filter((c) => c.podium_finish && c.podium_finish <= 3).length;
    if (podiumCount >= 3 && !existingKeys.has('podium_triple')) {
      const award = await this.awardAchievement({
        achievementId: 'podium_triple',
        userId,
        provenance: {
          triggered_by: 'podium_count_milestone',
          notes: `Finished on the podium across ${podiumCount} competitions`,
        },
      });
      awarded.push(award);
    }

    // Return newly awarded achievements in this evaluation
    return awarded;
  },
};
