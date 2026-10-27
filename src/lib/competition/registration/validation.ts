import {
  CompetitionRegistration,
  CompetitionRegistrationConfig,
  RegistrationStatus,
} from '@/types';

export interface RegistrationValidationResult {
  valid: boolean;
  error?: string;
  targetStatus?: RegistrationStatus;
}

/**
 * Validates registration timing windows (opens_at / closes_at).
 */
export function validateRegistrationWindow(
  config: CompetitionRegistrationConfig,
  now: Date = new Date()
): { valid: boolean; error?: string } {
  if (!config.is_enabled) {
    return { valid: false, error: 'Registration is currently closed for this competition.' };
  }

  if (config.opens_at) {
    const opensAt = new Date(config.opens_at);
    if (now.getTime() < opensAt.getTime()) {
      return {
        valid: false,
        error: `Registration opens on ${opensAt.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}.`,
      };
    }
  }

  if (config.closes_at) {
    const closesAt = new Date(config.closes_at);
    if (now.getTime() > closesAt.getTime()) {
      return {
        valid: false,
        error: `Registration closed on ${closesAt.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}.`,
      };
    }
  }

  return { valid: true };
}

/**
 * Validates participant eligibility rules such as allowed email domains.
 */
export function validateEligibility(
  config: CompetitionRegistrationConfig,
  email: string
): { valid: boolean; error?: string } {
  const allowedDomains = config.eligibility_rules?.allowed_domains || [];
  if (allowedDomains.length > 0) {
    const emailDomain = email.split('@')[1]?.toLowerCase().trim();
    const isDomainAllowed = allowedDomains.some(
      (d) => d.toLowerCase().trim() === emailDomain || d.toLowerCase().trim() === `@${emailDomain}`
    );

    if (!isDomainAllowed) {
      return {
        valid: false,
        error: `Registration is restricted to domains: ${allowedDomains.join(', ')}.`,
      };
    }
  }

  return { valid: true };
}

/**
 * Evaluates whether registration capacity is reached, and whether applicant should be waitlisted.
 */
export function evaluateCapacityStatus(
  config: CompetitionRegistrationConfig,
  confirmedOrApprovedCount: number
): { isFull: boolean; targetStatus: RegistrationStatus; error?: string } {
  if (!config.capacity || config.capacity <= 0) {
    // Unlimited capacity
    return {
      isFull: false,
      targetStatus: config.require_approval ? 'pending' : 'confirmed',
    };
  }

  if (confirmedOrApprovedCount >= config.capacity) {
    if (config.allow_waitlist) {
      return {
        isFull: true,
        targetStatus: 'waitlisted',
      };
    } else {
      return {
        isFull: true,
        targetStatus: 'rejected',
        error: 'Competition capacity has been reached and waitlist is closed.',
      };
    }
  }

  return {
    isFull: false,
    targetStatus: config.require_approval ? 'pending' : 'confirmed',
  };
}

/**
 * Detects duplicate entries by participant email or authenticated user identity.
 */
export function detectDuplicateRegistration(
  existingRegistrations: CompetitionRegistration[],
  email: string,
  userId?: string | null
): { isDuplicate: boolean; existingRegistration?: CompetitionRegistration; error?: string } {
  const normalizedEmail = email.toLowerCase().trim();

  const duplicate = existingRegistrations.find((reg) => {
    // Ignore withdrawn or rejected registrations — they can re-register
    if (reg.status === 'withdrawn' || reg.status === 'rejected') {
      return false;
    }

    if (reg.participant_email.toLowerCase().trim() === normalizedEmail) {
      return true;
    }

    if (userId && reg.user_id && reg.user_id === userId) {
      return true;
    }

    return false;
  });

  if (duplicate) {
    return {
      isDuplicate: true,
      existingRegistration: duplicate,
      error: `You already have an active registration (${duplicate.status}) for this competition.`,
    };
  }

  return { isDuplicate: false };
}

/**
 * Validates whether payment deadline has passed for a paid competition.
 */
export function validatePaymentDeadline(
  config: CompetitionRegistrationConfig,
  now: Date = new Date()
): { valid: boolean; error?: string } {
  if (config.payment_deadline) {
    const deadline = new Date(config.payment_deadline);
    if (now.getTime() > deadline.getTime()) {
      return {
        valid: false,
        error: `The payment deadline for this competition passed on ${deadline.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}.`,
      };
    }
  }
  return { valid: true };
}

/**
 * Validates allowed status transitions for organizer/participant lifecycle.
 */
export function validateStatusTransition(
  currentStatus: RegistrationStatus,
  nextStatus: RegistrationStatus
): { valid: boolean; error?: string } {
  if (currentStatus === nextStatus) {
    return { valid: true };
  }

  const allowedTransitions: Record<RegistrationStatus, RegistrationStatus[]> = {
    pending_payment: ['confirmed', 'approved', 'rejected', 'withdrawn', 'pending'],
    pending: ['approved', 'rejected', 'waitlisted', 'withdrawn'],
    approved: ['confirmed', 'waitlisted', 'rejected', 'withdrawn'],
    waitlisted: ['approved', 'rejected', 'withdrawn'],
    confirmed: ['withdrawn', 'rejected'],
    rejected: ['pending', 'approved', 'waitlisted'],
    withdrawn: ['pending', 'pending_payment'],
  };

  const allowed = allowedTransitions[currentStatus] || [];
  if (!allowed.includes(nextStatus)) {
    return {
      valid: false,
      error: `Cannot transition registration from "${currentStatus}" to "${nextStatus}".`,
    };
  }

  return { valid: true };
}
