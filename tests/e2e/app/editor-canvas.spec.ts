import { expect, test, type FrameLocator, type Page } from '@playwright/test';
import { exampleDocument } from '@/tests/fixtures/example-document';
import {
  addBlock,
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
  const id = await seedPage({ name: 'Broken', document: { schemaVersion: 2, sections: 'x' } });
  await page.goto(`/editor/${id}`);
  await expect(page.getByRole('heading', { name: "This draft can't be opened" })).toBeVisible();
});

/** A select message for the hero, shaped as the canvas runtime sends it. */
const selectHero = (channel: string) => ({
  source: 'launchpad-canvas',
  channel,
  type: 'select',
  target: { kind: 'block', blockId: heroId },
});

/** The channel this canvas load is tagged with (D-039). */
async function canvasChannel(page: Page): Promise<string> {
  const srcdoc = await page.locator('iframe[title="Page preview"]').getAttribute('srcdoc');
  return /data-lp-channel="([^"]+)"/.exec(srcdoc ?? '')![1]!;
}

const postFromCanvas = (frame: FrameLocator, message: unknown) =>
  frame.locator('body').evaluate((_, m) => window.parent.postMessage(m, '*'), message);

test('canvas messages on the right channel are ignored unless the iframe sent them', async ({
  page,
}) => {
  await openEditor(page, await seedPage({ name: 'Example', document: exampleDocument }));
  const channel = await canvasChannel(page);
  await page.evaluate((message) => window.postMessage(message, '*'), selectHero(channel));
  await page.waitForTimeout(300);
  await expect(page.getByTestId('canvas-selection')).toHaveCount(0);
});

test('canvas messages from the iframe are ignored unless they carry its channel', async ({
  page,
}) => {
  const frame = await openEditor(
    page,
    await seedPage({ name: 'Example', document: exampleDocument }),
  );
  await postFromCanvas(frame, selectHero('aaaaaaaaaa'));
  await page.waitForTimeout(300);
  await expect(page.getByTestId('canvas-selection')).toHaveCount(0);
  // The same message on the right channel is accepted, so the check above is the channel's.
  await postFromCanvas(frame, selectHero(await canvasChannel(page)));
  await expect(page.getByTestId('canvas-selection')).toContainText('Hero');
});

const HERO_DOC = {
  schemaVersion: 2,
  sections: [
    { id: 's1', blocks: [{ id: 'bHero', type: 'hero', props: { headline: 'Botol asli' } }] },
  ],
};
const channelOf = async (page: Page) =>
  /data-lp-channel="([a-z0-9]{10})"/.exec(
    (await page.locator('iframe[title="Page preview"]').getAttribute('srcdoc')) ?? '',
  )?.[1] ?? null;

test('a Custom HTML script cannot edit the page or reach the canvas', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const frame = await openEditor(page, await seedPage({ name: 'Canary', document: HERO_DOC }));
  await addBlock(page, 'Custom HTML');
  // Clicking the block in the canvas selects it (its frame takes no pointer events).
  await frame.locator('h1').click();
  await frame.locator('[data-lp-type="custom-html"]').click();
  await expect(page.getByTestId('canvas-selection')).toContainText('Custom HTML');
  await page.getByLabel('Run scripts in the exported page').check();
  // The worst case: the script even knows the channel id and the block ids.
  const channel = await channelOf(page);
  const customId = await frame
    .locator('[data-lp-type="custom-html"]')
    .getAttribute('data-lp-block');
  const forge = (blockId: string, path: string) =>
    `{source:'launchpad-canvas',channel:'${channel}',type:'edit',blockId:'${blockId}',path:'${path}',nodes:[{t:'text',v:'HACKED'}]}`;
  await page
    .getByLabel('HTML', { exact: true })
    .fill(
      `<p id="out">waiting</p><script>var r=[];try{parent.document.body;r.push('read')}catch(e){r.push(e.name)}` +
        `[${forge('bHero', 'headline')},${forge(customId!, 'blockName')}].forEach(function(m){top.postMessage(m,'*');parent.postMessage(m,'*')});` +
        `parent.postMessage({source:'launchpad-canvas',channel:'${channel}',type:'sync',rev:999,blocks:[],skeleton:'<p>HACKED</p>'},'*');` +
        `document.getElementById('out').textContent=r.join(',')</script>`,
    );
  await page.getByLabel('HTML', { exact: true }).blur();
  const nested = () =>
    page.frames().find((f) => f.parentFrame() && f.parentFrame() !== page.mainFrame());
  await expect
    .poll(
      async () =>
        (await nested()
          ?.locator('#out')
          .textContent()
          .catch(() => null)) ?? null,
    )
    .toBe('SecurityError');
  await page.waitForTimeout(1000);
  await expect(frame.locator('h1')).toHaveText('Botol asli');
  await expect(page.getByLabel('Name (for the checklist)')).toHaveValue('');
  await expect(frame.locator('[data-lp-block]')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('a canvas that navigates away is rebuilt', async ({ page }) => {
  const frame = await openEditor(page, await seedPage({ name: 'Navigate', document: HERO_DOC }));
  const before = await channelOf(page);
  const canvasFrame = page.frames().find((f) => f.parentFrame() === page.mainFrame())!;
  await canvasFrame.evaluate(() => {
    location.href = 'about:blank';
  });
  await expect.poll(() => channelOf(page)).not.toBe(before);
  await expect(page.locator('iframe[title="Page preview"][data-ready="true"]')).toBeAttached();
  await expect(frame.locator('h1')).toHaveText('Botol asli');
  await frame.locator('h1').click();
  await expect(page.getByTestId('canvas-selection')).toContainText('Hero');
});
