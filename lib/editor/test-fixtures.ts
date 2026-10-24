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
/** An older version of the page, as Versions → Restore brings it back. */
export const restoredDoc = (): PageDocument =>
  parseDocument({
    schemaVersion: 1,
    sections: [
      { id: 'r1', blocks: [{ id: 'rb1', type: 'hero', props: { headline: 'Versi lama' } }] },
    ],
  });

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
    // Drops and the structural cases they combine with (s2 holds only b2 here; the next id is n10).
    {
      type: 'insertBlockAt',
      blockType: 'faq',
      target: { kind: 'into', sectionId: 's2', index: 1 },
    },
    { type: 'insertBlockAt', blockType: 'hero', target: { kind: 'between', index: 1 } },
    { type: 'moveBlock', blockId: 'b2', direction: 'down' }, // swap inside s2
    { type: 'moveBlock', blockId: 'b2', direction: 'down' }, // split out of s2
    { type: 'moveBlockTo', blockId: 'n6', target: { kind: 'into', sectionId: 's1', index: 1 } },
    { type: 'duplicateBlock', blockId: 'n6' }, // shared duplicate
    { type: 'moveBlockTo', blockId: 'b1', target: { kind: 'into', sectionId: 's1', index: 2 } },
    { type: 'moveBlockTo', blockId: 'b1', target: { kind: 'between', index: 0 } },
    { type: 'moveBlockTo', blockId: 'n6', target: { kind: 'into', sectionId: 's3', index: 0 } },
    { type: 'moveBlockTo', blockId: 'n2', target: { kind: 'between', index: 0 } },
    { type: 'removeBlock', blockId: 'n2' }, // empties its section
    // Last: the restored document has none of the ids above.
    { type: 'restoreDocument', doc: restoredDoc(), when: 'Oct 1, 2026, 10:00' },
  ];
}
