import { DatabaseService, isSupabaseConfigured, supabase } from '@/lib/db';
import { LeagueService } from '@/lib/league/service';
import { CompetitionRules } from '@/types';
import { getDefaultCompetitionRules } from '@/lib/competition/rules/defaults';
import { validateCompetitionRules } from '@/lib/competition/rules/validation';

const STORAGE_KEY = 'leaderboardos_competition_rules';

function localGetRules(): CompetitionRules[] {
  if (typeof window === 'undefined' && typeof localStorage === 'undefined') return [];
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return [];
    return JSON.parse(raw) as CompetitionRules[];
  } catch {
    return [];
  }
}

function localSetRules(rules: CompetitionRules[]): void {
  if (typeof window === 'undefined' && typeof localStorage === 'undefined') return;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
  }
}

function mapDatabaseRowToRules(row: Record<string, unknown>): CompetitionRules {
  return {
    id: String(row.id),
    leaderboard_id: String(row.leaderboard_id),
    version: Number(row.version) || 1,
    engine: row.engine as CompetitionRules['engine'],
    ranking_order: row.ranking_order as CompetitionRules['ranking_order'],
    primary_metric: String(row.primary_metric || 'points'),
    points_config: {
      points_for_win: Number(row.points_for_win) ?? 3,
      points_for_draw: Number(row.points_for_draw) ?? 1,
      points_for_loss: Number(row.points_for_loss) ?? 0,
      allow_draws: row.allow_draws !== false,
      allow_negative_points: row.allow_negative_points !== false,
      min_points_per_event: row.min_points_per_event != null ? Number(row.min_points_per_event) : null,
      max_points_per_event: row.max_points_per_event != null ? Number(row.max_points_per_event) : null,
      walkover_win_score: Number(row.walkover_win_score) || 3,
      walkover_loss_score: Number(row.walkover_loss_score) || 0,
    },
    tie_breakers: Array.isArray(row.tie_breakers) ? (row.tie_breakers as CompetitionRules['tie_breakers']) : [],
    is_active: row.is_active !== false,
    created_at: String(row.created_at || new Date().toISOString()),
    updated_at: String(row.updated_at || new Date().toISOString()),
  };
}

