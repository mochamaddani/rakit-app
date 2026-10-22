// Writes .env.local from .env.example and the running local Supabase stack (pnpm db:start).
// Usage: pnpm env:local [--force]
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

/** Each .env key and the `supabase status` keys it is read from; the first one present wins. */
const FROM_STATUS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['NEXT_PUBLIC_SUPABASE_URL', ['API_URL']],
  ['NEXT_PUBLIC_SUPABASE_ANON_KEY', ['PUBLISHABLE_KEY', 'ANON_KEY']],
  ['SUPABASE_SERVICE_ROLE_KEY', ['SECRET_KEY', 'SERVICE_ROLE_KEY']],
];

/** `example` with the Supabase lines filled from `supabase status -o json`; other lines kept. */
export function envFromStatus(status: Record<string, string>, example: string): string {
  const values = new Map<string, string>();
  for (const [envKey, statusKeys] of FROM_STATUS) {
    const value = statusKeys.map((key) => status[key]).find(Boolean);
    if (!value) throw new Error(`supabase status has no ${statusKeys.join(' or ')}`);
    values.set(envKey, value);
  }
  return example
    .split('\n')
    .map((line) => {
      const key = /^([A-Z0-9_]+)=/.exec(line)?.[1];
      return key && values.has(key) ? `${key}=${values.get(key)}` : line;
    })
    .join('\n');
}

function main(): number {
  const { values } = parseArgs({ options: { force: { type: 'boolean' } }, strict: true });
  if (existsSync('.env.local') && !values.force) {
    console.error('.env.local already exists. Pass --force to overwrite it.');
    return 1;
  }
  let status: Record<string, string>;
  try {
    const output = execFileSync('pnpm', ['supabase', 'status', '-o', 'json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    status = JSON.parse(output) as Record<string, string>;
  } catch {
    console.error('Could not read `supabase status`. Is the local stack running (pnpm db:start)?');
    return 1;
  }
  try {
    writeFileSync('.env.local', envFromStatus(status, readFileSync('.env.example', 'utf8')));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
  console.log('Wrote .env.local from the local Supabase stack.');
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
