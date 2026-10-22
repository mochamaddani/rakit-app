import { describe, expect, it } from 'vitest';
import { sequentialIds } from '@/lib/schema/ids';
import {
  blockTypeLabel,
  canMoveBlock,
  canMoveSection,
  findBlock,
  findSection,
  getAtPath,
  selectionExists,
  withFreshIds,
} from './structure';
import { editorDoc } from './test-fixtures';

describe('structure helpers', () => {
  const doc = editorDoc();
  it('finds blocks and sections by id', () => {
    expect(findBlock(doc, 'b3')).toEqual({ sectionIndex: 1, blockIndex: 1 });
    expect(findBlock(doc, 'nope')).toBeNull();
    expect(findSection(doc, 's3')).toBe(2);
    expect(findSection(doc, 'nope')).toBe(-1);
  });
  it('knows which moves are possible', () => {
    expect(canMoveBlock(doc, 'b1', 'up')).toBe(false);
    expect(canMoveBlock(doc, 'b1', 'down')).toBe(true);
    expect(canMoveBlock(doc, 'b2', 'up')).toBe(true); // leaves its shared section
    expect(canMoveBlock(doc, 'b5', 'down')).toBe(false);
    expect(canMoveBlock(doc, 'nope', 'up')).toBe(false);
    expect(canMoveSection(doc, 's1', 'up')).toBe(false);
    expect(canMoveSection(doc, 's4', 'down')).toBe(false);
    expect(canMoveSection(doc, 's2', 'down')).toBe(true);
  });
  it('reads values through objects and arrays', () => {
    const value = { items: [{ title: 'a' }, { title: 'b', cta: { label: 'Go' } }] };
    expect(getAtPath(value, ['items', 1, 'cta', 'label'])).toBe('Go');
    expect(getAtPath(value, ['items', 5, 'title'])).toBeUndefined();
    expect(getAtPath(value, [])).toBe(value);
  });
  it('withFreshIds re-ids every object that has an id and leaves the input untouched', () => {
    const input = { id: 'a', title: 'x', links: [{ id: 'b', label: 'y' }], image: { src: '' } };
    const copy = withFreshIds(input, sequentialIds('n'));
    expect(copy).toEqual({
      id: 'n1',
      title: 'x',
      links: [{ id: 'n2', label: 'y' }],
      image: { src: '' },
    });
    expect(input.id).toBe('a');
    expect(copy.links).not.toBe(input.links);
  });
  it('checks that a selection still exists', () => {
    expect(selectionExists(doc, { kind: 'block', blockId: 'b4' })).toBe(true);
    expect(selectionExists(doc, { kind: 'block', blockId: 'gone' })).toBe(false);
    expect(selectionExists(doc, { kind: 'section', sectionId: 's2' })).toBe(true);
    expect(selectionExists(doc, { kind: 'page' })).toBe(true);
    expect(selectionExists(doc, null)).toBe(false);
  });
  it('labels blocks by their registry name', () => {
    expect(blockTypeLabel('product-carousel')).toBe('Product Carousel');
    expect(blockTypeLabel('unknown-thing')).toBe('unknown-thing');
  });
});
