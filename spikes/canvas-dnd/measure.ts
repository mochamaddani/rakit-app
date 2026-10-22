// Throwaway spike check (docs/DECISIONS.md D-034): measures index.html in headless Chromium.
// Run: pnpm exec tsx spikes/canvas-dnd/measure.ts — prints one PASS/FAIL line per check, exits 1 on any FAIL.
import { chromium, type Browser, type Frame, type Page } from '@playwright/test';

interface Rect {
  id: string;
  top: number;
  height: number;
}
interface Spike {
  rectLatencies: number[];
  drops: number[];
  pointerEventsInFrame: number;
  pointerTypesInFrame: string[];
  origins: string[];
  lineY: number | null;
  dropIndex: number;
  rects: Rect[];
  scrollY: number;
  scrollFrame(dy: number): void;
  requestStats(): void;
}
declare global {
  interface Window {
    __spike: Spike;
  }
}

const URL_OF_PAGE = new URL('./index.html', import.meta.url).href;
let failures = 0;

function report(name: string, pass: boolean, detail: string) {
  if (!pass) failures += 1;
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}: ${detail}`);
}

const percentile = (values: number[], p: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? Number.NaN;
};

async function open(browser: Browser, hasTouch: boolean): Promise<{ page: Page; frame: Frame }> {
  const context = await browser.newContext({ hasTouch, viewport: { width: 1000, height: 700 } });
  const page = await context.newPage();
  await page.goto(URL_OF_PAGE);
  await page.waitForFunction(() => window.__spike?.rects.length === 40);
  const frame = page.frames().find((f) => f !== page.mainFrame());
  if (!frame) throw new Error('no canvas frame');
  return { page, frame };
}

async function scrollFrameTo0(page: Page) {
  await page.evaluate(() => window.__spike.scrollFrame(-1_000_000));
  await page.waitForFunction(() => window.__spike.scrollY === 0);
}

/** Index of the first block whose vertical midpoint is below y, read from the iframe's real DOM. */
const realDropIndex = (frame: Frame, y: number) =>
  frame.evaluate((yy) => {
    const els = [...document.querySelectorAll('[data-id]')];
    const i = els.findIndex((el) => {
      const r = el.getBoundingClientRect();
      return r.top + r.height / 2 > yy;
    });
    return i === -1 ? els.length : i;
  }, y);

async function rectRoundTrip(page: Page) {
  for (let i = 0; i < 20; i++) {
    const before = await page.evaluate(() => window.__spike.rectLatencies.length);
    await page.evaluate(() => window.__spike.scrollFrame(300));
    await page.waitForFunction((n) => window.__spike.rectLatencies.length > n, before);
  }
  const latencies = await page.evaluate(() => window.__spike.rectLatencies.slice(-20));
  const median = percentile(latencies, 0.5);
  const p95 = percentile(latencies, 0.95);
  report(
    'rect round-trip',
    median <= 33,
    `median ${median.toFixed(1)} ms, p95 ${p95.toFixed(1)} ms (20 × scrollBy 300)`,
  );
}

async function mouseDrag(page: Page, frame: Frame) {
  await scrollFrameTo0(page);
  const item = (await page.locator('.item').first().boundingBox())!;
  const box = (await page.locator('#frame').boundingBox())!;
  const target = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(item.x + item.width / 2, item.y + item.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 20 });
  const expected = await realDropIndex(frame, target.y - box.y);
  const shown = await page.evaluate(() => window.__spike.dropIndex);
  // Sample while the button is still down: that is the drag. After the drop the shield goes away
  // and Chrome sends the iframe a normal pointerover for the element now under the cursor.
  await page.evaluate(() => {
    window.__spike.pointerEventsInFrame = -1;
    window.__spike.requestStats();
  });
  await page.waitForFunction(() => window.__spike.pointerEventsInFrame >= 0);
  const during = await page.evaluate(() => window.__spike.pointerEventsInFrame);
  await page.evaluate(() => (window.__spike.pointerEventsInFrame = -1));
  await page.mouse.up();
  await page.waitForFunction(() => window.__spike.pointerEventsInFrame >= 0);
  const { drops, pointerTypesInFrame } = await page.evaluate(() => window.__spike);
  const pass = shown === expected && drops.at(-1) === expected && during === 0;
  report(
    'mouse drag',
    pass,
    `drop index ${drops.at(-1)} (real DOM ${expected}); pointer events in iframe during drag: ${during}; right after the drop: ${JSON.stringify(pointerTypesInFrame)}`,
  );
}

async function autoScroll(page: Page, frame: Frame) {
  await scrollFrameTo0(page);
  const item = (await page.locator('.item').first().boundingBox())!;
  const box = (await page.locator('#frame').boundingBox())!;
  const x = box.x + box.width / 2;
  await page.mouse.move(item.x + item.width / 2, item.y + item.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, box.y + box.height - 10, { steps: 10 });
  const start = await frame.evaluate(() => window.scrollY);
  const t0 = Date.now();
  await page.waitForTimeout(1000);
  await page.mouse.move(x, box.y + box.height / 2, { steps: 2 }); // leave the edge zone: scrolling stops
  const seconds = (Date.now() - t0) / 1000;
  await page.waitForTimeout(150);
  const moved = (await frame.evaluate(() => window.scrollY)) - start;
  const lineY = await page.evaluate(() => window.__spike.lineY);
  const boundaries = await frame.evaluate(() => {
    const els = [...document.querySelectorAll('[data-id]')].map((el) => el.getBoundingClientRect());
    return [...els.map((r) => r.top), els.at(-1)!.bottom];
  });
  const drift = lineY === null ? Infinity : Math.min(...boundaries.map((b) => Math.abs(b - lineY)));
  await page.mouse.up();
  report(
    'auto-scroll',
    moved >= 500 && drift <= 2,
    `scrolled ${Math.round(moved)} px (${Math.round(moved / seconds)} px/s), insertion line ${drift.toFixed(1)} px from a real block boundary`,
  );
}

async function touchDrag(browser: Browser) {
  const { page } = await open(browser, true);
  const cdp = await page.context().newCDPSession(page);
  const item = (await page.locator('.item').first().boundingBox())!;
  const box = (await page.locator('#frame').boundingBox())!;
  const from = { x: item.x + item.width / 2, y: item.y + item.height / 2 };
  const to = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });
  await page.waitForTimeout(300);
  for (let i = 1; i <= 10; i++) {
    const p = { x: from.x + ((to.x - from.x) * i) / 10, y: from.y + ((to.y - from.y) * i) / 10 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [p] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(100);
  const drops = await page.evaluate(() => window.__spike.drops.length);
  const pageScroll = await page.evaluate(() => window.scrollY);
  report(
    'touch long-press drag',
    drops === 1 && pageScroll === 0,
    `drops recorded: ${drops}, parent page scrollY: ${pageScroll}`,
  );
}

async function isolation(page: Page) {
  const contentDocument = await page.evaluate(
    () => (document.getElementById('frame') as HTMLIFrameElement).contentDocument,
  );
  const origins = await page.evaluate(() => [...new Set(window.__spike.origins)]);
  report(
    'isolation',
    contentDocument === null && origins.length === 1 && origins[0] === 'null',
    `contentDocument ${contentDocument === null ? 'null' : 'reachable'}, message origins ${JSON.stringify(origins)}`,
  );
}

async function main() {
  const browser = await chromium.launch();
  try {
    const { page, frame } = await open(browser, false);
    await rectRoundTrip(page);
    await mouseDrag(page, frame);
    await autoScroll(page, frame);
    await touchDrag(browser);
    await isolation(page);
  } finally {
    await browser.close();
  }
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
