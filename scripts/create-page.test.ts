import { describe, expect, it, vi } from 'vitest';
import { parsePageArgs } from '@/scripts/create-page';

// The script runs under tsx with the react-server condition; vitest needs the mock instead.
vi.mock('server-only', () => ({}));

describe('parsePageArgs', () => {
  it('reads --email, --template and --images', () => {
    expect(
      parsePageArgs([
        '--email',
        'me@example.com',
        '--template',
        'teh-kumis-kucing',
        '--images',
        './img',
      ]),
    ).toEqual({ email: 'me@example.com', template: 'teh-kumis-kucing', images: './img' });
  });
  it('rejects an unknown template, a bad email and missing images', () => {
    expect(() =>
      parsePageArgs(['--email', 'me@example.com', '--template', 'nope', '--images', './img']),
    ).toThrow(/template/);
    expect(() =>
      parsePageArgs(['--email', 'nope', '--template', 'teh-kumis-kucing', '--images', './img']),
    ).toThrow(/email/);
    expect(() =>
      parsePageArgs(['--email', 'me@example.com', '--template', 'teh-kumis-kucing']),
    ).toThrow(/images/);
  });
});
