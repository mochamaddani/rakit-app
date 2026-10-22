import { expect, test, type FrameLocator } from '@playwright/test';
import { perfDocument } from '@/tests/fixtures/perf-document';
import {
  blockTypes,
  docWith,
  dragWithMouse,
  EMPTY_DOC,
  ensureOwner,
  openEditor,
  paletteItem,
  pointIn,
  resetOwnerPages,
  seedPage,
  signIn,
  touchDrag,
} from './helpers';

test.beforeAll(ensureOwner);
test.beforeEach(async ({ page }) => {
  await resetOwnerPages();
  await signIn(page);
});

const sections = (frame: FrameLocator) => frame.locator('[data-lp-section]');
const typesIn = (frame: FrameLocator, section: number) =>
  sections(frame)
    .nth(section)
    .locator('[data-lp-block]')
    .evaluateAll((elements) => elements.map((el) => el.getAttribute('data-lp-type')));

test('drags Hero from the palette to a new section between two others', async ({ page }) => {
  const frame = await openEditor(
    page,
    await seedPage({ name: 'Dnd', document: docWith(['benefits', 'faq']) }),
  );
  const grip = paletteItem(page, 'Hero').locator('[data-drag-handle]');
  await page.mouse.move(...(await pointIn(grip, 0.5, 0.5)));
  await page.mouse.down();
  await page.mouse.move(...(await pointIn(sections(frame).nth(1), 0.5, 0.1)), { steps: 12 });
  await expect(page.getByTestId('drop-marker')).toContainText('New section');
  await expect(page.getByTestId('canvas-shield')).toBeVisible();
  await expect(page.getByTestId('drag-ghost')).toHaveText('Hero');
  await page.mouse.up();
  await expect.poll(() => blockTypes(frame)).toEqual(['benefits', 'hero', 'faq']);
  await expect(page.getByTestId('announcer')).toHaveText('Added Hero as section 2 of 3');
  await expect(page.getByTestId('canvas-shield')).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(() => blockTypes(frame)).toEqual(['benefits', 'faq']);
});

test('a drop over the middle of a section joins it', async ({ page }) => {
  const frame = await openEditor(
    page,
    await seedPage({ name: 'Dnd', document: docWith(['benefits', 'faq']) }),
  );
  const grip = paletteItem(page, 'Hero').locator('[data-drag-handle]');
  await page.mouse.move(...(await pointIn(grip, 0.5, 0.5)));
  await page.mouse.down();
  await page.mouse.move(...(await pointIn(sections(frame).nth(1), 0.5, 0.3)), { steps: 12 });
  await expect(page.getByTestId('drop-marker')).toContainText('Into this section');
  await page.mouse.up();
  await expect.poll(() => typesIn(frame, 1)).toEqual(['hero', 'faq']);
  await expect(sections(frame)).toHaveCount(2);
});

test('reorders a block by dragging its toolbar grip', async ({ page }) => {
  const frame = await openEditor(
    page,
    // The FAQ is short, so the hero's toolbar and the FAQ section's top are both on screen.
    await seedPage({ name: 'Dnd', document: docWith(['faq', 'hero', 'benefits']) }),
  );
  await frame.locator('[data-lp-type="hero"]').click({ position: { x: 8, y: 8 } });
  const grip = page
    .getByRole('toolbar', { name: 'Block actions' })
    .getByRole('button', { name: 'Drag to move' });
  await dragWithMouse(
    page,
    await pointIn(grip, 0.5, 0.5),
    await pointIn(sections(frame).nth(0), 0.5, 0.1),
  );
  await expect.poll(() => blockTypes(frame)).toEqual(['hero', 'faq', 'benefits']);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(() => blockTypes(frame)).toEqual(['faq', 'hero', 'benefits']);
});

test('a drag released outside the canvas or cancelled with Escape changes nothing', async ({
  page,
}) => {
  const frame = await openEditor(
    page,
    await seedPage({ name: 'Dnd', document: docWith(['benefits', 'faq']) }),
  );
  const grip = paletteItem(page, 'Hero').locator('[data-drag-handle]');
  await dragWithMouse(
    page,
    await pointIn(grip, 0.5, 0.5),
    await pointIn(page.getByRole('complementary', { name: 'Inspector' }), 0.5, 0.5),
  );
  await expect(page.getByTestId('announcer')).toHaveText('Drag cancelled.');

  await page.mouse.move(...(await pointIn(grip, 0.5, 0.5)));
  await page.mouse.down();
  await page.mouse.move(...(await pointIn(sections(frame).nth(1), 0.5, 0.1)), { steps: 12 });
  await expect(page.getByTestId('canvas-shield')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('canvas-shield')).toHaveCount(0);
  await page.mouse.up();
  await expect(page.getByTestId('announcer')).toHaveText('Drag cancelled.');
  expect(await blockTypes(frame)).toEqual(['benefits', 'faq']);
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
});

test('auto-scrolls the canvas while the pointer stays near its bottom edge', async ({ page }) => {
  test.setTimeout(120_000);
  const frame = await openEditor(page, await seedPage({ name: 'Perf', document: perfDocument() }));
  await expect(frame.locator('[data-lp-block]')).toHaveCount(40, { timeout: 30_000 });
  const box = (await page.locator('iframe[title="Page preview"]').boundingBox())!;
  const grip = paletteItem(page, 'Hero').locator('[data-drag-handle]');
  await page.mouse.move(...(await pointIn(grip, 0.5, 0.5)));
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height - 8, { steps: 12 });
  // About 17 px per frame at 8 px from the edge: 2.5 s scrolls a few thousand px.
  await page.waitForTimeout(2500);
  expect(await frame.locator('html').evaluate(() => window.scrollY)).toBeGreaterThan(640);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
  await page.mouse.up();
  await expect
    .poll(async () => (await blockTypes(frame)).filter((type) => type === 'hero').length)
    .toBe(2);
  // Before the drag only blocks 0–1 were on screen.
  expect((await blockTypes(frame)).lastIndexOf('hero')).toBeGreaterThan(4);
});

test('touch: a long-press on the palette grip drags', async ({ browser }) => {
  const context = await browser.newContext({
    hasTouch: true,
    baseURL: 'http://localhost:3000',
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();
  await signIn(page);
  const frame = await openEditor(page, await seedPage({ name: 'Touch', document: EMPTY_DOC }));
  const grip = paletteItem(page, 'Hero').locator('[data-drag-handle]');
  await touchDrag(
    page,
    await pointIn(grip, 0.5, 0.5),
    await pointIn(page.locator('iframe[title="Page preview"]'), 0.5, 0.3),
  );
  await expect.poll(() => blockTypes(frame)).toEqual(['hero']);
  await context.close();
});
