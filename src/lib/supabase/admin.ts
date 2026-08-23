import { createClient } from '@supabase/supabase-js';

function getSupabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || '';
}

function getServiceRoleKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE || '';
}

function getAdminConfigErrors(): string[] {
  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = getServiceRoleKey();
  const issues: string[] = [];

  if (!supabaseUrl) {
    issues.push('NEXT_PUBLIC_SUPABASE_URL is missing');
  } else if (supabaseUrl.includes('your-project-id')) {
    issues.push('NEXT_PUBLIC_SUPABASE_URL is still using the placeholder value');
  }

  if (!serviceRoleKey) {
    issues.push('SUPABASE_SERVICE_ROLE_KEY is missing');
  }

  return issues;
}

export function isSupabaseAdminConfigured(): boolean {
  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = getServiceRoleKey();

  return !!(
    supabaseUrl &&
    serviceRoleKey &&
    !supabaseUrl.includes('your-project-id')
  );
}

export function getSupabaseAdminConfigStatus() {
  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = getServiceRoleKey();

  return {
    hasSupabaseUrl: !!supabaseUrl,
    usesPlaceholderSupabaseUrl: supabaseUrl.includes('your-project-id'),
    hasServiceRoleKey: !!serviceRoleKey,
    serviceRoleSource: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SUPABASE_SERVICE_ROLE_KEY' : process.env.SUPABASE_SERVICE_ROLE ? 'SUPABASE_SERVICE_ROLE' : null,
    errors: getAdminConfigErrors(),
  };
}

export function createSupabaseAdminClient() {
  if (!isSupabaseAdminConfigured()) {
    const issues = getAdminConfigErrors();
    throw new Error(
      `Supabase admin config is invalid: ${issues.join('; ')}. Billing server operations require valid server environment variables.`
    );
  }

  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = getServiceRoleKey();

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
