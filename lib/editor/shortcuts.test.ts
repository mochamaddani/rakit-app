import { describe, expect, it } from 'vitest';
import { sequentialIds } from '@/lib/schema/ids';
import { performIntent, resolveShortcut } from './shortcuts';
import { createEditorStore } from './store';
import { editorDoc, order } from './test-fixtures';

const key = (k: string, m: Partial<{ mod: boolean; shift: boolean; alt: boolean }> = {}) => ({
  key: k,
  mod: false,
  shift: false,
  alt: false,
  ...m,
});

describe('resolveShortcut', () => {
  it.each([
    [key('z', { mod: true }), false, 'undo'],
    [key('z', { mod: true, shift: true }), false, 'redo'],
    [key('y', { mod: true }), true, 'redo'],
    [key('z', { mod: true }), true, 'undo'],
    [key('Delete'), false, 'delete'],
    [key('Backspace'), true, null],
    [key('d', { mod: true }), false, 'duplicate'],
    [key('ArrowUp', { alt: true }), false, 'moveUp'],
    [key('ArrowDown', { alt: true }), true, null],
    [key('Escape'), false, 'escape'],
    [key('ArrowUp'), false, null],
  ])('%j editing=%s → %s', (input, editingText, intent) =>
    expect(resolveShortcut(input, { editingText })).toBe(intent),
  );
});

it('performIntent drives block and section commands and escape walks up', () => {
  const store = createEditorStore({ pageId: 'p', doc: editorDoc() }, { newId: sequentialIds('n') });
  store.getState().select({ kind: 'block', blockId: 'b4' });
  performIntent(store, 'moveUp');
  expect(order(store.getState().doc)).toEqual(['s1:b1', 's3:b4', 's2:b2,b3', 's4:b5']);
  performIntent(store, 'escape');
  expect(store.getState().selection).toEqual({ kind: 'section', sectionId: 's3' });
  performIntent(store, 'moveDown');
  expect(order(store.getState().doc)[2]).toBe('s3:b4');
  performIntent(store, 'escape');
  expect(store.getState().selection).toBeNull();
  performIntent(store, 'undo');
  expect(order(store.getState().doc)[1]).toBe('s3:b4');
});
