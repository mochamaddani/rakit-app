import { expect, test, type Page } from '@playwright/test';
import {
  addBlock,
  blockTypes,
  canvas,
  EMPTY_DOC,
  ensureOwner,
  openEditor,
  resetOwnerPages,
  saveStatus,
  seedPage,
  signIn,
} from './helpers';

test.beforeAll(ensureOwner);
test.beforeEach(async ({ page }) => {
  await resetOwnerPages();
  await signIn(page);
});
const fresh = async (page: Page) =>
  openEditor(page, await seedPage({ name: 'Blocks', document: EMPTY_DOC }));

test('adds Hero and Product Carousel from the palette', async ({ page }) => {
  const frame = await fresh(page);
  await addBlock(page, 'Hero');
  await addBlock(page, 'Product Carousel');
  await expect.poll(() => blockTypes(frame)).toEqual(['hero', 'product-carousel']);
  await expect(frame.locator('h1')).toContainText('Your main promise in one line');
  await expect(frame.locator('.lp-card')).toHaveCount(3);
  await expect(page.getByTestId('canvas-selection')).toContainText('Product Carousel');
});

test('moves, duplicates and deletes with the toolbar and the keyboard; undo and redo walk every step', async ({
  page,
}) => {
  const frame = await fresh(page);
  const steps: string[][] = [[]];
  const snap = async () => steps.push(await blockTypes(frame));
  for (const label of ['Hero', 'Benefits', 'FAQ']) {
    await addBlock(page, label);
    await expect.poll(() => blockTypes(frame)).toHaveLength(steps.length);
    await snap();
  }
  await page
    .getByRole('toolbar', { name: 'Block actions' })
    .getByRole('button', { name: 'Move up' })
    .click();
  await expect(page.getByTestId('announcer')).toHaveText('Moved FAQ up, now section 2 of 3');
  await snap();
  await page.keyboard.press('Alt+ArrowUp');
  await expect.poll(() => blockTypes(frame)).toEqual(['faq', 'hero', 'benefits']);
  await snap();
  await page.keyboard.press('ControlOrMeta+d');
  await expect.poll(() => blockTypes(frame)).toHaveLength(4);
  await snap();
  await page.keyboard.press('Delete');
  await expect.poll(() => blockTypes(frame)).toHaveLength(3);
  await snap();
  expect(steps.slice(4)).toEqual([
    ['hero', 'faq', 'benefits'],
    ['faq', 'hero', 'benefits'],
    ['faq', 'faq', 'hero', 'benefits'],
    ['faq', 'hero', 'benefits'],
  ]);
  for (let i = steps.length - 2; i >= 0; i--) {
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(() => blockTypes(frame)).toEqual(steps[i]);
  }
  for (let i = 1; i < steps.length; i++) {
    await page.keyboard.press('ControlOrMeta+Shift+z');
    await expect.poll(() => blockTypes(frame)).toEqual(steps[i]);
  }
});

test('autosave persists the draft across a reload', async ({ page }) => {
  await fresh(page);
  await addBlock(page, 'Hero');
  await addBlock(page, 'FAQ');
  await expect(saveStatus(page)).toHaveText('Saved');
  await page.reload();
  await expect.poll(() => blockTypes(canvas(page))).toEqual(['hero', 'faq']);
});

test('warns before leaving with unsaved changes', async ({ page }) => {
  await fresh(page);
  await addBlock(page, 'Hero');
  const dialog = page.waitForEvent('dialog');
  await page.close({ runBeforeUnload: true });
  const d = await dialog;
  expect(d.type()).toBe('beforeunload');
  await d.accept();
});

test('a save from another tab raises a conflict; keeping mine overwrites it', async ({
  page,
  context,
}) => {
  const id = await seedPage({ name: 'Two tabs', document: EMPTY_DOC });
  const other = await context.newPage();
  await openEditor(page, id);
  await openEditor(other, id);
  await addBlock(page, 'Hero');
  await expect(saveStatus(page)).toHaveText('Saved');
  await addBlock(other, 'FAQ');
  // Not getByRole('alert'): Next.js also renders a route announcer with role="alert".
  await expect(other.getByText('This page was changed in another tab or window.')).toBeVisible();
  await other.getByRole('button', { name: 'Keep my version' }).click();
  await expect(saveStatus(other)).toHaveText('Saved');
  await page.reload();
  await expect.poll(() => blockTypes(canvas(page))).toEqual(['faq']);
});

