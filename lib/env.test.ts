import { describe, expect, it } from 'vitest';
import { EnvError, readPublicEnv } from '@/lib/env';

describe('readPublicEnv', () => {
  it('returns typed values when both variables are set', () => {
    expect(
      readPublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_0123456789abcdef',
      }),
    ).toEqual({
      supabaseUrl: 'http://127.0.0.1:54321',
      supabaseAnonKey: 'sb_publishable_0123456789abcdef',
    });
  });

  it('throws an EnvError naming every missing variable', () => {
    expect(() => readPublicEnv({})).toThrow(EnvError);
    expect(() => readPublicEnv({})).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL.*NEXT_PUBLIC_SUPABASE_ANON_KEY/s,
    );
  });

  it('rejects a Supabase URL that is not a URL', () => {
    expect(() =>
      readPublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: 'localhost',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_0123456789abcdef',
      }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });
});
