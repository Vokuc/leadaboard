import {
  CompetitionConfig,
  CompetitionEngine,
  CompetitionRegistration,
  CompetitionRegistrationConfig,
  Leaderboard,
  LeaderboardMember,
  MarketplaceCompetition,
  MarketplaceQueryOptions,
  MarketplaceQueryResult,
  MarketplaceRegistrationInfo,
  Profile,
  Season,
} from '@/types';
import {
  DEFAULT_COMPETITION_CONFIGS,
  DEFAULT_LEADERBOARDS,
  DEFAULT_MEMBERS,
  DEFAULT_PROFILE,
  DEFAULT_REGISTRATION_CONFIGS,
  DEFAULT_SEASONS,
  isSupabaseConfigured,
  supabase,
} from '@/lib/db';

const DEMO_LEADERBOARD_IDS = new Set(['lb-gaming-1', 'lb-workplace-1', 'lb-sports-1']);

function getSupabaseAdapter() {
  return { client: supabase, isConfigured: isSupabaseConfigured };
}

export class CompetitionMarketplaceService {
  /**
   * Resolves the authoritative registration status based on configuration, capacity, and current time.
   */
  static resolveRegistrationStatus(
    config: CompetitionRegistrationConfig | null,
    registeredCount: number,
    now: Date = new Date()
  ): MarketplaceRegistrationInfo['status'] {
    if (!config || !config.is_enabled) {
      return 'view_only';
    }

    if (config.closes_at) {
      const closesAt = new Date(config.closes_at);
      if (now.getTime() > closesAt.getTime()) {
        return 'closed';
      }
    }

    if (config.opens_at) {
      const opensAt = new Date(config.opens_at);
      if (now.getTime() < opensAt.getTime()) {
        return 'closed';
      }
    }

    if (config.capacity !== null && config.capacity !== undefined && config.capacity > 0) {
      if (registeredCount >= config.capacity) {
        return config.allow_waitlist ? 'waitlist' : 'closed';
      }
    }

    if (config.require_approval) {
      return 'approval_required';
    }

    return 'open';
  }

  /**
   * Transforms raw competition data into a standardized MarketplaceCompetition item.
   */
  static buildMarketplaceItem(params: {
    leaderboard: Leaderboard;
    config?: CompetitionConfig | null;
    season?: Season | null;
    registrationConfig?: CompetitionRegistrationConfig | null;
    registeredCount?: number;
    participantCount?: number;
    organizer?: Profile | null;
    userRegistration?: CompetitionRegistration | null;
    isDemo?: boolean;
    now?: Date;
  }): MarketplaceCompetition {
    const {
      leaderboard,
      config,
      season,
      registrationConfig,
      registeredCount = 0,
      participantCount = 0,
      organizer,
      userRegistration,
      isDemo = false,
      now = new Date(),
    } = params;

    const registrationStatus = this.resolveRegistrationStatus(
      registrationConfig || null,
      registeredCount,
      now
    );

    const engineType: CompetitionEngine = config?.engine_type || 'simple_points';
    const entryFee = Number(config?.entry_fee ?? 0);

    // Determine derived participation type if unspecified
    let participationType = config?.participation_type || 'unspecified';
    if (participationType === 'unspecified') {
      if (leaderboard.competition_type === 'gaming') {
        participationType = 'online';
      } else if (leaderboard.competition_type === 'sports' || leaderboard.competition_type === 'fitness') {
        participationType = 'in_person';
      } else {
        participationType = 'online';
      }
    }

    return {
      id: leaderboard.id,
      slug: leaderboard.slug,
      name: leaderboard.name,
      description: leaderboard.description,
      competition_type: leaderboard.competition_type,
      engine_type: engineType,
      entity_type: config?.entity_type || 'individual',
      operational_status: config?.operational_status || 'in_progress',
      cover_image_url: leaderboard.cover_image_url,
      created_at: leaderboard.created_at,
      updated_at: leaderboard.updated_at,
      organizer: {
        id: organizer?.id || leaderboard.owner_id,
        name: organizer?.full_name || (isDemo ? 'Alex Mercer (Demo Organizer)' : 'Competition Organizer'),
        avatar_url: organizer?.avatar_url || null,
      },
      season: season
        ? {
            id: season.id,
            name: season.name,
            start_date: season.start_date,
            end_date: season.end_date,
          }
        : null,
      registration: {
        is_enabled: registrationConfig?.is_enabled ?? false,
        status: registrationStatus,
        opens_at: registrationConfig?.opens_at ?? null,
        closes_at: registrationConfig?.closes_at ?? null,
        capacity: registrationConfig?.capacity ?? null,
        registered_count: registeredCount,
        require_approval: registrationConfig?.require_approval ?? false,
        allow_waitlist: registrationConfig?.allow_waitlist ?? false,
        allow_team_registration: registrationConfig?.allow_team_registration ?? false,
        eligibility_rules: registrationConfig?.eligibility_rules ?? null,
        is_user_registered: !!userRegistration,
        user_registration_status: userRegistration?.status || null,
      },
      participation_type: participationType,
      location_name: config?.location_name || null,
      pricing: {
        is_free: entryFee === 0,
        entry_fee: entryFee,
        currency: config?.currency || 'USD',
      },
      rules_summary: config?.rules_summary || null,
      participant_count: participantCount,
      is_demo: isDemo,
    };
  }

