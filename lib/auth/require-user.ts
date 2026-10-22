import 'server-only';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export interface SessionUser {
  userId: string;
  email: string | null;
}

async function readSessionUser(): Promise<SessionUser | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { userId: claims.sub, email: typeof claims.email === 'string' ? claims.email : null };
}

/** Call first in every protected layout, data-reading page and server action; proxy.ts alone is not enough. */
export async function requireUser(): Promise<SessionUser> {
  const user = await readSessionUser();
  if (!user) redirect('/login');
  return user;
}

/** Route handlers: null means answer with unauthorizedResponse(). Never redirects. */
export async function getApiUser(): Promise<SessionUser | null> {
  return readSessionUser();
}

/** The same 401 body that lib/supabase/proxy.ts sends for anonymous API requests. */
export function unauthorizedResponse(): Response {
  return Response.json({ error: 'unauthorized' }, { status: 401 });
}
