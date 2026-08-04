import { leagueTableEngine } from '@/lib/competition/engines/league';
import { simplePointsEngine } from '@/lib/competition/engines/simple';
import { tournamentEngine } from '@/lib/competition/engines/tournament';
import { CompetitionEnginePlugin } from '@/lib/competition/engines/types';
import { CompetitionEngine } from '@/types';

const engines: Record<CompetitionEngine, CompetitionEnginePlugin> = {
  simple_points: simplePointsEngine,
  league_table: leagueTableEngine,
  tournament: tournamentEngine,
};

export function getCompetitionEngine(engine: CompetitionEngine): CompetitionEnginePlugin {
  return engines[engine];
}

export function getAllCompetitionEngines(): CompetitionEnginePlugin[] {
  return Object.values(engines);
}
