import { describe, expect, it } from 'vitest';
import { sequentialIds } from '@/lib/schema/ids';
import { createEditorStore } from './store';
import { editorDoc, everyCommand } from './test-fixtures';

function setup(times: number[] = []) {
  let i = 0;
  return createEditorStore(
    { pageId: 'p1', doc: editorDoc() },
    { newId: sequentialIds('n'), now: () => times[i++] ?? 0 },
  );
}
const headline = (text: string) => ({
  type: 'setBlockProp' as const,
  blockId: 'b1',
  path: ['headline'],
  value: text,
});

describe('editor store', () => {
  it('notify shows a notice and announces it', () => {
    const store = setup();
    store.getState().notify('Headline: Required');
    expect(store.getState()).toMatchObject({
      notice: 'Headline: Required',
      announcement: 'Headline: Required',
      version: 0,
    });
  });
  it('announce sets the announcement without touching history', () => {
    const store = setup();
    store.getState().announce('Dragging Hero. Press Escape to cancel.');
    expect(store.getState().announcement).toBe('Dragging Hero. Press Escape to cancel.');
    expect(store.getState().history.past).toHaveLength(0);
    expect(store.getState().version).toBe(0);
  });
  it('applies a command, bumps the version, records history and selects', () => {
    const store = setup();
    const result = store.getState().dispatch({ type: 'addBlock', blockType: 'faq' });
    expect(result.ok).toBe(true);
    expect(store.getState().version).toBe(1);
    expect(store.getState().history.past.map((e) => e.label)).toEqual(['Add FAQ']);
    expect(store.getState().selection).toEqual({ kind: 'block', blockId: 'n2' });
    expect(store.getState().announcement).toBe('Added FAQ');
  });
  it('a rejected command changes nothing', () => {
    const store = setup();
    const before = store.getState();
    expect(store.getState().dispatch(headline('')).ok).toBe(false);
    expect(store.getState().doc).toBe(before.doc);
    expect(store.getState().version).toBe(0);
    expect(store.getState().history.past).toHaveLength(0);
  });
  it('undoes and redoes every command type back to the exact documents', () => {
    const store = setup();
    const snapshots = [store.getState().doc];
    for (const command of everyCommand()) {
      expect(store.getState().dispatch(command).ok, command.type).toBe(true);
      snapshots.push(store.getState().doc);
    }
    for (let i = snapshots.length - 2; i >= 0; i--) {
      expect(store.getState().undo()).toBe(true);
      expect(store.getState().doc).toEqual(snapshots[i]);
    }
    expect(store.getState().undo()).toBe(false);
    for (let i = 1; i < snapshots.length; i++) {
      expect(store.getState().redo()).toBe(true);
      expect(store.getState().doc).toEqual(snapshots[i]);
    }
    expect(store.getState().redo()).toBe(false);
  });
  it('coalesces typing in one field within 1000 ms into one undo step', () => {
    const store = setup([0, 300, 600, 900]);
    for (const text of ['B', 'Bo', 'Bot', 'Boto'])
      store.getState().dispatch(headline(text), { coalesceKey: 'b1:headline' });
    expect(store.getState().history.past).toHaveLength(1);
    store.getState().undo();
    expect(store.getState().doc).toEqual(editorDoc());
  });
  it('starts a new step after a pause, a blur, or another field', () => {
    const store = setup([0, 1500, 1600, 1700]);
    store.getState().dispatch(headline('A'), { coalesceKey: 'b1:headline' });
    store.getState().dispatch(headline('AB'), { coalesceKey: 'b1:headline' }); // pause > 1000 ms
    store.getState().endCoalescing();
    store.getState().dispatch(headline('ABC'), { coalesceKey: 'b1:headline' }); // after blur
    store
      .getState()
      .dispatch(
        { type: 'setBlockProp', blockId: 'b1', path: ['eyebrow'], value: 'X' },
        { coalesceKey: 'b1:eyebrow' },
      );
    expect(store.getState().history.past).toHaveLength(4);
  });
  it('a new command clears the redo stack', () => {
    const store = setup();
    store.getState().dispatch(headline('A'));
    store.getState().undo();
    store.getState().dispatch(headline('B'));
    expect(store.getState().redo()).toBe(false);
  });
  it('keeps 200 entries', () => {
    const store = setup();
    for (let i = 0; i < 205; i++) store.getState().dispatch(headline(`v${i}`));
    expect(store.getState().history.past).toHaveLength(200);
  });
  it('restores the selection recorded with the entry, or clears it when gone', () => {
    const store = setup();
    store.getState().select({ kind: 'block', blockId: 'b2' });
    store.getState().dispatch({ type: 'removeBlock', blockId: 'b2' });
    expect(store.getState().selection).toEqual({ kind: 'block', blockId: 'b3' });
    store.getState().undo();
    expect(store.getState().selection).toEqual({ kind: 'block', blockId: 'b2' });
    store.getState().redo();
    store.getState().select({ kind: 'block', blockId: 'b3' });
    store.getState().dispatch({ type: 'addBlock', blockType: 'faq' });
    store.getState().undo();
    expect(store.getState().selection).toEqual({ kind: 'block', blockId: 'b3' });
  });
  it('selection and viewport changes are not history and do not bump the version', () => {
    const store = setup();
    store.getState().select({ kind: 'page' });
    store.getState().setViewport('desktop');
    expect(store.getState().version).toBe(0);
    expect(store.getState().history.past).toHaveLength(0);
  });
});
