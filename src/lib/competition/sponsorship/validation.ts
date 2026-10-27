/**
 * Sponsorship Validation and Safety Guardrails (Era 6 Prompt 2)
 */

import { SponsorshipTier } from '@/types';

export const VALID_SPONSORSHIP_TIERS: SponsorshipTier[] = [
  'headline',
  'gold',
  'silver',
  'bronze',
  'community',
  'partner',
];

export const TIER_WEIGHTS: Record<SponsorshipTier, number> = {
  headline: 100,
  gold: 80,
  silver: 60,
  bronze: 40,
  partner: 20,
  community: 10,
};

export interface ValidateSponsorInput {
  name: string;
  website_url: string;
  logo_url?: string | null;
  tier?: string;
  tagline?: string | null;
  campaign_start?: string | null;
  campaign_end?: string | null;
  display_order?: number;
}

/**
 * Validate that an external URL is safe, uses HTTP/HTTPS, and rejects dangerous protocols.
 */
export function validateSafeUrl(urlStr: string, fieldName = 'Website URL'): string {
  const clean = (urlStr || '').trim();
  if (!clean) {
    throw new Error(`${fieldName} is required.`);
  }

  // Reject dangerous characters or protocols
  const lower = clean.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:')
  ) {
    throw new Error(`${fieldName} contains an unsafe or forbidden URL protocol.`);
  }

  let parsed: URL;
  try {
    parsed = new URL(clean);
  } catch {
    throw new Error(`${fieldName} must be a valid, fully qualified URL (e.g. https://example.com).`);
  }

  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== 'https:' && protocol !== 'http:') {
    throw new Error(`${fieldName} must use https:// or http:// protocol. Found: "${protocol}".`);
  }

  return parsed.toString();
}

/**
 * Validate campaign date boundaries.
 */
export function validateCampaignDates(
  startStr?: string | null,
  endStr?: string | null
): { start: string | null; end: string | null } {
  let start: string | null = null;
  let end: string | null = null;

  if (startStr && startStr.trim()) {
    const s = new Date(startStr.trim());
    if (isNaN(s.getTime())) {
      throw new Error('Campaign start date is invalid.');
    }
    start = s.toISOString();
  }

  if (endStr && endStr.trim()) {
    const e = new Date(endStr.trim());
    if (isNaN(e.getTime())) {
      throw new Error('Campaign end date is invalid.');
    }
    end = e.toISOString();
  }

  if (start && end) {
    if (new Date(start).getTime() > new Date(end).getTime()) {
      throw new Error('Campaign start date must be before or equal to campaign end date.');
    }
  }

  return { start, end };
}

/**
 * Validate sponsor creation or update inputs.
 */
export function validateSponsorPayload(input: ValidateSponsorInput): {
  name: string;
  website_url: string;
  logo_url: string | null;
  tier: SponsorshipTier;
  tagline: string | null;
  campaign_start: string | null;
  campaign_end: string | null;
  display_order: number;
} {
  const name = (input.name || '').trim();
  if (!name || name.length < 2) {
    throw new Error('Sponsor name must be at least 2 characters.');
  }
  if (name.length > 100) {
    throw new Error('Sponsor name cannot exceed 100 characters.');
  }

  const website_url = validateSafeUrl(input.website_url, 'Website URL');

  let logo_url: string | null = null;
  if (input.logo_url && input.logo_url.trim()) {
    logo_url = validateSafeUrl(input.logo_url, 'Logo URL');
  }

  const rawTier = (input.tier || 'community').toLowerCase() as SponsorshipTier;
  if (!VALID_SPONSORSHIP_TIERS.includes(rawTier)) {
    throw new Error(
      `Invalid sponsorship tier: "${input.tier}". Must be one of: ${VALID_SPONSORSHIP_TIERS.join(', ')}.`
    );
  }

  const { start: campaign_start, end: campaign_end } = validateCampaignDates(
    input.campaign_start,
    input.campaign_end
  );

  const tagline = input.tagline?.trim() ? input.tagline.trim().slice(0, 160) : null;
  const display_order = typeof input.display_order === 'number' && input.display_order >= 0
    ? Math.floor(input.display_order)
    : 0;

  return {
    name,
    website_url,
    logo_url,
    tier: rawTier,
    tagline,
    campaign_start,
    campaign_end,
    display_order,
  };
}

/**
 * Generate a deterministic deduplication key for metrics to prevent duplicate event inflation.
 * Impressions deduplicate by visitor per hour.
 * Clicks deduplicate by visitor per 5 minutes.
 */
export function generateMetricsDedupKey(
  sponsorId: string,
  eventType: 'impression' | 'click',
  visitorHash: string,
  timestampMs: number = Date.now()
): string {
  const cleanVisitor = (visitorHash || 'anon').trim().slice(0, 64);
  if (eventType === 'impression') {
    // 1-hour window (3,600,000 ms)
    const hourBucket = Math.floor(timestampMs / (1000 * 60 * 60));
    return `imp_${sponsorId}_${cleanVisitor}_h${hourBucket}`;
  } else {
    // 5-minute window (300,000 ms)
    const fiveMinBucket = Math.floor(timestampMs / (1000 * 60 * 5));
    return `clk_${sponsorId}_${cleanVisitor}_5m${fiveMinBucket}`;
  }
}
