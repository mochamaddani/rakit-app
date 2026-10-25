import { expect, test } from '@playwright/test';
import { renderToFile } from './render-to-file';

const page = (runScripts: boolean) =>
  renderToFile(`test-results/custom-html/${runScripts ? 'on' : 'off'}.html`, {
    schemaVersion: 1,
    sections: [
      {
        id: 's1',
        blocks: [
          {
            id: 'c1',
            type: 'custom-html',
            props: {
              runScripts,
              html: '<p id="promo">Promo</p><img src="x.png" alt="x" onerror="window.__canary=(window.__canary||0)+1"><script>window.__canary=(window.__canary||0)+1</script>',
            },
          },
        ],
      },
    ],
  });

const canary = (p: import('@playwright/test').Page) =>
  p.evaluate(() => (window as unknown as { __canary?: number }).__canary);

test('with scripts off, a pasted script never runs', async ({ page: tab }) => {
  await tab.goto(page(false));
  await tab.waitForLoadState('load');
  await expect(tab.locator('#promo')).toHaveText('Promo');
  expect(await canary(tab)).toBeUndefined();
  expect(await tab.locator('script').count()).toBe(0);
});

test('with scripts on, the code runs verbatim', async ({ page: tab }) => {
  await tab.goto(page(true));
  await tab.waitForLoadState('load');
  // The inline script runs once; the broken image's handler runs too, because the code is verbatim.
  await expect.poll(() => canary(tab)).toBe(2);
});
