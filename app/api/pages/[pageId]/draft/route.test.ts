import { beforeEach, expect, it, vi } from 'vitest';

const { getApiUser } = vi.hoisted(() => ({ getApiUser: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/require-user', () => ({
  getApiUser,
  unauthorizedResponse: () => Response.json({ error: 'unauthorized' }, { status: 401 }),
}));
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => {
    throw new Error('no database in unit tests');
  },
}));

import { PUT } from './route';

const ctx = {
  params: Promise.resolve({ pageId: '7b0c7a52-3c1e-4c8e-9a43-2f1d2b6f0e11' }),
} as never;
const put = (init: RequestInit) =>
  PUT(new Request('http://localhost:3000/api/pages/x/draft', { method: 'PUT', ...init }), ctx);

beforeEach(() => getApiUser.mockResolvedValue({ userId: 'u1', email: null }));

it('answers 401 without a session, before touching the database', async () => {
  getApiUser.mockResolvedValue(null);
  expect((await put({ headers: { 'content-type': 'application/json' }, body: '{}' })).status).toBe(
    401,
  );
});
it('answers 415 for anything but JSON', async () => {
  expect((await put({ headers: { 'content-type': 'text/plain' }, body: '{}' })).status).toBe(415);
});
it('answers 403 for a cross-origin request', async () => {
  const res = await put({
    headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
    body: '{}',
  });
  expect(res.status).toBe(403);
});
it('answers 413 from content-length before reading the body', async () => {
  const res = await put({
    headers: { 'content-type': 'application/json', 'content-length': String(5 * 1024 * 1024) },
    body: '{}',
  });
  expect(res.status).toBe(413);
});
