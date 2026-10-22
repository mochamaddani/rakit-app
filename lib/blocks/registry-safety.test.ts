// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { listBlockDefinitions } from '@/lib/blocks/registry';
import { singleBlockDoc, testContext } from '@/lib/blocks/test-utils';
import { renderPage } from '@/lib/renderer/page';
import { parseDocument } from '@/lib/schema/document';
import { sequentialIds } from '@/lib/schema/ids';
import { HOSTILE_URL, poisonProps } from '@/tests/helpers/poison';
import { validateHtml } from '@/tests/helpers/validate-html';

describe.each(listBlockDefinitions().map((d) => [d.type, d] as const))(
  '%s (registry-wide)',
  (_type, def) => {
    it('escapes hostile text and neutralizes hostile URLs in every field', () => {
      for (const mode of ['export', 'preview'] as const) {
        const fragment = String(def.render(poisonProps(def) as never, testContext({ mode })));
        const doc = new DOMParser().parseFromString(
          `<!doctype html><body>${fragment}</body>`,
          'text/html',
        );
        expect(doc.querySelectorAll('script')).toHaveLength(0);
        expect(doc.querySelector('img[src="x"]')).toBeNull();
        for (const el of Array.from(doc.querySelectorAll('*'))) {
          for (const attr of Array.from(el.attributes)) {
            expect(attr.name.startsWith('on'), `${el.tagName}[${attr.name}]`).toBe(false);
            if (attr.name === 'href' || attr.name === 'src')
              expect(attr.value.toLowerCase()).not.toContain('javascript:');
          }
        }
        expect(fragment).toContain('&lt;script&gt;');
      }
    });

    it('resolves default links safely when the page default CTA is hostile', () => {
      const settings = { defaultCta: { kind: 'url' as const, url: HOSTILE_URL } };
      const fragment = String(
        def.render(def.defaultProps(sequentialIds()) as never, testContext({ settings })),
      );
      const doc = new DOMParser().parseFromString(
        `<!doctype html><body>${fragment}</body>`,
        'text/html',
      );
      for (const link of Array.from(doc.querySelectorAll('[href]'))) {
        expect(link.getAttribute('href')!.toLowerCase()).not.toContain('javascript:');
      }
    });

    it('renders valid HTML from its default props', async () => {
      const html = renderPage(
        parseDocument(singleBlockDoc(def.type, def.defaultProps(sequentialIds()))),
        { mode: 'export' },
      ).html;
      expect(await validateHtml(html)).toEqual([]);
    });
  },
);
