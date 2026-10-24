import { expect, test } from '@playwright/test';
import {
  addBlock,
  adminClient,
  blockTypes,
  canvas,
  dragWithMouse,
  ensureOwner,
  paletteItem,
  pointIn,
  resetOwnerPages,
  saveStatus,
  signIn,
} from './helpers';

test.beforeAll(ensureOwner);

/**
 * Polls until the canvas shows the step, and returns the state that passed: reading again could
 * catch the canvas between two patches (the old journey's flake, M2b review M6).
 */
async function settled<S>(read: () => Promise<S>, ready: (s: S) => boolean): Promise<S> {
  let passed: S | undefined;
  await expect
    .poll(async () => {
      const s = await read();
      if (ready(s)) passed = s;
      return passed !== undefined;
    })
    .toBe(true);
  return passed!;
}
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
  type State = Awaited<ReturnType<typeof state>>;
  const steps: State[] = [await state()];
  // A step is captured once the canvas shows it (M2b review M6): edits sync asynchronously.
  const step = async (ready: (s: State) => boolean) => steps.push(await settled(state, ready));

  await addBlock(page, 'Hero');
  await step((s) => s.types.join() === 'hero');
  await addBlock(page, 'Product Carousel');
  await step((s) => s.types.join() === 'hero,product-carousel');
  await canvas(page)
    .locator('[data-lp-type="hero"]')
    .click({ position: { x: 8, y: 8 } });
  // exact: getByLabel matches substrings, and "Subheadline" contains "headline".
  await page.getByLabel('Headline', { exact: true }).fill('Botol anti bocor');
  await step((s) => s.headlines.includes('Botol anti bocor'));
  await canvas(page)
    .locator('[data-lp-type="product-carousel"]')
    .click({ position: { x: 8, y: 8 } });
  await page
    .getByRole('list', { name: 'Items' })
    .getByRole('listitem')
    .nth(2)
    .getByRole('button', { name: 'Move item up' })
    .click();
  await step((s) => s.cards.join() === 'Product 1,Product 3,Product 2');
  await page
    .getByRole('toolbar', { name: 'Block actions' })
    .getByRole('button', { name: 'Move up' })
    .click();
  await step((s) => s.types.join() === 'product-carousel,hero');

  for (let i = steps.length - 2; i >= 0; i--) {
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect.poll(state).toEqual(steps[i]);
  }
  for (let i = 1; i < steps.length; i++) {
    await page.getByRole('button', { name: 'Redo' }).click();
    await expect.poll(state).toEqual(steps[i]);
  }
  await expect(saveStatus(page)).toHaveText('Saved');
  // The server holds the last step before the reload: a failure here is a save problem, one
  // after the reload a loading problem.
  const id = new URL(page.url()).pathname.split('/').pop()!;
  await expect
    .poll(async () => {
      const { data } = await adminClient()
        .from('pages')
        .select('current_draft')
        .eq('id', id)
        .single();
      const draft = data?.current_draft as { sections: { blocks: { type: string }[] }[] };
      return draft.sections.flatMap((section) => section.blocks.map((block) => block.type));
    })
    .toEqual(steps.at(-1)!.types);
  await page.reload();
  await expect.poll(state, { timeout: 20_000 }).toEqual(steps.at(-1));
});

test('M2 exit: add by drag, edit inline and in the inspector, reorder items and blocks by drag, undo/redo all, reload', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.getByRole('button', { name: 'New page' }).click();
  await page.getByLabel('Name', { exact: true }).fill('Exit');
  await page.getByRole('button', { name: 'Create page' }).click();
  await expect(page).toHaveURL(/\/editor\//, { timeout: 20_000 });
  const iframe = page.locator('iframe[title="Page preview"]');
  await expect(page.locator('iframe[title="Page preview"][data-ready="true"]')).toBeAttached({
    timeout: 20_000,
  });
  const frame = canvas(page);
  const sections = frame.locator('[data-lp-section]');
  const state = async () => ({
    types: await blockTypes(frame),
    headlines: await frame.locator('h1, h2.lp-h1').allTextContents(),
    heading: await frame.locator('.lp-carousel .lp-h2').allTextContents(),
    cards: await frame.locator('.lp-card__title').allTextContents(),
  });
  type State = Awaited<ReturnType<typeof state>>;
  const steps: State[] = [await state()];
  // A step is captured once the canvas shows it: drags and inline edits sync asynchronously.
  const step = async (ready: (s: State) => boolean) => steps.push(await settled(state, ready));
  const grip = (label: string) => paletteItem(page, label).locator('[data-drag-handle]');

  await dragWithMouse(page, await pointIn(grip('Hero'), 0.5, 0.5), await pointIn(iframe, 0.5, 0.3));
  await step((s) => s.types.join() === 'hero');

  await dragWithMouse(
    page,
    await pointIn(grip('Product Carousel'), 0.5, 0.5),
    await pointIn(sections.nth(0), 0.5, 0.9),
  );
  await step((s) => s.types.join() === 'hero,product-carousel');

  await frame.locator('[data-lp-type="hero"] [data-lp-field="headline"]').dblclick();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('Botol anti bocor');
  await page.keyboard.press('Escape');
  await step((s) => s.headlines.includes('Botol anti bocor'));

  await frame.locator('[data-lp-type="product-carousel"]').click({ position: { x: 8, y: 8 } });
  await page.getByLabel('Heading', { exact: true }).fill('Pilih warnamu');
  await step((s) => s.heading.join() === 'Pilih warnamu');

  const items = page.getByRole('list', { name: 'Items' }).getByRole('listitem');
  await dragWithMouse(
    page,
    await pointIn(items.nth(2).getByRole('button', { name: 'Drag to reorder' }), 0.5, 0.5),
    await pointIn(items.nth(0), 0.5, 0.2),
  );
  await step((s) => s.cards.join() === 'Product 3,Product 1,Product 2');

  await dragWithMouse(
    page,
    await pointIn(
      page
        .getByRole('toolbar', { name: 'Block actions' })
        .getByRole('button', { name: 'Drag to move' }),
      0.5,
      0.5,
    ),
    await pointIn(sections.nth(0), 0.5, 0.1),
  );
  await step((s) => s.types.join() === 'product-carousel,hero');

  for (let i = steps.length - 2; i >= 0; i--) {
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect.poll(state).toEqual(steps[i]);
  }
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
  for (let i = 1; i < steps.length; i++) {
    await page.getByRole('button', { name: 'Redo' }).click();
    await expect.poll(state).toEqual(steps[i]);
  }
  await expect(saveStatus(page)).toHaveText('Saved');
  await page.reload();
  await expect.poll(state, { timeout: 20_000 }).toEqual(steps.at(-1));
});
