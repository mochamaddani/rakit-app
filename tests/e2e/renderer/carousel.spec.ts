import { devices, expect, test } from '@playwright/test';
import {
  exampleDocument,
  stressDocument,
  twoCarouselsDocument,
} from '@/tests/fixtures/example-document';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { renderPage } from '@/lib/renderer/page';
import { parseDocument } from '@/lib/schema/document';
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
    // 4 cards per view: the 5th dot is the last scroll position (one dot per position, m-3).
    await page.keyboard.press('End');
    await expect(c.getByRole('button', { name: 'Ke slide 5' })).toHaveAttribute(
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
    // 8 cards, 4 visible on desktop: four steps reach slides 2-5, the last scroll position.
    for (const slide of [2, 3, 4, 5]) {
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

test.describe('M4: fast clicks and dots (desktop)', () => {
  test('two fast next clicks advance two cards', async ({ page }, info) => {
    await page.goto(renderToFile(info.outputPath('example.html'), exampleDocument));
    const c = carouselIn(page, 'bProducts');
    const next = c.getByRole('button', { name: 'Slide berikutnya' });
    await next.click();
    await next.click();
    await expect(c.getByRole('button', { name: 'Ke slide 3' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  test('at 1280 px there is one dot per scroll position', async ({ page }, info) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(renderToFile(info.outputPath('example.html'), exampleDocument));
    const c = carouselIn(page, 'bProducts');
    // 8 cards, 4 per view: positions 1-5.
    await expect(c.locator('[data-lp-dot]:visible')).toHaveCount(5);
    await c.getByRole('button', { name: 'Ke slide 5' }).click();
    await expect(c.getByRole('button', { name: 'Slide berikutnya' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
});

// Autoplay (D-054): 3 cards on a phone, 5 s per card. The page clock drives the interval and the
// animation frames; the smooth scroll itself runs in real time.
const autoplayDoc = {
  schemaVersion: 2,
  settings: { lang: 'id' },
  sections: [
    {
      id: 's1',
      blocks: [
        {
          id: 'cAuto',
          type: 'product-carousel',
          props: {
            heading: 'Pilihan',
            autoplay: true,
            items: [1, 2, 3].map((n) => ({ id: `i${n}`, title: `Produk ${n}` })),
          },
        },
      ],
    },
    {
      id: 's2',
      blocks: [{ id: 'bFaq', type: 'faq', props: { heading: 'Tanya', items: [] } }],
    },
  ],
};

test.describe('carousel autoplay', () => {
  test.use({ viewport: { width: 390, height: 780 } });
  const current = (page: import('@playwright/test').Page) =>
    carouselIn(page, 'cAuto')
      .locator('[data-lp-dot][aria-current="true"]')
      .getAttribute('aria-label');
  /** Advances the page clock a little at a time until the active dot is `label`. */
  const reaches = (page: import('@playwright/test').Page, label: string) =>
    expect
      .poll(async () => {
        await page.clock.runFor(50);
        return current(page);
      })
      .toBe(label);
  const open = async (page: import('@playwright/test').Page, url: string) => {
    await page.clock.install();
    await page.goto(url);
    await page.mouse.move(380, 770);
  };

  test('autoplay advances every 5 s, wraps, and pauses on hover and focus', async ({
    page,
  }, info) => {
    await open(page, renderToFile(info.outputPath('auto.html'), autoplayDoc));
    await page.clock.runFor(4900);
    expect(await current(page)).toBe('Ke slide 1');
    await page.clock.runFor(150);
    await reaches(page, 'Ke slide 2');
    await page.clock.runFor(4800);
    await reaches(page, 'Ke slide 3');
    await page.clock.runFor(4800);
    await reaches(page, 'Ke slide 1');

    await carouselIn(page, 'cAuto').locator('.lp-carousel__track').hover();
    await page.clock.runFor(11_000);
    expect(await current(page)).toBe('Ke slide 1');
    await page.mouse.move(380, 770);
    await carouselIn(page, 'cAuto').locator('.lp-carousel__track').focus();
    await page.clock.runFor(11_000);
    expect(await current(page)).toBe('Ke slide 1');
  });

  test('autoplay stops after a swipe and never runs with reduced motion', async ({
    page,
  }, info) => {
    const url = renderToFile(info.outputPath('auto.html'), autoplayDoc);
    await open(page, url);
    const track = carouselIn(page, 'cAuto').locator('.lp-carousel__track');
    const box = (await track.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.8, box.y + 40);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.2, box.y + 40, { steps: 5 });
    await page.mouse.up();
    await page.mouse.move(380, 770);
    const after = await current(page);
    await page.clock.runFor(16_000);
    expect(await current(page)).toBe(after);
    // Stopped by the visitor: the button says so, and Play starts it again.
    const c = carouselIn(page, 'cAuto');
    await expect(c.getByRole('button', { name: 'Jeda' })).toHaveCount(0);
    await c.getByRole('button', { name: 'Putar' }).click();
    await page.mouse.move(380, 770);
    await page.locator('body').focus();
    await page.clock.runFor(5000);
    await expect.poll(async () => (await page.clock.runFor(50), current(page))).not.toBe(after);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await page.mouse.move(380, 770);
    await page.clock.runFor(16_000);
    expect(await current(page)).toBe('Ke slide 1');
    // Nothing to pause: no dead button.
    await expect(c.locator('[data-lp-play]')).toBeHidden();
  });

  test('the pause button toggles autoplay and its label', async ({ page }, info) => {
    await open(page, renderToFile(info.outputPath('auto.html'), autoplayDoc));
    const c = carouselIn(page, 'cAuto');
    await c.getByRole('button', { name: 'Jeda' }).click();
    await page.mouse.move(380, 770);
    await page.clock.runFor(11_000);
    expect(await current(page)).toBe('Ke slide 1');
    await c.getByRole('button', { name: 'Putar' }).click();
    await page.mouse.move(380, 770);
    await page.locator('body').focus();
    await page.clock.runFor(5000);
    await reaches(page, 'Ke slide 2');
  });

  test('autoplay never runs in the canvas preview', async ({ page }, info) => {
    const path = info.outputPath('preview.html');
    writeFileSync(path, renderPage(parseDocument(autoplayDoc), { mode: 'preview' }).html);
    await open(page, pathToFileURL(path).href);
    await page.clock.runFor(16_000);
    expect(await current(page)).toBe('Ke slide 1');
    await expect(carouselIn(page, 'cAuto').locator('[data-lp-play]')).toBeHidden();
  });
});
