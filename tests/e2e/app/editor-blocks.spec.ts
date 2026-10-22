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
