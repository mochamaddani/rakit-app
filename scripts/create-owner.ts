// Creates the single owner account (public sign-ups are disabled; docs/DECISIONS.md D-005).
// Usage: pnpm owner:create --email you@example.com --password '<12+ characters>'
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

export function parseOwnerArgs(argv: string[]): { email: string; password: string } {
  const { values } = parseArgs({
    args: argv,
    options: { email: { type: 'string' }, password: { type: 'string' } },
    strict: true,
  });
  const email = z.email().safeParse(values.email);
  if (!email.success) throw new Error('Pass a valid --email address.');
  if (!values.password || values.password.length < 12) {
    throw new Error('Pass a --password of at least 12 characters.');
  }
  return { email: email.data, password: values.password };
}

async function main(): Promise<number> {
  try {
    process.loadEnvFile('.env.local');
  } catch {
    // No .env.local: rely on variables already in the environment.
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.example).');
    return 1;
  }

  let owner: { email: string; password: string };
  try {
    owner = parseOwnerArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 2;
  }

  // Own client on purpose: lib/supabase/server.ts imports 'server-only', which throws outside Next.
  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  const { error } = await admin.auth.admin.createUser({ ...owner, email_confirm: true });
  if (error) {
    if (/already/i.test(error.message)) {
      console.log(`Owner already exists: ${owner.email}`);
      return 0;
    }
    console.error(`Could not create the owner: ${error.message}`);
    return 1;
  }
  console.log(`Owner created: ${owner.email}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => process.exit(code));
}
