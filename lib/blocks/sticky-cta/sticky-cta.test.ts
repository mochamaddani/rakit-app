// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stickyCta } from '@/lib/blocks/sticky-cta';
import { renderBlock, singleBlockDoc } from '@/lib/blocks/test-utils';
import { byteLength } from '@/lib/renderer/html';
import { renderPage } from '@/lib/renderer/page';
import { parseDocument } from '@/lib/schema/document';
import { validateHtml } from '@/tests/helpers/validate-html';

const props = {
  text: 'Gratis ongkir hari ini',
  cta: { label: 'Pesan sekarang', link: { kind: 'default' }, event: 'Lead' },
};

describe('sticky-cta block', () => {
  it('renders a fixed bar with the CTA and optional text', () => {
    const out = renderBlock(stickyCta, props);
    expect(out).toMatch(/^<div class="lp-sticky lp-sticky--mobile" data-lp-sticky data-reveal>/);
    expect(out).toContain('<p class="lp-sticky__text">Gratis ongkir hari ini</p>');
    expect(out).toContain('data-lp-event="Lead"');
    expect(renderBlock(stickyCta, { ...props, text: '' })).not.toContain('lp-sticky__text');
  });
  it('reveal mode marks the bar for the snippet', () => {
    expect(renderBlock(stickyCta, { ...props, reveal: 'always', showOn: 'all' })).toMatch(
      /^<div class="lp-sticky lp-sticky--all" data-lp-sticky>/,
    );
  });
  it('marks the text and the button label for inline editing', () => {
    const out = renderBlock(stickyCta, props, { mode: 'preview' });
    expect(out).toContain('data-lp-field="text"');
    expect(out).toContain('data-lp-field="cta.label"');
  });
  it('requires a button', () => {
    expect(stickyCta.schema.safeParse({}).success).toBe(false);
  });
  it('renders valid HTML with only required fields', async () => {
    for (const p of [{ cta: { label: 'Go', link: { kind: 'default' } } }, props]) {
      expect(
        await validateHtml(
          renderPage(parseDocument(singleBlockDoc('sticky-cta', p)), { mode: 'export' }).html,
        ),
      ).toEqual([]);
    }
  });
  it('matches the snapshot', async () => {
    await expect(renderBlock(stickyCta, props)).toMatchFileSnapshot(
      './__snapshots__/sticky-cta.html',
    );
  });
});

describe('sticky-cta snippet', () => {
  type Callback = (entries: { isIntersecting: boolean }[]) => void;
  let observed: { callback: Callback; target: Element }[] = [];
  class FakeObserver {
    constructor(private callback: Callback) {}
    observe(target: Element) {
      observed.push({ callback: this.callback, target });
    }
  }
  afterEach(() => {
    document.body.innerHTML = '';
    document.documentElement.className = '';
    observed = [];
    vi.unstubAllGlobals();
  });
  const run = (markup: string) => {
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    document.body.innerHTML = markup;
    new Function(stickyCta.snippet!.asset.src)();
    return document.querySelector('[data-lp-sticky]')!;
  };

  it('reveals the bar after the first section and never hides it in the canvas', () => {
    const bar = run(
      `<section class="lp-s" id="first"></section><section class="lp-s"><div class="lp-b">${renderBlock(stickyCta, props)}</div></section>`,
    );
    expect(document.documentElement.classList.contains('lp-js')).toBe(true);
    expect(observed[0]!.target.id).toBe('first');
    expect(bar.classList.contains('lp-sticky--on')).toBe(false);
    observed[0]!.callback([{ isIntersecting: false }]);
    expect(bar.classList.contains('lp-sticky--on')).toBe(true);
    observed[0]!.callback([{ isIntersecting: true }]);
    expect(bar.classList.contains('lp-sticky--on')).toBe(false);

    const canvasBar = run(
      `<section class="lp-s"></section><div class="lp-b" data-lp-block="b1">${renderBlock(stickyCta, props, { mode: 'preview' })}</div>`,
    );
    expect(canvasBar.classList.contains('lp-sticky--on')).toBe(true);
  });
  it('an always-visible bar is on at once', () => {
    const bar = run(
      `<section class="lp-s"></section>${renderBlock(stickyCta, { ...props, reveal: 'always' })}`,
    );
    expect(bar.classList.contains('lp-sticky--on')).toBe(true);
    expect(observed).toEqual([]);
  });
  it('snippet stays within 512 bytes', () => {
    expect(byteLength(stickyCta.snippet!.asset.min)).toBeLessThanOrEqual(512);
  });
});
