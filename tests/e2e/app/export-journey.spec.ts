import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { STORELINK_SNIPPET } from '@/tests/fixtures/forms';
import {
  dataLayer,
  fbCalls,
  stayOnClick,
  stubStorelink,
  stubVendors,
} from '../renderer/vendor-stubs';
import {
  addBlock,
  adminClient,
  canvas,
  ensureOwner,
  exportPage,
  resetOwnerPages,
  saveStatus,
  signIn,
  versionsOf,
} from './helpers';

test.beforeAll(ensureOwner);
test.beforeEach(async ({ page }) => {
  await resetOwnerPages();
  await signIn(page);
});

const selectBlock = (page: Page, type: string) =>
  canvas(page)
    .locator(`[data-lp-type="${type}"]`)
    .first()
    .click({ position: { x: 8, y: 8 } });
const pageSettings = (page: Page) =>
  page.getByRole('banner').getByRole('button', { name: 'Page settings' }).click();

test('M3 exit: build → export → open from file:// → PageView, CTA event, Storelink order events, UTM passthrough → version with hash → rollback', async ({
  page,
  context,
}, info) => {
  test.setTimeout(180_000);
  await page.getByRole('button', { name: 'New page' }).click();
  await page.getByLabel('Name', { exact: true }).fill('Ekspor');
  await page.getByRole('button', { name: 'Create page' }).click();
  await expect(page).toHaveURL(/\/editor\//, { timeout: 20_000 });
  const pageId = new URL(page.url()).pathname.split('/').pop()!;
  const frame = canvas(page);
  await expect(page.locator('iframe[title="Page preview"][data-ready="true"]')).toBeAttached({
    timeout: 20_000,
  });
  for (const block of ['Hero', 'Form Embed', 'Footer']) await addBlock(page, block);
  await expect(frame.locator('[data-lp-block]')).toHaveCount(3);

  // The order form: Storelink's code, shown as a placeholder in the canvas.
  await selectBlock(page, 'form-embed');
  await page.getByLabel('Embed code').fill(STORELINK_SNIPPET);
  await expect(frame.getByText('Form · Storelink')).toBeVisible();
  await expect(page.getByTestId('block-note')).toContainText(
    'Storelink sends its own conversion events',
  );
  await page.getByRole('tab', { name: 'Section' }).click();
  await page.getByLabel('Anchor').fill('pesan');
  await page.getByLabel('Anchor').press('Tab');

  // The hero's button goes to the shop and fires Contact.
  await selectBlock(page, 'hero');
  const cta = page.getByRole('group', { name: 'Primary button' });
  await cta.getByLabel('Link type').selectOption('url');
  await cta.getByLabel('Address').fill('https://shop.test/p');
  await cta.getByLabel('Tracking event').selectOption('Contact');

  await pageSettings(page);
  await page.getByLabel('Title', { exact: true }).fill('Teh Kumis Kucing');
  await page.getByLabel('Description', { exact: true }).fill('Teh herbal.');
  const target = page.getByRole('group', { name: 'Default button target' });
  await target.getByLabel('Link type').selectOption('section');
  await target.getByLabel('Section').selectOption({ label: 'Section 2 · Form Embed (#pesan)' });
  await page.getByLabel('Meta Pixel ID').fill('1234567890');
  await page.getByLabel('GA4 measurement ID').fill('G-TEST1234');
  await page.getByLabel('Google Ads ID').fill('AW-123456789');
  await page.getByLabel('Google Ads lead conversion label').fill('abcdEF12');
  await page.getByLabel('GTM container ID').fill('GTM-TEST12');
  await expect(saveStatus(page)).toHaveText('Saved');
  const exportedHeadline = (await frame.locator('h1').textContent()) ?? '';

  // Export → the file and its recorded version.
  const path = info.outputPath('ekspor.html');
  expect(await exportPage(page, path)).toBe('ekspor.html');
  const html = await readFile(path, 'utf8');
  const [version] = await versionsOf(pageId);
  expect(version!.html_sha256).toBe(createHash('sha256').update(html).digest('hex'));
  const { data } = await adminClient().from('pages').select('status').eq('id', pageId).single();
  expect(data!.status).toBe('exported');

  // The file, opened from disk with stand-ins for every vendor and for Storelink.
  const visitor = await context.newPage();
  const unexpected = await stubVendors(visitor);
  await stubStorelink(visitor);
  await visitor.route('https://shop.test/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Shop</title>' }),
  );
  await visitor.goto(`${pathToFileURL(path).href}?utm_source=meta&gclid=abc`);
  await expect.poll(() => fbCalls(visitor)).toContainEqual(['init', '1234567890']);
  const pageViews = (await fbCalls(visitor)).filter((call) => call[1] === 'PageView');
  expect(pageViews).toEqual([['track', 'PageView', {}, { eventID: expect.any(String) }]]);
  const layer = await dataLayer(visitor);
  expect(layer).toContainEqual(['config', 'G-TEST1234']);
  expect(layer).toContainEqual(['config', 'AW-123456789']);

  const shop = visitor.getByRole('link', { name: 'Order now' });
  await expect(shop).toHaveAttribute('href', 'https://shop.test/p?utm_source=meta&gclid=abc');
  await stayOnClick(visitor);
  await shop.click();
  await expect
    .poll(() => fbCalls(visitor))
    .toContainEqual(['track', 'Contact', {}, { eventID: expect.any(String) }]);

  // Storelink counts the order with its own pixel event; the page adds no Lead of its own.
  await visitor.locator('#pesan #evf-embed-widget').getByRole('button', { name: 'Pesan' }).click();
  await expect
    .poll(() => fbCalls(visitor))
    .toContainEqual(['trackSingle', '1234567890', 'Purchase', { value: 1 }, { eventID: 'x' }]);
  expect((await fbCalls(visitor)).filter((call) => call[1] === 'Lead')).toEqual([]);
  expect(unexpected.filter((url) => !/storelink\.id|gabung\.id|shop\.test/.test(url))).toEqual([]);
  await visitor.close();

  // Rollback: a later edit, then Versions → Restore brings the exported page back, and it stays.
  await selectBlock(page, 'hero');
  await page.getByLabel('Headline', { exact: true }).fill('Judul baru');
  await expect(saveStatus(page)).toHaveText('Saved');
  await expect(page.getByTestId('export-status')).toHaveText('Exported · changes since');
  await page.getByRole('button', { name: 'Versions' }).click();
  await page
    .getByRole('dialog', { name: 'Versions' })
    .getByRole('button', { name: 'Restore' })
    .click();
  await expect(frame.locator('h1')).toHaveText(exportedHeadline);
  await expect(saveStatus(page)).toHaveText('Saved');
  await page.reload();
  await expect(canvas(page).locator('h1')).toHaveText(exportedHeadline, { timeout: 20_000 });
});
