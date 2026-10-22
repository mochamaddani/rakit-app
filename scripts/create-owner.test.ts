import { describe, expect, it } from 'vitest';
import { parseOwnerArgs } from '@/scripts/create-owner';

describe('parseOwnerArgs', () => {
  it('reads --email and --password', () => {
    expect(parseOwnerArgs(['--email', 'me@example.com', '--password', 'long-enough-pass'])).toEqual(
      {
        email: 'me@example.com',
        password: 'long-enough-pass',
      },
    );
  });
  it('rejects a short password and a bad email', () => {
    expect(() => parseOwnerArgs(['--email', 'me@example.com', '--password', 'short'])).toThrow(
      /12 characters/,
    );
    expect(() => parseOwnerArgs(['--email', 'nope', '--password', 'long-enough-pass'])).toThrow(
      /email/,
    );
  });
});
