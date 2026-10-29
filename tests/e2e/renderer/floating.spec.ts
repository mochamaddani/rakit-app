import { expect, test, type Page } from '@playwright/test';
import { renderToFile } from './render-to-file';

// Floating blocks (D-050): the sticky CTA bar sits over the page.

const filler = (id: string) => ({
  id,
  blocks: [
    {
      id: `b${id}`,
      type: 'benefits',
      props: {
        heading: `Section ${id}`,
        items: [1, 2, 3, 4].map((n) => ({ id: `i${n}`, title: `Benefit ${n}`, text: 'Text' })),
      },
    },
  ],
});
const footer = {
  id: 'sFoot',
  blocks: [
    {
      id: 'bFoot',
      type: 'footer',
      props: {
        brand: 'Botolku',
        links: [
          { id: 'l1', label: 'Kebijakan Privasi', link: { kind: 'url', url: 'https://x.test/p' } },
        ],
      },
    },
  ],
};
const page = (name: string, floating: unknown[]) =>
  renderToFile(`test-results/floating/${name}.html`, {
    schemaVersion: 2,
    settings: { lang: 'id' },
    sections: [
      { id: 'sHero', blocks: [{ id: 'bHero', type: 'hero', props: { headline: 'Promo' } }] },
      filler('2'),
      filler('3'),
      { id: 'sFloat', blocks: floating },
      footer,
    ],
  });
const sticky = {
  id: 'bSticky',
  type: 'sticky-cta',
  props: { text: 'Gratis ongkir', cta: { label: 'Pesan sekarang', link: { kind: 'default' } } },
};

test.use({ viewport: { width: 390, height: 780 } });

const bar = (p: Page) => p.locator('.lp-sticky');

test('the sticky bar appears after the first section and never covers the footer at 390 px', async ({
  page: tab,
}) => {
  await tab.goto(page('sticky', [sticky]));
  await expect(bar(tab)).toBeHidden();
  await tab.locator('#s-3').scrollIntoViewIfNeeded();
  await expect(bar(tab)).toBeVisible();
  await tab.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const link = tab.getByRole('link', { name: 'Kebijakan Privasi' });
  const [linkBox, barBox] = await Promise.all([link.boundingBox(), bar(tab).boundingBox()]);
  expect(linkBox!.y + linkBox!.height).toBeLessThanOrEqual(barBox!.y);
  // The band holding only the bar takes no room.
  expect((await tab.locator('#s-sFloat').boundingBox())!.height).toBe(0);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('the bar is always visible', async ({ page: tab }) => {
    await tab.goto(page('sticky-nojs', [sticky]));
    await expect(bar(tab)).toBeVisible();
  });
});

test('the bar is hidden from 1024 px when set to phones only', async ({ page: tab }) => {
  await tab.setViewportSize({ width: 1280, height: 800 });
  await tab.goto(page('sticky-desktop', [sticky]));
  await tab.evaluate(() => window.scrollTo(0, 2000));
  await expect(bar(tab)).toBeHidden();
});
