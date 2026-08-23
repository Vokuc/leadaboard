import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseServerConfigured } from '@/lib/supabase/server';
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { getBillingAdminEmailsFromEnv, isProfileRoleBillingAdmin, normalizeProfileRole, ProfileRole } from '@/lib/billing/admin';
import { requireBillingAdminUser, toBillingErrorResponse } from '@/lib/billing/guards';

interface RoleUpdatePayload {
  userId?: string;
  email?: string;
  role?: ProfileRole;
}

const ADMIN_VIEW_ROLES: ProfileRole[] = ['admin', 'billing_admin', 'super_admin'];

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

async function getRequesterRole(userId: string): Promise<ProfileRole> {
  const role = await getProfileRoleById(userId);
  return role || 'member';
}

async function getRequesterProfileExists(userId: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data?.id);
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

type AdminUserRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: ProfileRole;
  created_at: string;
  updated_at: string;
  accessSource: 'profile_role' | 'billing_admin_email' | 'both';
};

function toAdminRow(row: Record<string, unknown>, source: AdminUserRow['accessSource']): AdminUserRow | null {
  const id = String(row.id || '').trim();
  const email = String(row.email || '').trim().toLowerCase();

  if (!id || !email) {
    return null;
  }

  return {
    id,
    email,
    full_name: typeof row.full_name === 'string' ? row.full_name : null,
    role: source === 'billing_admin_email' && !isProfileRoleBillingAdmin(row.role) ? 'billing_admin' : normalizeProfileRole(row.role),
    created_at: String(row.created_at || new Date().toISOString()),
    updated_at: String(row.updated_at || new Date().toISOString()),
    accessSource: source,
  };
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
    const requesterProfileExists = await getRequesterProfileExists(requester.id);
    const billingAdminEmails = getBillingAdminEmailsFromEnv();
    const requesterEmailIsAllowlisted = billingAdminEmails.has((requester.email || '').trim().toLowerCase());

    const admin = createSupabaseAdminClient();
    const [profileRoleAdminsRes, emailAllowlistedAdminsRes] = await Promise.all([
      admin
        .from('profiles')
        .select('id,email,full_name,role,created_at,updated_at')
        .in('role', ADMIN_VIEW_ROLES)
        .order('updated_at', { ascending: false }),
      billingAdminEmails.size > 0
        ? admin
            .from('profiles')
            .select('id,email,full_name,role,created_at,updated_at')
            .in('email', Array.from(billingAdminEmails.values()))
        : Promise.resolve({ data: [], error: null as Error | null }),
    ]);

    if (profileRoleAdminsRes.error) {
      throw profileRoleAdminsRes.error;
    }
    if (emailAllowlistedAdminsRes.error) {
      throw emailAllowlistedAdminsRes.error;
    }

    const adminsById = new Map<string, AdminUserRow>();

    for (const row of (profileRoleAdminsRes.data || []) as Array<Record<string, unknown>>) {
      const adminRow = toAdminRow(row, 'profile_role');
      if (adminRow) {
        adminsById.set(adminRow.id, adminRow);
      }
    }

    for (const row of (emailAllowlistedAdminsRes.data || []) as Array<Record<string, unknown>>) {
      const adminRow = toAdminRow(row, 'billing_admin_email');
      if (!adminRow) {
        continue;
      }

      const existing = adminsById.get(adminRow.id);
      if (existing) {
        existing.accessSource = 'both';
        if (existing.role === 'member') {
          existing.role = 'billing_admin';
        }
      } else {
        adminsById.set(adminRow.id, adminRow);
      }
    }

    const admins = Array.from(adminsById.values()).sort((left, right) => {
      return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
    });

    return NextResponse.json({
      admins,
      requesterRole,
      requesterProfileExists,
      requesterEmailIsAllowlisted,
      canAssignSuperAdmin: requesterRole === 'super_admin' || requesterEmailIsAllowlisted,
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
    const billingAdminEmails = getBillingAdminEmailsFromEnv();
    const requesterEmailIsAllowlisted = billingAdminEmails.has((requester.email || '').trim().toLowerCase());

    const payload = (await request.json()) as RoleUpdatePayload;
    const normalizedRole = normalizeProfileRole(payload.role);

    if (!payload.role) {
      return NextResponse.json({ error: 'role is required.' }, { status: 400 });
    }

    if (normalizedRole === 'super_admin' && requesterRole !== 'super_admin' && !requesterEmailIsAllowlisted) {
      return NextResponse.json({ error: 'Only super_admin can assign super_admin.' }, { status: 403 });
    }

    const targetUserId = await resolveTargetUserId(payload);
    const targetCurrentRole = await getProfileRoleById(targetUserId);

    if (!targetCurrentRole) {
      return NextResponse.json({ error: 'Target user profile not found.' }, { status: 404 });
    }

    if (requesterRole !== 'super_admin' && !requesterEmailIsAllowlisted && targetCurrentRole === 'super_admin') {
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
