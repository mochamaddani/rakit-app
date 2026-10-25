import { describe, expect, it } from 'vitest';
import { createRenderContext, type RenderEnv } from '@/lib/renderer/context';
import { PageSettingsSchema } from '@/lib/schema/settings';

const env: RenderEnv = {
  mode: 'export',
  settings: PageSettingsSchema.parse({ defaultCta: { kind: 'section', sectionId: 'sForm' } }),
  sectionAnchors: new Map([
    ['sForm', 'order'],
    ['sHero', 's-sHero'],
  ]),
  priorityBlockId: null,
};
const pos = { blockId: 'b1', sectionId: 'sHero', sectionIndex: 0, indexInSection: 0 };

describe('render context', () => {
  it('resolves url, section and default links', () => {
    const ctx = createRenderContext(env, pos);
    expect(ctx.resolveLink({ kind: 'url', url: 'https://wa.me/62', newTab: false })).toBe(
      'https://wa.me/62',
    );
    expect(ctx.resolveLink({ kind: 'section', sectionId: 'sForm' })).toBe('#order');
    expect(ctx.resolveLink({ kind: 'default' })).toBe('#order');
  });
  it('falls back to "#" for unsafe urls, unknown sections and a missing default', () => {
    const ctx = createRenderContext({ ...env, settings: PageSettingsSchema.parse({}) }, pos);
    expect(ctx.resolveLink({ kind: 'url', url: 'javascript:alert(1)', newTab: false })).toBe('#');
    expect(ctx.resolveLink({ kind: 'url', url: '', newTab: false })).toBe('#');
    expect(ctx.resolveLink({ kind: 'section', sectionId: 'gone' })).toBe('#');
    expect(ctx.resolveLink({ kind: 'default' })).toBe('#');
  });
  it('treats the first section as above the fold and knows the first block', () => {
    expect(createRenderContext(env, pos).aboveFold).toBe(true);
    expect(createRenderContext(env, { ...pos, sectionIndex: 1 }).aboveFold).toBe(false);
    expect(createRenderContext(env, pos).isFirstBlock).toBe(true);
    expect(createRenderContext(env, { ...pos, indexInSection: 1 }).isFirstBlock).toBe(false);
  });
  it('highlights placeholders only in preview mode', () => {
    expect(String(createRenderContext({ ...env, mode: 'preview' }, pos).text('[REPLACE: x]'))).toBe(
      '<mark class="lp-replace">[REPLACE: x]</mark>',
    );
    expect(String(createRenderContext(env, pos).text('[REPLACE: x]'))).toBe('[REPLACE: x]');
  });
  it('builds block-scoped DOM ids and localized strings', () => {
    const ctx = createRenderContext(env, pos);
    expect(ctx.domId('s', 'i1')).toBe('b-b1-s-i1');
    expect(ctx.t('products')).toBe('Produk');
  });
});
