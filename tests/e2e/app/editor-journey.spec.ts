import { expect, test } from '@playwright/test';
import {
  addBlock,
  blockTypes,
  canvas,
  ensureOwner,
  resetOwnerPages,
  saveStatus,
  signIn,
} from './helpers';

test.beforeAll(ensureOwner);
test.beforeEach(async ({ page }) => {
  await resetOwnerPages();
  await signIn(page);
});

test('create → add Hero and Carousel → edit → reorder items and blocks → undo/redo all → reload keeps the draft', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.getByRole('button', { name: 'New page' }).click();
  await page.getByLabel('Name').fill('Journey');
  await page.getByRole('button', { name: 'Create page' }).click();
  await expect(page).toHaveURL(/\/editor\//, { timeout: 20_000 });
  const frame = canvas(page);
  // allTextContents() never waits, so polling an empty page stays fast.
  const state = async () => ({
    types: await blockTypes(frame),
    headlines: await frame.locator('h1, h2.lp-h1').allTextContents(),
    cards: await frame.locator('.lp-card__title').allTextContents(),
  });
  const steps = [await state()];
  const step = async () => steps.push(await state());

  await addBlock(page, 'Hero');
  await step();
  await addBlock(page, 'Product Carousel');
  await step();
  await canvas(page)
    .locator('[data-lp-type="hero"]')
    .click({ position: { x: 8, y: 8 } });
  // exact: getByLabel matches substrings, and "Subheadline" contains "headline".
  await page.getByLabel('Headline', { exact: true }).fill('Botol anti bocor');
  await step();
  await canvas(page)
    .locator('[data-lp-type="product-carousel"]')
    .click({ position: { x: 8, y: 8 } });
  await page
    .getByRole('list', { name: 'Items' })
    .getByRole('listitem')
    .nth(2)
    .getByRole('button', { name: 'Move item up' })
    .click();
  await step();
  await page
    .getByRole('toolbar', { name: 'Block actions' })
    .getByRole('button', { name: 'Move up' })
    .click();
  await step();

  for (let i = steps.length - 2; i >= 0; i--) {
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect.poll(state).toEqual(steps[i]);
  }
  for (let i = 1; i < steps.length; i++) {
    await page.getByRole('button', { name: 'Redo' }).click();
    await expect.poll(state).toEqual(steps[i]);
  }
  await expect(saveStatus(page)).toHaveText('Saved');
  await page.reload();
  await expect.poll(state, { timeout: 20_000 }).toEqual(steps.at(-1));
});
