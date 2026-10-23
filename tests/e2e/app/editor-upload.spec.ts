import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';
import {
  adminClient,
  docWith,
  ensureOwner,
  openEditor,
  ownerWorkspaceId,
  resetOwnerPages,
  seedPage,
  signIn,
} from './helpers';

test.beforeAll(ensureOwner);
test.beforeEach(async ({ page }) => {
  await resetOwnerPages();
  await signIn(page);
});

async function heroImageField(page: Page) {
  const frame = await openEditor(
    page,
    await seedPage({ name: 'Upload', document: docWith(['hero']) }),
  );
  await frame.locator('[data-lp-type="hero"]').click({ position: { x: 8, y: 8 } });
  const field = page.getByRole('group', { name: 'Image', exact: true });
  return { frame, field, input: field.locator('input[type="file"]') };
}

const originals = async (ws: string) =>
  ((await adminClient().storage.from('uploads').list(ws)).data ?? []).map((object) => object.name);

test('uploading a JPEG replaces the hero image with its 1600 px WebP', async ({ page }) => {
  const ws = await ownerWorkspaceId();
  // Compared with what was there before: a failed run elsewhere may have left an original.
  const before = await originals(ws);
  const { frame, field, input } = await heroImageField(page);
  await expect(field.getByRole('button', { name: 'Upload image' })).toBeEnabled();
  const jpeg = await sharp({
    create: { width: 2400, height: 1600, channels: 3, background: '#0e7490' },
  })
    .jpeg()
    .toBuffer();
  await input.setInputFiles({ name: 'botol.jpg', mimeType: 'image/jpeg', buffer: jpeg });
  const img = frame.locator('.lp-hero img');
  await expect(img).toHaveAttribute(
    'src',
    /\/storage\/v1\/object\/public\/assets\/[0-9a-f-]{36}\/[0-9a-f-]{36}-1600\.webp$/,
    { timeout: 20_000 },
  );
  const src = (await img.getAttribute('src'))!;
  const assetId = /\/([0-9a-f-]{36})-1600\.webp$/.exec(src)![1]!;
  try {
    await expect(img).toHaveAttribute('width', '1600');
    await expect(img).toHaveAttribute('height', '1067');
    await expect(img).toHaveAttribute('alt', '');
    expect(await originals(ws)).toEqual(before);
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(frame.locator('.lp-hero img')).toHaveCount(0);
  } finally {
    await adminClient()
      .storage.from('assets')
      .remove([`${ws}/${assetId}-1600.webp`, `${ws}/${assetId}-800.webp`]);
    await adminClient().from('assets').delete().eq('id', assetId);
  }
});

test('alt text typed while the image uploads is kept', async ({ page }) => {
  const ws = await ownerWorkspaceId();
  const { frame, field, input } = await heroImageField(page);
  // Hold the processing request until the alt text is in.
  let reached!: () => void;
  let release!: () => void;
  const arrived = new Promise<void>((resolve) => (reached = resolve));
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/api/assets', async (route) => {
    reached();
    await held;
    await route.continue();
  });
  const jpeg = await sharp({
    create: { width: 2400, height: 1600, channels: 3, background: '#0e7490' },
  })
    .jpeg()
    .toBuffer();
  await input.setInputFiles({ name: 'botol.jpg', mimeType: 'image/jpeg', buffer: jpeg });
  await arrived;
  const alt = field.getByLabel('Alt text');
  await alt.fill('Botol biru di atas meja');
  release();
  const img = frame.locator('.lp-hero img');
  await expect(img).toHaveAttribute('src', /-1600\.webp$/, { timeout: 20_000 });
  const assetId = /\/([0-9a-f-]{36})-1600\.webp$/.exec((await img.getAttribute('src'))!)![1]!;
  try {
    await expect(img).toHaveAttribute('alt', 'Botol biru di atas meja');
    await expect(alt).toHaveValue('Botol biru di atas meja');
  } finally {
    await adminClient()
      .storage.from('assets')
      .remove([`${ws}/${assetId}-1600.webp`, `${ws}/${assetId}-800.webp`]);
    await adminClient().from('assets').delete().eq('id', assetId);
  }
});

test('a file that is not an image shows an error and changes nothing', async ({ page }) => {
  const { field, input } = await heroImageField(page);
  await input.setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not an image'),
  });
  await expect(field.getByText('Choose a JPEG, PNG, WebP, GIF or AVIF image.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
});
