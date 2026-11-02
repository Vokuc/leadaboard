-- ============================================================================
-- 202611050002_fix_organization_members_rls_recursion.sql
-- Fix: Prevent infinite recursion in organization_members and related RLS policies
-- ============================================================================

BEGIN;

-- 1. Helper security definer functions to prevent recursive RLS policy expansion
CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL OR p_org_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = p_org_id AND user_id = p_user_id
  ) OR EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = p_org_id AND created_by = p_user_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin_or_owner(p_org_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL OR p_org_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = p_org_id
      AND user_id = p_user_id
      AND role IN ('owner', 'admin')
  ) OR EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = p_org_id AND created_by = p_user_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_org_owner(p_org_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL OR p_org_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = p_org_id
      AND user_id = p_user_id
      AND role = 'owner'
  ) OR EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = p_org_id AND created_by = p_user_id
  );
END;
$$;

-- 2. Drop recursive policies
DROP POLICY IF EXISTS "Members can view org members" ON public.organization_members;
DROP POLICY IF EXISTS "Owners and admins can insert members" ON public.organization_members;
DROP POLICY IF EXISTS "Owners and admins can update member roles" ON public.organization_members;
DROP POLICY IF EXISTS "Owners and admins can remove members" ON public.organization_members;

DROP POLICY IF EXISTS "Org owners and admins can update organization" ON public.organizations;
DROP POLICY IF EXISTS "Org owners can delete organization" ON public.organizations;

DROP POLICY IF EXISTS "Org members can view audit logs" ON public.organization_audit_logs;
DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.organization_audit_logs;

-- 3. Recreate policies using security definer functions and direct user_id matches
CREATE POLICY "Members can view org members"
ON public.organization_members FOR SELECT
TO authenticated
USING (
    user_id = auth.uid() OR
    public.is_org_member(organization_id, auth.uid())
);

CREATE POLICY "Owners and admins can insert members"
ON public.organization_members FOR INSERT
TO authenticated
WITH CHECK (
    -- Case 1: Initial creator inserting owner record
    (user_id = auth.uid() AND EXISTS (
        SELECT 1 FROM public.organizations o
        WHERE o.id = organization_id AND o.created_by = auth.uid()
    ))
    OR
    -- Case 2: Existing owner/admin adding other members
    public.is_org_admin_or_owner(organization_id, auth.uid())
);

CREATE POLICY "Owners and admins can update member roles"
ON public.organization_members FOR UPDATE
TO authenticated
USING (
    public.is_org_admin_or_owner(organization_id, auth.uid())
);

CREATE POLICY "Owners and admins can remove members"
ON public.organization_members FOR DELETE
TO authenticated
USING (
    user_id = auth.uid() OR
    public.is_org_admin_or_owner(organization_id, auth.uid())
);

-- Organizations table policies
CREATE POLICY "Org owners and admins can update organization"
ON public.organizations FOR UPDATE
TO authenticated
USING (
    created_by = auth.uid() OR
    public.is_org_admin_or_owner(id, auth.uid())
);

CREATE POLICY "Org owners can delete organization"
ON public.organizations FOR DELETE
TO authenticated
USING (
    created_by = auth.uid() OR
    public.is_org_owner(id, auth.uid())
);

-- Organization audit logs policies
CREATE POLICY "Org members can view audit logs"
ON public.organization_audit_logs FOR SELECT
TO authenticated
USING (
    public.is_org_member(organization_id, auth.uid())
);

CREATE POLICY "Authenticated users can insert audit logs"
ON public.organization_audit_logs FOR INSERT
TO authenticated
WITH CHECK (
    public.is_org_member(organization_id, auth.uid())
);

COMMIT;

