// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { customHtml } from '@/lib/blocks/custom-html';
import { renderBlock, singleBlockDoc } from '@/lib/blocks/test-utils';
import { renderPage } from '@/lib/renderer/page';
import { parseDocument } from '@/lib/schema/document';
import { validateHtml } from '@/tests/helpers/validate-html';

const code =
  '<div class="promo"><p>Promo <b>hari ini</b></p><img src="x" alt="Promo" onerror="alert(1)"></div><script>window.__canary = 1</script>';

describe('custom-html block', () => {
  it('export sanitizes the code unless scripts are on', () => {
    expect(renderBlock(customHtml, { html: code })).toBe(
      '<div class="lp-custom"><div class="promo"><p>Promo <b>hari ini</b></p><img src="x" alt="Promo"></div></div>',
    );
  });
  it('run scripts emits the code verbatim', () => {
    expect(renderBlock(customHtml, { html: code, runScripts: true })).toBe(
      `<div class="lp-custom">${code}</div>`,
    );
  });
  it('preview puts the code only inside a sandboxed srcdoc frame', () => {
    for (const runScripts of [false, true]) {
      const fragment = renderBlock(customHtml, { html: code, runScripts }, { mode: 'preview' });
      const doc = new DOMParser().parseFromString(`<body>${fragment}</body>`, 'text/html');
      const frames = doc.querySelectorAll('iframe');
      expect(frames).toHaveLength(1);
      expect(frames[0]!.getAttribute('sandbox')).toBe('allow-scripts');
      expect(frames[0]!.hasAttribute('data-lp-custom-frame')).toBe(true);
      expect(doc.querySelectorAll('script, .promo')).toHaveLength(0);
      const srcdoc = frames[0]!.getAttribute('srcdoc')!;
      expect(srcdoc).toContain('<div class="promo">');
      expect(srcdoc.includes('window.__canary')).toBe(runScripts);
    }
  });
  it('the srcdoc carries the theme and the height reporter', () => {
    const fragment = renderBlock(
      customHtml,
      { html: '<p>x</p>', blockName: 'Promo box' },
      { mode: 'preview' },
    );
    const frame = new DOMParser()
      .parseFromString(`<body>${fragment}</body>`, 'text/html')
      .querySelector('iframe')!;
    expect(frame.title).toBe('Promo box');
    const srcdoc = frame.getAttribute('srcdoc')!;
    expect(srcdoc).toMatch(/^<!doctype html><html lang="id">/);
    expect(srcdoc).toContain('--lp-primary:#2563EB');
    expect(srcdoc).toContain('lpHeight');
  });
  it('names the frame in the page language without a block name', () => {
    expect(renderBlock(customHtml, {}, { mode: 'preview' })).toContain('title="HTML khusus"');
  });
  it('renders valid HTML with only required fields', async () => {
    for (const p of [{}, { html: code }, { html: '<p>ok</p>', runScripts: true }]) {
      for (const mode of ['export', 'preview'] as const) {
        expect(
          await validateHtml(
            renderPage(parseDocument(singleBlockDoc('custom-html', p)), { mode }).html,
          ),
        ).toEqual([]);
      }
    }
  });
  it('matches the snapshot', async () => {
    await expect(renderBlock(customHtml, { html: code })).toMatchFileSnapshot(
      './__snapshots__/custom-html.html',
    );
  });
});
