import { z } from 'zod';

export class EnvError extends Error {
  override name = 'EnvError';
}

export interface PublicEnv {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

const PublicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
});

export function readPublicEnv(source: Record<string, string | undefined>): PublicEnv {
  const parsed = PublicEnvSchema.safeParse(source);
  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))];
    throw new EnvError(
      `Missing or invalid environment variables: ${names.join(', ')}. Copy .env.example to .env.local.`,
    );
  }
  return {
    supabaseUrl: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: parsed.data.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

// Next.js only inlines literal `process.env.NEXT_PUBLIC_*` reads into client bundles.
export function publicEnv(): PublicEnv {
  return readPublicEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}
