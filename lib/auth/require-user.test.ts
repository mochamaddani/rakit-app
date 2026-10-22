import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getClaims } = vi.hoisted(() => ({ getClaims: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({ auth: { getClaims } }),
}));

import { getApiUser, unauthorizedResponse } from '@/lib/auth/require-user';

describe('getApiUser', () => {
  beforeEach(() => getClaims.mockReset());
  it('returns the user from verified claims', async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: 'u1', email: 'a@b.test' } } });
    await expect(getApiUser()).resolves.toEqual({ userId: 'u1', email: 'a@b.test' });
  });
  it('returns null without a session instead of redirecting', async () => {
    getClaims.mockResolvedValue({ data: null });
    await expect(getApiUser()).resolves.toBeNull();
  });
});

it('unauthorizedResponse answers 401 with the same body as the proxy', async () => {
  const res = unauthorizedResponse();
  expect(res.status).toBe(401);
  await expect(res.json()).resolves.toEqual({ error: 'unauthorized' });
});
