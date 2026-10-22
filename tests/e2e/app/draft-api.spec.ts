import { expect, test } from '@playwright/test';
import { adminClient, EMPTY_DOC, ensureOwner, resetOwnerPages, seedPage, signIn } from './helpers';

test.beforeAll(ensureOwner);
test.beforeEach(async ({ page }) => {
  await resetOwnerPages();
  await signIn(page);
});

test('saves with the current revision and rejects a stale one, naming the save that won', async ({
  page,
}) => {
  const id = await seedPage({ name: 'Api', document: EMPTY_DOC });
  const url = `/api/pages/${id}/draft`;
  const saveId = crypto.randomUUID();
  const first = await page.request.put(url, {
    data: { document: EMPTY_DOC, baseRevision: 0, saveId },
  });
  expect(first.status()).toBe(200);
  expect(await first.json()).toMatchObject({ revision: 1 });
  const stale = await page.request.put(url, { data: { document: EMPTY_DOC, baseRevision: 0 } });
  expect(stale.status()).toBe(409);
  expect(await stale.json()).toEqual({ error: 'conflict', revision: 1, saveId });
});

test('stores the normalized document', async ({ page }) => {
  const id = await seedPage({ name: 'Api', document: EMPTY_DOC });
  await page.request.put(`/api/pages/${id}/draft`, {
    data: { document: EMPTY_DOC, baseRevision: 0 },
  });
  const { data } = await adminClient()
    .from('pages')
    .select('current_draft, draft_revision')
    .eq('id', id)
    .single();
  expect(data).toMatchObject({
    draft_revision: 1,
    current_draft: { settings: { lang: 'id', seo: { noindex: true } } },
  });
});

test('rejects invalid documents, wrong content types, foreign origins and oversized bodies', async ({
  page,
}) => {
  const id = await seedPage({ name: 'Api', document: EMPTY_DOC });
  const url = `/api/pages/${id}/draft`;
  const invalid = await page.request.put(url, {
    data: { document: { schemaVersion: 1, sections: 'x' }, baseRevision: 0 },
  });
  expect(invalid.status()).toBe(422);
  expect((await invalid.json()).issues[0].path).toBe('sections');
  const textPlain = await page.request.put(url, {
    headers: { 'content-type': 'text/plain' },
    data: '{}',
  });
  expect(textPlain.status()).toBe(415);
  const foreign = await page.request.put(url, {
    headers: { origin: 'https://evil.example' },
    data: { document: EMPTY_DOC, baseRevision: 0 },
  });
  expect(foreign.status()).toBe(403);
  const huge = 'x'.repeat(4 * 1024 * 1024 + 1);
  const tooLarge = await page.request.put(url, { data: { document: huge, baseRevision: 0 } });
  expect(tooLarge.status()).toBe(413);
});

test('unknown pages answer 404 and anonymous requests 401', async ({
  page,
  playwright,
  baseURL,
}) => {
  const missing = await page.request.put(`/api/pages/${crypto.randomUUID()}/draft`, {
    data: { document: EMPTY_DOC, baseRevision: 0 },
  });
  expect(missing.status()).toBe(404);
  const anon = await playwright.request.newContext({ baseURL });
  const anonymous = await anon.put(`/api/pages/${crypto.randomUUID()}/draft`, { data: {} });
  expect(anonymous.status()).toBe(401);
  await anon.dispose();
});
