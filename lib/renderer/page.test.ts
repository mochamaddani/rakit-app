import { describe, expect, it, vi } from 'vitest';
import { asset as baseCss } from '@/lib/renderer/base.generated';
import { byteLength, html } from '@/lib/renderer/html';
import {
  createRenderEnv,
  footerStart,
  renderBlock,
  renderBody,
  renderPage,
} from '@/lib/renderer/page';
import { parseDocument, type PageDocument } from '@/lib/schema/document';
import { exampleDocument } from '@/tests/fixtures/example-document';
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

describe('footer landmark placement', () => {
  const sections = [
    { id: 'sHero', blocks: [{ id: 'bHero', type: 'hero', props: { headline: 'Halo' } }] },
    { id: 'sFoot', blocks: [{ id: 'bFoot', type: 'footer', props: {} }] },
  ];
  it('renders trailing footer sections after </main>', () => {
    const { html } = renderPage(parseDocument({ schemaVersion: 1, sections }), { mode: 'export' });
    expect(html).toContain(
      '</main><div id="s-sFoot" class="lp-s lp-tone-base lp-pad-md"><div class="lp-c lp-w-normal"><div class="lp-b" id="b-bFoot"><footer class="lp-footer">',
    );
  });
  it('keeps a footer section that is followed by other content inside <main>', () => {
    const { html } = renderPage(
      parseDocument({ schemaVersion: 1, sections: [sections[1], sections[0]] }),
      { mode: 'export' },
    );
    expect(html).toContain('<main><section id="s-sFoot"');
    expect(html).not.toContain('</main><div');
  });
});

describe('block-level API', () => {
  const example = parseDocument(exampleDocument);
  it('renderBlock returns exactly the markup renderPage emits for each block', () => {
    for (const mode of ['export', 'preview'] as const) {
      const page = renderPage(example, { mode }).html;
      const env = createRenderEnv(example, mode);
      example.sections.forEach((section, sectionIndex) =>
        section.blocks.forEach((block, indexInSection) => {
          const markup = renderBlock(env, block, {
            sectionId: section.id,
            sectionIndex,
            indexInSection,
          });
          expect(page).toContain(markup!.value);
        }),
      );
    }
  });
  it('renderBody with slots keeps every block in order and the footer after </main>', () => {
    const env = createRenderEnv(example, 'preview');
    const body = renderBody(
      example,
      env,
      (block) => html`<div data-lp-slot="${block.id}"></div>`,
    ).value;
    const ids = example.sections.flatMap((s) => s.blocks.map((b) => b.id));
    expect([...body.matchAll(/data-lp-slot="([^"]+)"/g)].map((m) => m[1])).toEqual(ids);
    expect(body.startsWith('<main>')).toBe(true);
    expect(body.indexOf('</main>')).toBeLessThan(body.indexOf(`data-lp-slot="${ids.at(-1)}"`));
  });
  it('footerStart finds only trailing footer-only sections', () => {
    const s = (id: string, type: string, props: unknown = {}) => ({
      id,
      blocks: [{ id: `b${id}`, type, props }],
    });
    const hero = { headline: 'Hi' };
    const sections = (...list: unknown[]) => parseDocument({ schemaVersion: 1, sections: list });
    expect(footerStart(sections(s('1', 'hero', hero), s('2', 'footer')))).toBe(1);
    expect(footerStart(sections(s('1', 'footer'), s('2', 'hero', hero)))).toBe(2);
    expect(footerStart(sections())).toBe(0);
  });
});
