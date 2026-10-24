import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { STORELINK_SNIPPET } from '@/tests/fixtures/forms';
import {
  adminClient,
  canvas,
  ensureOwner,
  openEditor,
  resetOwnerPages,
  saveStatus,
  seedPage,
  signIn,
  storedExport,
  versionsOf,
} from './helpers';

test.beforeAll(ensureOwner);
test.beforeEach(async ({ page }) => {
  await resetOwnerPages();
  await signIn(page);
});

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

function shopDocument(heroImage?: string) {
  return {
    schemaVersion: 1,
    settings: { seo: { title: 'Teh Kumis Kucing', description: 'Teh herbal.' } },
    sections: [
      {
        id: 'sHero',
        blocks: [
          {
            id: 'bHero',
            type: 'hero',
            props: {
              headline: 'Teh Kumis Kucing',
              ...(heroImage ? { image: { src: heroImage, alt: 'Teh' } } : {}),
            },
          },
        ],
      },
      {
        id: 'sOrder',
        anchor: 'pesan',
        blocks: [
          { id: 'bForm', type: 'form-embed', props: { mode: 'snippet', code: STORELINK_SNIPPET } },
        ],
      },
      {
        id: 'sFoot',
        blocks: [
          {
            id: 'bFoot',
            type: 'footer',
            props: {
              links: [
                {
                  id: 'l1',
                  label: 'Kebijakan Privasi',
                  link: { kind: 'url', url: 'https://example.com/privasi' },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

const exportButton = (page: Page) =>
  page.getByRole('banner').getByRole('button', { name: 'Export', exact: true });
const exportDialog = (page: Page) => page.getByRole('dialog', { name: 'Export page' });
const downloadButton = (page: Page) =>
  exportDialog(page).getByRole('button', { name: 'Download HTML' });

/** "812 KB" → 812000; "1.4 MB" → 1400000. */
function bytesOf(text: string): number {
  const match = /([\d.]+) (B|KB|MB)/.exec(text);
  if (!match) throw new Error(`No size in "${text}"`);
  return Number(match[1]) * { B: 1, KB: 1000, MB: 1_000_000 }[match[2] as 'B' | 'KB' | 'MB'];
}

async function download(page: Page, path: string): Promise<{ name: string; text: string }> {
  const [file] = await Promise.all([page.waitForEvent('download'), downloadButton(page).click()]);
  await file.saveAs(path);
  return { name: file.suggestedFilename(), text: await readFile(path, 'utf8') };
}

test('downloading exports <slug>.html whose hash is recorded', async ({ page }, info) => {
  const pageId = await seedPage({ name: 'Teh', document: shopDocument(), slug: 'teh-kumis' });
  await openEditor(page, pageId);
  await expect(page.getByTestId('export-status')).toHaveText('Not exported yet');
  await exportButton(page).click();
  await expect(downloadButton(page)).toBeEnabled();
  const file = await download(page, info.outputPath('teh-kumis.html'));
  expect(file.name).toBe('teh-kumis.html');
  await expect(exportDialog(page).getByText(/^Recorded · sha256 [0-9a-f]{12}$/)).toBeVisible();

  const [version] = await versionsOf(pageId);
  expect(version!.html_sha256).toBe(sha256(file.text));
  expect(await storedExport(version!.html_path)).toBe(file.text);
  expect(version!.export_settings).toEqual({ images: 'portable', minify: true, tracking: true });
  const { data } = await adminClient().from('pages').select('status').eq('id', pageId).single();
  expect(data!.status).toBe('exported');
  // The Storelink code is in the file verbatim, never in the editor's canvas.
  expect(file.text).toContain('evf-widget-script');
  await expect(canvas(page).locator('script#evf-widget-script')).toHaveCount(0);

  await page.keyboard.press('Escape');
  await expect(exportDialog(page)).toBeHidden();
  await expect(page.getByTestId('export-status')).toHaveText('Exported · up to date');
  await canvas(page)
    .locator('[data-lp-type="hero"]')
    .click({ position: { x: 8, y: 8 } });
  await page.getByLabel('Headline', { exact: true }).fill('Teh baru');
  await expect(saveStatus(page)).toHaveText('Saved');
  await expect(page.getByTestId('export-status')).toHaveText('Exported · changes since');
});

test('the checklist and size update with the options', async ({ page }) => {
  await page.route('https://img.test/**', (route) =>
    route.fulfill({
      contentType: 'image/webp',
      headers: { 'access-control-allow-origin': '*' },
      body: Buffer.alloc(200_000, 7),
    }),
  );
  const pageId = await seedPage({
    name: 'Teh',
    document: shopDocument('https://img.test/hero.webp'),
  });
  await openEditor(page, pageId);
  await exportButton(page).click();
  const size = exportDialog(page).getByTestId('export-size');
  await expect(size).toHaveText(/File size: \d/);
  const portable = bytesOf((await size.textContent()) ?? '');
  expect(portable).toBeGreaterThan(250_000);
  await exportDialog(page)
    .getByLabel(/^Hosted/)
    .check();
  await expect.poll(async () => bytesOf((await size.textContent()) ?? '')).toBeLessThan(100_000);

  const checklist = exportDialog(page).getByTestId('export-checklist');
  await expect(checklist).toContainText('No tracking IDs are set.');
  await exportDialog(page).getByLabel('Include tracking').uncheck();
  await expect(checklist).not.toContainText('No tracking IDs are set.');
  await expect(checklist).toContainText('Storelink sends its own conversion events');
});

test("export waits for the save and records nothing while the draft can't be saved", async ({
  page,
}) => {
  const pageId = await seedPage({ name: 'Teh', document: shopDocument() });
  await openEditor(page, pageId);
  await page.route('**/api/pages/*/draft', (route) => route.abort());
  await canvas(page)
    .locator('[data-lp-type="hero"]')
    .click({ position: { x: 8, y: 8 } });
  await page.getByLabel('Headline', { exact: true }).fill('Belum tersimpan');
  await exportButton(page).click();
  await expect(exportDialog(page).getByRole('alert')).toContainText(
    "Save the page before exporting: you're offline",
  );
  await expect(downloadButton(page)).toBeDisabled();
  expect(await versionsOf(pageId)).toEqual([]);

  await page.unroute('**/api/pages/*/draft');
  await exportDialog(page).getByRole('button', { name: 'Try again' }).click();
  await expect(downloadButton(page)).toBeEnabled();
});

test('the file name is editable and must be unique', async ({ page }, info) => {
  const pageId = await seedPage({ name: 'Teh A', document: shopDocument(), slug: 'teh-a' });
  await seedPage({ name: 'Teh B', document: shopDocument(), slug: 'teh-b' });
  await openEditor(page, pageId);
  await exportButton(page).click();
  const name = exportDialog(page).getByLabel('File name');
  await name.fill('teh-b');
  await name.press('Tab');
  await expect(
    exportDialog(page).getByText('Another page already uses this file name'),
  ).toBeVisible();
  await name.fill('Teh C');
  await name.press('Tab');
  await expect(
    exportDialog(page).getByText('Use lowercase letters, numbers and dashes'),
  ).toBeVisible();
  await name.fill('teh-c');
  await name.press('Tab');
  await expect(exportDialog(page).getByText('Use lowercase letters')).toHaveCount(0);
  await expect(downloadButton(page)).toBeEnabled();
  const file = await download(page, info.outputPath('teh-c.html'));
  expect(file.name).toBe('teh-c.html');
  const { data } = await adminClient().from('pages').select('slug').eq('id', pageId).single();
  expect(data!.slug).toBe('teh-c');
});
