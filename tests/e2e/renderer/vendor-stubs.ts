import type { Page } from '@playwright/test';

// Exported pages load real vendor scripts; these stubs stand in for them so tests can read every
// call. fbevents.js drains the base code's queue into window.__fb and records later calls there.
const FB_STUB = `window.__fb = [];
(function () {
  var queued = fbq.queue.slice();
  fbq.queue.length = 0;
  fbq.callMethod = function () { window.__fb.push([].slice.call(arguments)); };
  queued.forEach(function (args) { fbq.callMethod.apply(fbq, args); });
})();`;

const ALLOWED = [
  'https://connect.facebook.net/',
  'https://www.googletagmanager.com/',
  'https://tally.so/',
];

/** Routes vendor scripts (and the fixture's Tally form) to stubs; returns any other requests made. */
export async function stubVendors(page: Page): Promise<string[]> {
  const unexpected: string[] = [];
  await page.route('https://connect.facebook.net/**', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: FB_STUB }),
  );
  await page.route('https://www.googletagmanager.com/**', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: '' }),
  );
  // The fixture's order form; specs that submit it route tally.so again (the newest route wins).
  await page.route('https://tally.so/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Tally</title>' }),
  );
  page.on('request', (request) => {
    const url = request.url();
    if (/^(file|data|about|blob):/.test(url) || ALLOWED.some((p) => url.startsWith(p))) return;
    unexpected.push(url);
  });
  return unexpected;
}

export const fbCalls = (page: Page) =>
  page.evaluate(() => (window as unknown as { __fb?: unknown[][] }).__fb ?? []);

/** dataLayer entries, with gtag's `arguments` objects turned into arrays. */
export const dataLayer = (page: Page) =>
  page.evaluate(() =>
    ((window as unknown as { dataLayer?: unknown[] }).dataLayer ?? []).map((entry) =>
      Object.prototype.toString.call(entry) === '[object Arguments]'
        ? Array.from(entry as ArrayLike<unknown>)
        : entry,
    ),
  );

/** Keeps CTA clicks on the page (the runtime still sees them: it listens on document). */
export const stayOnClick = (page: Page) =>
  page.evaluate(() => window.addEventListener('click', (event) => event.preventDefault(), true));

/**
 * Stand-ins that behave like Storelink's loader and widget (read 2026-10-24, D-048): the loader
 * puts div#evf-embed-widget before #evf-widget-script and loads the widget into the page itself;
 * the widget's "Pesan" button fires Storelink's own pixel event on the page's fbq.
 */
export async function stubStorelink(page: Page): Promise<void> {
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
}
