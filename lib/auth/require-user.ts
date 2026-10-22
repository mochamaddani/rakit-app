import 'server-only';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/** Call first in every protected layout, server action and route handler; proxy.ts alone is not enough. */
export async function requireUser(): Promise<{ userId: string; email: string | null }> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect('/login');
  return { userId: claims.sub, email: typeof claims.email === 'string' ? claims.email : null };
}
