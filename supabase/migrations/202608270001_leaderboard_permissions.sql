-- ==========================================
-- LEADERBOARD ADMINS & PERMISSIONS
-- ==========================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.leaderboard_admins (
  leaderboard_id UUID NOT NULL REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (leaderboard_id, user_id)
);

CREATE OR REPLACE FUNCTION public.can_manage_leaderboard(p_leaderboard_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM leaderboards l
    WHERE l.id = p_leaderboard_id AND l.owner_id = p_user_id
  ) OR EXISTS (
    SELECT 1 FROM leaderboard_admins la
    WHERE la.leaderboard_id = p_leaderboard_id AND la.user_id = p_user_id
  );
END;
$$;

-- Enable RLS on leaderboard_admins
ALTER TABLE public.leaderboard_admins ENABLE ROW LEVEL SECURITY;

-- 1. Re-define SELECT, UPDATE policies on public.leaderboards
DROP POLICY IF EXISTS "Anyone can view public leaderboards" ON public.leaderboards;
CREATE POLICY "Anyone can view public leaderboards" ON public.leaderboards
  FOR SELECT USING (visibility = 'public' OR auth.uid() = owner_id OR EXISTS (SELECT 1 FROM public.leaderboard_admins la WHERE la.leaderboard_id = id AND la.user_id = auth.uid()));

DROP POLICY IF EXISTS "Owners can update their own leaderboards" ON public.leaderboards;
DROP POLICY IF EXISTS "Owners and admins can update leaderboards" ON public.leaderboards;
CREATE POLICY "Owners and admins can update leaderboards" ON public.leaderboards
  FOR UPDATE USING (auth.uid() = owner_id OR EXISTS (SELECT 1 FROM public.leaderboard_admins la WHERE la.leaderboard_id = id AND la.user_id = auth.uid()));

-- 2. Leaderboard Admins Policies
DROP POLICY IF EXISTS "Anyone can view leaderboard admins" ON public.leaderboard_admins;
CREATE POLICY "Anyone can view leaderboard admins" ON public.leaderboard_admins
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards l 
      WHERE l.id = leaderboard_id AND (l.visibility = 'public' OR l.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.leaderboard_admins la WHERE la.leaderboard_id = l.id AND la.user_id = auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Owners can manage leaderboard admins" ON public.leaderboard_admins;
CREATE POLICY "Owners can manage leaderboard admins" ON public.leaderboard_admins
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards l 
      WHERE l.id = leaderboard_id AND auth.uid() = l.owner_id
    )
  );

