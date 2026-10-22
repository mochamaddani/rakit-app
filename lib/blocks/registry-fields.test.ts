// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { getAtPath } from '@/lib/editor/structure';
import { describeFields, fieldSpecAt, parseFieldPath } from '@/lib/editor/inspector/fields';
import { toPlainText } from '@/lib/renderer/inline';
import { renderPage } from '@/lib/renderer/page';
import { parseDocument, type PageDocument } from '@/lib/schema/document';
import { sequentialIds } from '@/lib/schema/ids';
import { exampleDocument } from '@/tests/fixtures/example-document';
import { getBlockDefinition, listBlockDefinitions } from './registry';

// Inline editing finds text by these preview-only markers (docs/DECISIONS.md D-044).

const example = parseDocument(exampleDocument);
const defaults = parseDocument({
  schemaVersion: 1,
  sections: listBlockDefinitions().map((definition, i) => ({
    id: `s${i}`,
    blocks: [
      {
        id: `b${i}`,
        type: definition.type,
        props: definition.defaultProps(sequentialIds(`b${i}i`)),
      },
    ],
  })),
});

function markers(doc: PageDocument) {
  const page = new DOMParser().parseFromString(
    renderPage(doc, { mode: 'preview' }).html,
    'text/html',
  );
  return Array.from(page.querySelectorAll('[data-lp-field]')).map((el) => {
    const blockId = el.closest('[data-lp-block]')?.getAttribute('data-lp-block') ?? '';
    const block = doc.sections.flatMap((s) => s.blocks).find((b) => b.id === blockId)!;
    return {
      el,
      block,
      path: el.getAttribute('data-lp-field')!,
      rich: el.hasAttribute('data-lp-rich'),
    };
  });
}
const squash = (text: string) => text.replace(/\s+/g, '');

describe('field markers', () => {
  it('every field marker names a text or rich field of its block, with data-lp-rich exactly on rich fields', () => {
    for (const doc of [example, defaults]) {
      const found = markers(doc);
      expect(found.length).toBeGreaterThan(10);
      for (const { el, block, path, rich } of found) {
        const definition = getBlockDefinition(block.type)!;
        const parsed = parseFieldPath(path);
        const spec = parsed ? fieldSpecAt(describeFields(definition.schema), parsed) : null;
        expect(spec?.kind, `${block.type} ${path}`).toBe(rich ? 'rich' : 'text');
        // The element's whole content is this field.
        const value = String(getAtPath(block.props, parsed!));
        expect(squash(el.textContent ?? ''), `${block.type} ${path}`).toBe(
          squash(rich ? toPlainText(value) : value),
        );
      }
    }
  });

  it('every text and rich value the example renders is marked', () => {
    const byBlock = new Map<string, string[]>();
    for (const { block, path } of markers(example)) {
      byBlock.set(block.id, [...(byBlock.get(block.id) ?? []), path]);
    }
    const items = (count: number, fields: string[]) =>
      Array.from({ length: count }, (_, i) => fields.map((f) => `items.${i}.${f}`)).flat();
    expect(new Set(byBlock.get('bHero'))).toEqual(
      new Set(['eyebrow', 'headline', 'subheadline', 'primaryCta.label', 'trustLine']),
    );
    expect(new Set(byBlock.get('bBenefits'))).toEqual(
      new Set(['heading', ...items(4, ['title', 'text'])]),
    );
    expect(new Set(byBlock.get('bProducts'))).toEqual(
      new Set([
        'heading',
        'subheading',
        'items.0.badge',
        ...items(8, ['title', 'description', 'cta.label']),
      ]),
    );
    expect(new Set(byBlock.get('bTestimonials'))).toEqual(
      new Set(['heading', ...items(3, ['quote', 'name', 'detail'])]),
    );
    expect(new Set(byBlock.get('bFaq'))).toEqual(
      new Set(['heading', ...items(4, ['question', 'answer'])]),
    );
    expect(new Set(byBlock.get('bFooter'))).toEqual(
      new Set([
        'brand',
        'links.0.label',
        'links.1.label',
        'links.2.label',
        'disclaimer',
        'copyright',
      ]),
    );
  });

  it('export output carries no field markers', () => {
    const { html } = renderPage(example, { mode: 'export' });
    expect(html).not.toContain('data-lp-field');
    expect(html).not.toContain('data-lp-rich');
  });
});
