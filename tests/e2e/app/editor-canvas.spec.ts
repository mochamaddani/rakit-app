import { expect, test } from '@playwright/test';
import { exampleDocument } from '@/tests/fixtures/example-document';
import {
  blockTypes,
  EMPTY_DOC,
  ensureOwner,
  openEditor,
  resetOwnerPages,
  seedPage,
  signIn,
} from './helpers';

const heroId = exampleDocument.sections[0]!.blocks[0]!.id;
test.beforeAll(ensureOwner);
test.beforeEach(async ({ page }) => {
  await resetOwnerPages();
  await signIn(page);
});

test('renders the draft in a sandboxed canvas the editor cannot reach into', async ({ page }) => {
  const frame = await openEditor(
    page,
    await seedPage({ name: 'Example', document: exampleDocument }),
  );
  await expect(page.locator('iframe[title="Page preview"]')).toHaveAttribute(
    'sandbox',
    'allow-scripts',
  );
  expect(await blockTypes(frame)).toEqual(
    exampleDocument.sections.flatMap((s) => s.blocks.map((b) => b.type)),
  );
  expect(await page.evaluate(() => document.querySelector('iframe')!.contentDocument)).toBeNull();
});

test('clicking a block selects it; links in the canvas do not navigate', async ({ page }) => {
  const frame = await openEditor(
    page,
    await seedPage({ name: 'Example', document: exampleDocument }),
  );
  await frame.locator(`[data-lp-block="${heroId}"] a[href]`).first().click();
  await expect(page.getByTestId('canvas-selection')).toContainText('Hero');
  expect(
    page
      .frames()
      .find((f) => f !== page.mainFrame())!
      .url(),
  ).toBe('about:srcdoc');
});

test('the selection outline follows canvas scrolling', async ({ page }) => {
  const frame = await openEditor(
    page,
    await seedPage({ name: 'Example', document: exampleDocument }),
  );
  await frame.locator(`[data-lp-block="${heroId}"] h1`).click();
  const outline = page.getByTestId('canvas-selection');
  const y0 = (await outline.boundingBox())!.y;
  await frame.locator('html').evaluate(() => window.scrollBy(0, 200));
  await expect
    .poll(async () => Math.round((await outline.boundingBox())!.y - (y0 - 200)))
    .toBeLessThanOrEqual(3);
});

test('the viewport toggle changes the canvas width', async ({ page }) => {
  const frame = await openEditor(
    page,
    await seedPage({ name: 'Example', document: exampleDocument }),
  );
  const width = () => frame.locator('html').evaluate(() => window.innerWidth);
  expect(await width()).toBe(390);
  await page.getByRole('radio', { name: 'Tablet' }).check();
  await expect.poll(width).toBe(768);
  await page.getByRole('radio', { name: 'Desktop' }).check();
  await expect.poll(width).toBe(1280);
  const box = (await page.locator('iframe[title="Page preview"]').boundingBox())!;
  expect(box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test('an empty page shows a hint', async ({ page }) => {
  await openEditor(page, await seedPage({ name: 'Empty', document: EMPTY_DOC }));
  await expect(
    page.getByText('This page is empty. Add a block from the panel on the left.'),
  ).toBeVisible();
});

test('an invalid stored draft shows an error instead of the editor', async ({ page }) => {
  const id = await seedPage({ name: 'Broken', document: { schemaVersion: 1, sections: 'x' } });
  await page.goto(`/editor/${id}`);
  await expect(page.getByRole('heading', { name: "This draft can't be opened" })).toBeVisible();
});

test('forged canvas messages are ignored', async ({ page }) => {
  await openEditor(page, await seedPage({ name: 'Example', document: exampleDocument }));
  await page.evaluate((blockId) => {
    window.postMessage(
      {
        source: 'launchpad-canvas',
        channel: 'aaaaaaaaaa',
        type: 'select',
        target: { kind: 'block', blockId },
      },
      '*',
    );
  }, heroId);
  await page.waitForTimeout(300);
  await expect(page.getByTestId('canvas-selection')).toHaveCount(0);
});
