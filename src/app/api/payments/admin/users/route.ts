import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseServerConfigured } from '@/lib/supabase/server';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { normalizeProfileRole, ProfileRole } from '@/lib/billing/admin';
import { requireBillingAdminUser, toBillingErrorResponse } from '@/lib/billing/guards';

interface RoleUpdatePayload {
  userId?: string;
  email?: string;
  role?: ProfileRole;
}

const ADMIN_VIEW_ROLES: ProfileRole[] = ['admin', 'billing_admin', 'super_admin'];

async function getRequesterRole(userId: string): Promise<ProfileRole> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return normalizeProfileRole(data?.role);
}

async function getProfileRoleById(userId: string): Promise<ProfileRole | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return normalizeProfileRole(data.role);
}

async function resolveTargetUserId(payload: RoleUpdatePayload): Promise<string> {
  if (payload.userId && payload.userId.trim()) {
    return payload.userId.trim();
  }

  if (!payload.email?.trim()) {
    throw new Error('Provide either userId or email.');
  }

  const admin = createSupabaseAdminClient();
  const email = payload.email.trim().toLowerCase();
  const { data, error } = await admin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data?.id) {
    throw new Error('No profile found for that email.');
  }

  return data.id;
}

export async function GET() {
  try {
    if (!isSupabaseServerConfigured) {
      return NextResponse.json({ error: 'Server is not configured.' }, { status: 500 });
    }

    if (!isSupabaseAdminConfigured) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is missing.' }, { status: 500 });
    }

    const requester = await requireBillingAdminUser();
    const requesterRole = await getRequesterRole(requester.id);

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from('profiles')
      .select('id,email,full_name,role,created_at,updated_at')
      .in('role', ADMIN_VIEW_ROLES)
      .order('updated_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      admins: data || [],
      requesterRole,
      canAssignSuperAdmin: requesterRole === 'super_admin',
    });
  } catch (error) {
    return toBillingErrorResponse(error, 'Failed to load admin users.');
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!isSupabaseServerConfigured) {
      return NextResponse.json({ error: 'Server is not configured.' }, { status: 500 });
    }

    if (!isSupabaseAdminConfigured) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is missing.' }, { status: 500 });
    }

    const requester = await requireBillingAdminUser();
    const requesterRole = await getRequesterRole(requester.id);

    const payload = (await request.json()) as RoleUpdatePayload;
    const normalizedRole = normalizeProfileRole(payload.role);

    if (!payload.role) {
      return NextResponse.json({ error: 'role is required.' }, { status: 400 });
    }

    if (normalizedRole === 'super_admin' && requesterRole !== 'super_admin') {
      return NextResponse.json({ error: 'Only super_admin can assign super_admin.' }, { status: 403 });
    }

    const targetUserId = await resolveTargetUserId(payload);
    const targetCurrentRole = await getProfileRoleById(targetUserId);

    if (!targetCurrentRole) {
      return NextResponse.json({ error: 'Target user profile not found.' }, { status: 404 });
    }

    if (requesterRole !== 'super_admin' && targetCurrentRole === 'super_admin') {
      return NextResponse.json({ error: 'Only super_admin can modify another super_admin.' }, { status: 403 });
    }

    if (targetUserId === requester.id && normalizedRole === 'member') {
      return NextResponse.json({ error: 'You cannot demote your own admin role with this endpoint.' }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from('profiles')
      .update({ role: normalizedRole, updated_at: new Date().toISOString() })
      .eq('id', targetUserId)
      .select('id,email,full_name,role,created_at,updated_at')
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ profile: data });
  } catch (error) {
    return toBillingErrorResponse(error, 'Failed to update admin role.');
  }
}
