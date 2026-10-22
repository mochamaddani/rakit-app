import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { decideAuthRoute } from '@/lib/auth/routing';
import { publicEnv } from '@/lib/env';
import type { Database } from '@/lib/supabase/database.types';

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const { supabaseUrl, supabaseAnonKey } = publicEnv();
  let response = NextResponse.next({ request });
  // Responses that set auth cookies must not be cached (see @supabase/ssr SetAllCookies).
  let noCacheHeaders: Record<string, string> = {};

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet)
          response.cookies.set(name, value, options);
        noCacheHeaders = { ...noCacheHeaders, ...headers };
        for (const [key, value] of Object.entries(noCacheHeaders)) response.headers.set(key, value);
      },
    },
  });

  // getClaims() verifies the token signature; getSession() would trust a forged cookie.
  const { data } = await supabase.auth.getClaims();
  const decision = decideAuthRoute({
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    isAuthenticated: Boolean(data?.claims),
  });
  if (decision.kind === 'continue') return response;

  const outcome =
    decision.kind === 'redirect'
      ? NextResponse.redirect(new URL(decision.location, request.url))
      : NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  // Carry refreshed or cleared auth cookies over to the new response.
  for (const cookie of response.cookies.getAll()) outcome.cookies.set(cookie);
  for (const [key, value] of Object.entries(noCacheHeaders)) outcome.headers.set(key, value);
  return outcome;
}
