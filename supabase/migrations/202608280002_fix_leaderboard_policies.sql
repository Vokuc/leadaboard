-- ==========================================
-- FIX: Restore leaderboard RLS policies
-- Reverts the inline SELECT policy that caused infinite recursion
-- ==========================================

BEGIN;

-- Drop all existing leaderboard policies
DROP POLICY IF EXISTS "Anyone can view public leaderboards" ON public.leaderboards;
DROP POLICY IF EXISTS "Owners and admins can update leaderboards" ON public.leaderboards;
DROP POLICY IF EXISTS "Owners can update their own leaderboards" ON public.leaderboards;
DROP POLICY IF EXISTS "Owners can delete their own leaderboards" ON public.leaderboards;
DROP POLICY IF EXISTS "Owners can insert leaderboards" ON public.leaderboards;
DROP POLICY IF EXISTS "Authenticated users can insert leaderboards" ON public.leaderboards;

-- Ensure the SECURITY DEFINER functions exist
CREATE OR REPLACE FUNCTION public.can_view_leaderboard(p_leaderboard_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM leaderboards l
    WHERE l.id = p_leaderboard_id
      AND (l.visibility = 'public' OR l.owner_id = p_user_id)
  ) OR EXISTS (
    SELECT 1 FROM leaderboard_admins la
    WHERE la.leaderboard_id = p_leaderboard_id AND la.user_id = p_user_id
  );
END;
$$;

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

-- Recreate clean policies using SECURITY DEFINER functions (no recursion)
CREATE POLICY "Anyone can view public leaderboards" ON public.leaderboards
  FOR SELECT USING (public.can_view_leaderboard(id, auth.uid()));

CREATE POLICY "Owners can insert leaderboards" ON public.leaderboards
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners and admins can update leaderboards" ON public.leaderboards
  FOR UPDATE TO authenticated
  USING (public.can_manage_leaderboard(id, auth.uid()));

CREATE POLICY "Owners can delete their own leaderboards" ON public.leaderboards
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

COMMIT;
