-- Migration: 202610190001_realtime_fixtures.sql
-- Enables real-time replication for fixtures and fixture_results on Supabase Realtime

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = 'fixtures'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.fixtures;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = 'fixture_results'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.fixture_results;
    END IF;
  END IF;
END $$;
