import { AiTaskType } from '../types';

export interface ValidationOutcome {
  isValid: boolean;
  errors: string[];
}

export function validateProposalPayload(
  taskType: AiTaskType,
  payload: Record<string, unknown>
): ValidationOutcome {
  const errors: string[] = [];

  if (!payload || typeof payload !== 'object') {
    return { isValid: false, errors: ['Proposal payload must be a non-null object.'] };
  }

  switch (taskType) {
    case 'schedule_draft': {
      if (!payload.start_date || typeof payload.start_date !== 'string') {
        errors.push('Schedule draft requires a valid "start_date" (YYYY-MM-DD).');
      } else if (isNaN(Date.parse(payload.start_date))) {
        errors.push('Schedule "start_date" is not a valid date.');
      }

      if (payload.playable_days && !Array.isArray(payload.playable_days)) {
        errors.push('"playable_days" must be an array of day indices (0-6).');
      }

      if (
        payload.match_duration_minutes !== undefined &&
        (typeof payload.match_duration_minutes !== 'number' || payload.match_duration_minutes <= 0)
      ) {
        errors.push('"match_duration_minutes" must be a positive number.');
      }
      break;
    }

    case 'points_rules_draft': {
      if (
        payload.points_for_win !== undefined &&
        (typeof payload.points_for_win !== 'number' || isNaN(payload.points_for_win))
      ) {
        errors.push('"points_for_win" must be a numeric value.');
      }

      if (
        payload.points_for_draw !== undefined &&
        (typeof payload.points_for_draw !== 'number' || isNaN(payload.points_for_draw))
      ) {
        errors.push('"points_for_draw" must be a numeric value.');
      }

      if (
        payload.points_for_loss !== undefined &&
        (typeof payload.points_for_loss !== 'number' || isNaN(payload.points_for_loss))
      ) {
        errors.push('"points_for_loss" must be a numeric value.');
      }

      if (payload.tie_breakers && !Array.isArray(payload.tie_breakers)) {
        errors.push('"tie_breakers" must be an array of criteria strings or rule objects.');
      }
      break;
    }

    case 'announcement_draft': {
      if (!payload.title || typeof payload.title !== 'string' || !payload.title.trim()) {
        errors.push('Announcement draft requires a non-empty "title".');
      }
      if (!payload.body || typeof payload.body !== 'string' || !payload.body.trim()) {
        errors.push('Announcement draft requires a non-empty "body".');
      }
      break;
    }

    case 'pathway_proposal': {
      if (!payload.name || typeof payload.name !== 'string' || !payload.name.trim()) {
        errors.push('Pathway proposal requires a non-empty "name".');
      }
      if (
        payload.qualifier_count !== undefined &&
        (typeof payload.qualifier_count !== 'number' || payload.qualifier_count < 1)
      ) {
        errors.push('"qualifier_count" must be an integer greater than 0.');
      }
      break;
    }

    case 'venue_setup': {
      if (!payload.name || typeof payload.name !== 'string' || !payload.name.trim()) {
        errors.push('Venue setup requires a non-empty venue "name".');
      }
      if (
        payload.capacity !== undefined &&
        payload.capacity !== null &&
        (typeof payload.capacity !== 'number' || payload.capacity < 0)
      ) {
        errors.push('"capacity" must be a non-negative number.');
      }
      break;
    }

    default:
      errors.push(`Unsupported or unknown proposal task type: "${taskType}".`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
