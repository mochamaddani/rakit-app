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
