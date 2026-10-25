import { Window } from 'happy-dom';
import { describe, expect, it } from 'vitest';
import { byteLength } from '@/lib/renderer/html';
import { asset } from './snippet.generated';

type Call = unknown[];
interface Page {
  win: Window;
  fb: Call[];
  gtag: Call[];
  layer: unknown[];
}

/** A fresh page with stubbed vendors, the given body markup and URL, then the runtime. */
function load(
  markup: string,
  options: { url?: string; attrs?: Record<string, string>; storage?: Record<string, string> } = {},
): Page {
  const win = new Window({ url: options.url ?? 'https://landing.example/' });
  for (const [k, v] of Object.entries(options.storage ?? {})) win.sessionStorage.setItem(k, v);
  for (const [k, v] of Object.entries(options.attrs ?? {})) win.document.body.setAttribute(k, v);
  win.document.body.innerHTML = markup;
  const page: Page = { win, fb: [], gtag: [], layer: [] };
  const w = win as unknown as Record<string, unknown>;
  w.fbq = (...args: unknown[]) => page.fb.push(args);
  w.gtag = (...args: unknown[]) => page.gtag.push(args);
  w.dataLayer = page.layer;
  win.eval(asset.src);
  return page;
}
const hrefs = (page: Page) =>
  Array.from(page.win.document.querySelectorAll('a')).map((a) => a.getAttribute('href'));

describe('page runtime: events', () => {
  it('lp:track Lead calls fbq, gtag, dataLayer and the Ads conversion with one shared event id', () => {
    const page = load('', { attrs: { 'data-lp-gtm': '', 'data-lp-conversion': 'AW-1/abc' } });
    page.win.document.dispatchEvent(
      new page.win.CustomEvent('lp:track', { detail: { name: 'Lead', params: { form: 'x' } } }),
    );
    expect(page.fb).toHaveLength(1);
    const [, name, params, options] = page.fb[0] as [string, string, unknown, { eventID: string }];
    expect([name, params]).toEqual(['Lead', { form: 'x' }]);
    const id = options.eventID;
    expect(id).toMatch(/^[0-9a-z]+-[0-9a-z]{8}$/);
    expect(page.gtag).toEqual([
      ['event', 'generate_lead', { form: 'x', event_id: id }],
      ['event', 'conversion', { send_to: 'AW-1/abc', transaction_id: id }],
    ]);
    expect(page.layer).toEqual([{ event: 'generate_lead', event_id: id, form: 'x' }]);
  });

  it('without GTM or a conversion label only fbq and gtag hear the event', () => {
    const page = load('');
    page.win.document.dispatchEvent(
      new page.win.CustomEvent('lp:track', { detail: { name: 'Lead' } }),
    );
    expect(page.gtag).toHaveLength(1);
    expect(page.layer).toEqual([]);
  });

  it('a carousel click sends Meta and GA params to their vendors with one event id', () => {
    const meta = { content_ids: ['p1'], content_name: 'Botol', value: 149000, currency: 'IDR' };
    const ga = { item_list_id: 'c1', items: [{ item_id: 'p1', item_name: 'Botol', index: 0 }] };
    const page = load(
      `<a data-lp-cta data-lp-event="ViewContent" data-lp-params='${JSON.stringify(meta)}' data-lp-ga='${JSON.stringify(ga)}' href="#x">Beli</a>`,
      { attrs: { 'data-lp-gtm': '' } },
    );
    (page.win.document.querySelector('a') as unknown as HTMLElement).click();
    const [, name, params, options] = page.fb[0] as [string, string, unknown, { eventID: string }];
    expect([name, params]).toEqual(['ViewContent', meta]);
    expect(page.gtag).toEqual([['event', 'select_item', { ...ga, event_id: options.eventID }]]);
    expect(page.layer).toEqual([{ event: 'select_item', event_id: options.eventID, ...ga }]);
  });

  it('AddToCart maps to add_to_cart, and lp:track may carry GA params', () => {
    const page = load('');
    page.win.document.dispatchEvent(
      new page.win.CustomEvent('lp:track', {
        detail: { name: 'AddToCart', params: { value: 1 }, ga: { items: [] } },
      }),
    );
    expect(page.fb[0]!.slice(0, 3)).toEqual(['track', 'AddToCart', { value: 1 }]);
    expect(page.gtag[0]!.slice(0, 2)).toEqual(['event', 'add_to_cart']);
    expect(page.gtag[0]![2]).toMatchObject({ items: [] });
  });

  it('an unparseable data-lp-params sends the event without params', () => {
    const page = load(
      `<a data-lp-cta data-lp-event="ViewContent" data-lp-params="{oops" data-lp-ga="[1" href="#x">Beli</a>`,
    );
    (page.win.document.querySelector('a') as unknown as HTMLElement).click();
    expect(page.fb[0]!.slice(0, 3)).toEqual(['track', 'ViewContent', {}]);
    expect(Object.keys(page.gtag[0]![2] as object)).toEqual(['event_id']);
  });

  it('a click on a CTA with data-lp-event dispatches it', () => {
    const page = load(
      '<a data-lp-cta data-lp-event="Contact" href="#pesan"><span>Tanya</span></a><a data-lp-cta href="#x">No</a>',
    );
    (page.win.document.querySelector('span') as unknown as HTMLElement).click();
    (page.win.document.querySelectorAll('a')[1] as unknown as HTMLElement).click();
    expect(page.fb.map((c) => c.slice(0, 2))).toEqual([['track', 'Contact']]);
    expect(page.gtag[0]!.slice(0, 2)).toEqual(['event', 'contact']);
  });

  it('maps every event to its GA4 name', () => {
    const page = load('');
    for (const name of ['InitiateCheckout', 'ViewContent'])
      page.win.document.dispatchEvent(new page.win.CustomEvent('lp:track', { detail: { name } }));
    expect(page.gtag.map((c) => c[1])).toEqual(['begin_checkout', 'select_item']);
  });
});

