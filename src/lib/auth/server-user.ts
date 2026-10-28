import { createSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/supabase/server';
import { DatabaseService } from '@/lib/db';

export interface ServerAuthUser {
  id: string;
  email?: string;
  role?: string;
}

/**
 * Resolves the authenticated user in Next.js Server Components, Server Actions,
 * and Route Handlers.
 *
 * In Supabase-backed live mode, reads session cookies from the incoming HTTP request.
 * In local/demo mode or non-request environments, falls back to DatabaseService.getCurrentProfile().
 */
export async function getServerAuthUser(): Promise<ServerAuthUser | null> {
  if (isSupabaseServerConfigured) {
    try {
      const serverSupabase = await createSupabaseServerClient();
      const {
        data: { user },
        error,
      } = await serverSupabase.auth.getUser();

      if (!error && user) {
        return {
          id: user.id,
          email: user.email,
          role: (user.user_metadata?.role as string) || 'member',
        };
      }
    } catch {
      // Fall through to profile fallback
    }
  }

  try {
    const profile = await DatabaseService.getCurrentProfile();
    if (profile) {
      return {
        id: profile.id,
        email: profile.email,
        role: profile.role,
      };
    }
  } catch {
    // Ignore and return null
  }

  return null;
}
