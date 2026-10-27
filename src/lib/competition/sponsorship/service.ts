/**
 * Competition Sponsorship & Monetization Service (Era 6 Prompt 2)
 *
 * Manages competition- and organization-level sponsors, campaign date boundaries,
 * permission enforcement, plan-based entitlement limits, safe link navigation,
 * and reliable, non-inflated click/impression metrics tracking.
 */

import {
  CompetitionSponsor,
  CompetitionSponsorEvent,
  SponsorMetricsSummary,
} from '@/types';
import { DatabaseService, isSupabaseConfigured, mockDb, supabase } from '@/lib/db';
import { OrganizationService } from '@/lib/organization/service';
import {
  generateMetricsDedupKey,
  TIER_WEIGHTS,
  validateSponsorPayload,
  ValidateSponsorInput,
} from './validation';

function nowIso(): string {
  return new Date().toISOString();
}

export interface CreateSponsorInput extends ValidateSponsorInput {
  leaderboard_id?: string | null;
  organization_id?: string | null;
  is_active?: boolean;
  metadata?: Record<string, unknown>;
}

export interface UpdateSponsorInput extends Partial<ValidateSponsorInput> {
  is_active?: boolean;
  metadata?: Record<string, unknown>;
}

export const CompetitionSponsorshipService = {
  // ─── Permission & Plan Entitlement Helpers ─────────────────────────────────

  /**
   * Verify actor has permission to manage sponsors for the leaderboard or organization.
   */
  async requireSponsorPermission(
    scope: { leaderboardId?: string | null; organizationId?: string | null },
    actorUserId?: string
  ): Promise<void> {
    if (!scope.leaderboardId && !scope.organizationId) {
      throw new Error('Sponsorship scope must specify either a leaderboard or an organization.');
    }

    if (scope.leaderboardId) {
      await DatabaseService.requireAdminPermission(scope.leaderboardId, actorUserId);
      return;
    }

    if (scope.organizationId && actorUserId) {
      await OrganizationService.requireRole(scope.organizationId, actorUserId, ['owner', 'admin']);
    }
  },

  /**
   * Enforce plan entitlement limits for sponsors.
   * Free: max 1 sponsor per competition (basic tier).
   * Pro: up to 5 sponsors per competition with custom tiers & campaign dates.
   * Business: unlimited sponsors per competition and organization-level sponsors.
   */
  async enforcePlanLimits(
    scope: { leaderboardId?: string | null; organizationId?: string | null },
    actorUserId?: string
  ): Promise<void> {
    // If organization sponsor, requires Business plan entitlement
    if (scope.organizationId && isSupabaseConfigured && supabase && actorUserId) {
      try {
        const { data } = await supabase.rpc('has_plan_feature', {
          auth_user: actorUserId,
          feature_key: 'custom_branding',
        });
        if (!data) {
          throw new Error('Organization-level sponsorship requires an active Business organization plan.');
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.message.includes('Organization-level')) throw err;
      }
    }

    // Check count limits per competition
    if (scope.leaderboardId) {
      const existing = await this.getSponsorsForCompetition(scope.leaderboardId, {
        includeInactive: true,
        directOnly: true,
      });

      // Check user plan in Supabase
      if (isSupabaseConfigured && supabase && actorUserId) {
        try {
          const { data: hasCustomBranding } = await supabase.rpc('has_plan_feature', {
            auth_user: actorUserId,
            feature_key: 'custom_branding',
          });

          if (!hasCustomBranding && existing.length >= 1) {
            throw new Error(
              'Free plan limit reached: Free competitions can feature up to 1 sponsor. Upgrade to Pro for up to 5 sponsors and custom campaign tiers.'
            );
          }

          if (hasCustomBranding && existing.length >= 25) {
            throw new Error('Plan limit reached: Maximum sponsor capacity reached for this competition.');
          }
        } catch (err: unknown) {
          if (err instanceof Error && err.message.includes('limit reached')) throw err;
        }
      } else {
        // Mock / local demo limits: allow testing up to 5 sponsors
        if (existing.length >= 5) {
          throw new Error(
            'Demo mode sponsor capacity reached (max 5 sponsors per competition in local demo).'
          );
        }
      }
    }
  },

  // ─── CRUD Operations ──────────────────────────────────────────────────────

  /**
   * Create a new sponsor.
   */
  async createSponsor(input: CreateSponsorInput, actorUserId?: string): Promise<CompetitionSponsor> {
    const scope = {
      leaderboardId: input.leaderboard_id || null,
      organizationId: input.organization_id || null,
    };

    // 1. Check permissions
    await this.requireSponsorPermission(scope, actorUserId);

    // 2. Enforce plan limits
    await this.enforcePlanLimits(scope, actorUserId);

    // 3. Validate payload
    const validated = validateSponsorPayload(input);

    const now = nowIso();
    const sponsor: CompetitionSponsor = {
      id: `spon_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      leaderboard_id: scope.leaderboardId,
      organization_id: scope.organizationId,
      name: validated.name,
      logo_url: validated.logo_url,
      website_url: validated.website_url,
      tier: validated.tier,
      display_order: validated.display_order,
      tagline: validated.tagline,
      campaign_start: validated.campaign_start,
      campaign_end: validated.campaign_end,
      is_active: input.is_active !== undefined ? input.is_active : true,
      impressions_count: 0,
      clicks_count: 0,
      created_by: actorUserId || null,
      metadata: input.metadata || {},
      created_at: now,
      updated_at: now,
    };

    // Save to mockDb
    const mockSponsors = mockDb.getCompetitionSponsors();
    mockSponsors.push(sponsor);
    mockDb.setCompetitionSponsors(mockSponsors);

    // Save to Supabase if configured
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('competition_sponsors')
          .insert({
            leaderboard_id: sponsor.leaderboard_id,
            organization_id: sponsor.organization_id,
            name: sponsor.name,
            logo_url: sponsor.logo_url,
            website_url: sponsor.website_url,
            tier: sponsor.tier,
            display_order: sponsor.display_order,
            tagline: sponsor.tagline,
            campaign_start: sponsor.campaign_start,
            campaign_end: sponsor.campaign_end,
            is_active: sponsor.is_active,
            impressions_count: 0,
            clicks_count: 0,
            created_by: sponsor.created_by,
            metadata: sponsor.metadata,
          })
          .select()
          .single();

        if (!error && data) {
          sponsor.id = data.id;
          // Update id in mockDb as well
          const idx = mockSponsors.findIndex((s) => s.id === sponsor.id);
          if (idx >= 0) mockSponsors[idx].id = data.id;
        }
      } catch (err) {
        console.warn('Supabase createSponsor failed, falling back to localDb:', err);
      }
    }

    return sponsor;
  },

  /**
   * Update an existing sponsor.
   */
  async updateSponsor(
    sponsorId: string,
    updates: UpdateSponsorInput,
    actorUserId?: string
  ): Promise<CompetitionSponsor> {
    const existing = await this.getSponsorById(sponsorId);
    if (!existing) {
      throw new Error(`Sponsor with id "${sponsorId}" not found.`);
    }

    // Check permissions
    await this.requireSponsorPermission(
      {
        leaderboardId: existing.leaderboard_id,
        organizationId: existing.organization_id,
      },
      actorUserId
    );

    // Validate update fields if provided
    const payloadToValidate: ValidateSponsorInput = {
      name: updates.name !== undefined ? updates.name : existing.name,
      website_url: updates.website_url !== undefined ? updates.website_url : existing.website_url,
      logo_url: updates.logo_url !== undefined ? updates.logo_url : existing.logo_url,
      tier: updates.tier !== undefined ? updates.tier : existing.tier,
      tagline: updates.tagline !== undefined ? updates.tagline : existing.tagline,
      campaign_start: updates.campaign_start !== undefined ? updates.campaign_start : existing.campaign_start,
      campaign_end: updates.campaign_end !== undefined ? updates.campaign_end : existing.campaign_end,
      display_order: updates.display_order !== undefined ? updates.display_order : existing.display_order,
    };
    const validated = validateSponsorPayload(payloadToValidate);

    const now = nowIso();
    const updatedSponsor: CompetitionSponsor = {
      ...existing,
      name: validated.name,
      logo_url: validated.logo_url,
      website_url: validated.website_url,
      tier: validated.tier,
      display_order: validated.display_order,
      tagline: validated.tagline,
      campaign_start: validated.campaign_start,
      campaign_end: validated.campaign_end,
      is_active: updates.is_active !== undefined ? updates.is_active : existing.is_active,
      metadata: updates.metadata ? { ...(existing.metadata || {}), ...updates.metadata } : existing.metadata,
      updated_at: now,
    };

    // Update in mockDb
    const mockSponsors = mockDb.getCompetitionSponsors();
    const idx = mockSponsors.findIndex((s) => s.id === sponsorId);
    if (idx >= 0) {
      mockSponsors[idx] = updatedSponsor;
      mockDb.setCompetitionSponsors(mockSponsors);
    }

    // Update in Supabase
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('competition_sponsors')
          .update({
            name: updatedSponsor.name,
            logo_url: updatedSponsor.logo_url,
            website_url: updatedSponsor.website_url,
            tier: updatedSponsor.tier,
            display_order: updatedSponsor.display_order,
            tagline: updatedSponsor.tagline,
            campaign_start: updatedSponsor.campaign_start,
            campaign_end: updatedSponsor.campaign_end,
            is_active: updatedSponsor.is_active,
            metadata: updatedSponsor.metadata,
            updated_at: now,
          })
          .eq('id', sponsorId);
      } catch (err) {
        console.warn('Supabase updateSponsor failed:', err);
      }
    }

    return updatedSponsor;
  },

  /**
   * Delete a sponsor.
   */
  async deleteSponsor(sponsorId: string, actorUserId?: string): Promise<boolean> {
    const existing = await this.getSponsorById(sponsorId);
    if (!existing) return true;

    // Check permissions
    await this.requireSponsorPermission(
      {
        leaderboardId: existing.leaderboard_id,
        organizationId: existing.organization_id,
      },
      actorUserId
    );

    // Remove from mockDb
    const mockSponsors = mockDb.getCompetitionSponsors().filter((s) => s.id !== sponsorId);
    mockDb.setCompetitionSponsors(mockSponsors);

    // Remove from Supabase
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('competition_sponsors').delete().eq('id', sponsorId);
      } catch (err) {
        console.warn('Supabase deleteSponsor failed:', err);
      }
    }

    return true;
  },

  /**
   * Get single sponsor by ID.
   */
  async getSponsorById(sponsorId: string): Promise<CompetitionSponsor | null> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('competition_sponsors')
          .select('*')
          .eq('id', sponsorId)
          .maybeSingle();
        if (!error && data) return data as CompetitionSponsor;
      } catch {
        // Fall back to mockDb
      }
    }

    const mockSponsors = mockDb.getCompetitionSponsors();
    return mockSponsors.find((s) => s.id === sponsorId) || null;
  },

  /**
   * Get sponsors for a competition.
   * If `directOnly` is false, also merges active organization-level sponsors from parent organization.
   * Respects date boundaries and active status unless `includeInactive` is true.
   * Sorts by tier weight descending, then display_order ascending.
   */
  async getSponsorsForCompetition(
    leaderboardId: string,
    options: { includeInactive?: boolean; directOnly?: boolean } = {}
  ): Promise<CompetitionSponsor[]> {
    let competitionSponsors: CompetitionSponsor[] = [];
    let organizationId: string | null = null;

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('competition_sponsors')
          .select('*')
          .eq('leaderboard_id', leaderboardId);
        if (!error && data) {
          competitionSponsors = data as CompetitionSponsor[];
        }

        if (!options.directOnly) {
          const { data: lb } = await supabase
            .from('leaderboards')
            .select('organization_id')
            .eq('id', leaderboardId)
            .maybeSingle();
          organizationId = lb?.organization_id || null;
        }
      } catch {
        // fallback to local
      }
    }

    if (competitionSponsors.length === 0) {
      competitionSponsors = mockDb
        .getCompetitionSponsors()
        .filter((s) => s.leaderboard_id === leaderboardId);
      if (!options.directOnly) {
        const lb = await DatabaseService.getLeaderboard(leaderboardId);
        organizationId = lb?.organization_id || null;
      }
    }

    let allSponsors = [...competitionSponsors];

    // Merge organization-level sponsors if parent organization exists
    if (organizationId && !options.directOnly) {
      const orgSponsors = await this.getSponsorsForOrganization(organizationId, options);
      // Avoid duplicates
      const existingIds = new Set(allSponsors.map((s) => s.id));
      for (const os of orgSponsors) {
        if (!existingIds.has(os.id)) {
          allSponsors.push(os);
        }
      }
    }

    // Apply filtering
    if (!options.includeInactive) {
      const nowMs = Date.now();
      allSponsors = allSponsors.filter((s) => {
        if (!s.is_active) return false;
        if (s.campaign_start && new Date(s.campaign_start).getTime() > nowMs) return false;
        if (s.campaign_end && new Date(s.campaign_end).getTime() < nowMs) return false;
        return true;
      });
    }

    // Sort by tier weight descending, then display_order ascending, then name ascending
    return allSponsors.sort((a, b) => {
      const weightA = TIER_WEIGHTS[a.tier] || 0;
      const weightB = TIER_WEIGHTS[b.tier] || 0;
      if (weightB !== weightA) return weightB - weightA;
      if (a.display_order !== b.display_order) return a.display_order - b.display_order;
      return a.name.localeCompare(b.name);
    });
  },

  /**
   * Get sponsors for an organization.
   */
  async getSponsorsForOrganization(
    organizationId: string,
    options: { includeInactive?: boolean } = {}
  ): Promise<CompetitionSponsor[]> {
    let orgSponsors: CompetitionSponsor[] = [];

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('competition_sponsors')
          .select('*')
          .eq('organization_id', organizationId);
        if (!error && data) {
          orgSponsors = data as CompetitionSponsor[];
        }
      } catch {
        // fallback to local
      }
    }

    if (orgSponsors.length === 0) {
      orgSponsors = mockDb
        .getCompetitionSponsors()
        .filter((s) => s.organization_id === organizationId);
    }

    if (!options.includeInactive) {
      const nowMs = Date.now();
      orgSponsors = orgSponsors.filter((s) => {
        if (!s.is_active) return false;
        if (s.campaign_start && new Date(s.campaign_start).getTime() > nowMs) return false;
        if (s.campaign_end && new Date(s.campaign_end).getTime() < nowMs) return false;
        return true;
      });
    }

    return orgSponsors.sort((a, b) => {
      const weightA = TIER_WEIGHTS[a.tier] || 0;
      const weightB = TIER_WEIGHTS[b.tier] || 0;
      if (weightB !== weightA) return weightB - weightA;
      return a.display_order - b.display_order;
    });
  },

  // ─── Measurable Metrics Tracking (Reliable & Non-Inflated) ──────────────────

  /**
   * Record a sponsor impression. Deduplicates within 1 hour per visitor.
   */
  async recordImpression(
    sponsorId: string,
    leaderboardId?: string | null,
    visitorHash: string = 'anon'
  ): Promise<{ recorded: boolean; deduplicated: boolean }> {
    const dedupKey = generateMetricsDedupKey(sponsorId, 'impression', visitorHash);

    // Check mockDb for existing dedupKey
    const mockEvents = mockDb.getCompetitionSponsorEvents();
    if (mockEvents.some((e) => e.dedup_key === dedupKey)) {
      return { recorded: false, deduplicated: true };
    }

    const event: CompetitionSponsorEvent = {
      id: `spevt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      sponsor_id: sponsorId,
      leaderboard_id: leaderboardId || null,
      event_type: 'impression',
      dedup_key: dedupKey,
      ip_hash: visitorHash,
      created_at: nowIso(),
    };

    mockEvents.push(event);
    mockDb.setCompetitionSponsorEvents(mockEvents);

    // Increment sponsor impressions in mockDb
    const mockSponsors = mockDb.getCompetitionSponsors();
    const sIdx = mockSponsors.findIndex((s) => s.id === sponsorId);
    if (sIdx >= 0) {
      mockSponsors[sIdx].impressions_count = (mockSponsors[sIdx].impressions_count || 0) + 1;
      mockDb.setCompetitionSponsors(mockSponsors);
    }

    // In Supabase
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.from('competition_sponsor_events').insert({
          sponsor_id: sponsorId,
          leaderboard_id: leaderboardId || null,
          event_type: 'impression',
          dedup_key: dedupKey,
          ip_hash: visitorHash,
        });

        if (!error) {
          try {
            const { error: rpcErr } = await supabase.rpc('increment_sponsor_impressions', {
              target_sponsor_id: sponsorId,
            });
            if (rpcErr) {
              const sp = await this.getSponsorById(sponsorId);
              if (sp) {
                await supabase
                  .from('competition_sponsors')
                  .update({ impressions_count: sp.impressions_count + 1 })
                  .eq('id', sponsorId);
              }
            }
          } catch {
            // Fallback handled
          }
        }
      } catch (err) {
        console.warn('Supabase recordImpression failed:', err);
      }
    }

    return { recorded: true, deduplicated: false };
  },

  /**
   * Record a sponsor link click. Deduplicates within 5 minutes per visitor.
   */
  async recordClick(
    sponsorId: string,
    leaderboardId?: string | null,
    visitorHash: string = 'anon'
  ): Promise<{ recorded: boolean; deduplicated: boolean; targetUrl: string }> {
    const sponsor = await this.getSponsorById(sponsorId);
    if (!sponsor) {
      throw new Error(`Sponsor with id "${sponsorId}" not found.`);
    }

    const dedupKey = generateMetricsDedupKey(sponsorId, 'click', visitorHash);

    // Check mockDb for existing dedupKey
    const mockEvents = mockDb.getCompetitionSponsorEvents();
    const alreadyClicked = mockEvents.some((e) => e.dedup_key === dedupKey);

    if (!alreadyClicked) {
      const event: CompetitionSponsorEvent = {
        id: `spevt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        sponsor_id: sponsorId,
        leaderboard_id: leaderboardId || null,
        event_type: 'click',
        dedup_key: dedupKey,
        ip_hash: visitorHash,
        created_at: nowIso(),
      };

      mockEvents.push(event);
      mockDb.setCompetitionSponsorEvents(mockEvents);

      // Increment click in mockDb
      const mockSponsors = mockDb.getCompetitionSponsors();
      const sIdx = mockSponsors.findIndex((s) => s.id === sponsorId);
      if (sIdx >= 0) {
        mockSponsors[sIdx].clicks_count = (mockSponsors[sIdx].clicks_count || 0) + 1;
        mockDb.setCompetitionSponsors(mockSponsors);
      }

      // Supabase
      if (isSupabaseConfigured && supabase) {
        try {
          const { error } = await supabase.from('competition_sponsor_events').insert({
            sponsor_id: sponsorId,
            leaderboard_id: leaderboardId || null,
            event_type: 'click',
            dedup_key: dedupKey,
            ip_hash: visitorHash,
          });

          if (!error) {
            try {
              const { error: rpcErr } = await supabase.rpc('increment_sponsor_clicks', {
                target_sponsor_id: sponsorId,
              });
              if (rpcErr) {
                const sp = await this.getSponsorById(sponsorId);
                if (sp) {
                  await supabase
                    .from('competition_sponsors')
                    .update({ clicks_count: sp.clicks_count + 1 })
                    .eq('id', sponsorId);
                }
              }
            } catch {
              // Fallback handled
            }
          }
        } catch (err) {
          console.warn('Supabase recordClick failed:', err);
        }
      }

      return { recorded: true, deduplicated: false, targetUrl: sponsor.website_url };
    }

    return { recorded: false, deduplicated: true, targetUrl: sponsor.website_url };
  },

  /**
   * Get metrics summary for a sponsor (impressions, clicks, CTR).
   */
  async getSponsorMetrics(sponsorId: string): Promise<SponsorMetricsSummary> {
    const sponsor = await this.getSponsorById(sponsorId);
    if (!sponsor) {
      return { sponsor_id: sponsorId, impressions: 0, clicks: 0, ctr: 0 };
    }

    const impressions = sponsor.impressions_count || 0;
    const clicks = sponsor.clicks_count || 0;
    const ctr = impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(1)) : 0;

    return {
      sponsor_id: sponsorId,
      impressions,
      clicks,
      ctr,
    };
  },
};
