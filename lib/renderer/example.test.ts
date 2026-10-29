import { describe, expect, it } from 'vitest';
import { renderPage } from '@/lib/renderer/page';
import { parseDocument } from '@/lib/schema/document';
import { exampleDocument } from '@/tests/fixtures/example-document';
import { validateHtml } from '@/tests/helpers/validate-html';

describe('example document', () => {
  const doc = parseDocument(exampleDocument);
  it('renders to valid, self-contained HTML', async () => {
    const { html } = renderPage(doc, { mode: 'export' });
    expect(await validateHtml(html)).toEqual([]);
    expect(html).not.toMatch(/<(script|img|iframe)[^>]+src="https?:/);
    expect(html).not.toMatch(/<link[^>]+stylesheet/);
    expect(html.match(/<script>/g)).toHaveLength(1);
  });
  it('matches the export and preview snapshots', async () => {
    await expect(renderPage(doc, { mode: 'export' }).html).toMatchFileSnapshot(
      './__snapshots__/example.export.html',
    );
    await expect(renderPage(doc, { mode: 'preview' }).html).toMatchFileSnapshot(
      './__snapshots__/example.preview.html',
    );
  });
  it('a page using every snippet ships at most 10,240 bytes of inline JS', () => {
    // Tracking ids make the page runtime ship too; the example uses every block snippet.
    const tracked = parseDocument({
      ...exampleDocument,
      settings: { ...exampleDocument.settings, tracking: { metaPixelId: '1234567890' } },
    });
    const { jsBytes, html } = renderPage(tracked, { mode: 'export' });
    for (const marker of [
      'data-lp-carousel',
      'data-lp-countdown',
      'data-lp-video',
      'data-lp-sticky',
      'lp:track',
    ]) {
      expect(html, marker).toContain(marker);
    }
    expect(jsBytes).toBeLessThanOrEqual(10_240);
  });
});