describe('page runtime: passthrough', () => {
  it('passthrough adds only missing keys, keeps the hash and skips non-web links', () => {
    const page = load(
      [
        '<a data-lp-cta href="https://shop.example/p?utm_source=google#buy">1</a>',
        '<a data-lp-cta href="https://a.example/?q=a%20b">2</a>',
        '<a data-lp-cta href="https://b.example/path">3</a>',
        '<a data-lp-cta href="#form">4</a>',
        '<a data-lp-cta href="tel:+62811">5</a>',
        '<a href="https://not-a-cta.example/">6</a>',
        '<iframe data-lp-pass src="https://forms.example/f?x=1" title="f"></iframe>',
      ].join(''),
      { url: 'https://landing.example/?utm_source=meta&gclid=x&foo=1' },
    );
    expect(hrefs(page)).toEqual([
      'https://shop.example/p?utm_source=google&gclid=x#buy',
      'https://a.example/?q=a%20b&utm_source=meta&gclid=x',
      'https://b.example/path?utm_source=meta&gclid=x',
      '#form',
      'tel:+62811',
      'https://not-a-cta.example/',
    ]);
    expect(page.win.document.querySelector('iframe')!.getAttribute('src')).toBe(
      'https://forms.example/f?x=1&utm_source=meta&gclid=x',
    );
  });

  it('values are encoded once; long values and more than 20 keys are dropped', () => {
    const keys = Array.from({ length: 25 }, (_, i) => `utm_k${i}=v`).join('&');
    const page = load('<a data-lp-cta href="https://b.example/">1</a>', {
      url: `https://landing.example/?utm_campaign=a%20b%26c&utm_term=${'x'.repeat(501)}&${keys}`,
    });
    const href = hrefs(page)[0]!;
    expect(href).toContain('utm_campaign=a%20b%26c');
    expect(href).not.toContain('utm_term');
    expect(new URL(href).searchParams.size).toBe(20);
  });

  it('parameters survive a reload through sessionStorage, and a storage error is harmless', () => {
    const first = load('', { url: 'https://landing.example/?fbclid=abc' });
    expect(first.win.sessionStorage.getItem('lp-params')).toBe('{"fbclid":"abc"}');
    const again = load('<a data-lp-cta href="https://b.example/">1</a>', {
      storage: { 'lp-params': '{"fbclid":"abc"}' },
    });
    expect(hrefs(again)[0]).toBe('https://b.example/?fbclid=abc');
    const broken = load('<a data-lp-cta href="https://b.example/">1</a>', {
      url: 'https://landing.example/?gbraid=g',
      storage: { 'lp-params': 'not json' },
    });
    expect(hrefs(broken)[0]).toBe('https://b.example/?gbraid=g');
  });

  it('stays within 2304 bytes minified', () => {
    expect(byteLength(asset.min)).toBeLessThanOrEqual(2304);
  });
});
