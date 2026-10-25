import dynamicIconImports from 'lucide-react/dynamicIconImports';
import { describe, expect, it } from 'vitest';
import { BLOCKS, getBlockDefinition, listBlockDefinitions } from '@/lib/blocks/registry';
import { sequentialIds } from '@/lib/schema/ids';
import { exampleDocument, trackingDocument } from '@/tests/fixtures/example-document';

describe('block registry', () => {
  it('registers each type once', () => {
    const types = BLOCKS.map((b) => b.type);
    expect(new Set(types).size).toBe(types.length);
  });
  it('every block has a description and defaults that validate', () => {
    for (const def of listBlockDefinitions()) {
      expect(def.description.length, def.type).toBeGreaterThan(20);
      expect(def.schema.safeParse(def.defaultProps(sequentialIds())).success, def.type).toBe(true);
    }
  });
  it('getBlockDefinition returns undefined for unknown types', () => {
    expect(getBlockDefinition('hero')?.type).toBe('hero');
    expect(getBlockDefinition('marquee')).toBeUndefined();
  });
});

it('every block icon is a lucide icon name', () => {
  for (const d of listBlockDefinitions())
    expect(Object.keys(dynamicIconImports), d.type).toContain(d.icon);
});

it('every registered block type appears in the example documents', () => {
  const used = new Set(
    [exampleDocument, trackingDocument].flatMap((doc) =>
      doc.sections.flatMap((section) => section.blocks.map((block) => block.type)),
    ),
  );
  expect(BLOCKS.map((block) => block.type).filter((type) => !used.has(type))).toEqual([]);
});
