import { expect, test } from '@playwright/test';
import { perfDocument } from '@/tests/fixtures/perf-document';
import { ensureOwner, openEditor, resetOwnerPages, seedPage, signIn } from './helpers';

test.beforeAll(ensureOwner);
test.beforeEach(async ({ page }) => {
  await resetOwnerPages();
  await signIn(page);
});

test('a 40-block page with two 20-item carousels stays responsive while typing', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const frame = await openEditor(page, await seedPage({ name: 'Perf', document: perfDocument() }));
  await expect(frame.locator('[data-lp-block]')).toHaveCount(40, { timeout: 30_000 });
  const carousel = frame.locator('[data-lp-type="product-carousel"]').nth(1);
  await carousel.scrollIntoViewIfNeeded();
  await carousel.click({ position: { x: 8, y: 8 } });
  await expect(page.getByTestId('canvas-selection')).toContainText('Product Carousel');
  await page.evaluate(() => {
    (
      window as unknown as { __lpCanvasMetrics: { syncLatencies: number[] } }
    ).__lpCanvasMetrics.syncLatencies = [];
  });
  // exact: "Subheading" contains "heading".
  const heading = page.getByLabel('Heading', { exact: true });
  await heading.click();
  await heading.press('End');
  const typed = ' tiga puluh karakter tambahan!';
  await heading.pressSequentially(typed, { delay: 25 });
  await expect(carousel.locator('h2')).toContainText(typed.trim(), { timeout: 1000 });
  const latencies = await page.evaluate(
    () =>
      (window as unknown as { __lpCanvasMetrics: { syncLatencies: number[] } }).__lpCanvasMetrics
        .syncLatencies,
  );
  const sorted = [...latencies].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)]!;
  test.info().annotations.push({
    type: 'sync latency',
    description: `${sorted.length} syncs: p95 ${p95.toFixed(1)} ms, max ${sorted.at(-1)!.toFixed(1)} ms`,
  });
  expect(sorted.length).toBeGreaterThan(5);
  expect(p95).toBeLessThan(100);
  expect(sorted.at(-1)!).toBeLessThan(250);
});
