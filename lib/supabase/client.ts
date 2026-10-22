import { createBrowserClient } from '@supabase/ssr';
import { publicEnv } from '@/lib/env';
import type { Database } from '@/lib/supabase/database.types';

export function createSupabaseBrowserClient() {
  const { supabaseUrl, supabaseAnonKey } = publicEnv();
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}
