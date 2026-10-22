import { expect, it } from 'vitest';
import { envFromStatus } from './write-env-local';

const example =
  'NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321\nNEXT_PUBLIC_SUPABASE_ANON_KEY=\nSUPABASE_SERVICE_ROLE_KEY=\nAI_MODEL=claude-opus-5-5\n';
it('fills the Supabase values and keeps the rest', () => {
  expect(
    envFromStatus(
      {
        API_URL: 'http://127.0.0.1:54321',
        PUBLISHABLE_KEY: 'sb_publishable_x',
        SECRET_KEY: 'sb_secret_y',
      },
      example,
    ),
  ).toBe(
    'NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321\nNEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_x\nSUPABASE_SERVICE_ROLE_KEY=sb_secret_y\nAI_MODEL=claude-opus-5-5\n',
  );
  expect(envFromStatus({ API_URL: 'u', ANON_KEY: 'a', SERVICE_ROLE_KEY: 's' }, example)).toContain(
    'NEXT_PUBLIC_SUPABASE_ANON_KEY=a',
  );
});
it('throws when a key is missing', () =>
  expect(() => envFromStatus({ API_URL: 'u' }, example)).toThrow(/ANON_KEY/));
