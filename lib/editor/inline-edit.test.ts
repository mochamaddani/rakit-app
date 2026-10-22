import { describe, expect, it } from 'vitest';
import { sequentialIds } from '@/lib/schema/ids';
import { applyInlineEdit, finishInlineEdit } from './inline-edit';
import { createEditorStore } from './store';
import { editorDoc } from './test-fixtures';

const setup = () => {
  let time = 0;
  const store = createEditorStore(
    { pageId: 'p1', doc: editorDoc() },
    { newId: sequentialIds('n'), now: () => (time += 100) },
  );
  return store;
};
const headline = (store: ReturnType<typeof setup>) =>
  (store.getState().doc.sections[0]!.blocks[0]!.props as { headline: string }).headline;

describe('inline edits', () => {
  it('an edit to a rich field stores markup and coalesces a typing run into one undo step', () => {
    const store = setup();
    const before = headline(store);
    applyInlineEdit(store, { blockId: 'b1', path: 'headline', nodes: [{ t: 'text', v: 'Botol' }] });
    applyInlineEdit(store, {
      blockId: 'b1',
      path: 'headline',
      nodes: [
        { t: 'text', v: 'Botol ' },
        { t: 'strong', v: 'anti bocor' },
      ],
    });
    expect(headline(store)).toBe('Botol **anti bocor**');
    expect(store.getState().history.past).toHaveLength(1);
    finishInlineEdit(store);
    applyInlineEdit(store, { blockId: 'b1', path: 'headline', nodes: [{ t: 'text', v: 'Lain' }] });
    expect(store.getState().history.past).toHaveLength(2);
    store.getState().undo();
    store.getState().undo();
    expect(headline(store)).toBe(before);
  });

  it('a path that is not a text or rich field, or a missing block, changes nothing', () => {
    const store = setup();
    const nodes = [{ t: 'text', v: 'x' }] as const;
    for (const edit of [
      { blockId: 'b1', path: 'layout' },
      { blockId: 'b1', path: 'image' },
      { blockId: 'b1', path: 'nope' },
      { blockId: 'b1', path: '__proto__' },
      { blockId: 'b1', path: 'secondaryCta.label' },
      { blockId: 'zz', path: 'headline' },
    ]) {
      applyInlineEdit(store, { ...edit, nodes: [...nodes] });
    }
    expect(store.getState().version).toBe(0);
    expect(store.getState().notice).toBeNull();
  });

  it('an invalid value notifies with the field label', () => {
    const store = setup();
    applyInlineEdit(store, { blockId: 'b1', path: 'headline', nodes: [] });
    expect(store.getState().notice).toBe('Headline: Required');
    expect(store.getState().version).toBe(0);
  });

  it('text fields store plain text', () => {
    const store = setup();
    applyInlineEdit(store, {
      blockId: 'b1',
      path: 'primaryCta.label',
      nodes: [{ t: 'strong', v: 'Pesan' }, { t: 'br' }, { t: 'text', v: 'sekarang' }],
    });
    const cta = (
      store.getState().doc.sections[0]!.blocks[0]!.props as { primaryCta: { label: string } }
    ).primaryCta;
    expect(cta.label).toBe('Pesan sekarang');
  });
});
