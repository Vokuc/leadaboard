import { DatabaseService } from '@/lib/db';
import { LeagueService } from '@/lib/league/service';
import {
  CompetitionConfig,
  CompetitionContext,
  CompetitionEngine,
  Leaderboard,
  LeaderboardMember,
  Season,
} from '@/types';

function resolveEngineFromConfig(config: CompetitionConfig | null): CompetitionEngine {
  return config?.engine_type || 'simple_points';
}

async function getPrimarySeason(leaderboardId: string): Promise<Season | null> {
  const seasons = await DatabaseService.getSeasons(leaderboardId);
  return seasons[0] || null;
}

export const CompetitionService = {
  async getCompetitionContext(leaderboardId: string): Promise<CompetitionContext | null> {
    const leaderboard = await DatabaseService.getLeaderboardById(leaderboardId);
    if (!leaderboard) {
      return null;
    }

    const [config, members, season] = await Promise.all([
      LeagueService.getCompetitionConfig(leaderboardId),
      DatabaseService.getMembers(leaderboardId),
      getPrimarySeason(leaderboardId),
    ]);

    return {
      leaderboard,
      config,
      members,
      season,
    };
  },

  async getEngineType(leaderboardId: string): Promise<CompetitionEngine> {
    const config = await LeagueService.getCompetitionConfig(leaderboardId);
    return resolveEngineFromConfig(config);
  },

  async getParticipants(leaderboardId: string): Promise<LeaderboardMember[]> {
    return DatabaseService.getMembers(leaderboardId);
  },

  async updateCoreMetadata(leaderboardId: string, updates: Partial<Leaderboard>): Promise<Leaderboard> {
    return DatabaseService.updateLeaderboard(leaderboardId, updates);
  },
};
