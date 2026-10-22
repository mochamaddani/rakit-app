import { produce } from 'immer';
import { afterEach, expect, it, vi } from 'vitest';
import { hero } from '@/lib/blocks/hero';
import { createRenderEnv, renderBlock } from '@/lib/renderer/page';
import { editorDoc } from '../test-fixtures';
import { createBlockHtmlCache } from './render-cache';

afterEach(() => vi.restoreAllMocks());
const at0 = { sectionId: 's1', sectionIndex: 0, indexInSection: 0 };

it('returns renderBlock output and reuses it for the same block object', () => {
  const doc = editorDoc();
  const env = createRenderEnv(doc, 'preview');
  const block = doc.sections[0]!.blocks[0]!;
  const cache = createBlockHtmlCache();
  const spy = vi.spyOn(hero, 'render');
  expect(cache.get(env, block, at0)).toBe(renderBlock(env, block, at0)!.value);
  spy.mockClear();
  cache.get(createRenderEnv(doc, 'preview'), block, at0);
  expect(spy).not.toHaveBeenCalled();
});

it('re-renders when the block, the settings, the anchors or first-section status change', () => {
  const doc = editorDoc();
  const cache = createBlockHtmlCache();
  const block = doc.sections[0]!.blocks[0]!;
  cache.get(createRenderEnv(doc, 'preview'), block, at0);
  const spy = vi.spyOn(hero, 'render');
  const edited = produce(doc, (d) => {
    (d.sections[0]!.blocks[0]!.props as { headline: string }).headline = 'X';
  });
  cache.get(createRenderEnv(edited, 'preview'), edited.sections[0]!.blocks[0]!, at0);
  const themed = produce(doc, (d) => {
    d.settings.theme.colors.primary = '#000000';
  });
  cache.get(createRenderEnv(themed, 'preview'), block, at0);
  const anchored = produce(doc, (d) => {
    d.sections[2]!.anchor = 'pesan';
  });
  cache.get(createRenderEnv(anchored, 'preview'), block, at0);
  cache.get(createRenderEnv(doc, 'preview'), block, {
    sectionId: 's1',
    sectionIndex: 1,
    indexInSection: 0,
  });
  expect(spy).toHaveBeenCalledTimes(4);
});
