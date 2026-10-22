import { devices, expect, test } from '@playwright/test';
import {
  exampleDocument,
  stressDocument,
  twoCarouselsDocument,
} from '@/tests/fixtures/example-document';
import { renderToFile } from './render-to-file';

const carouselIn = (page: import('@playwright/test').Page, blockId: string) =>
  page.locator(`#b-${blockId} .lp-carousel`);

test.describe('carousel with JavaScript (desktop)', () => {
  test('arrows move one slide and update the active dot', async ({ page }, info) => {
    await page.goto(renderToFile(info.outputPath('example.html'), exampleDocument));
    const c = carouselIn(page, 'bProducts');
    await expect(c.locator('.lp-carousel__nav')).toBeVisible();
    await c.getByRole('button', { name: 'Slide berikutnya' }).click();
    await expect(c.getByRole('button', { name: 'Ke slide 2' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  test('keyboard: ArrowRight, End and Home on the focused track', async ({ page }, info) => {
    await page.goto(renderToFile(info.outputPath('example.html'), exampleDocument));
    const c = carouselIn(page, 'bProducts');
    await c.locator('.lp-carousel__track').focus();
    await page.keyboard.press('ArrowRight');
    await expect(c.getByRole('button', { name: 'Ke slide 2' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    await page.keyboard.press('End');
    await expect(c.getByRole('button', { name: 'Ke slide 8' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    await page.keyboard.press('Home');
    await expect(c.getByRole('button', { name: 'Ke slide 1' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  test('keyboard focus stays on the next arrow at the end of the row', async ({ page }, info) => {
    await page.goto(renderToFile(info.outputPath('example.html'), exampleDocument));
    const c = carouselIn(page, 'bProducts');
    const next = c.getByRole('button', { name: 'Slide berikutnya' });
    await next.focus();
    // 8 cards, 4 visible on desktop: three steps reach slides 2-4, the fourth reaches the end.
    for (const slide of [2, 3, 4, 8]) {
      await page.keyboard.press('Enter');
      await expect(c.getByRole('button', { name: `Ke slide ${slide}` })).toHaveAttribute(
        'aria-current',
        'true',
      );
    }
    await expect(next).toHaveAttribute('aria-disabled', 'true');
    await expect(next).toBeFocused();
  });

  test('two carousels are independent', async ({ page }, info) => {
    await page.goto(renderToFile(info.outputPath('two.html'), twoCarouselsDocument));
    await carouselIn(page, 'cA').getByRole('button', { name: 'Slide berikutnya' }).click();
    await expect(
      carouselIn(page, 'cA').getByRole('button', { name: 'Ke slide 2' }),
    ).toHaveAttribute('aria-current', 'true');
    await expect(
      carouselIn(page, 'cB').getByRole('button', { name: 'Ke slide 1' }),
    ).toHaveAttribute('aria-current', 'true');
    await expect(carouselIn(page, 'cB').locator('.lp-carousel__track')).toHaveJSProperty(
      'scrollLeft',
      0,
    );
  });

  test('no horizontal overflow at 360px width', async ({ page }, info) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(renderToFile(info.outputPath('example.html'), exampleDocument));
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });
});

test.describe('layout stress (long unbroken words, URLs, huge prices)', () => {
  test('no horizontal overflow at 360px width', async ({ page }, info) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(renderToFile(info.outputPath('stress.html'), stressDocument));
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });
});

test.describe('carousel on a touch phone', () => {
  // Device descriptors carry defaultBrowserType, which test.use() rejects inside a describe block.
  const { defaultBrowserType, ...pixel7 } = devices['Pixel 7'];
  void defaultBrowserType;
  test.use(pixel7);

  test('hides arrows on touch screens but keeps dots', async ({ page }, info) => {
    await page.goto(renderToFile(info.outputPath('example.html'), exampleDocument));
    const c = carouselIn(page, 'bProducts');
    await expect(c.locator('.lp-carousel__prev')).toBeHidden();
    await expect(c.locator('.lp-carousel__dots')).toBeVisible();
  });

  test('scrolling part of a slide snaps to the next one', async ({ page }, info) => {
    await page.goto(renderToFile(info.outputPath('example.html'), exampleDocument));
    const c = carouselIn(page, 'bProducts');
    await c
      .locator('.lp-carousel__track')
      .evaluate((el) => el.scrollBy({ left: el.clientWidth * 0.6 }));
    await expect(c.getByRole('button', { name: 'Ke slide 2' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });
});

test.describe('carousel without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('controls stay hidden and the track still scrolls with snap points', async ({
    page,
  }, info) => {
    await page.goto(renderToFile(info.outputPath('example.html'), exampleDocument));
    const c = carouselIn(page, 'bProducts');
    await expect(c.locator('.lp-carousel__nav')).toBeHidden();
    await expect(c.locator('.lp-carousel__track')).toHaveCSS('scroll-snap-type', 'x mandatory');
    await expect(c.locator('.lp-carousel__track')).toHaveCSS('overflow-x', 'auto');
    await expect(c.locator('.lp-carousel__slide')).toHaveCount(8);
  });
});
