// Test-only helpers for lib/editor tests (and later editor tasks). Not imported by production code.
import { benefits } from '@/lib/blocks/benefits';
import { faq } from '@/lib/blocks/faq';
import { footer } from '@/lib/blocks/footer';
import { hero } from '@/lib/blocks/hero';
import { productCarousel } from '@/lib/blocks/special/product-carousel';
import type { AnyBlockDefinition } from '@/lib/blocks/types';
import { parseDocument, type PageDocument } from '@/lib/schema/document';
import { sequentialIds } from '@/lib/schema/ids';
import type { CommandDeps, EditorCommand } from './commands';

/** s1[b1 hero] · s2(tone muted)[b2 benefits, b3 faq] · s3[b4 product-carousel, items i6–i8] · s4[b5 footer] */
export function editorDoc(): PageDocument {
  const itemIds = sequentialIds('i');
  const block = (id: string, definition: AnyBlockDefinition) => ({
    id,
    type: definition.type,
    props: definition.defaultProps(itemIds),
  });
  return parseDocument({
    schemaVersion: 1,
    sections: [
      { id: 's1', blocks: [block('b1', hero)] },
      { id: 's2', style: { tone: 'muted' }, blocks: [block('b2', benefits), block('b3', faq)] },
      { id: 's3', blocks: [block('b4', productCarousel)] },
      { id: 's4', blocks: [block('b5', footer)] },
    ],
  });
}

export const deps = (): CommandDeps => ({ newId: sequentialIds('n') });

export const order = (doc: PageDocument) =>
  doc.sections.map((s) => `${s.id}:${s.blocks.map((b) => b.id).join(',')}`);

/** One valid command of every type, applicable in sequence to editorDoc() with deps(). */
export function everyCommand(): EditorCommand[] {
  return [
    { type: 'addBlock', blockType: 'testimonials' },
    { type: 'moveBlock', blockId: 'b4', direction: 'up' },
    { type: 'duplicateBlock', blockId: 'b1' },
    { type: 'removeBlock', blockId: 'b3' },
    { type: 'setBlockProp', blockId: 'b1', path: ['headline'], value: 'Botol **anti bocor**' },
    { type: 'setBlockStyle', blockId: 'b1', path: ['hideOn'], value: 'desktop' },
    { type: 'moveSection', sectionId: 's2', direction: 'down' },
    { type: 'duplicateSection', sectionId: 's2' },
    { type: 'removeSection', sectionId: 's4' },
    { type: 'setSectionStyle', sectionId: 's3', path: ['tone'], value: 'dark' },
    { type: 'setSectionAnchor', sectionId: 's3', anchor: 'pesan' },
    { type: 'setSetting', path: ['theme', 'colors', 'primary'], value: '#0F766E' },
    {
      type: 'listInsert',
      blockId: 'b4',
      path: ['items'],
      index: 0,
      item: { id: 'x1', title: 'Botol baru' },
    },
    { type: 'listMove', blockId: 'b4', path: ['items'], from: 0, to: 2 },
    { type: 'listDuplicate', blockId: 'b4', path: ['items'], index: 1 },
    { type: 'listRemove', blockId: 'b4', path: ['items'], index: 0 },
  ];
}
