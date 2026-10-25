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
import { exampleDocument, trackingDocument } from '@/tests/fixtures/example-document';
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
    const tracked = parseDocument(trackingDocument);
    expect(renderPage(tracked, { mode: 'export' }).html).toBe(
      renderPage(structuredClone(tracked), { mode: 'export' }).html,
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

describe('tracking and social tags', () => {
  const tracked = parseDocument(trackingDocument);
  const exported = (options: { tracking?: boolean } = {}) =>
    renderPage(tracked, { mode: 'export', ...options }).html;

  it('preview never carries vendor tags, custom code or the page runtime', () => {
    const preview = renderPage(tracked, { mode: 'preview' }).html;
    for (const needle of [
      'fbq',
      'googletagmanager',
      'lp-head-code',
      'lp-body-code',
      // The page runtime (the Form Embed's own snippet may ship; it has no form to act on here).
      'lp-params',
      'og:',
      '<iframe',
      'tally.so',
    ])
      expect(preview, needle).not.toContain(needle);
    expect(preview).not.toContain('data-lp-gtm');
  });

  it('export carries vendor tags, custom code, body attributes and the page runtime', () => {
    const html = exported();
    expect(html).toContain('fbq("init","1234567890")');
    expect(html).toContain('<meta name="lp-head-code" content="1"></head>');
    expect(html).toContain(
      '<body data-lp-gtm data-lp-conversion="AW-123456789/abcdEF12"><noscript>',
    );
    expect(html).toMatch(/<div id="lp-body-code"><\/div><script>/);
    expect(html).toContain('lp:track');
    expect(html).toContain('data-lp-event="Contact"');
  });

  it('export with tracking off drops vendor tags and custom code but keeps passthrough', () => {
    const html = exported({ tracking: false });
    // The runtime itself mentions fbq/gtag; it only calls them when the vendor code defined them.
    for (const needle of [
      'fbq("init"',
      'googletagmanager',
      'lp-head-code',
      'lp-body-code',
      '<body data-lp',
    ])
      expect(html, needle).not.toContain(needle);
    expect(html).toContain('lp-params');
  });

  it('export head order and social tags', () => {
    const html = exported();
    const head = html.slice(0, html.indexOf('</head>'));
    const order = [
      '<meta name="robots"',
      '<meta property="og:title" content="Teh Kumis Kucing">',
      '<meta property="og:description" content="Teh herbal untuk teman santai.">',
      '<meta property="og:type" content="website">',
      '<meta property="og:image" content="https://cdn.example/og.webp">',
      '<link rel="icon" href="data:image/svg+xml;base64,',
      '<style>',
      'fbq(',
      '<meta name="lp-head-code"',
    ].map((needle) => head.indexOf(needle));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);

    const relative = parseDocument({
      ...trackingDocument,
      settings: {
        ...trackingDocument.settings,
        seo: { ogImage: { src: '/og.webp' }, favicon: { src: 'javascript:alert(1)' } },
      },
    });
    const other = renderPage(relative, { mode: 'export' }).html;
    expect(other).not.toContain('og:image');
    expect(other).not.toContain('rel="icon"');
    expect(other).toContain('<meta property="og:title" content="Tanpa judul">');
  });

  it('pages whose CTAs only jump within the page ship no runtime', () => {
    const anchorOnly = parseDocument({
      schemaVersion: 1,
      sections: [
        {
          id: 'sHero',
          blocks: [
            {
              id: 'bHero',
              type: 'hero',
              props: {
                headline: 'Halo',
                primaryCta: { label: 'Pesan', link: { kind: 'section', sectionId: 'sHero' } },
              },
            },
          ],
        },
      ],
    });
    expect(renderPage(anchorOnly, { mode: 'export' }).html).not.toContain('<script');
  });

  it('trackingDocument exports valid HTML', async () => {
    expect(await validateHtml(exported())).toEqual([]);
  });
});

describe('image priority (D-016)', () => {
  const IMG = 'https://x.test/a.webp';
  const carousel = (src: string) => ({
    id: 'bCar',
    type: 'product-carousel',
    props: {
      items: [
        { id: 'i1', title: 'One', image: { src, alt: 'One' } },
        { id: 'i2', title: 'Two', image: { src, alt: 'Two' } },
      ],
    },
  });
  const firstSection = (blocks: unknown[]) =>
    parseDocument({ schemaVersion: 1, sections: [{ id: 's1', blocks }] });
  const priorities = (html: string) => html.match(/<img[^>]*fetchpriority="high"[^>]*>/g) ?? [];

  it('only one image is high priority when the first section has a hero and a carousel', () => {
    const page = firstSection([
      { id: 'bHero', type: 'hero', props: { headline: 'H', image: { src: IMG, alt: 'Hero' } } },
      carousel(IMG),
    ]);
    const marked = priorities(renderPage(page, { mode: 'export' }).html);
    expect(marked).toHaveLength(1);
    expect(marked[0]).toContain('lp-hero__img');
  });

  it("the carousel's first card is high priority when the hero has no image", () => {
    const page = firstSection([
      { id: 'bHero', type: 'hero', props: { headline: 'H', image: { src: '', alt: '' } } },
      carousel(IMG),
    ]);
    const marked = priorities(renderPage(page, { mode: 'export' }).html);
    expect(marked).toHaveLength(1);
    expect(marked[0]).toContain('alt="One"');
  });

  it('preview never marks fetchpriority', () => {
    const page = firstSection([
      { id: 'bHero', type: 'hero', props: { headline: 'H', image: { src: IMG, alt: 'Hero' } } },
    ]);
    expect(renderPage(page, { mode: 'preview' }).html).not.toContain('fetchpriority');
  });
});
