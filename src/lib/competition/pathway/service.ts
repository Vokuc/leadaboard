import { DatabaseService, isSupabaseConfigured, supabase } from '@/lib/db';
import { LeagueService } from '@/lib/league/service';
import { TournamentService } from '@/lib/tournament/service';
import { CompetitionLifecycleService } from '@/lib/competition/lifecycle/service';
import { getSeedingPattern } from '@/services/tournamentAdvancement';
import {
  CompetitionPathway,
  CreatePathwayInput,
  QualificationPreview,
  QualificationPreviewRow,
  BracketMatchupPreview,
  CommitQualificationInput,
  LeaderboardMember,
  Tournament,
  PathwayTieHandling,
} from '@/types';

const PATHWAYS_STORAGE_KEY = 'leaderboardos_competition_pathways';

function getLocalPathways(): CompetitionPathway[] {
  if (typeof window === 'undefined' && typeof localStorage === 'undefined') return [];
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(PATHWAYS_STORAGE_KEY) : null;
    if (!raw) return [];
    return JSON.parse(raw) as CompetitionPathway[];
  } catch {
    return [];
  }
}

function setLocalPathways(pathways: CompetitionPathway[]): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(PATHWAYS_STORAGE_KEY, JSON.stringify(pathways));
  }
}

export const CompetitionPathwayService = {
  /**
    * Creates or updates a multi-stage qualification pathway between a source and destination competition.
   */
  async createOrUpdatePathway(input: CreatePathwayInput): Promise<CompetitionPathway> {
    const sourceLeaderboardId =
      input.sourceLeaderboardId || (input as unknown as { source_leaderboard_id?: string }).source_leaderboard_id!;
    const destinationLeaderboardId =
      input.destinationLeaderboardId || (input as unknown as { destination_leaderboard_id?: string }).destination_leaderboard_id!;
    const qualifierCount =
      input.qualifierCount ?? (input as unknown as { qualifier_count?: number }).qualifier_count ?? 4;
    const tieHandling: PathwayTieHandling =
      input.tieHandling || (input as unknown as { tie_handling?: PathwayTieHandling }).tie_handling || 'standard_rules';
    const stageOrder =
      input.stageOrder ?? (input as unknown as { stage_order?: number }).stage_order ?? 1;

    // 1. Authorization check on both competitions
    await DatabaseService.requireAdminPermission(sourceLeaderboardId);
    await DatabaseService.requireAdminPermission(destinationLeaderboardId);

    // 2. Verify neither competition is archived
    const [sourceBoard, destBoard] = await Promise.all([
      DatabaseService.getLeaderboardById(sourceLeaderboardId),
      DatabaseService.getLeaderboardById(destinationLeaderboardId),
    ]);

    if (!sourceBoard || !destBoard) {
      throw new Error('Source or destination competition not found.');
    }

    if (sourceBoard.status === 'archived' || destBoard.status === 'archived') {
      throw new Error('Cannot configure a pathway with an archived competition.');
    }

    // 3. Verify neither is cancelled
    const [sourceOpStatus, destOpStatus] = await Promise.all([
      CompetitionLifecycleService.getOperationalStatus(sourceLeaderboardId),
      CompetitionLifecycleService.getOperationalStatus(destinationLeaderboardId),
    ]);

    if (sourceOpStatus === 'cancelled' || destOpStatus === 'cancelled') {
      throw new Error('Cannot configure a pathway with a cancelled competition.');
    }

    const timestamp = new Date().toISOString();

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('competition_pathways')
        .upsert(
          {
            source_leaderboard_id: sourceLeaderboardId,
            destination_leaderboard_id: destinationLeaderboardId,
            name: input.name,
            stage_order: stageOrder,
            qualifier_count: qualifierCount,
            tie_handling: tieHandling,
            status: 'configured',
            updated_at: timestamp,
          },
          { onConflict: 'source_leaderboard_id,destination_leaderboard_id' }
        )
        .select()
        .single();

      if (error) {
        throw error;
      }
      return data as CompetitionPathway;
    }

    // Local demo mode
    const pathways = getLocalPathways();
    const existingIndex = pathways.findIndex(
      (p) =>
        p.source_leaderboard_id === sourceLeaderboardId &&
        p.destination_leaderboard_id === destinationLeaderboardId
    );

    const pathway: CompetitionPathway = {
      id: existingIndex >= 0 ? pathways[existingIndex].id : `pathway-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      source_leaderboard_id: sourceLeaderboardId,
      destination_leaderboard_id: destinationLeaderboardId,
      name: input.name,
      stage_order: stageOrder,
      qualifier_count: qualifierCount,
      tie_handling: tieHandling,
      status: 'configured',
      committed_at: null,
      created_at: existingIndex >= 0 ? pathways[existingIndex].created_at : timestamp,
      updated_at: timestamp,
    };

    if (existingIndex >= 0) {
      pathways[existingIndex] = pathway;
    } else {
      pathways.push(pathway);
    }
    setLocalPathways(pathways);

    return pathway;
  },

  /**
   * Retrieves a pathway by its primary ID.
   */
  async getPathwayById(id: string): Promise<CompetitionPathway | null> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('competition_pathways')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) return null;
      return data as CompetitionPathway;
    }

    const pathways = getLocalPathways();
    return pathways.find((p) => p.id === id) || null;
  },

  /**
   * Retrieves a pathway between two specific competitions.
   */
  async getPathway(sourceLeaderboardId: string, destinationLeaderboardId: string): Promise<CompetitionPathway | null> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('competition_pathways')
        .select('*')
        .eq('source_leaderboard_id', sourceLeaderboardId)
        .eq('destination_leaderboard_id', destinationLeaderboardId)
        .maybeSingle();

      if (error) return null;
      return data as CompetitionPathway;
    }

    const pathways = getLocalPathways();
    return (
      pathways.find(
        (p) =>
          p.source_leaderboard_id === sourceLeaderboardId &&
          p.destination_leaderboard_id === destinationLeaderboardId
      ) || null
    );
  },

  /**
   * Retrieves all pathways linked to a competition (either as source or destination).
   */
  async getPathwaysForLeaderboard(leaderboardId: string): Promise<CompetitionPathway[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('competition_pathways')
        .select('*')
        .or(`source_leaderboard_id.eq.${leaderboardId},destination_leaderboard_id.eq.${leaderboardId}`)
        .order('stage_order', { ascending: true });

      if (error) return [];
      return (data || []) as CompetitionPathway[];
    }

    const pathways = getLocalPathways();
    return pathways
      .filter((p) => p.source_leaderboard_id === leaderboardId || p.destination_leaderboard_id === leaderboardId)
      .sort((a, b) => a.stage_order - b.stage_order);
  },

  /**
   * Generates a deterministic preview of qualifiers and bracket placements from source league standings.
   */
  async previewQualification(
    inputOrPathwayId:
      | string
      | {
          pathwayId?: string;
          pathway_id?: string;
          sourceLeaderboardId?: string;
          source_leaderboard_id?: string;
          destinationLeaderboardId?: string;
          destination_leaderboard_id?: string;
          qualifierCount?: number;
          qualifier_count?: number;
          tieHandling?: PathwayTieHandling;
          tie_handling?: PathwayTieHandling;
        }
  ): Promise<
    QualificationPreview & {
      bracketMatchups: BracketMatchupPreview[];
      hasCutoffTie: boolean;
      tieNotes: string;
    }
  > {
    let sourceId: string;
    let destId: string;
    let count: number | undefined;
    let tieHandling: PathwayTieHandling = 'standard_rules';

    if (typeof inputOrPathwayId === 'string') {
      const pathway = await this.getPathwayById(inputOrPathwayId);
      if (!pathway) throw new Error(`Pathway not found: ${inputOrPathwayId}`);
      sourceId = pathway.source_leaderboard_id;
      destId = pathway.destination_leaderboard_id;
      count = pathway.qualifier_count;
      tieHandling = pathway.tie_handling;
    } else if (inputOrPathwayId.pathwayId || inputOrPathwayId.pathway_id) {
      const pid = (inputOrPathwayId.pathwayId || inputOrPathwayId.pathway_id)!;
      const pathway = await this.getPathwayById(pid);
      if (!pathway) throw new Error(`Pathway not found: ${pid}`);
      sourceId = pathway.source_leaderboard_id;
      destId = pathway.destination_leaderboard_id;
      count = inputOrPathwayId.qualifierCount ?? inputOrPathwayId.qualifier_count ?? pathway.qualifier_count;
      tieHandling = inputOrPathwayId.tieHandling || inputOrPathwayId.tie_handling || pathway.tie_handling;
    } else {
      sourceId = (inputOrPathwayId.sourceLeaderboardId || inputOrPathwayId.source_leaderboard_id)!;
      destId = (inputOrPathwayId.destinationLeaderboardId || inputOrPathwayId.destination_leaderboard_id)!;
      count = inputOrPathwayId.qualifierCount ?? inputOrPathwayId.qualifier_count;
      tieHandling = inputOrPathwayId.tieHandling || inputOrPathwayId.tie_handling || 'standard_rules';
    }

    const [standings, tournament] = await Promise.all([
      LeagueService.getLeagueStandings(sourceId),
      TournamentService.getTournament(destId),
    ]);

    const bracketSize = tournament?.bracket_size || 4;
    const qualifierCount = count || bracketSize;

    const warnings: string[] = [];
    if (standings.length < qualifierCount) {
      warnings.push(
        `Source league only has ${standings.length} participant(s), but ${qualifierCount} qualifiers are needed for the bracket.`
      );
    }

    // Check for ties at the qualification boundary
    let hasUnresolvedTies = false;
    const unresolvedTieMembers: string[] = [];

    if (standings.length > qualifierCount) {
      const lastQualified = standings[qualifierCount - 1];
      const firstExcluded = standings[qualifierCount];

      const pointsTied = (lastQualified.stats?.points ?? 0) === (firstExcluded.stats?.points ?? 0);
      const gdTied = (lastQualified.stats?.goal_difference ?? 0) === (firstExcluded.stats?.goal_difference ?? 0);
      const gfTied = (lastQualified.stats?.goals_for ?? 0) === (firstExcluded.stats?.goals_for ?? 0);

      if (pointsTied && gdTied && gfTied) {
        hasUnresolvedTies = true;
        unresolvedTieMembers.push(lastQualified.name, firstExcluded.name);
        if (tieHandling === 'manual_approval') {
          warnings.push(
            `Cutoff tie detected at qualification boundary between "${lastQualified.name}" and "${firstExcluded.name}". Manual approval required.`
          );
        } else {
          warnings.push(
            `Cutoff tie detected at qualification boundary between "${lastQualified.name}" and "${firstExcluded.name}". Broken using ${tieHandling}.`
          );
        }
      }
    }

    // Build qualifiers list with seed index
    const qualifiers: QualificationPreviewRow[] = standings.slice(0, qualifierCount).map((row, idx) => ({
      rank: row.position,
      memberId: row.member_id,
      name: row.name,
      team: row.team || null,
      avatarUrl: row.avatar_url || null,
      points: row.stats?.points ?? 0,
      stats: row.stats || {},
      seedIndex: idx + 1,
      isQualified: true,
      isCutoffTie: hasUnresolvedTies && idx === qualifierCount - 1,
    }));

    // Build bracket placement preview using tournament seeding pattern
    const pattern = getSeedingPattern(bracketSize);
    const bracketPlacementPreview: BracketMatchupPreview[] = [];
    const matchCount = bracketSize / 2;

    for (let m = 0; m < matchCount; m++) {
      const homeSeed = pattern[m * 2];
      const awaySeed = pattern[m * 2 + 1];

      const homeQ = qualifiers.find((q) => q.seedIndex === homeSeed);
      const awayQ = qualifiers.find((q) => q.seedIndex === awaySeed);

      bracketPlacementPreview.push({
        matchIndex: m + 1,
        homeSeed,
        homeParticipantName: homeQ ? homeQ.name : homeSeed <= qualifierCount ? `Seed ${homeSeed}` : 'BYE',
        awaySeed,
        awayParticipantName: awayQ ? awayQ.name : awaySeed <= qualifierCount ? `Seed ${awaySeed}` : 'BYE',
      });
    }

    const canCommit =
      qualifiers.length >= 2 &&
      !(hasUnresolvedTies && tieHandling === 'manual_approval');

    return {
      sourceLeaderboardId: sourceId,
      destinationLeaderboardId: destId,
      qualifiers,
      bracketPlacementPreview,
      bracketMatchups: bracketPlacementPreview,
      hasUnresolvedTies,
      hasCutoffTie: hasUnresolvedTies,
      unresolvedTieMembers,
      canCommit,
      warnings,
      tieNotes: warnings.join('; '),
    };
  },

  /**
   * Commits the qualification pathway to the destination tournament bracket.
   * Ensures idempotency: does not duplicate members, matches, or results on repeated executions.
   */
  async commitQualification(
    input:
      | CommitQualificationInput
      | { pathwayId?: string; pathway_id?: string; forceReset?: boolean }
  ): Promise<{
    pathway: CompetitionPathway;
    tournament: Tournament;
    qualifiedMembers: LeaderboardMember[];
    success: boolean;
    promotedParticipantsCount: number;
  }> {
    let sourceId: string;
    let destId: string;
    let qualifierCount: number | undefined;
    let tieHandling: PathwayTieHandling = 'standard_rules';
    const forceReset = input.forceReset ?? false;

    const rawInput = input as Record<string, unknown>;
    const pathwayId = (rawInput.pathwayId || rawInput.pathway_id) as string | undefined;

    if (pathwayId) {
      const pathway = await this.getPathwayById(pathwayId);
      if (!pathway) throw new Error(`Pathway not found: ${pathwayId}`);
      sourceId = pathway.source_leaderboard_id;
      destId = pathway.destination_leaderboard_id;
      qualifierCount = pathway.qualifier_count;
      tieHandling = pathway.tie_handling;
    } else {
      sourceId = (rawInput.sourceLeaderboardId || rawInput.source_leaderboard_id) as string;
      destId = (rawInput.destinationLeaderboardId || rawInput.destination_leaderboard_id) as string;
      qualifierCount = (rawInput.qualifierCount || rawInput.qualifier_count) as number | undefined;
      tieHandling = ((rawInput.tieHandling || rawInput.tie_handling) as PathwayTieHandling) || 'standard_rules';
    }

    // 1. Authorization check
    await DatabaseService.requireAdminPermission(sourceId);
    await DatabaseService.requireAdminPermission(destId);

    // 2. Verify neither competition is archived or cancelled
    const [sourceBoard, destBoard] = await Promise.all([
      DatabaseService.getLeaderboardById(sourceId),
      DatabaseService.getLeaderboardById(destId),
    ]);

    if (!sourceBoard || !destBoard) {
      throw new Error('Source or destination competition not found.');
    }

    if (sourceBoard.status === 'archived' || destBoard.status === 'archived') {
      throw new Error('Cannot commit qualification for an archived competition.');
    }

    const [sourceOpStatus, destOpStatus] = await Promise.all([
      CompetitionLifecycleService.getOperationalStatus(sourceId),
      CompetitionLifecycleService.getOperationalStatus(destId),
    ]);

    if (sourceOpStatus === 'cancelled' || destOpStatus === 'cancelled') {
      throw new Error('Cannot commit qualification: source or destination competition is cancelled.');
    }

    // 3. Verify destination tournament
    const destinationTournament = await TournamentService.getTournament(destId);
    if (!destinationTournament) {
      throw new Error('Destination tournament configuration not found.');
    }

    // 4. Check for completed matches in destination tournament
    const existingMatches = await TournamentService.getMatches(destId);
    const hasCompletedMatches = existingMatches.some((m) => m.state === 'completed');
    if (hasCompletedMatches && !forceReset) {
      throw new Error(
        'Destination tournament already has completed matches. Pass forceReset: true to re-seed and overwrite bracket.'
      );
    }

    // 5. Generate qualification preview
    const preview = await this.previewQualification({
      sourceLeaderboardId: sourceId,
      destinationLeaderboardId: destId,
      qualifierCount: qualifierCount || destinationTournament.bracket_size,
      tieHandling,
    });

    if (!preview.canCommit && !input.forceReset) {
      throw new Error(
        `Cannot commit qualification: ${preview.warnings.join(' ')}`
      );
    }

    // 6. Idempotently synchronize qualified participants to destination tournament
    const existingDestMembers = await DatabaseService.getMembers(destId);
    const qualifiedMembers: LeaderboardMember[] = [];
    const seedIds: string[] = [];

    for (const q of preview.qualifiers) {
      let matched = existingDestMembers.find(
        (m) => m.name.toLowerCase() === q.name.toLowerCase()
      );

      if (!matched) {
        matched = await DatabaseService.addMember(destId, {
          name: q.name,
          team: q.team || null,
          email: null,
          notes: `Qualified from ${sourceBoard.name} (#${q.seedIndex})`,
          avatar_url: q.avatarUrl || null,
        });
        existingDestMembers.push(matched);
      }
      qualifiedMembers.push(matched);
      seedIds.push(matched.id);
    }

    // 7. Generate single elimination bracket with exact qualified seeds
    await TournamentService.generateBracket({
      leaderboardId: destId,
      bracketSize: destinationTournament.bracket_size,
      seedingMode: 'manual',
      manualSeedMemberIds: seedIds,
    });

    // 8. Update destination operational status to in_progress if needed
    const currentDestStatus = await CompetitionLifecycleService.getOperationalStatus(destId);
    if (currentDestStatus !== 'in_progress') {
      if (CompetitionLifecycleService.canTransition(currentDestStatus, 'in_progress')) {
        await CompetitionLifecycleService.updateOperationalStatus({
          leaderboardId: destId,
          targetStatus: 'in_progress',
          reason: `Bracket generated with ${seedIds.length} qualifiers from "${sourceBoard.name}"`,
        });
      }
    }

    // 9. Update pathway status to committed
    const timestamp = new Date().toISOString();
    let pathway = await this.getPathway(sourceId, destId);
    if (!pathway) {
      pathway = await this.createOrUpdatePathway({
        sourceLeaderboardId: sourceId,
        destinationLeaderboardId: destId,
        name: `${sourceBoard.name} to ${destBoard.name} Pathway`,
        qualifierCount: preview.qualifiers.length,
        tieHandling,
      });
    }

    if (isSupabaseConfigured && supabase) {
      await supabase
        .from('competition_pathways')
        .update({
          status: 'committed',
          committed_at: timestamp,
          updated_at: timestamp,
        })
        .eq('id', pathway.id);
    } else {
      const pathways = getLocalPathways();
      const pIdx = pathways.findIndex((p) => p.id === pathway?.id);
      if (pIdx >= 0) {
        pathways[pIdx] = {
          ...pathways[pIdx],
          status: 'committed',
          committed_at: timestamp,
          updated_at: timestamp,
        };
        setLocalPathways(pathways);
      }
    }
    pathway.status = 'committed';
    pathway.committed_at = timestamp;

    // 10. Record cross-engine activity logs
    try {
      await DatabaseService.addActivityLog(
        sourceId,
        `[Multi-Stage Pathway] Advanced top ${seedIds.length} qualifiers to "${destBoard.name}" knockout bracket.`
      );
      await DatabaseService.addActivityLog(
        destId,
        `[Multi-Stage Pathway] Bracket seeded with ${seedIds.length} qualifiers from "${sourceBoard.name}".`
      );
    } catch (err) {
      console.warn('Failed to emit pathway activity logs:', err);
    }

    const updatedTournament = await TournamentService.getTournament(destId);

    return {
      pathway,
      tournament: updatedTournament || destinationTournament,
      qualifiedMembers,
      success: true,
      promotedParticipantsCount: qualifiedMembers.length,
    };
  },
};
