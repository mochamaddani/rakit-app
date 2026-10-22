import { beforeEach, expect, it, vi } from 'vitest';

const { getApiUser, processUpload } = vi.hoisted(() => ({
  getApiUser: vi.fn(),
  processUpload: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/require-user', () => ({
  getApiUser,
  unauthorizedResponse: () => Response.json({ error: 'unauthorized' }, { status: 401 }),
}));
vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: async () => ({}) }));
vi.mock('@/lib/pages/queries', () => ({ getWorkspaceId: async () => 'ws1' }));
vi.mock('@/lib/assets/asset-store', () => ({ createSupabaseAssetStore: () => ({}) }));
vi.mock('@/lib/assets/upload', () => ({ processUpload }));

import { POST } from './route';

const post = (
  body: string,
  headers: Record<string, string> = { 'content-type': 'application/json' },
) => POST(new Request('http://localhost:3000/api/assets', { method: 'POST', headers, body }));

beforeEach(() => {
  getApiUser.mockResolvedValue({ userId: 'u1', email: null });
  processUpload.mockReset();
});

it('answers 401 without a session, before reading anything', async () => {
  getApiUser.mockResolvedValue(null);
  expect((await post(JSON.stringify({ path: 'ws1/a.jpg' }))).status).toBe(401);
  expect(processUpload).not.toHaveBeenCalled();
});

it("passes the path with the caller's workspace, and the result's status and body through", async () => {
  processUpload.mockResolvedValue({ status: 413, body: { error: 'too_large', reason: 'pixels' } });
  const res = await post(JSON.stringify({ path: 'ws1/a.jpg' }));
  expect(res.status).toBe(413);
  expect(await res.json()).toEqual({ error: 'too_large', reason: 'pixels' });
  expect(processUpload.mock.calls[0]![1]).toMatchObject({ workspaceId: 'ws1', path: 'ws1/a.jpg' });
});

it('answers 400 for a body without a string path, and 415 for anything but JSON', async () => {
  expect((await post('{}')).status).toBe(400);
  expect((await post('nope')).status).toBe(400);
  expect((await post('{}', { 'content-type': 'text/plain' })).status).toBe(415);
  expect(processUpload).not.toHaveBeenCalled();
});
