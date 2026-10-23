import { expect, test, type Page } from '@playwright/test';
import { svgPlaceholder } from '@/tests/fixtures/example-document';
import {
  addBlock,
  canvas,
  dragWithMouse,
  EMPTY_DOC,
  ensureOwner,
  openEditor,
  pointIn,
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
async function heroAndCarousel(page: Page) {
  const frame = await openEditor(page, await seedPage({ name: 'Inspector', document: EMPTY_DOC }));
  await addBlock(page, 'Hero');
  await addBlock(page, 'Product Carousel');
  await expect(frame.locator('.lp-card')).toHaveCount(3);
  return frame;
}
const selectBlock = (page: Page, type: string) =>
  canvas(page)
    .locator(`[data-lp-type="${type}"]`)
    .first()
    .click({ position: { x: 8, y: 8 } });
// exact: getByLabel matches substrings, and "Subheadline" contains "headline".
const headlineField = (page: Page) => page.getByLabel('Headline', { exact: true });

test('edits the hero headline and the canvas follows; rich toolbar adds bold', async ({ page }) => {
  const frame = await heroAndCarousel(page);
  await selectBlock(page, 'hero');
  const headline = headlineField(page);
  await headline.fill('Botol anti bocor');
  await expect(frame.locator('h1')).toHaveText('Botol anti bocor');
  await headline.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(6, 10));
  // Each rich field has its own formatting toolbar; the hero has two (headline, subheadline).
  await page
    .getByRole('toolbar', { name: 'Headline formatting', exact: true })
    .getByRole('button', { name: 'Bold' })
    .click();
  await expect(headline).toHaveValue('Botol **anti** bocor');
  await expect(frame.locator('h1 strong')).toHaveText('anti');
});

test('a required field cannot be emptied', async ({ page }) => {
  const frame = await heroAndCarousel(page);
  await selectBlock(page, 'hero');
  const headline = headlineField(page);
  await headline.fill('');
  await expect(page.getByText('Required')).toBeVisible();
  await expect(frame.locator('h1')).toContainText('Your main promise');
  await page.getByLabel('Eyebrow').click();
  await expect(headline).toHaveValue('Your main promise in **one line**');
});

test('adds, reorders, duplicates and removes carousel items; undo restores each step', async ({
  page,
}) => {
  const frame = await heroAndCarousel(page);
  const titles = () => frame.locator('.lp-card__title').allTextContents();
  const items = page.getByRole('list', { name: 'Items' }).getByRole('listitem');
  const start = await titles();
  await page.getByRole('button', { name: 'Add item' }).click();
  await expect.poll(titles).toHaveLength(4);
  await items.nth(3).getByRole('button', { name: 'Move item up' }).click();
  await items.nth(0).getByRole('button', { name: 'Duplicate item' }).click();
  await expect.poll(titles).toHaveLength(5);
  await items.nth(1).getByRole('button', { name: 'Delete item' }).click();
  await expect.poll(titles).toHaveLength(4);
  for (let i = 0; i < 4; i++) await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(titles).toEqual(start);
});

test('drags a carousel item to a new position; undo restores the order', async ({ page }) => {
  const frame = await heroAndCarousel(page);
  await selectBlock(page, 'product-carousel');
  const items = page.getByRole('list', { name: 'Items' }).getByRole('listitem');
  await dragWithMouse(
    page,
    await pointIn(items.nth(2).getByRole('button', { name: 'Drag to reorder' }), 0.5, 0.5),
    await pointIn(items.nth(0), 0.5, 0.2),
  );
  const titles = () => frame.locator('.lp-card__title').allTextContents();
  await expect.poll(titles).toEqual(['Product 3', 'Product 1', 'Product 2']);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(titles).toEqual(['Product 1', 'Product 2', 'Product 3']);
});

test('typing a UTM campaign with a space keeps it', async ({ page }) => {
  const frame = await heroAndCarousel(page);
  await selectBlock(page, 'hero');
  const cta = page.getByRole('group', { name: 'Primary button' });
  await cta.getByLabel('Link type').selectOption('url');
  await cta.getByLabel('Address').fill('https://botolku.example/beli');
  await cta.getByText('UTM parameters').click();
  await cta.getByLabel('Campaign').pressSequentially('promo oktober');
  await expect(frame.locator('.lp-hero .lp-btn--primary')).toHaveAttribute(
    'href',
    'https://botolku.example/beli?utm_campaign=promo%20oktober',
  );
});