test('Pages, then browser Back, shows the latest draft and keeps saving without a conflict', async ({
  page,
}) => {
  const frame = await fresh(page);
  await addBlock(page, 'Hero');
  await expect(saveStatus(page)).toHaveText('Saved');
  await page.getByRole('link', { name: 'Pages' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  // Next.js replays the editor's first-load payload (no blocks, revision 0) on back/forward.
  await page.goBack();
  await expect(page.locator('iframe[title="Page preview"][data-ready="true"]')).toBeAttached({
    timeout: 20_000,
  });
  await expect.poll(() => blockTypes(frame)).toEqual(['hero']);
  await addBlock(page, 'FAQ');
  await expect(saveStatus(page)).toHaveText('Saved');
  await page.reload();
  await expect.poll(() => blockTypes(canvas(page)), { timeout: 20_000 }).toEqual(['hero', 'faq']);
});

test('leaving with unsaved changes asks first, and closing the tab afterwards still warns', async ({
  page,
}) => {
  await fresh(page);
  // Saves fail as if the network were down, while the app's own pages still load.
  await page.route('**/api/pages/*/draft', (route) => route.abort('internetdisconnected'));
  await addBlock(page, 'Hero');
  await expect(saveStatus(page)).toHaveText('Offline — retrying');
  const pagesLink = page.getByRole('link', { name: 'Pages' });
  const confirm = page.getByRole('alertdialog', { name: 'Leave without saving?' });
  await pagesLink.click();
  await confirm.getByRole('button', { name: 'Stay' }).click();
  await expect(confirm).toBeHidden();
  await expect(page).toHaveURL(/\/editor\//);
  await pagesLink.click();
  await confirm.getByRole('button', { name: 'Leave anyway' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  const dialog = page.waitForEvent('dialog');
  await page.close({ runBeforeUnload: true });
  const d = await dialog;
  expect(d.type()).toBe('beforeunload');
  await d.accept();
});

test('a save whose response is lost does not turn into a conflict', async ({ page }) => {
  await fresh(page);
  let drop = true;
  await page.route('**/api/pages/*/draft', async (route) => {
    const response = await route.fetch(); // the server receives and commits the save
    if (!drop) return route.fulfill({ response });
    drop = false;
    return route.abort('internetdisconnected');
  });
  await addBlock(page, 'Hero');
  await expect(saveStatus(page)).toHaveText('Offline — retrying');
  await addBlock(page, 'FAQ');
  await expect(saveStatus(page)).toHaveText('Saved', { timeout: 10_000 });
  await page.reload();
  await expect.poll(() => blockTypes(canvas(page)), { timeout: 20_000 }).toEqual(['hero', 'faq']);
});

test('a sticky CTA can be added, selected and edited in the canvas', async ({ page }) => {
  const frame = await fresh(page);
  await addBlock(page, 'Hero');
  await addBlock(page, 'Sticky CTA bar');
  const bar = frame.locator('.lp-sticky');
  await expect(bar).toBeVisible();
  // Select something else first, then pick the bar from the canvas itself.
  await frame.locator('h1').click();
  await expect(page.getByTestId('canvas-selection')).toContainText('Hero');
  await bar.click({ position: { x: 4, y: 4 } });
  await expect(page.getByTestId('canvas-selection')).toContainText('Sticky CTA bar');
  const label = frame.locator('.lp-sticky [data-lp-field="cta.label"]');
  await label.dblclick();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('Beli sekarang');
  await page.keyboard.press('Escape');
  await expect(label).toHaveText('Beli sekarang');
  await expect(page.getByLabel('Label', { exact: true })).toHaveValue('Beli sekarang');
});
