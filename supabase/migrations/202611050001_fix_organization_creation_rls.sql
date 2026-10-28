-- ============================================================================
-- 202611050001_fix_organization_creation_rls.sql
-- Fix: Allow organization creators to insert their initial owner membership record
-- ============================================================================

BEGIN;

-- Drop the restrictive policy that prevented initial owner membership insertion
DROP POLICY IF EXISTS "Owners and admins can insert members" ON public.organization_members;

-- Recreate the policy to permit the organization creator to insert their own initial owner record,
-- while continuing to require existing owner/admin role for any subsequent member additions.
CREATE POLICY "Owners and admins can insert members"
ON public.organization_members FOR INSERT
TO authenticated
WITH CHECK (
    -- Case 1: Initial organization creator inserting their own owner record
    (user_id = auth.uid() AND EXISTS (
        SELECT 1 FROM public.organizations o
        WHERE o.id = organization_id AND o.created_by = auth.uid()
    ))
    OR
    -- Case 2: Existing owners and admins adding other members
    EXISTS (
        SELECT 1 FROM public.organization_members my_om
        WHERE my_om.organization_id = organization_id
          AND my_om.user_id = auth.uid()
          AND my_om.role IN ('owner', 'admin')
    )
);

COMMIT;
