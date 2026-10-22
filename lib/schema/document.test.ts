import { describe, expect, expectTypeOf, it } from 'vitest';
import type { BlockType } from '@/lib/blocks/registry';
import {
  collectIdIssues,
  createEmptyDocument,
  parseDocument,
  safeParseDocument,
  type BlockInstance,
} from '@/lib/schema/document';

const minimal = () => ({
  schemaVersion: 1,
  sections: [
    {
      id: 'sHero',
      blocks: [
        { id: 'bHero', type: 'hero', props: { headline: 'Halo' } as Record<string, unknown> },
      ],
    },
  ],
});
const pathsOf = (raw: unknown) => {
  const r = safeParseDocument(raw);
  return r.ok ? [] : r.error.issues.map((i) => i.path);
};

describe('PageDocument', () => {
  it('parses a minimal document and fills defaults', () => {
    const doc = parseDocument(minimal());
    expect(doc.settings.lang).toBe('id');
    expect(doc.sections[0]!.style).toEqual({ tone: 'base', padY: 'md', width: 'normal' });
    expect(doc.sections[0]!.blocks[0]!.style).toEqual({ hideOn: 'none', spaceAbove: 'none' });
  });
  it('reports the exact path of invalid block props', () => {
    const raw = minimal();
    raw.sections[0]!.blocks[0]!.props.headline = '';
    expect(pathsOf(raw)).toContain('sections.0.blocks.0.props.headline');
  });
  it('rejects unknown block types', () => {
    const raw = minimal();
    raw.sections[0]!.blocks[0]!.type = 'marquee';
    expect(pathsOf(raw).some((p) => p.startsWith('sections.0.blocks.0'))).toBe(true);
  });
  it('rejects duplicate block ids across sections', () => {
    const raw = minimal();
    raw.sections.push({
      id: 'sTwo',
      blocks: [{ id: 'bHero', type: 'hero', props: { headline: 'Lagi' } }],
    });
    expect(pathsOf(raw)).toContain('sections.1.blocks.0.id');
  });
  it('rejects reserved and duplicate anchors', () => {
    const reserved = { ...minimal(), sections: [{ ...minimal().sections[0]!, anchor: 'b-x' }] };
    expect(pathsOf(reserved)).toContain('sections.0.anchor');
    const dup = minimal();
    dup.sections = [
      { ...dup.sections[0]!, anchor: 'order' } as never,
      { id: 's2', anchor: 'order', blocks: [] } as never,
    ];
    expect(pathsOf(dup)).toContain('sections.1.anchor');
  });
  it('rejects ids whose DOM ids could collide (block "carousel" item "2" vs block "carousel-2")', () => {
    const raw = {
      schemaVersion: 1,
      sections: [
        {
          id: 's1',
          blocks: [
            {
              id: 'carousel',
              type: 'product-carousel',
              props: {
                items: [
                  { id: '1', title: 'A' },
                  { id: '2', title: 'B' },
                ],
              },
            },
            { id: 'carousel-2', type: 'hero', props: { headline: 'X' } },
          ],
        },
      ],
    };
    expect(pathsOf(raw)).toContain('sections.0.blocks.1.id');
  });
  it('collectIdIssues finds duplicate ids inside item lists', () => {
    const doc = {
      sections: [
        { id: 's', blocks: [{ id: 'b', props: { items: [{ id: 'i1' }, { id: 'i1' }] } }] },
      ],
    };
    expect(collectIdIssues(doc)).toEqual([
      { path: 'sections.0.blocks.0.props.items.1.id', message: 'Duplicate id "i1"' },
    ]);
  });
  it('types block instances by registered type', () => {
    expectTypeOf<BlockInstance['type']>().toEqualTypeOf<BlockType>();
    expectTypeOf<BlockType>().not.toEqualTypeOf<string>();
  });
  it('createEmptyDocument is a valid document with no sections and ad-page defaults', () => {
    const doc = createEmptyDocument();
    expect(doc.sections).toEqual([]);
    expect(doc.settings.lang).toBe('id');
    expect(doc.settings.seo.noindex).toBe(true);
    expect(parseDocument(doc)).toEqual(doc);
  });
});
