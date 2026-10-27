import { DatabaseService } from '@/lib/db';
import { CompetitionSchedulingService } from '@/lib/competition/scheduling/service';
import { CompetitionRulesService } from '@/lib/competition/rules/service';
import { CompetitionNotificationService } from '@/lib/competition/notifications/service';
import { CompetitionPathwayService } from '@/lib/competition/pathway/service';
import { AiActionProposal, ProposalExecutionResult } from '../types';

/**
 * Executes an approved AI proposal against the authoritative domain services.
 * Requires that the proposal has passed validation and organizer confirmation.
 * Strictly disallows modifying official match scores, awarding prizes, or altering admin permissions.
 */
export async function executeApprovedProposal(
  proposal: AiActionProposal,
  actorUserId?: string
): Promise<ProposalExecutionResult> {
  const { leaderboard_id: leaderboardId, task_type: taskType, payload } = proposal;

  // Security guard: Ensure actor has organizer / admin permissions
  if (actorUserId) {
    await DatabaseService.requireAdminPermission(leaderboardId, actorUserId);
  }

  switch (taskType) {
    case 'schedule_draft': {
      // Configure schedule options and generate initial round-robin fixtures
      const doubleRoundRobin = Boolean(payload.double_round_robin);

      // Save schedule config first if provided
      if (payload.start_date) {
        await CompetitionSchedulingService.saveScheduleConfig({
          leaderboard_id: leaderboardId,
          start_date: String(payload.start_date),
          end_date: payload.end_date ? String(payload.end_date) : String(payload.start_date),
          timezone: String(payload.timezone || 'UTC'),
          playable_days: Array.isArray(payload.playable_days) ? (payload.playable_days as number[]) : [1, 2, 3, 4, 5, 6],
          daily_start_time: String(payload.daily_start_time || '09:00'),
          daily_end_time: String(payload.daily_end_time || '18:00'),
          match_duration_minutes: Number(payload.match_duration_minutes) || 60,
          buffer_minutes: Number(payload.buffer_minutes) || 15,
          rest_interval_minutes: Number(payload.rest_interval_minutes) || 30,
          participant_availability: [],
          auto_assign_venues: Boolean(payload.auto_assign_venues ?? true),
        });
      }

      // Preview schedule
      const preview = await CompetitionSchedulingService.previewLeagueSchedule(leaderboardId, {
        doubleRoundRobin,
      });

      // Commit schedule
      const committed = await CompetitionSchedulingService.commitLeagueSchedule(leaderboardId, preview);

      return {
        success: true,
        message: `Generated and scheduled ${committed.length} league fixtures successfully.`,
        details: { fixtureCount: committed.length },
      };
    }

    case 'points_rules_draft': {
      const currentRules = await CompetitionRulesService.getRules(leaderboardId);

      const updated = await CompetitionRulesService.saveRules(
        leaderboardId,
        {
          engine: (payload.engine as typeof currentRules.engine) || currentRules.engine,
          ranking_order: (payload.ranking_order as typeof currentRules.ranking_order) || currentRules.ranking_order,
          primary_metric: String(payload.primary_metric || currentRules.primary_metric),
          points_config: {
            ...currentRules.points_config,
            points_for_win: typeof payload.points_for_win === 'number' ? payload.points_for_win : currentRules.points_config.points_for_win,
            points_for_draw: typeof payload.points_for_draw === 'number' ? payload.points_for_draw : currentRules.points_config.points_for_draw,
            points_for_loss: typeof payload.points_for_loss === 'number' ? payload.points_for_loss : currentRules.points_config.points_for_loss,
          },
          tie_breakers: Array.isArray(payload.tie_breakers)
            ? (payload.tie_breakers as typeof currentRules.tie_breakers)
            : currentRules.tie_breakers,
        },
        actorUserId
      );

      return {
        success: true,
        message: `Updated competition scoring rules to Version ${updated.version}.`,
        details: { version: updated.version },
      };
    }

    case 'announcement_draft': {
      const notification = await CompetitionNotificationService.sendNotification({
        leaderboard_id: leaderboardId,
        user_id: actorUserId || 'system',
        notification_type: 'competition_announcement',
        title: String(payload.title),
        message: String(payload.body),
        action_url: `/dashboard/leaderboards/${leaderboardId}`,
      });

      return {
        success: true,
        message: `Broadcasted announcement "${payload.title}" to participants.`,
        entityId: notification?.id,
      };
    }

    case 'pathway_proposal': {
      const pathway = await CompetitionPathwayService.createOrUpdatePathway({
        sourceLeaderboardId: leaderboardId,
        destinationLeaderboardId: String(payload.destination_leaderboard_id || leaderboardId),
        qualifierCount: Number(payload.qualifier_count) || 4,
        tieHandling: 'standard_rules',
        name: String(payload.name || 'Playoff Qualification'),
      });

      return {
        success: true,
        message: `Created competition pathway "${pathway.name}" with ${pathway.qualifier_count} qualifiers.`,
        entityId: pathway.id,
      };
    }

    case 'venue_setup': {
      const venue = await CompetitionSchedulingService.createVenue({
        leaderboardId,
        name: String(payload.name),
        courtField: payload.court_field ? String(payload.court_field) : null,
        location: payload.location ? String(payload.location) : null,
        capacity: typeof payload.capacity === 'number' ? payload.capacity : null,
      });

      return {
        success: true,
        message: `Configured venue "${venue.name}".`,
        entityId: venue.id,
      };
    }

    default:
      throw new Error(`Cannot execute unsupported proposal task type: "${taskType}".`);
  }
}
