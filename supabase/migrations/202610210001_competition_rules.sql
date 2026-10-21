-- Migration: 202610210001_competition_rules.sql
-- Description: Introduces typed, versioned competition rules configuration, customizable scoring, tie-breakers, and fallback logic.

-- 1. Create Competition Rules Table
CREATE TABLE IF NOT EXISTS public.competition_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_id UUID NOT NULL REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  engine TEXT NOT NULL CHECK (engine IN ('simple_points', 'league_table', 'tournament')),
  ranking_order TEXT NOT NULL DEFAULT 'desc' CHECK (ranking_order IN ('asc', 'desc')),
  primary_metric TEXT NOT NULL DEFAULT 'points',
  points_for_win DOUBLE PRECISION NOT NULL DEFAULT 3,
  points_for_draw DOUBLE PRECISION NOT NULL DEFAULT 1,
  points_for_loss DOUBLE PRECISION NOT NULL DEFAULT 0,
  allow_draws BOOLEAN NOT NULL DEFAULT TRUE,
  allow_negative_points BOOLEAN NOT NULL DEFAULT TRUE,
  min_points_per_event DOUBLE PRECISION,
  max_points_per_event DOUBLE PRECISION,
  walkover_win_score DOUBLE PRECISION NOT NULL DEFAULT 3,
  walkover_loss_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  tie_breakers JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (leaderboard_id, version)
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_competition_rules_leaderboard ON public.competition_rules(leaderboard_id, is_active);
CREATE INDEX IF NOT EXISTS idx_competition_rules_engine ON public.competition_rules(engine);

-- 3. Row Level Security
ALTER TABLE public.competition_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view competition rules for accessible leaderboards" ON public.competition_rules;
CREATE POLICY "Anyone can view competition rules for accessible leaderboards" ON public.competition_rules
  FOR SELECT USING (public.can_view_leaderboard(leaderboard_id, auth.uid()));

DROP POLICY IF EXISTS "Owners and admins can manage competition rules" ON public.competition_rules;
CREATE POLICY "Owners and admins can manage competition rules" ON public.competition_rules
  FOR ALL USING (public.can_manage_leaderboard(leaderboard_id, auth.uid()));

-- 4. Realtime publication
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = 'competition_rules'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.competition_rules;
    END IF;
  END IF;
END $$;

-- 5. Repeatable Backfill of initial version 1 rules for existing competitions
DO $$
DECLARE
  lb RECORD;
  conf RECORD;
  ls RECORD;
  tb_json JSONB;
BEGIN
  FOR lb IN SELECT id, competition_type FROM public.leaderboards LOOP
    -- Check if rules already exist for this competition
    IF NOT EXISTS (SELECT 1 FROM public.competition_rules WHERE leaderboard_id = lb.id) THEN
      -- Determine engine from competition_configs if present
      SELECT * INTO conf FROM public.competition_configs WHERE leaderboard_id = lb.id LIMIT 1;
      
      IF conf.engine_type = 'league_table' THEN
        SELECT * INTO ls FROM public.league_settings WHERE leaderboard_id = lb.id LIMIT 1;
        tb_json := '[
          {"type": "points", "label": "Points", "direction": "desc"},
          {"type": "goal_difference", "label": "Goal Difference", "direction": "desc"},
          {"type": "goals_for", "label": "Goals For", "direction": "desc"},
          {"type": "head_to_head", "label": "Head-to-Head", "direction": "desc"},
          {"type": "alphabetical", "label": "Alphabetical", "direction": "asc"}
        ]'::jsonb;
        
        INSERT INTO public.competition_rules (
          leaderboard_id,
          version,
          engine,
          ranking_order,
          primary_metric,
          points_for_win,
          points_for_draw,
          points_for_loss,
          allow_draws,
          allow_negative_points,
          tie_breakers,
          is_active
        ) VALUES (
          lb.id,
          1,
          'league_table',
          'desc',
          'points',
          COALESCE(ls.points_for_win, 3),
          COALESCE(ls.points_for_draw, 1),
          COALESCE(ls.points_for_loss, 0),
          TRUE,
          TRUE,
          tb_json,
          TRUE
        ) ON CONFLICT (leaderboard_id, version) DO NOTHING;

      ELSIF conf.engine_type = 'tournament' THEN
        tb_json := '[
          {"type": "alphabetical", "label": "Alphabetical", "direction": "asc"}
        ]'::jsonb;

        INSERT INTO public.competition_rules (
          leaderboard_id,
          version,
          engine,
          ranking_order,
          primary_metric,
          points_for_win,
          points_for_draw,
          points_for_loss,
          allow_draws,
          allow_negative_points,
          walkover_win_score,
          walkover_loss_score,
          tie_breakers,
          is_active
        ) VALUES (
          lb.id,
          1,
          'tournament',
          'desc',
          'score',
          1,
          0,
          0,
          FALSE,
          FALSE,
          3,
          0,
          tb_json,
          TRUE
        ) ON CONFLICT (leaderboard_id, version) DO NOTHING;

      ELSE
        -- Default simple_points engine
        tb_json := '[
          {"type": "points", "label": "Total Points", "direction": "desc"},
          {"type": "earliest_score", "label": "Earliest Score", "direction": "asc"},
          {"type": "alphabetical", "label": "Alphabetical", "direction": "asc"}
        ]'::jsonb;

        INSERT INTO public.competition_rules (
          leaderboard_id,
          version,
          engine,
          ranking_order,
          primary_metric,
          points_for_win,
          points_for_draw,
          points_for_loss,
          allow_draws,
          allow_negative_points,
          tie_breakers,
          is_active
        ) VALUES (
          lb.id,
          1,
          'simple_points',
          'desc',
          'total_points',
          1,
          0,
          0,
          TRUE,
          TRUE,
          tb_json,
          TRUE
        ) ON CONFLICT (leaderboard_id, version) DO NOTHING;
      END IF;
    END IF;
  END LOOP;
END $$;
