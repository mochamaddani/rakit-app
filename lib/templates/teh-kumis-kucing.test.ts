import { describe, expect, it } from 'vitest';
import { preExportChecklist } from '@/lib/export/checklist';
import { renderPage } from '@/lib/renderer/page';
import { parseDocument } from '@/lib/schema/document';
import { STORELINK_SNIPPET } from '@/tests/fixtures/forms';
import { validateHtml } from '@/tests/helpers/validate-html';
import { TEH_KUMIS_KUCING_IMAGES, tehKumisKucingDocument } from './teh-kumis-kucing';

const images = Object.fromEntries(
  TEH_KUMIS_KUCING_IMAGES.map((key) => [
    key,
    { src: `https://cdn.example/${key}-1600.webp`, width: 1600, height: 1200, assetId: key },
  ]),
) as Parameters<typeof tehKumisKucingDocument>[0];
const doc = parseDocument(tehKumisKucingDocument(images));
const html = renderPage(doc, { mode: 'export' }).html;
const WA =
  'https://wa.me/6287891570167?text=Halo%20kak%2C%20saya%20mau%20beli%20Teh%20Kumis%20Kucingnya%20dong.';

describe('Teh Kumis Kucing page', () => {
  it('parses and exports valid HTML', async () => {
    expect(await validateHtml(html)).toEqual([]);
    expect(html).toContain('<title>Teh Kumis Kucing — Teh Herbal Alami</title>');
  });

  it('keeps the version 1 WhatsApp buttons, which fire Lead', () => {
    const buttons = html.match(/<a class="lp-btn[^>]*>Pesan Sekarang<\/a>/g) ?? [];
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      expect(button).toContain(`href="${WA.replace(/&/g, '&amp;')}"`);
      expect(button).toContain('target="_blank"');
      expect(button).toContain('data-lp-event="Lead"');
    }
  });

  it('adds the Storelink order form in its own #pesan section', () => {
    expect(html).toContain('<section id="pesan"');
    expect(html).toContain(STORELINK_SNIPPET);
    expect(html).toContain('Lengkapi Data Pemesanan');
  });

  it('carries the tracking ids and every image', () => {
    expect(html).toContain('fbq("init","480125371067808")');
    expect(html).toContain('gtag("config","G-RJD8R8GZHW")');
    expect(html).toContain('data-lp-conversion="AW-18391075496/LkwNCLne3OMcEKiVxsFE"');
    expect(html).toContain('GTM-WMCLH9HB');
    for (const key of TEH_KUMIS_KUCING_IMAGES)
      expect(html).toContain(`cdn.example/${key}-1600.webp`);
  });

  it('the checklist only asks for what the original page never had', () => {
    const items = preExportChecklist({
      doc,
      tracking: true,
      bytes: html.length,
      images: { failed: 0, large: 0 },
    });
    expect(items.map((item) => item.id)).toEqual(['privacy', 'formSelf', 'customCode']);
  });
});
