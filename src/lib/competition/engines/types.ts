import {
  CompetitionContext,
  CompetitionEngine,
  CompetitionTemplateKey,
  Leaderboard,
  LeaderboardMember,
  VisibilityType,
} from '@/types';

export interface BaseCreateCompetitionInput {
  name: string;
  description: string | null;
  visibility: VisibilityType;
  competitionType: Leaderboard['competition_type'];
  coverImageUrl: string | null;
  slug: string;
  seasonName: string;
  startDate: string;
  endDate: string | null;
  templateKey: CompetitionTemplateKey;
}

export interface CompetitionEnginePlugin {
  key: CompetitionEngine;

  createCompetition?: (input: BaseCreateCompetitionInput & Record<string, unknown>) => Promise<Leaderboard>;
  validateCompetition?: (input: BaseCreateCompetitionInput & Record<string, unknown>) => string[];
  initializeCompetition?: (leaderboardId: string) => Promise<void>;
  updateCompetition?: (leaderboardId: string, updates: Record<string, unknown>) => Promise<void>;
  generateCompetitionView?: (leaderboardId: string) => Promise<unknown>;
  processResult?: (leaderboardId: string, payload: Record<string, unknown>) => Promise<void>;
  calculateStandings?: (leaderboardId: string) => Promise<unknown>;
  publishRealtimeUpdate?: (leaderboardId: string, payload: Record<string, unknown>) => Promise<void>;
}

export interface CompetitionMetadata {
  engine: CompetitionEngine;
  context: CompetitionContext;
  participants: LeaderboardMember[];
}