-- 3. Seasons Policies
DROP POLICY IF EXISTS "Anyone can select seasons for accessible leaderboards" ON public.seasons;
CREATE POLICY "Anyone can select seasons for accessible leaderboards" ON public.seasons
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards l 
      WHERE l.id = leaderboard_id AND (l.visibility = 'public' OR l.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.leaderboard_admins la WHERE la.leaderboard_id = l.id AND la.user_id = auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Owners can manage seasons" ON public.seasons;
DROP POLICY IF EXISTS "Owners and admins can manage seasons" ON public.seasons;
CREATE POLICY "Owners and admins can manage seasons" ON public.seasons
  FOR ALL USING (public.can_manage_leaderboard(leaderboard_id, auth.uid()));

-- 4. Scoring Rules Policies
DROP POLICY IF EXISTS "Anyone can view scoring rules for accessible leaderboards" ON public.scoring_rules;
CREATE POLICY "Anyone can view scoring rules for accessible leaderboards" ON public.scoring_rules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards l 
      WHERE l.id = leaderboard_id AND (l.visibility = 'public' OR l.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.leaderboard_admins la WHERE la.leaderboard_id = l.id AND la.user_id = auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Owners can manage scoring rules" ON public.scoring_rules;
DROP POLICY IF EXISTS "Owners and admins can manage scoring rules" ON public.scoring_rules;
CREATE POLICY "Owners and admins can manage scoring rules" ON public.scoring_rules
  FOR ALL USING (public.can_manage_leaderboard(leaderboard_id, auth.uid()));

-- 5. Leaderboard Members Policies
DROP POLICY IF EXISTS "Anyone can view leaderboard members for accessible leaderboards" ON public.leaderboard_members;
CREATE POLICY "Anyone can view leaderboard members for accessible leaderboards" ON public.leaderboard_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards l 
      WHERE l.id = leaderboard_id AND (l.visibility = 'public' OR l.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.leaderboard_admins la WHERE la.leaderboard_id = l.id AND la.user_id = auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Owners can manage leaderboard members" ON public.leaderboard_members;
DROP POLICY IF EXISTS "Owners and admins can manage leaderboard members" ON public.leaderboard_members;
CREATE POLICY "Owners and admins can manage leaderboard members" ON public.leaderboard_members
  FOR ALL USING (public.can_manage_leaderboard(leaderboard_id, auth.uid()));

-- 6. Competition Configs Policies
DROP POLICY IF EXISTS "Anyone can view competition config for accessible leaderboards" ON public.competition_configs;
CREATE POLICY "Anyone can view competition config for accessible leaderboards" ON public.competition_configs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards l 
      WHERE l.id = leaderboard_id AND (l.visibility = 'public' OR l.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.leaderboard_admins la WHERE la.leaderboard_id = l.id AND la.user_id = auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Owners can manage competition config" ON public.competition_configs;
DROP POLICY IF EXISTS "Owners and admins can manage competition config" ON public.competition_configs;
CREATE POLICY "Owners and admins can manage competition config" ON public.competition_configs
  FOR ALL USING (public.can_manage_leaderboard(leaderboard_id, auth.uid()));

-- 7. Competition Statistics Policies
DROP POLICY IF EXISTS "Anyone can read competition statistics" ON public.competition_statistics;
CREATE POLICY "Anyone can read competition statistics" ON public.competition_statistics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards l 
      WHERE l.id = leaderboard_id AND (l.visibility = 'public' OR l.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.leaderboard_admins la WHERE la.leaderboard_id = l.id AND la.user_id = auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Owners can manage competition statistics" ON public.competition_statistics;
DROP POLICY IF EXISTS "Owners and admins can manage competition statistics" ON public.competition_statistics;
CREATE POLICY "Owners and admins can manage competition statistics" ON public.competition_statistics
  FOR ALL USING (public.can_manage_leaderboard(leaderboard_id, auth.uid()));

-- 8. Competition Stat Values Policies
DROP POLICY IF EXISTS "Anyone can read competition stat values" ON public.competition_stat_values;
CREATE POLICY "Anyone can read competition stat values" ON public.competition_stat_values
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards l 
      WHERE l.id = leaderboard_id AND (l.visibility = 'public' OR l.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.leaderboard_admins la WHERE la.leaderboard_id = l.id AND la.user_id = auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Owners can manage competition stat values" ON public.competition_stat_values;
DROP POLICY IF EXISTS "Owners and admins can manage competition stat values" ON public.competition_stat_values;
CREATE POLICY "Owners and admins can manage competition stat values" ON public.competition_stat_values
  FOR ALL USING (public.can_manage_leaderboard(leaderboard_id, auth.uid()));

-- 9. Competition Ranking Rules Policies
DROP POLICY IF EXISTS "Anyone can read ranking rules" ON public.competition_ranking_rules;
CREATE POLICY "Anyone can read ranking rules" ON public.competition_ranking_rules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards l 
      WHERE l.id = leaderboard_id AND (l.visibility = 'public' OR l.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.leaderboard_admins la WHERE la.leaderboard_id = l.id AND la.user_id = auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Owners can manage ranking rules" ON public.competition_ranking_rules;
DROP POLICY IF EXISTS "Owners and admins can manage ranking rules" ON public.competition_ranking_rules;
CREATE POLICY "Owners and admins can manage ranking rules" ON public.competition_ranking_rules
  FOR ALL USING (public.can_manage_leaderboard(leaderboard_id, auth.uid()));

-- 10. League Settings Policies
DROP POLICY IF EXISTS "Anyone can read league settings" ON public.league_settings;
CREATE POLICY "Anyone can read league settings" ON public.league_settings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards l 
      WHERE l.id = leaderboard_id AND (l.visibility = 'public' OR l.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.leaderboard_admins la WHERE la.leaderboard_id = l.id AND la.user_id = auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Owners can manage league settings" ON public.league_settings;
DROP POLICY IF EXISTS "Owners and admins can manage league settings" ON public.league_settings;
CREATE POLICY "Owners and admins can manage league settings" ON public.league_settings
  FOR ALL USING (public.can_manage_leaderboard(leaderboard_id, auth.uid()));

-- 11. Fixtures Policies
DROP POLICY IF EXISTS "Anyone can read fixtures" ON public.fixtures;
CREATE POLICY "Anyone can read fixtures" ON public.fixtures
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards l 
      WHERE l.id = leaderboard_id AND (l.visibility = 'public' OR l.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.leaderboard_admins la WHERE la.leaderboard_id = l.id AND la.user_id = auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Owners can manage fixtures" ON public.fixtures;
DROP POLICY IF EXISTS "Owners and admins can manage fixtures" ON public.fixtures;
CREATE POLICY "Owners and admins can manage fixtures" ON public.fixtures
  FOR ALL USING (public.can_manage_leaderboard(leaderboard_id, auth.uid()));

-- 12. Fixture Results Policies
DROP POLICY IF EXISTS "Anyone can read fixture results" ON public.fixture_results;
CREATE POLICY "Anyone can read fixture results" ON public.fixture_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.fixtures f
      JOIN public.leaderboards l ON l.id = f.leaderboard_id
      WHERE f.id = fixture_id AND (l.visibility = 'public' OR l.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.leaderboard_admins la WHERE la.leaderboard_id = l.id AND la.user_id = auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Owners can manage fixture results" ON public.fixture_results;
DROP POLICY IF EXISTS "Owners and admins can manage fixture results" ON public.fixture_results;
CREATE POLICY "Owners and admins can manage fixture results" ON public.fixture_results
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.fixtures f
      WHERE f.id = fixture_id AND public.can_manage_leaderboard(f.leaderboard_id, auth.uid())
    )
  );

-- 13. Score Events Policies
DROP POLICY IF EXISTS "Anyone can view score events for accessible leaderboards" ON public.score_events;
CREATE POLICY "Anyone can view score events for accessible leaderboards" ON public.score_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards l 
      WHERE l.id = leaderboard_id AND (l.visibility = 'public' OR l.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.leaderboard_admins la WHERE la.leaderboard_id = l.id AND la.user_id = auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Owners can manage score events" ON public.score_events;
DROP POLICY IF EXISTS "Owners and admins can manage score events" ON public.score_events;
CREATE POLICY "Owners and admins can manage score events" ON public.score_events
  FOR ALL USING (public.can_manage_leaderboard(leaderboard_id, auth.uid()));

-- 14. Activity Logs Policies
DROP POLICY IF EXISTS "Anyone can view activity logs for accessible leaderboards" ON public.activity_logs;
CREATE POLICY "Anyone can view activity logs for accessible leaderboards" ON public.activity_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards l 
      WHERE l.id = leaderboard_id AND (l.visibility = 'public' OR l.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.leaderboard_admins la WHERE la.leaderboard_id = l.id AND la.user_id = auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Owners can manage activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Owners and admins can manage activity logs" ON public.activity_logs;
CREATE POLICY "Owners and admins can manage activity logs" ON public.activity_logs
  FOR ALL USING (public.can_manage_leaderboard(leaderboard_id, auth.uid()));

-- 15. Tournament Policies
DROP POLICY IF EXISTS "Anyone can read tournaments" ON public.tournaments;
CREATE POLICY "Anyone can read tournaments" ON public.tournaments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards l 
      WHERE l.id = leaderboard_id AND (l.visibility = 'public' OR l.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.leaderboard_admins la WHERE la.leaderboard_id = l.id AND la.user_id = auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Owners can manage tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Owners and admins can manage tournaments" ON public.tournaments;
CREATE POLICY "Owners and admins can manage tournaments" ON public.tournaments
  FOR ALL USING (public.can_manage_leaderboard(leaderboard_id, auth.uid()));

-- 16. Tournament Rounds Policies
DROP POLICY IF EXISTS "Anyone can read tournament rounds" ON public.tournament_rounds;
CREATE POLICY "Anyone can read tournament rounds" ON public.tournament_rounds
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards l 
      WHERE l.id = leaderboard_id AND (l.visibility = 'public' OR l.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.leaderboard_admins la WHERE la.leaderboard_id = l.id AND la.user_id = auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Owners can manage tournament rounds" ON public.tournament_rounds;
DROP POLICY IF EXISTS "Owners and admins can manage tournament rounds" ON public.tournament_rounds;
CREATE POLICY "Owners and admins can manage tournament rounds" ON public.tournament_rounds
  FOR ALL USING (public.can_manage_leaderboard(leaderboard_id, auth.uid()));

-- 17. Tournament Matches Policies
DROP POLICY IF EXISTS "Anyone can read tournament matches" ON public.tournament_matches;
CREATE POLICY "Anyone can read tournament matches" ON public.tournament_matches
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards l 
      WHERE l.id = leaderboard_id AND (l.visibility = 'public' OR l.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.leaderboard_admins la WHERE la.leaderboard_id = l.id AND la.user_id = auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Owners can manage tournament matches" ON public.tournament_matches;
DROP POLICY IF EXISTS "Owners and admins can manage tournament matches" ON public.tournament_matches;
CREATE POLICY "Owners and admins can manage tournament matches" ON public.tournament_matches
  FOR ALL USING (public.can_manage_leaderboard(leaderboard_id, auth.uid()));

-- 18. Tournament Match Results Policies
DROP POLICY IF EXISTS "Anyone can read tournament match results" ON public.tournament_match_results;
CREATE POLICY "Anyone can read tournament match results" ON public.tournament_match_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tournament_matches tm
      JOIN public.leaderboards l ON l.id = tm.leaderboard_id
      WHERE tm.id = match_id AND (l.visibility = 'public' OR l.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.leaderboard_admins la WHERE la.leaderboard_id = l.id AND la.user_id = auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Owners can manage tournament match results" ON public.tournament_match_results;
DROP POLICY IF EXISTS "Owners and admins can manage tournament match results" ON public.tournament_match_results;
CREATE POLICY "Owners and admins can manage tournament match results" ON public.tournament_match_results
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.tournament_matches tm
      WHERE tm.id = match_id AND public.can_manage_leaderboard(tm.leaderboard_id, auth.uid())
    )
  );

-- 19. Tournament Advancements Policies
DROP POLICY IF EXISTS "Anyone can read tournament advancements" ON public.tournament_advancements;
CREATE POLICY "Anyone can read tournament advancements" ON public.tournament_advancements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards l 
      WHERE l.id = leaderboard_id AND (l.visibility = 'public' OR l.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.leaderboard_admins la WHERE la.leaderboard_id = l.id AND la.user_id = auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Owners can manage tournament advancements" ON public.tournament_advancements;
DROP POLICY IF EXISTS "Owners and admins can manage tournament advancements" ON public.tournament_advancements;
CREATE POLICY "Owners and admins can manage tournament advancements" ON public.tournament_advancements
  FOR ALL USING (public.can_manage_leaderboard(leaderboard_id, auth.uid()));

COMMIT;