  /**
   * Queries public competitions with filters, sorting, and pagination.
   * Works in both Live Supabase mode and Demo mode.
   */
  static async queryCompetitions(
    options: MarketplaceQueryOptions = {}
  ): Promise<MarketplaceQueryResult> {
    const {
      query,
      category,
      engine,
      participation_type,
      registration_status,
      pricing,
      date_range,
      organizer_id,
      sort = 'recently_updated',
      page = 1,
      pageSize = 12,
      includeDemo = true,
      currentUserId,
    } = options;

    const now = new Date();

    const { client, isConfigured } = getSupabaseAdapter();

    let allCompetitions: MarketplaceCompetition[] = [];

    if (isConfigured && client) {
      allCompetitions = await this.fetchFromSupabase(client, currentUserId, now);
    } else {
      allCompetitions = await this.fetchFromLocalDemo(currentUserId, now);
    }

    // Filter out demo data if requested
    if (!includeDemo) {
      allCompetitions = allCompetitions.filter((c) => !c.is_demo);
    }

    // Build raw facets across all available public competitions
    const facets = {
      categories: {} as Record<string, number>,
      engines: {} as Record<string, number>,
      participationTypes: {} as Record<string, number>,
      registrationStatuses: {} as Record<string, number>,
    };

    for (const item of allCompetitions) {
      facets.categories[item.competition_type] = (facets.categories[item.competition_type] || 0) + 1;
      facets.engines[item.engine_type] = (facets.engines[item.engine_type] || 0) + 1;
      facets.participationTypes[item.participation_type] = (facets.participationTypes[item.participation_type] || 0) + 1;
      facets.registrationStatuses[item.registration.status] = (facets.registrationStatuses[item.registration.status] || 0) + 1;
    }

    // Apply Filters
    const filtered = allCompetitions.filter((comp) => {
      // 1. Text Search Query
      if (query && query.trim().length > 0) {
        const q = query.trim().toLowerCase();
        const matchesName = comp.name.toLowerCase().includes(q);
        const matchesDesc = comp.description ? comp.description.toLowerCase().includes(q) : false;
        const matchesLocation = comp.location_name ? comp.location_name.toLowerCase().includes(q) : false;
        const matchesRules = comp.rules_summary ? comp.rules_summary.toLowerCase().includes(q) : false;
        const matchesOrganizer = comp.organizer.name.toLowerCase().includes(q);
        if (!matchesName && !matchesDesc && !matchesLocation && !matchesRules && !matchesOrganizer) {
          return false;
        }
      }

      // 2. Category / Type Filter
      if (category && category !== 'all') {
        if (comp.competition_type !== category) {
          return false;
        }
      }

      // 3. Engine Filter
      if (engine && engine !== 'all') {
        if (comp.engine_type !== engine) {
          return false;
        }
      }

      // 4. Participation Type Filter
      if (participation_type && participation_type !== 'all') {
        if (comp.participation_type !== participation_type) {
          return false;
        }
      }

      // 5. Registration Status Filter
      if (registration_status && registration_status !== 'all') {
        if (comp.registration.status !== registration_status) {
          return false;
        }
      }

      // 6. Pricing Filter
      if (pricing && pricing !== 'all') {
        if (pricing === 'free' && !comp.pricing.is_free) {
          return false;
        }
        if (pricing === 'paid' && comp.pricing.is_free) {
          return false;
        }
      }

      // 7. Date Range Filter
      if (date_range && date_range !== 'all' && comp.season) {
        const startDate = comp.season.start_date ? new Date(comp.season.start_date).getTime() : null;
        const endDate = comp.season.end_date ? new Date(comp.season.end_date).getTime() : null;
        const nowTime = now.getTime();

        if (date_range === 'upcoming') {
          if (!startDate || startDate <= nowTime) return false;
        } else if (date_range === 'ongoing') {
          if (startDate && startDate > nowTime) return false;
          if (endDate && endDate < nowTime) return false;
        } else if (date_range === 'past') {
          if (!endDate || endDate >= nowTime) return false;
        }
      }

      // 8. Organizer Filter
      if (organizer_id) {
        if (comp.organizer.id !== organizer_id) {
          return false;
        }
      }

      return true;
    });

    // Apply Sorting
    filtered.sort((a, b) => {
      switch (sort) {
        case 'upcoming': {
          const aStart = a.season?.start_date ? new Date(a.season.start_date).getTime() : Infinity;
          const bStart = b.season?.start_date ? new Date(b.season.start_date).getTime() : Infinity;
          if (aStart !== bStart) {
            return aStart - bStart;
          }
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        }
        case 'popular': {
          // Strictly sorted by real participant_count
          if (b.participant_count !== a.participant_count) {
            return b.participant_count - a.participant_count;
          }
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        }
        case 'newest': {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        case 'recently_updated':
        default: {
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        }
      }
    });

    // Pagination
    const totalCount = filtered.length;
    const currentPage = Math.max(1, page);
    const limit = Math.max(1, pageSize);
    const offset = (currentPage - 1) * limit;
    const paginatedItems = filtered.slice(offset, offset + limit);
    const totalPages = Math.ceil(totalCount / limit);

    return {
      items: paginatedItems,
      totalCount,
      page: currentPage,
      pageSize: limit,
      totalPages,
      facets,
    };
  }

  /**
   * Fetches public competition detail by slug or ID with privacy and authorization checks.
   */
  static async getCompetitionDetail(
    slugOrId: string,
    currentUserId?: string
  ): Promise<MarketplaceCompetition | null> {
    const { client, isConfigured } = getSupabaseAdapter();
    const now = new Date();

    if (isConfigured && client) {
      // Query leaderboard
      const { data: lb } = await client
        .from('leaderboards')
        .select('*')
        .or(`slug.eq.${slugOrId},id.eq.${slugOrId}`)
        .maybeSingle();

      if (!lb) return null;

      // Visibility check: private leaderboards can only be seen by owner
      if (lb.visibility !== 'public') {
        if (!currentUserId || lb.owner_id !== currentUserId) {
          return null;
        }
      }

      const [
        { data: config },
        { data: seasons },
        { data: regConfig },
        { count: regCount },
        { count: membersCount },
        { data: ownerProfile },
      ] = await Promise.all([
        client.from('competition_configs').select('*').eq('leaderboard_id', lb.id).maybeSingle(),
        client.from('seasons').select('*').eq('leaderboard_id', lb.id).order('start_date', { ascending: false }),
        client.from('competition_registration_configs').select('*').eq('leaderboard_id', lb.id).maybeSingle(),
        client.from('competition_registrations').select('*', { count: 'exact', head: true }).eq('leaderboard_id', lb.id),
        client.from('leaderboard_members').select('*', { count: 'exact', head: true }).eq('leaderboard_id', lb.id),
        client.from('profiles').select('*').eq('id', lb.owner_id).maybeSingle(),
      ]);

      let userReg: CompetitionRegistration | null = null;
      if (currentUserId) {
        const { data: ureg } = await client
          .from('competition_registrations')
          .select('*')
          .eq('leaderboard_id', lb.id)
          .eq('user_id', currentUserId)
          .maybeSingle();
        userReg = (ureg as CompetitionRegistration) || null;
      }

      return this.buildMarketplaceItem({
        leaderboard: lb as Leaderboard,
        config: config as CompetitionConfig | null,
        season: seasons?.[0] as Season | null,
        registrationConfig: regConfig as CompetitionRegistrationConfig | null,
        registeredCount: regCount || 0,
        participantCount: membersCount || 0,
        organizer: ownerProfile as Profile | null,
        userRegistration: userReg,
        isDemo: false,
        now,
      });
    }

    // Local Demo / Fallback Mode
    const items = await this.fetchFromLocalDemo(currentUserId, now);
    const found = items.find((c) => c.slug === slugOrId || c.id === slugOrId);

    if (!found) return null;

    return found;
  }

  // ─── Private Data Loaders ──────────────────────────────────────────────────

  private static async fetchFromSupabase(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client: any,
    currentUserId?: string,
    now: Date = new Date()
  ): Promise<MarketplaceCompetition[]> {
    if (!client) return [];

    // Query all public and active leaderboards
    const { data: leaderboards, error } = await client
      .from('leaderboards')
      .select(`
        *,
        config:competition_configs(*),
        seasons(*),
        registration_config:competition_registration_configs(*),
        owner:profiles!leaderboards_owner_id_fkey(*)
      `)
      .eq('visibility', 'public')
      .eq('status', 'active')
      .order('updated_at', { ascending: false });

    if (error || !leaderboards) {
      console.error('Failed to fetch marketplace leaderboards from Supabase:', error);
      return [];
    }

    // Fetch participant counts and registration counts in parallel
    const items: MarketplaceCompetition[] = [];

    for (const lb of leaderboards) {
      const [
        { count: memberCount },
        { count: regCount },
      ] = await Promise.all([
        client
          .from('leaderboard_members')
          .select('*', { count: 'exact', head: true })
          .eq('leaderboard_id', lb.id),
        client
          .from('competition_registrations')
          .select('*', { count: 'exact', head: true })
          .eq('leaderboard_id', lb.id),
      ]);

      const primarySeason = Array.isArray(lb.seasons) && lb.seasons.length > 0 ? lb.seasons[0] : null;
      const config = Array.isArray(lb.config) ? lb.config[0] : lb.config;
      const regConfig = Array.isArray(lb.registration_config) ? lb.registration_config[0] : lb.registration_config;
      const owner = Array.isArray(lb.owner) ? lb.owner[0] : lb.owner;

      items.push(
        this.buildMarketplaceItem({
          leaderboard: lb as Leaderboard,
          config: config as CompetitionConfig | null,
          season: primarySeason as Season | null,
          registrationConfig: regConfig as CompetitionRegistrationConfig | null,
          registeredCount: regCount || 0,
          participantCount: memberCount || 0,
          organizer: owner as Profile | null,
          isDemo: DEMO_LEADERBOARD_IDS.has(lb.id),
          now,
        })
      );
    }

    return items;
  }

  private static async fetchFromLocalDemo(
    currentUserId?: string,
    now: Date = new Date()
  ): Promise<MarketplaceCompetition[]> {
    let rawLeaderboards: Leaderboard[] = Array.isArray(DEFAULT_LEADERBOARDS) ? DEFAULT_LEADERBOARDS : [];
    let rawConfigs: CompetitionConfig[] = Array.isArray(DEFAULT_COMPETITION_CONFIGS) ? DEFAULT_COMPETITION_CONFIGS : [];
    let rawRegConfigs: CompetitionRegistrationConfig[] = Array.isArray(DEFAULT_REGISTRATION_CONFIGS) ? DEFAULT_REGISTRATION_CONFIGS : [];
    let rawSeasons: Season[] = Array.isArray(DEFAULT_SEASONS) ? DEFAULT_SEASONS : [];
    let rawMembers: LeaderboardMember[] = Array.isArray(DEFAULT_MEMBERS) ? DEFAULT_MEMBERS : [];

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const storedLbs = localStorage.getItem('leaderboardos_leaderboards');
        if (storedLbs) {
          const parsed = JSON.parse(storedLbs);
          if (Array.isArray(parsed)) rawLeaderboards = parsed;
        }

        const storedConfigs = localStorage.getItem('leaderboardos_competition_configs');
        if (storedConfigs) {
          const parsed = JSON.parse(storedConfigs);
          if (Array.isArray(parsed)) rawConfigs = parsed;
        }

        const storedRegConfigs = localStorage.getItem('leaderboardos_competition_registration_configs');
        if (storedRegConfigs) {
          const parsed = JSON.parse(storedRegConfigs);
          if (Array.isArray(parsed)) rawRegConfigs = parsed;
        }

        const storedSeasons = localStorage.getItem('leaderboardos_seasons');
        if (storedSeasons) {
          const parsed = JSON.parse(storedSeasons);
          if (Array.isArray(parsed)) rawSeasons = parsed;
        }

        const storedMembers = localStorage.getItem('leaderboardos_members');
        if (storedMembers) {
          const parsed = JSON.parse(storedMembers);
          if (Array.isArray(parsed)) rawMembers = parsed;
        }
      } catch (e) {
        console.warn('Failed to parse localStorage demo data:', e);
      }
    }

    // Public and active leaderboards only
    const publicBoards = rawLeaderboards.filter(
      (lb) => lb.visibility === 'public' && lb.status === 'active'
    );

    return publicBoards.map((lb) => {
      const config = rawConfigs.find((c) => c.leaderboard_id === lb.id) || null;
      const season = rawSeasons.find((s) => s.leaderboard_id === lb.id) || null;
      const regConfig = rawRegConfigs.find((r) => r.leaderboard_id === lb.id) || null;
      const memberCount = rawMembers.filter((m) => m.leaderboard_id === lb.id).length;
      const isDemo = DEMO_LEADERBOARD_IDS.has(lb.id) || !isSupabaseConfigured;

      return this.buildMarketplaceItem({
        leaderboard: lb,
        config,
        season,
        registrationConfig: regConfig,
        registeredCount: memberCount,
        participantCount: memberCount,
        organizer: DEFAULT_PROFILE,
        isDemo,
        now,
      });
    });
  }
}