export const CompetitionRulesService = {
  /**
   * Retrieves active competition rules.
   * If no custom rules row exists, falls back to the competition default rules.
   */
  async getRules(leaderboardId: string): Promise<CompetitionRules> {
    const config = await LeagueService.getCompetitionConfig(leaderboardId);
    const engine = config?.engine_type || 'simple_points';

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('competition_rules')
        .select('*')
        .eq('leaderboard_id', leaderboardId)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.warn('Error fetching competition rules from Supabase, falling back to defaults:', error);
      } else if (data) {
        return mapDatabaseRowToRules(data as Record<string, unknown>);
      }
    } else {
      const localRules = localGetRules();
      const activeRule = localRules.find(r => r.leaderboard_id === leaderboardId && r.is_active);
      if (activeRule) {
        return activeRule;
      }
    }

    // Default fallback preserving legacy configuration
    return getDefaultCompetitionRules(engine, leaderboardId, config?.template_key);
  },

  /**
   * Retrieves complete version history for a competition's rules.
   */
  async getRuleHistory(leaderboardId: string): Promise<CompetitionRules[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('competition_rules')
        .select('*')
        .eq('leaderboard_id', leaderboardId)
        .order('version', { ascending: false });

      if (error) {
        console.error('Error fetching competition rules history:', error);
        return [];
      }
      return (data || []).map(r => mapDatabaseRowToRules(r as Record<string, unknown>));
    }

    const localRules = localGetRules();
    return localRules
      .filter(r => r.leaderboard_id === leaderboardId)
      .sort((a, b) => b.version - a.version);
  },

  /**
   * Saves and activates a new version of competition rules.
   * Monotonically increments version, archiving previous rules.
   */
  async saveRules(
    leaderboardId: string,
    updates: Partial<CompetitionRules>
  ): Promise<CompetitionRules> {
    await DatabaseService.requireAdminPermission(leaderboardId);
    const currentRules = await this.getRules(leaderboardId);

    const mergedPointsConfig = {
      ...currentRules.points_config,
      ...(updates.points_config || {}),
    };

    const nextVersion = (currentRules.version || 1) + 1;
    const timestamp = new Date().toISOString();

    const newRules: CompetitionRules = {
      id: `rules-${leaderboardId}-v${nextVersion}`,
      leaderboard_id: leaderboardId,
      version: nextVersion,
      engine: updates.engine || currentRules.engine,
      ranking_order: updates.ranking_order || currentRules.ranking_order,
      primary_metric: updates.primary_metric || currentRules.primary_metric,
      points_config: mergedPointsConfig,
      tie_breakers: updates.tie_breakers || currentRules.tie_breakers,
      is_active: true,
      created_at: timestamp,
      updated_at: timestamp,
    };

    // Validate
    const validation = validateCompetitionRules(newRules);
    if (!validation.valid) {
      throw new Error(`Invalid competition rules: ${validation.errors.join(' ')}`);
    }

    if (isSupabaseConfigured && supabase) {
      // Deactivate existing rules
      await supabase
        .from('competition_rules')
        .update({ is_active: false, updated_at: timestamp })
        .eq('leaderboard_id', leaderboardId);

      // Insert new active version
      const { error } = await supabase
        .from('competition_rules')
        .insert([{
          leaderboard_id: leaderboardId,
          version: nextVersion,
          engine: newRules.engine,
          ranking_order: newRules.ranking_order,
          primary_metric: newRules.primary_metric,
          points_for_win: newRules.points_config.points_for_win,
          points_for_draw: newRules.points_config.points_for_draw,
          points_for_loss: newRules.points_config.points_for_loss,
          allow_draws: newRules.points_config.allow_draws,
          allow_negative_points: newRules.points_config.allow_negative_points,
          min_points_per_event: newRules.points_config.min_points_per_event,
          max_points_per_event: newRules.points_config.max_points_per_event,
          walkover_win_score: newRules.points_config.walkover_win_score ?? 3,
          walkover_loss_score: newRules.points_config.walkover_loss_score ?? 0,
          tie_breakers: newRules.tie_breakers,
          is_active: true,
          created_at: timestamp,
          updated_at: timestamp,
        }])
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Synchronize legacy league settings if league table
      if (newRules.engine === 'league_table') {
        await supabase
          .from('league_settings')
          .update({
            points_for_win: newRules.points_config.points_for_win,
            points_for_draw: newRules.points_config.points_for_draw,
            points_for_loss: newRules.points_config.points_for_loss,
            updated_at: timestamp,
          })
          .eq('leaderboard_id', leaderboardId);
      }
    } else {
      // Local storage mode
      const localRules = localGetRules();
      const updatedRules = localRules.map(r => 
        r.leaderboard_id === leaderboardId ? { ...r, is_active: false, updated_at: timestamp } : r
      );
      updatedRules.push(newRules);
      localSetRules(updatedRules);

      // Synchronize local league settings
      if (newRules.engine === 'league_table') {
        try {
          await LeagueService.updateLeagueSettings(leaderboardId, {
            points_for_win: newRules.points_config.points_for_win,
            points_for_draw: newRules.points_config.points_for_draw,
            points_for_loss: newRules.points_config.points_for_loss,
          });
        } catch {
          // ignore if league settings not initialized yet
        }
      }
    }

    // Log activity
    const tbSummary = newRules.tie_breakers.map(tb => tb.label).join(' > ');
    const logMsg = `Competition rules updated to version ${nextVersion} (${newRules.ranking_order.toUpperCase()}, Tie-breakers: ${tbSummary})`;
    try {
      await DatabaseService.addActivityLog(leaderboardId, logMsg);
    } catch (err) {
      console.warn('Failed to record activity log for rules update:', err);
    }

    return newRules;
  },
};
