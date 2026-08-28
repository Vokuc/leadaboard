import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const isSupabaseConfigured = !!(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('your-project-id')
);

// 5-second timeout for Supabase auth in middleware.
// Edge middleware has a 25s hard limit — without this, a slow/unavailable
// Supabase will cause MIDDLEWARE_INVOCATION_TIMEOUT (504) for every request.
const AUTH_TIMEOUT_MS = 5000;

export async function middleware(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({
          request,
        });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
    // Attach an AbortSignal timeout so the auth network call never blocks
    // the middleware beyond AUTH_TIMEOUT_MS.
    global: {
      fetch: (url, options = {}) =>
        fetch(url, {
          ...options,
          signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
        }),
    },
  });

  const { pathname } = request.nextUrl;

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user && pathname.startsWith('/dashboard')) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/login';
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (user && pathname === '/login') {
      const dashboardUrl = request.nextUrl.clone();
      dashboardUrl.pathname = '/dashboard';
      dashboardUrl.search = '';
      return NextResponse.redirect(dashboardUrl);
    }
  } catch (err) {
    // If the auth call times out or Supabase is unreachable, degrade
    // gracefully: let the request through rather than returning a 504.
    // The page-level auth guards (Server Components / API routes) will
    // still enforce access control.
    console.error('[middleware] Supabase auth check failed:', err);
  }

  return response;
}

export const config = {
  matcher: ['/dashboard/:path*', '/login'],
};