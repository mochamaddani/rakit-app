import { expect, test } from '@playwright/test';
import { trackingDocument } from '@/tests/fixtures/example-document';
import { renderToFile } from './render-to-file';
import { dataLayer, fbCalls, stayOnClick, stubVendors } from './vendor-stubs';

test('PageView fires once with an event id; GA4 and Ads are configured', async ({ page }, info) => {
  const unexpected = await stubVendors(page);
  await page.goto(renderToFile(info.outputPath('tracking.html'), trackingDocument));
  await expect.poll(() => fbCalls(page)).toContainEqual(['init', '1234567890']);
  const pageViews = (await fbCalls(page)).filter((call) => call[1] === 'PageView');
  expect(pageViews).toHaveLength(1);
  expect(pageViews[0]).toEqual([
    'track',
    'PageView',
    {},
    { eventID: expect.stringMatching(/^[0-9a-z]+-[0-9a-z]{8}$/) },
  ]);
  const layer = await dataLayer(page);
  expect(layer).toContainEqual(['config', 'G-TEST1234']);
  expect(layer).toContainEqual(['config', 'AW-123456789']);
  expect(layer).toContainEqual(expect.objectContaining({ event: 'gtm.js' }));
  expect(unexpected).toEqual([]);
});

test('a CTA with an event fires it to Meta, GA4 and GTM', async ({ page }, info) => {
  await stubVendors(page);
  await page.goto(renderToFile(info.outputPath('tracking.html'), trackingDocument));
  await expect.poll(() => fbCalls(page)).toContainEqual(['init', '1234567890']);
  await stayOnClick(page);
  await page.getByRole('link', { name: 'Beli di toko' }).click();
  const contact = (await fbCalls(page)).find((call) => call[1] === 'Contact');
  expect(contact).toEqual(['track', 'Contact', {}, { eventID: expect.any(String) }]);
  const id = (contact![3] as { eventID: string }).eventID;
  const layer = await dataLayer(page);
  expect(layer).toContainEqual(['event', 'contact', { event_id: id }]);
  expect(layer).toContainEqual({ event: 'contact', event_id: id });
});

test('UTM and click ids reach outbound CTAs', async ({ page }, info) => {
  await stubVendors(page);
  const url = renderToFile(info.outputPath('tracking.html'), trackingDocument);
  await page.goto(`${url}?utm_source=meta&utm_campaign=teh&gclid=abc`);
  await expect(page.getByRole('link', { name: 'Beli di toko' })).toHaveAttribute(
    'href',
    'https://shop.example/p?utm_source=google&utm_campaign=teh&gclid=abc#buy',
  );
  await expect(page.getByRole('link', { name: 'Pesan' })).toHaveAttribute('href', '#pesan');
});

test('a carousel card CTA fires ViewContent and select_item with the item and keeps UTM passthrough', async ({
  page,
}, info) => {
  await stubVendors(page);
  const doc = structuredClone(trackingDocument) as unknown as {
    sections: { id: string; blocks: unknown[] }[];
  };
  doc.sections.splice(1, 0, {
    id: 'sCards',
    blocks: [
      {
        id: 'cCards',
        type: 'product-carousel',
        props: {
          heading: 'Pilih paket',
          items: [
            {
              id: 'p1',
              title: 'Paket Hemat',
              price: 149000,
              cta: {
                label: 'Ambil paket',
                link: { kind: 'url', url: 'https://shop.example/hemat' },
              },
            },
          ],
        },
      },
    ],
  });
  const url = renderToFile(info.outputPath('cards.html'), doc);
  await page.goto(`${url}?utm_source=meta&fbclid=f1`);
  await expect.poll(() => fbCalls(page)).toContainEqual(['init', '1234567890']);
  const cta = page.getByRole('link', { name: 'Ambil paket' });
  await expect(cta).toHaveAttribute('href', 'https://shop.example/hemat?utm_source=meta&fbclid=f1');
  await stayOnClick(page);
  await cta.click();
  const view = (await fbCalls(page)).find((call) => call[1] === 'ViewContent');
  expect(view).toEqual([
    'track',
    'ViewContent',
    {
      content_ids: ['p1'],
      content_name: 'Paket Hemat',
      content_type: 'product',
      value: 149000,
      currency: 'IDR',
    },
    { eventID: expect.any(String) },
  ]);
  const id = (view![3] as { eventID: string }).eventID;
  const items = [{ item_id: 'p1', item_name: 'Paket Hemat', price: 149000, index: 0 }];
  expect(await dataLayer(page)).toContainEqual([
    'event',
    'select_item',
    { item_list_id: 'cCards', item_list_name: 'Pilih paket', items, event_id: id },
  ]);
});
