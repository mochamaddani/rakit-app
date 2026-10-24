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

const ALLOWED = ['https://connect.facebook.net/', 'https://www.googletagmanager.com/'];

/** Routes vendor scripts to stubs; returns the list of other non-file requests the page made. */
export async function stubVendors(page: Page): Promise<string[]> {
  const unexpected: string[] = [];
  await page.route('https://connect.facebook.net/**', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: FB_STUB }),
  );
  await page.route('https://www.googletagmanager.com/**', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: '' }),
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
