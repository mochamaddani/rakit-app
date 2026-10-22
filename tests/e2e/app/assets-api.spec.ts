import { expect, test } from '@playwright/test';
import sharp from 'sharp';
import { adminClient, ensureOwner, ownerWorkspaceId, resetOwnerPages, signIn } from './helpers';

test.beforeAll(ensureOwner);
test.beforeEach(async ({ page }) => {
  await resetOwnerPages();
  await signIn(page);
});

test('processes an uploaded original into WebP variants and an assets row', async ({ page }) => {
  const ws = await ownerWorkspaceId();
  const path = `${ws}/${crypto.randomUUID()}.jpg`;
  const jpeg = await sharp({
    create: { width: 2400, height: 1600, channels: 3, background: '#1d4ed8' },
  })
    .jpeg()
    .toBuffer();
  const upload = await adminClient()
    .storage.from('uploads')
    .upload(path, jpeg, { contentType: 'image/jpeg' });
  expect(upload.error).toBeNull();

  const res = await page.request.post('/api/assets', { data: { path } });
  // The route removes the original; if it never ran, don't leave it for other tests.
  if (res.status() !== 201) await adminClient().storage.from('uploads').remove([path]);
  expect(res.status()).toBe(201);
  const body = (await res.json()) as {
    assetId: string;
    src: string;
    width: number;
    height: number;
  };
  expect(body).toMatchObject({ width: 1600, height: 1067 });
  expect(body.src).toMatch(
    new RegExp(`/storage/v1/object/public/assets/${ws}/${body.assetId}-1600\\.webp$`),
  );
  try {
    const image = await page.request.get(body.src);
    expect(image.headers()['content-type']).toBe('image/webp');
    expect(await sharp(await image.body()).metadata()).toMatchObject({
      format: 'webp',
      width: 1600,
      height: 1067,
    });
    const { data: row } = await adminClient()
      .from('assets')
      .select('path, width, height, mime')
      .eq('id', body.assetId)
      .single();
    expect(row).toEqual({
      path: `${ws}/${body.assetId}`,
      width: 1600,
      height: 1067,
      mime: 'image/webp',
    });
    const { data: left } = await adminClient().storage.from('uploads').list(ws);
    expect((left ?? []).map((object) => `${ws}/${object.name}`)).not.toContain(path);
  } finally {
    await adminClient()
      .storage.from('assets')
      .remove([`${ws}/${body.assetId}-1600.webp`, `${ws}/${body.assetId}-800.webp`]);
    await adminClient().from('assets').delete().eq('id', body.assetId);
  }
});

test("another workspace's path is refused", async ({ page }) => {
  const res = await page.request.post('/api/assets', {
    data: { path: `${crypto.randomUUID()}/${crypto.randomUUID()}.jpg` },
  });
  expect(res.status()).toBe(403);
});

test('a path in your workspace with no upload behind it answers 404', async ({ page }) => {
  const ws = await ownerWorkspaceId();
  const res = await page.request.post('/api/assets', {
    data: { path: `${ws}/${crypto.randomUUID()}.png` },
  });
  expect(res.status()).toBe(404);
});
