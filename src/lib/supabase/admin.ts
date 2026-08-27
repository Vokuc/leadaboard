import { createClient } from '@supabase/supabase-js';

function getSupabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || '';
}

function getServiceRoleKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE || '';
}

function getProjectRefFromUrl(supabaseUrl: string): string | null {
  const match = supabaseUrl.match(/^https?:\/\/([a-z0-9-]+)\.supabase\.co/i);
  return match ? match[1] : null;
}

// Decodes the JWT payload only (no signature check) to read the `ref` claim for a mismatch check.
function getProjectRefFromServiceRoleKey(serviceRoleKey: string): string | null {
  const parts = serviceRoleKey.split('.');
  if (parts.length !== 3) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8')) as { ref?: string };
    return payload.ref || null;
  } catch {
    return null;
  }
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

  if (supabaseUrl && serviceRoleKey) {
    const urlRef = getProjectRefFromUrl(supabaseUrl);
    const keyRef = getProjectRefFromServiceRoleKey(serviceRoleKey);
    if (urlRef && keyRef && urlRef !== keyRef) {
      issues.push(
        `SUPABASE_SERVICE_ROLE_KEY belongs to project "${keyRef}" but NEXT_PUBLIC_SUPABASE_URL points to project "${urlRef}"`
      );
    }
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
    urlProjectRef: getProjectRefFromUrl(supabaseUrl),
    serviceRoleKeyProjectRef: getProjectRefFromServiceRoleKey(serviceRoleKey),
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
