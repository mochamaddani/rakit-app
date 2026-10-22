import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../commands';
import { deps, editorDoc } from '../test-fixtures';
import { createBlockHtmlCache } from './render-cache';
import { canvasState, diffCanvas } from './sync';

const cache = createBlockHtmlCache();
const state = (doc: ReturnType<typeof editorDoc>) => canvasState(doc, cache);
const apply = (doc: ReturnType<typeof editorDoc>, command: Parameters<typeof applyCommand>[1]) => {
  const r = applyCommand(doc, command, null, deps());
  if (!r.ok) throw new Error(r.reason);
  return r.doc;
};

describe('diffCanvas', () => {
  const base = editorDoc();
  it('is null when nothing changed', () => expect(diffCanvas(state(base), state(base))).toBeNull());
  it('sends only the edited block for a prop change', () => {
    const next = apply(base, {
      type: 'setBlockProp',
      blockId: 'b2',
      path: ['heading'],
      value: 'Kenapa kami',
    });
    const payload = diffCanvas(state(base), state(next))!;
    expect(payload.blocks.map((b) => b.id)).toEqual(['b2']);
    expect(payload).not.toHaveProperty('skeleton');
    expect(payload).not.toHaveProperty('css');
  });
  it('sends a new skeleton but no block markup for a move outside the first section', () => {
    const next = apply(base, { type: 'moveBlock', blockId: 'b4', direction: 'up' });
    const payload = diffCanvas(state(base), state(next))!;
    expect(payload.skeleton).toContain('data-lp-slot="b4"');
    expect(payload.blocks).toEqual([]);
  });
  it('re-sends only blocks whose markup depends on their new position', () => {
    // The hero leaves the first section: its h1 becomes an h2 and its image turns lazy.
    // Benefits and FAQ enter it, but their markup does not depend on position.
    const next = apply(base, { type: 'moveSection', sectionId: 's2', direction: 'up' });
    expect(diffCanvas(state(base), state(next))!.blocks.map((b) => b.id)).toEqual(['b1']);
  });
  it('sends css and js when the first carousel arrives', () => {
    const noCarousel = apply(base, { type: 'removeBlock', blockId: 'b4' });
    const payload = diffCanvas(state(noCarousel), state(base))!;
    expect(payload.css).toContain('.lp-carousel');
    expect(payload.js).toContain('data-lp-carousel');
  });
  it('a theme change sends css only, because block markup does not depend on colors', () => {
    const next = produce(base, (d) => {
      d.settings.theme.colors.primary = '#0F766E';
    });
    const payload = diffCanvas(state(base), state(next))!;
    expect(payload.css).toContain('#0F766E');
    expect(payload.blocks).toEqual([]);
    expect(payload).not.toHaveProperty('skeleton');
  });
  it('a language change sends lang and the blocks whose built-in strings changed', () => {
    const next = produce(base, (d) => {
      d.settings.lang = 'en';
    });
    const payload = diffCanvas(state(base), state(next))!;
    expect(payload.lang).toBe('en');
    expect(payload.blocks.map((b) => b.id)).toContain('b4');
  });
});
