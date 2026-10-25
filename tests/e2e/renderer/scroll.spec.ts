import { expect, test, type Page } from '@playwright/test';
import { exampleDocument } from '@/tests/fixtures/example-document';
import { renderToFile } from './render-to-file';

/** Clicks the hero CTA (a link to #order) and returns every scrollY seen until the section is reached. */
async function scrollPositions(page: Page): Promise<number[]> {
  await page.evaluate(() => {
    const seen: number[] = [];
    (window as unknown as { seen: number[] }).seen = seen;
    const sample = () => {
      seen.push(window.scrollY);
      requestAnimationFrame(sample);
    };
    sample();
  });
  await page.getByRole('link', { name: 'Pesan Sekarang' }).first().click();
  await expect(page).toHaveURL(/#order$/);
  // The section is last, so the page may stop short of putting it at the top.
  const target = await page.locator('#order').evaluate((el) => {
    const top = el.getBoundingClientRect().top + window.scrollY;
    return Math.round(Math.min(top, document.documentElement.scrollHeight - window.innerHeight));
  });
  await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBe(target);
  return page.evaluate(() => (window as unknown as { seen: number[] }).seen);
}

const between = (positions: number[]) => {
  const end = positions.at(-1)!;
  return new Set(positions.filter((y) => y > 0 && y < end)).size;
};

test('a button that links to a section scrolls there smoothly', async ({ page }, info) => {
  await page.goto(renderToFile(info.outputPath('scroll.html'), exampleDocument));
  expect(between(await scrollPositions(page))).toBeGreaterThan(2);
});

test('with reduced motion it jumps straight to the section', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(renderToFile(info.outputPath('scroll.html'), exampleDocument));
  expect(between(await scrollPositions(page))).toBe(0);
});
