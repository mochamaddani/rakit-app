import type { Patch } from 'immer';
import { describe, expect, it } from 'vitest';
import { parseDocument } from '@/lib/schema/document';
import {
  HISTORY_LIMIT,
  breakCoalescing,
  emptyHistory,
  record,
  redo,
  undo,
  type HistoryEntry,
} from './history';

const replace = (path: Patch['path'], value: unknown): Patch => ({ op: 'replace', path, value });
const TITLE = ['settings', 'seo', 'title'];
const entry = (over: Partial<HistoryEntry> = {}): HistoryEntry => ({
  label: 'Edit page settings',
  patches: [replace(TITLE, 'new')],
  inversePatches: [replace(TITLE, 'old')],
  at: 0,
  selectionBefore: null,
  selectionAfter: null,
  ...over,
});

describe('record', () => {
  it('appends entries and clears the redo stack', () => {
    const history = record({ past: [entry()], future: [entry()] }, entry({ label: 'Next' }));
    expect(history.past.map((e) => e.label)).toEqual(['Edit page settings', 'Next']);
    expect(history.future).toEqual([]);
  });
  it('merges same-key edits within 1000 ms, keeping the first inverse and the last patch', () => {
    const first = entry({
      coalesceKey: 'seo',
      at: 0,
      patches: [replace(TITLE, 'B')],
      inversePatches: [replace(TITLE, '')],
    });
    const second = entry({
      coalesceKey: 'seo',
      at: 1000,
      patches: [replace(TITLE, 'Bo')],
      inversePatches: [replace(TITLE, 'B')],
      selectionAfter: { kind: 'page' },
    });
    const [merged] = record(record(emptyHistory, first), second).past;
    expect(merged).toMatchObject({
      patches: [replace(TITLE, 'Bo')],
      inversePatches: [replace(TITLE, '')],
      at: 1000,
      selectionAfter: { kind: 'page' },
    });
  });
  it('concatenates patches when a merge is not a single replace of one path', () => {
    const a = replace(['settings', 'lang'], 'en');
    const b = replace(TITLE, 'x');
    const first = entry({
      coalesceKey: 'k',
      patches: [a],
      inversePatches: [replace(['settings', 'lang'], 'id')],
    });
    const second = entry({
      coalesceKey: 'k',
      at: 10,
      patches: [b],
      inversePatches: [replace(TITLE, '')],
    });
    const [merged] = record(record(emptyHistory, first), second).past;
    expect(merged!.patches).toEqual([a, b]);
    expect(merged!.inversePatches).toEqual([
      replace(TITLE, ''),
      replace(['settings', 'lang'], 'id'),
    ]);
  });
  it('never merges different keys, entries without a key, or edits more than 1000 ms apart', () => {
    let history = record(emptyHistory, entry({ coalesceKey: 'a', at: 0 }));
    history = record(history, entry({ coalesceKey: 'b', at: 10 }));
    history = record(history, entry({ at: 20 }));
    history = record(history, entry({ at: 30 }));
    history = record(history, entry({ coalesceKey: 'c', at: 40 }));
    history = record(history, entry({ coalesceKey: 'c', at: 1041 }));
    expect(history.past).toHaveLength(6);
  });
  it('stops merging after breakCoalescing', () => {
    const history = breakCoalescing(record(emptyHistory, entry({ coalesceKey: 'a' })));
    expect(record(history, entry({ coalesceKey: 'a', at: 1 })).past).toHaveLength(2);
  });
  it(`keeps only the latest ${HISTORY_LIMIT} entries`, () => {
    let history = emptyHistory;
    for (let i = 0; i < HISTORY_LIMIT + 3; i++)
      history = record(history, entry({ label: `e${i}` }));
    expect(history.past).toHaveLength(HISTORY_LIMIT);
    expect(history.past[0]!.label).toBe('e3');
  });
});

describe('undo and redo', () => {
  const doc = parseDocument({
    schemaVersion: 2,
    sections: [],
    settings: { seo: { title: 'old' } },
  });
  it('apply inverse patches, then patches, and return null at the ends', () => {
    const edited = parseDocument({
      schemaVersion: 2,
      sections: [],
      settings: { seo: { title: 'new' } },
    });
    const history = record(emptyHistory, entry({ selectionBefore: { kind: 'page' } }));
    const undone = undo(history, edited)!;
    expect(undone.doc.settings.seo.title).toBe('old');
    expect(undone.selection).toEqual({ kind: 'page' });
    expect(undo(undone.history, undone.doc)).toBeNull();
    const redone = redo(undone.history, undone.doc)!;
    expect(redone.doc.settings.seo.title).toBe('new');
    expect(redo(redone.history, redone.doc)).toBeNull();
  });
  it('drops a recorded selection that no longer exists', () => {
    const history = record(
      emptyHistory,
      entry({ selectionBefore: { kind: 'block', blockId: 'gone' } }),
    );
    expect(undo(history, doc)!.selection).toBeNull();
  });
});
