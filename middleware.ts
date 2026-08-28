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
    // getUser() validates the token server-side (network call). It's the
    // authoritative check — use it when Supabase is reachable.
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user && pathname.startsWith('/dashboard')) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/login';
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Only bounce authenticated users away from /login when we can verify
    // them via getUser(). This avoids a redirect loop if the token is stale.
    if (user && pathname === '/login') {
      const next = request.nextUrl.searchParams.get('next');
      const dashboardUrl = request.nextUrl.clone();
      dashboardUrl.pathname = next && next.startsWith('/') ? next : '/dashboard';
      dashboardUrl.search = '';
      return NextResponse.redirect(dashboardUrl);
    }
  } catch (err) {
    // getUser() timed out or Supabase is unreachable.
    // Fall back to getSession() which reads the cookie locally (no network)
    // so we can still protect /dashboard without a 504.
    console.error('[middleware] getUser() failed, falling back to getSession():', err);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session && pathname.startsWith('/dashboard')) {
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = '/login';
        loginUrl.searchParams.set('next', pathname);
        return NextResponse.redirect(loginUrl);
      }
      // Don't redirect /login → /dashboard in the fallback path.
      // getSession() isn't server-verified, so we let the client handle it.
    } catch {
      // Both checks failed — let the request through, client-side auth will handle it.
      console.error('[middleware] getSession() also failed; passing request through.');
    }
  }

  return response;
}

export const config = {
  matcher: ['/dashboard/:path*', '/login'],
};