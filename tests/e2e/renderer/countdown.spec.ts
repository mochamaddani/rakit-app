import { expect, test, type Browser } from '@playwright/test';
import { renderToFile } from './render-to-file';

// The deadline: 1 Nov 2026, 00:00 WIB (UTC+7) = 31 Oct 2026, 17:00 UTC.
const END = Date.parse('2026-11-01T00:00:00+07:00');

const page = (props: Record<string, unknown>, name: string) =>
  renderToFile(`test-results/countdown/${name}.html`, {
    schemaVersion: 1,
    settings: { lang: 'id' },
    sections: [
      {
        id: 's1',
        blocks: [
          { id: 'h1', type: 'hero', props: { headline: 'Promo' } },
          {
            id: 'c1',
            type: 'countdown',
            props: { heading: 'Berakhir dalam', endsAt: '2026-11-01T00:00', ...props },
          },
        ],
      },
    ],
  });

const digits = (p: import('@playwright/test').Page) =>
  p.locator('.lp-countdown__n').allTextContents();

async function openAt(browser: Browser, timezoneId: string, time: number, url: string) {
  const context = await browser.newContext({ timezoneId });
  const tab = await context.newPage();
  await tab.clock.install({ time });
  await tab.clock.pauseAt(time);
  await tab.goto(url);
  return tab;
}

test('a visitor in New York sees the same remaining time as one in Jakarta', async ({
  browser,
}) => {
  const url = page({}, 'zones');
  const at = END - (3 * 86400 + 4 * 3600 + 5 * 60 + 6) * 1000;
  const jakarta = await openAt(browser, 'Asia/Jakarta', at, url);
  const newYork = await openAt(browser, 'America/New_York', at, url);
  await expect.poll(() => digits(jakarta)).toEqual(['03', '04', '05', '06']);
  expect(await digits(newYork)).toEqual(['03', '04', '05', '06']);
});

test('ticks down each second and shows the message at zero', async ({ page: tab }) => {
  await tab.clock.install({ time: END - 3000 });
  await tab.clock.pauseAt(END - 3000);
  await tab.goto(page({}, 'ticks'));
  await expect.poll(() => digits(tab)).toEqual(['00', '00', '00', '03']);
  await tab.clock.runFor(1000);
  await expect.poll(() => digits(tab)).toEqual(['00', '00', '00', '02']);
  await tab.clock.runFor(2000);
  await expect(tab.getByText('Promo telah berakhir')).toBeVisible();
  await expect(tab.locator('.lp-countdown__units')).toBeHidden();
});

test('an ended countdown loads in its end state', async ({ page: tab }) => {
  await tab.clock.install({ time: END + 60_000 });
  await tab.goto(page({ onEnd: 'hide' }, 'ended'), { waitUntil: 'domcontentloaded' });
  await expect(tab.locator('#b-c1')).toBeHidden();
  await expect(tab.getByRole('heading', { name: 'Promo' })).toBeVisible();
});

test('reduced motion still updates the numbers', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const tab = await context.newPage();
  await tab.clock.install({ time: END - 5000 });
  await tab.clock.pauseAt(END - 5000);
  await tab.goto(page({}, 'reduced'));
  await expect.poll(() => digits(tab)).toEqual(['00', '00', '00', '05']);
  await tab.clock.runFor(1000);
  await expect.poll(() => digits(tab)).toEqual(['00', '00', '00', '04']);
});