test('an undo while a UTM field has focus stays undone when it loses focus', async ({ page }) => {
  const frame = await heroAndCarousel(page);
  await selectBlock(page, 'hero');
  const cta = page.getByRole('group', { name: 'Primary button' });
  await cta.getByLabel('Link type').selectOption('url');
  await cta.getByLabel('Address').fill('https://botolku.example/beli');
  await cta.getByText('UTM parameters').click();
  const campaign = cta.getByLabel('Campaign');
  const button = frame.locator('.lp-hero .lp-btn--primary');
  await campaign.pressSequentially('promo');
  await expect(button).toHaveAttribute('href', 'https://botolku.example/beli?utm_campaign=promo');
  await page.keyboard.press('ControlOrMeta+Z');
  await expect(button).toHaveAttribute('href', 'https://botolku.example/beli');
  await expect(campaign).toHaveValue('');
  await campaign.press('Tab');
  await expect(page.getByRole('button', { name: 'Redo' })).toBeEnabled();
  await expect(button).toHaveAttribute('href', 'https://botolku.example/beli');
});

test('a theme color change restyles the canvas and shows a contrast warning', async ({ page }) => {
  const frame = await heroAndCarousel(page);
  await page.getByRole('button', { name: 'Page settings' }).click();
  await page.getByLabel('Primary', { exact: true }).fill('#FDE047');
  await expect(page.getByTestId('contrast-onPrimary-primary')).toContainText('too low for text');
  await expect(frame.locator('.lp-hero .lp-btn--primary')).toHaveCSS(
    'background-color',
    'rgb(253, 224, 71)',
  );
});

test('the hero button can target a section, and UTM parameters are appended to web links', async ({
  page,
}) => {
  const frame = await heroAndCarousel(page);
  await selectBlock(page, 'hero');
  const cta = page.getByRole('group', { name: 'Primary button' });
  await cta.getByLabel('Link type').selectOption('section');
  await cta.getByLabel('Section').selectOption({ label: 'Section 2 · Product Carousel' });
  await expect(frame.locator('.lp-hero .lp-btn--primary')).toHaveAttribute(
    'href',
    /^#s-[a-z0-9]{10}$/,
  );
  await cta.getByLabel('Link type').selectOption('url');
  await cta.getByLabel('Address').fill('https://wa.me/62812');
  await cta.getByText('UTM parameters').click();
  await cta.getByLabel('Source').fill('meta');
  await expect(frame.locator('.lp-hero .lp-btn--primary')).toHaveAttribute(
    'href',
    'https://wa.me/62812?utm_source=meta',
  );
});

test('a button whose section was deleted says so instead of showing another section', async ({
  page,
}) => {
  const link = { kind: 'section', sectionId: 'deleted' };
  const document = {
    schemaVersion: 1,
    sections: [
      {
        id: 'sHero',
        blocks: [
          {
            id: 'bHero',
            type: 'hero',
            props: { headline: 'Botol', primaryCta: { label: 'Pesan', link } },
          },
        ],
      },
    ],
  };
  await openEditor(page, await seedPage({ name: 'Dangling link', document }));
  await selectBlock(page, 'hero');
  const section = page.getByRole('group', { name: 'Primary button' }).getByLabel('Section');
  await expect(section.locator('option:checked')).toHaveText('Missing section');
  await expect(section).toHaveAccessibleDescription(
    'This section no longer exists. Choose another.',
  );
});

test('block style hides a block on mobile only', async ({ page }) => {
  const frame = await heroAndCarousel(page);
  await selectBlock(page, 'hero');
  await page.getByRole('tab', { name: 'Style' }).click();
  await page.getByLabel('Hide on').selectOption('mobile');
  await expect(frame.locator('[data-lp-type="hero"]')).toBeHidden();
  await page.getByRole('radio', { name: 'Desktop' }).check();
  await expect(frame.locator('[data-lp-type="hero"]')).toBeVisible();
});

test('an item image from a URL appears in the canvas and asks for alt text', async ({ page }) => {
  const frame = await heroAndCarousel(page);
  const first = page.getByRole('list', { name: 'Items' }).getByRole('listitem').first();
  await first.getByRole('button', { expanded: false }).first().click();
  await first.getByLabel('Image address').fill(svgPlaceholder('Biru', '#1D4ED8'));
  await expect(first.getByText('Describe the image for screen readers')).toBeVisible();
  await expect(frame.locator('.lp-card__img').first()).toHaveAttribute(
    'src',
    /^data:image\/svg\+xml/,
  );
  await expect(saveStatus(page)).toHaveText('Saved');
});
