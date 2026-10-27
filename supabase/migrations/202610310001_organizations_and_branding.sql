-- ============================================================================
-- 202610310001_organizations_and_branding.sql
-- Era 5 Prompt 2: Organizations and White-Label Competitions
-- ============================================================================

BEGIN;

-- 1. Organizations Table
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    logo_url TEXT,
    website_url TEXT,
    primary_color TEXT DEFAULT '#6366f1',
    secondary_color TEXT DEFAULT '#06b6d4',
    accent_color TEXT DEFAULT '#f59e0b',
    custom_domain TEXT UNIQUE,
    domain_status TEXT DEFAULT 'unverified' CHECK (domain_status IN ('unverified', 'pending', 'verified', 'failed')),
    domain_verification_token TEXT,
    domain_verified_at TIMESTAMPTZ,
    hide_powered_by BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for lookup by slug and domain
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_custom_domain ON public.organizations(custom_domain) WHERE custom_domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_organizations_created_by ON public.organizations(created_by);

-- 2. Organization Memberships Table
CREATE TABLE IF NOT EXISTS public.organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'admin', 'manager', 'viewer')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON public.organization_members(organization_id);

-- 3. Organization Invitations Table
CREATE TABLE IF NOT EXISTS public.organization_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'manager', 'viewer')),
    token TEXT UNIQUE NOT NULL,
    invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_invitations_email ON public.organization_invitations(email);
CREATE INDEX IF NOT EXISTS idx_org_invitations_token ON public.organization_invitations(token);

-- 4. Organization Audit Logs Table
CREATE TABLE IF NOT EXISTS public.organization_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_audit_org ON public.organization_audit_logs(organization_id, created_at DESC);

-- 5. Add organization_id to leaderboards (Additive)
ALTER TABLE public.leaderboards 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leaderboards_organization_id ON public.leaderboards(organization_id);

-- 6. Add organization_id to api_keys (Additive)
ALTER TABLE public.api_keys 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_api_keys_organization_id ON public.api_keys(organization_id);

-- 7. Enable Row-Level Security (RLS)
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_audit_logs ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies

-- Organizations:
-- Public can view active organization profiles for branded public pages
CREATE POLICY "Public read for organizations"
ON public.organizations FOR SELECT
USING (true);

-- Authenticated users can create organizations
CREATE POLICY "Authenticated users can create organizations"
ON public.organizations FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

-- Org owners and admins can update their organization
CREATE POLICY "Org owners and admins can update organization"
ON public.organizations FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.organization_id = id
          AND om.user_id = auth.uid()
          AND om.role IN ('owner', 'admin')
    )
);

-- Org owners can delete organization
CREATE POLICY "Org owners can delete organization"
ON public.organizations FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.organization_id = id
          AND om.user_id = auth.uid()
          AND om.role = 'owner'
    )
);

-- Organization Members:
-- Members can view roster in their organization
CREATE POLICY "Members can view org members"
ON public.organization_members FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.organization_members my_om
        WHERE my_om.organization_id = organization_id
          AND my_om.user_id = auth.uid()
    )
);

-- Org owners and admins can manage members
CREATE POLICY "Owners and admins can insert members"
ON public.organization_members FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.organization_members my_om
        WHERE my_om.organization_id = organization_id
          AND my_om.user_id = auth.uid()
          AND my_om.role IN ('owner', 'admin')
    )
);

CREATE POLICY "Owners and admins can update member roles"
ON public.organization_members FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.organization_members my_om
        WHERE my_om.organization_id = organization_id
          AND my_om.user_id = auth.uid()
          AND my_om.role IN ('owner', 'admin')
    )
);

CREATE POLICY "Owners and admins can remove members"
ON public.organization_members FOR DELETE
TO authenticated
USING (
    user_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.organization_members my_om
        WHERE my_om.organization_id = organization_id
          AND my_om.user_id = auth.uid()
          AND my_om.role IN ('owner', 'admin')
    )
);

-- Organization Audit Logs:
-- Org members can view audit logs
CREATE POLICY "Org members can view audit logs"
ON public.organization_audit_logs FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.organization_id = organization_id
          AND om.user_id = auth.uid()
    )
);

-- System and authenticated members can insert audit logs
CREATE POLICY "Authenticated users can insert audit logs"
ON public.organization_audit_logs FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.organization_id = organization_id
          AND om.user_id = auth.uid()
    )
);

COMMIT;
