// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cookieBanner } from '@/lib/blocks/cookie-banner';
import { renderBlock, singleBlockDoc } from '@/lib/blocks/test-utils';
import { byteLength } from '@/lib/renderer/html';
import { renderPage } from '@/lib/renderer/page';
import { parseDocument } from '@/lib/schema/document';
import { validateHtml } from '@/tests/helpers/validate-html';

const props = { privacyLink: { kind: 'url', url: 'https://x.test/privasi' } };

describe('cookie-banner block', () => {
  it('renders hidden with the default message in the page language', () => {
    const out = renderBlock(cookieBanner, props);
    expect(out).toMatch(
      /^<section class="lp-cookie" data-lp-cookie aria-label="Pemberitahuan cookie" hidden>/,
    );
    expect(out).toContain('Situs ini memakai cookie');
    expect(out).toContain('<a href="https://x.test/privasi">Kebijakan privasi</a>');
    expect(out).toContain('<button type="button" class="lp-btn lp-cookie__ok">Oke</button>');
    const en = renderBlock(cookieBanner, {}, { settings: { lang: 'en' } });
    expect(en).toContain('This site uses cookies');
    expect(en).toContain('>OK</button>');
    expect(en).not.toContain('<a ');
  });
  it('uses the owner message and label, marked for inline editing in preview', () => {
    const out = renderBlock(
      cookieBanner,
      { message: 'Kami pakai **cookie**.', buttonLabel: 'Setuju' },
      { mode: 'preview' },
    );
    expect(out).toContain(
      'data-lp-field="message" data-lp-rich>Kami pakai <strong>cookie</strong>.',
    );
    expect(out).toContain('data-lp-field="buttonLabel">Setuju</button>');
    expect(out).not.toMatch(/ hidden>/);
  });
  it('renders valid HTML with only required fields', async () => {
    for (const p of [{}, props]) {
      expect(
        await validateHtml(
          renderPage(parseDocument(singleBlockDoc('cookie-banner', p)), { mode: 'export' }).html,
        ),
      ).toEqual([]);
    }
  });
  it('matches the snapshot', async () => {
    await expect(renderBlock(cookieBanner, props)).toMatchFileSnapshot(
      './__snapshots__/cookie-banner.html',
    );
  });
});

describe('cookie-banner snippet', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
    vi.restoreAllMocks();
  });
  const run = (markup = `<main></main>${renderBlock(cookieBanner, props)}`) => {
    document.body.innerHTML = markup;
    new Function(cookieBanner.snippet!.asset.src)();
    return document.querySelector<HTMLElement>('[data-lp-cookie]')!;
  };

  it('shows it once and remembers the dismissal', () => {
    const banner = run();
    expect(banner.hidden).toBe(false);
    banner.querySelector('button')!.click();
    expect(banner.hidden).toBe(true);
    expect(localStorage.getItem('lp-cookie-ok')).toBe('1');
    expect(document.activeElement).toBe(document.querySelector('main'));
    expect(run().hidden).toBe(true);
  });
  it('storage errors only lose the memory', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const banner = run();
    expect(banner.hidden).toBe(false);
    banner.querySelector('button')!.click();
    expect(banner.hidden).toBe(true);
  });
  it('always shows in the canvas and the button does nothing there', () => {
    localStorage.setItem('lp-cookie-ok', '1');
    const banner = run(
      `<div class="lp-b" data-lp-block="b1">${renderBlock(cookieBanner, props, { mode: 'preview' })}</div>`,
    );
    expect(banner.hidden).toBe(false);
    banner.querySelector('button')!.click();
    expect(banner.hidden).toBe(false);
  });
  it('snippet stays within 512 bytes', () => {
    expect(byteLength(cookieBanner.snippet!.asset.min)).toBeLessThanOrEqual(512);
  });
});
