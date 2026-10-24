import { expect, test, type Page } from '@playwright/test';
import { trackingDocument } from '@/tests/fixtures/example-document';
import { STORELINK_SNIPPET } from '@/tests/fixtures/forms';
import { renderToFile } from './render-to-file';
import { dataLayer, fbCalls, stubVendors } from './vendor-stubs';

/** A Tally stand-in whose button posts Tally's submit message to the page. */
async function stubTally(page: Page) {
  await page.route('https://tally.so/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><title>Tally</title><button type="button" onclick="parent.postMessage(JSON.stringify({event:'Tally.FormSubmitted',payload:{}}),'*')">Kirim</button>`,
    }),
  );
}

const leads = async (page: Page) => (await fbCalls(page)).filter((call) => call[1] === 'Lead');

test('the form iframe gets UTM params; a submit fires Lead to Meta, GA4 and Ads', async ({
  page,
}, info) => {
  await stubVendors(page);
  await stubTally(page);
  const url = renderToFile(info.outputPath('form.html'), trackingDocument);
  await page.goto(`${url}?utm_source=meta&gclid=abc`);
  const frame = page.locator('iframe.lp-form__frame');
  await expect(frame).toHaveAttribute(
    'src',
    'https://tally.so/embed/abc?transparentBackground=1&utm_source=meta&gclid=abc',
  );
  await frame.scrollIntoViewIfNeeded();
  await page.frameLocator('iframe.lp-form__frame').getByRole('button', { name: 'Kirim' }).click();
  await expect.poll(() => leads(page)).toHaveLength(1);
  const [lead] = await leads(page);
  const id = (lead![3] as { eventID: string }).eventID;
  const layer = await dataLayer(page);
  expect(layer).toContainEqual(['event', 'generate_lead', { event_id: id }]);
  expect(layer).toContainEqual([
    'event',
    'conversion',
    { send_to: 'AW-123456789/abcdEF12', transaction_id: id },
  ]);
});

test('a page script posting the same message does not', async ({ page }, info) => {
  await stubVendors(page);
  await stubTally(page);
  await page.goto(renderToFile(info.outputPath('form.html'), trackingDocument));
  await expect.poll(() => fbCalls(page)).toContainEqual(['init', '1234567890']);
  await page.evaluate(() =>
    window.postMessage(JSON.stringify({ event: 'Tally.FormSubmitted', payload: {} }), '*'),
  );
  await page.waitForTimeout(300);
  expect(await leads(page)).toEqual([]);
});

test("a Storelink snippet runs once and its widget shares the page's pixel", async ({
  page,
}, info) => {
  const contacted: string[] = [];
  page.on('request', (request) => {
    if (/storelink\.id|gabung\.id/.test(request.url())) contacted.push(request.url());
  });
  await stubVendors(page);
  // Stand-ins that behave like Storelink's loader and widget (read 2026-10-24): the loader puts
  // div#evf-embed-widget before #evf-widget-script and loads the widget into the page itself.
  await page.route('https://srstorebdg.storelink.id/script/embed', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: `window.embedEvfScript = function (params) {
  var x = document.createElement('div'); x.id = 'evf-embed-widget'; x.textContent = 'Loading Widget...';
  var y = document.getElementById('evf-widget-script'); y.parentNode.insertBefore(x, y);
  setTimeout(function () {
    var t = document.createElement('script'); t.async = true;
    t.src = 'https://cdn.gabung.id/form-builder/embed/bundle-test.js';
    var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(t, s);
  }, params.delayLoad || 0);
};`,
    }),
  );
  await page.route('https://cdn.gabung.id/**', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: `(function () {
  var root = document.getElementById('evf-embed-widget');
  root.innerHTML = '<button type="button">Pesan</button>';
  root.querySelector('button').addEventListener('click', function () {
    fbq('init', '1234567890');
    fbq('trackSingle', '1234567890', 'Purchase', { value: 1 }, { eventID: 'x' });
  });
})();`,
    }),
  );
  const fbevents: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('fbevents.js')) fbevents.push(request.url());
  });
  const doc = {
    schemaVersion: 1,
    settings: { tracking: { metaPixelId: '1234567890' } },
    sections: [
      {
        id: 'sOrder',
        anchor: 'pesan',
        blocks: [
          { id: 'bForm', type: 'form-embed', props: { mode: 'snippet', code: STORELINK_SNIPPET } },
        ],
      },
    ],
  };
  await page.goto(renderToFile(info.outputPath('storelink.html'), doc));
  const widget = page.locator('#pesan #evf-embed-widget');
  await widget.getByRole('button', { name: 'Pesan' }).click();
  await expect
    .poll(() => fbCalls(page))
    .toContainEqual(['trackSingle', '1234567890', 'Purchase', { value: 1 }, { eventID: 'x' }]);
  const calls = await fbCalls(page);
  expect(calls.filter((call) => call[1] === 'PageView')).toHaveLength(1);
  expect(calls.filter((call) => call[1] === 'Lead')).toEqual([]);
  expect(fbevents).toHaveLength(1);
  expect(
    contacted.every((url) => url.includes('/script/embed') || url.includes('bundle-test')),
  ).toBe(true);
});
