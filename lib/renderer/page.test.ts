import { describe, expect, it, vi } from 'vitest';
import { asset as baseCss } from '@/lib/renderer/base.generated';
import { byteLength } from '@/lib/renderer/html';
import { renderPage } from '@/lib/renderer/page';
import { parseDocument, type PageDocument } from '@/lib/schema/document';
import { validateHtml } from '@/tests/helpers/validate-html';

const doc = parseDocument({
  schemaVersion: 1,
  settings: { seo: { title: 'Botol <Anti> Bocor', description: 'Desc "x"' } },
  sections: [
    {
      id: 'sHero',
      anchor: 'top',
      style: { tone: 'primary' },
      blocks: [{ id: 'bHero', type: 'hero', props: { headline: 'Halo [REPLACE: nama produk]' } }],
    },
  ],
});

describe('renderPage', () => {
  it('produces a complete single-file document', () => {
    const { html } = renderPage(doc, { mode: 'export' });
    expect(
      html.startsWith(
        '<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Botol &lt;Anti&gt; Bocor</title>',
      ),
    ).toBe(true);
    expect(html).toContain('<meta name="description" content="Desc &quot;x&quot;">');
    expect(html).toContain('<meta name="robots" content="noindex,nofollow">');
    expect(html).toContain(
      '<section id="top" class="lp-s lp-tone-primary lp-pad-md"><div class="lp-c lp-w-normal"><div class="lp-b" id="b-bHero">',
    );
    expect(html.endsWith('</main></body></html>')).toBe(true);
  });
  it('has one style element, only the CSS of present types, and no script when nothing needs JS', () => {
    const { html } = renderPage(doc, { mode: 'export' });
    expect(html.match(/<style>/g)).toHaveLength(1);
    expect(html).toContain('.lp-hero');
    expect(html).not.toContain('<script');
  });
  it('omits robots when noindex is off and falls back to a localized title', () => {
    const d = parseDocument({ ...doc, settings: { lang: 'en', seo: { noindex: false } } });
    const { html } = renderPage(d, { mode: 'export' });
    expect(html).not.toContain('name="robots"');
    expect(html).toContain('<title>Untitled</title>');
  });
  it('marks sections and blocks for the editor overlay only in preview mode', () => {
    expect(renderPage(doc, { mode: 'preview' }).html).toContain('data-lp-section="sHero"');
    expect(renderPage(doc, { mode: 'preview' }).html).toContain(
      'data-lp-block="bHero" data-lp-type="hero"',
    );
    expect(renderPage(doc, { mode: 'export' }).html).not.toMatch(/data-lp-(block|section|type)/);
  });
  it('highlights [REPLACE: …] placeholders in preview but not in export', () => {
    expect(renderPage(doc, { mode: 'preview' }).html).toContain(
      '<mark class="lp-replace">[REPLACE: nama produk]</mark>',
    );
    const exported = renderPage(doc, { mode: 'export' }).html;
    expect(exported).toContain('Halo [REPLACE: nama produk]');
    expect(exported).not.toContain('lp-replace');
  });
  it('is deterministic and never reads the clock or randomness', () => {
    const now = vi.spyOn(Date, 'now');
    const rnd = vi.spyOn(Math, 'random');
    expect(renderPage(doc, { mode: 'export' }).html).toBe(
      renderPage(structuredClone(doc), { mode: 'export' }).html,
    );
    expect(now).not.toHaveBeenCalled();
    expect(rnd).not.toHaveBeenCalled();
  });
  it('reports total and per-block sizes', () => {
    const r = renderPage(doc, { mode: 'export' });
    expect(r.bytes).toBe(byteLength(r.html));
    expect(r.jsBytes).toBe(0);
    expect(r.blocks).toEqual([
      { blockId: 'bHero', type: 'hero', sectionId: 'sHero', bytes: expect.any(Number) },
    ]);
  });
  it('skips unknown block types with a warning instead of crashing', () => {
    const broken = structuredClone(doc) as unknown as {
      sections: { blocks: { type: string }[] }[];
    };
    broken.sections[0]!.blocks[0]!.type = 'nope';
    const r = renderPage(broken as unknown as PageDocument, { mode: 'export' });
    expect(r.warnings).toEqual(['Unknown block type "nope" in block bHero was skipped']);
  });
  it('produces valid HTML in both modes', async () => {
    expect(await validateHtml(renderPage(doc, { mode: 'export' }).html)).toEqual([]);
    expect(await validateHtml(renderPage(doc, { mode: 'preview' }).html)).toEqual([]);
  });
  it('keeps base CSS within its 4 KB budget', () => {
    expect(byteLength(baseCss.min)).toBeLessThanOrEqual(4096);
  });
  it('matches the export snapshot', async () => {
    await expect(renderPage(doc, { mode: 'export' }).html).toMatchFileSnapshot(
      './__snapshots__/page.hero-only.export.html',
    );
  });
});
