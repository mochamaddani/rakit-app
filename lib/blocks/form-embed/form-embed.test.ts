// @vitest-environment happy-dom
import { Window } from 'happy-dom';
import { describe, expect, it } from 'vitest';
import { renderBlock, singleBlockDoc } from '@/lib/blocks/test-utils';
import { byteLength } from '@/lib/renderer/html';
import { renderPage } from '@/lib/renderer/page';
import { parseDocument } from '@/lib/schema/document';
import { STORELINK_SNIPPET } from '@/tests/fixtures/forms';
import { validateHtml } from '@/tests/helpers/validate-html';
import { formEmbed } from '.';
import { detectFormProvider, formTrackingNote } from './providers';
import { FormEmbedPropsSchema } from './schema';
import { asset as snippet } from './snippet.generated';

const tally = { mode: 'iframe', url: 'https://tally.so/r/abc', heading: 'Pesan di sini' };
const storelink = { mode: 'snippet', code: STORELINK_SNIPPET };

describe('form embed schema', () => {
  it('rejects heights outside 200–4000 and code over 20,000 characters', () => {
    expect(FormEmbedPropsSchema.safeParse({ height: 199 }).success).toBe(false);
    expect(FormEmbedPropsSchema.safeParse({ height: 4001 }).success).toBe(false);
    expect(FormEmbedPropsSchema.safeParse({ code: 'x'.repeat(20_001) }).success).toBe(false);
    expect(FormEmbedPropsSchema.parse({})).toMatchObject({ mode: 'snippet', height: 640 });
  });
});

describe('form providers', () => {
  const detect = (props: { mode: 'iframe' | 'snippet'; url?: string; code?: string }) =>
    detectFormProvider({ url: '', code: '', ...props });

  it('detects providers from URLs and snippets', () => {
    expect(detect({ mode: 'snippet', code: STORELINK_SNIPPET })?.id).toBe('storelink');
    const t = detect({ mode: 'iframe', url: 'https://tally.so/r/abc' });
    expect(t?.id).toBe('tally');
    expect(t?.embedUrl(new URL('https://tally.so/r/abc'))).toBe(
      'https://tally.so/embed/abc?transparentBackground=1',
    );
    expect(detect({ mode: 'iframe', url: 'https://evil.test/?u=tally.so' })).toBeNull();
    expect(
      detect({ mode: 'snippet', code: '<script src="https://evil.test/tally.so.js">' }),
    ).toBeNull();
    expect(detect({ mode: 'iframe', url: 'https://example.com/form' })).toBeNull();
    expect(detect({ mode: 'iframe', url: 'not a url' })).toBeNull();
  });
  it('Google Forms is embedded and reports nothing; Storelink reports its own conversions', () => {
    const g = detect({ mode: 'iframe', url: 'https://docs.google.com/forms/d/e/x/viewform' });
    expect(g?.conversions).toBe('none');
    expect(g?.embedUrl(new URL('https://docs.google.com/forms/d/e/x/viewform'))).toBe(
      'https://docs.google.com/forms/d/e/x/viewform?embedded=true',
    );
    expect(detect({ mode: 'iframe', url: 'https://docs.google.com/document/d/x' })).toBeNull();
    expect(detect({ mode: 'snippet', code: STORELINK_SNIPPET })?.conversions).toBe('self');
  });
});

describe('form tracking note', () => {
  it('says who sends the conversion', () => {
    const note = (props: object) => formTrackingNote(FormEmbedPropsSchema.parse(props));
    expect(note(storelink)).toBe(
      'Storelink sends its own conversion events. Set the Meta Pixel and events in Storelink, using the same Pixel ID as this page.',
    );
    expect(note(tally)).toBe('Fires Lead when the form is submitted.');
    expect(note({ mode: 'iframe', url: 'https://docs.google.com/forms/d/e/x/viewform' })).toBe(
      "Google Forms doesn't report submits, so Lead can't fire here.",
    );
    expect(note({ mode: 'snippet', code: '<div>x</div>' })).toBe(
      "This form doesn't report submits, so Lead can't fire here.",
    );
  });
});

describe('form embed render', () => {
  it('renders valid HTML with only required fields', async () => {
    const page = (props: unknown) =>
      renderPage(parseDocument(singleBlockDoc('form-embed', props)), { mode: 'export' }).html;
    expect(await validateHtml(page({}))).toEqual([]);
    expect(await validateHtml(page(tally))).toEqual([]);
  });

  it('export iframe mode: lazy below the fold, eager above, src sanitized', () => {
    const above = renderBlock(formEmbed, tally);
    expect(above).toContain(
      '<iframe class="lp-form__frame" src="https://tally.so/embed/abc?transparentBackground=1" title="Formulir pemesanan" height="640" loading="eager" data-lp-pass data-lp-form-frame></iframe>',
    );
    expect(above).toContain('data-lp-form="tally"');
    const below = renderBlock(formEmbed, tally, { block: { sectionIndex: 2 } });
    expect(below).toContain('loading="lazy"');
    const hostile = renderBlock(formEmbed, { mode: 'iframe', url: 'javascript:alert(1)' });
    expect(hostile).not.toContain('<iframe');
    expect(hostile).toContain('Alamat formulir belum diisi');
  });

  it('snippet code appears verbatim in export and never in preview', () => {
    expect(renderBlock(formEmbed, storelink)).toContain(STORELINK_SNIPPET);
    const preview = renderBlock(formEmbed, storelink, { mode: 'preview' });
    expect(preview).not.toContain('<script');
    expect(preview).not.toContain('storelink.id');
  });

  it('a Storelink form ships no form snippet and no thank-you attribute', () => {
    const props = FormEmbedPropsSchema.parse({ ...storelink, thankYouUrl: 'https://x.example/' });
    expect(formEmbed.snippet?.isNeeded?.(props)).toBe(false);
    expect(renderBlock(formEmbed, props)).not.toContain('data-lp-thanks');
    const tallyProps = FormEmbedPropsSchema.parse({ ...tally, thankYouUrl: 'https://x.example/' });
    expect(formEmbed.snippet?.isNeeded?.(tallyProps)).toBe(true);
    expect(renderBlock(formEmbed, tallyProps)).toContain('data-lp-thanks="https://x.example/"');
  });

  it('preview shows a placeholder and no iframe', () => {
    const preview = renderBlock(formEmbed, tally, { mode: 'preview' });
    expect(preview).not.toContain('<iframe');
    expect(preview).toContain('Form · Tally');
    expect(preview).toContain('Shows in the exported page');
    expect(preview).toContain('data-lp-field="heading"');
    expect(renderBlock(formEmbed, storelink, { mode: 'preview' })).toContain('Form · Storelink');
    expect(
      renderBlock(formEmbed, { mode: 'snippet', code: '<div>x</div>' }, { mode: 'preview' }),
    ).toContain('Form · Embedded form');
  });

  it('matches the snapshot', async () => {
    await expect(
      renderBlock(formEmbed, { ...tally, subheading: 'Isi data **pengiriman**' }),
    ).toMatchFileSnapshot('./__snapshots__/form-embed.html');
  });
});

describe('form embed snippet', () => {
  /** A page with one Tally form whose iframe's window is `frame`. */
  function load(thanks = '') {
    const win = new Window({ url: 'https://landing.example/' });
    win.document.body.innerHTML = `<div class="lp-form" data-lp-form="tally"${
      thanks ? ` data-lp-thanks="${thanks}"` : ''
    }><iframe title="f"></iframe></div>`;
    const frame = { name: 'tally-frame' };
    Object.defineProperty(win.document.querySelector('iframe')!, 'contentWindow', { value: frame });
    const leads: unknown[] = [];
    win.document.addEventListener('lp:track', (e) =>
      leads.push((e as unknown as CustomEvent).detail),
    );
    const assigned: string[] = [];
    Object.defineProperty(win.location, 'assign', { value: (url: string) => assigned.push(url) });
    win.eval(snippet.src);
    const post = (data: unknown, origin = 'https://tally.so', source: unknown = frame) =>
      win.dispatchEvent(new win.MessageEvent('message', { data, origin, source: source as never }));
    return { win, leads, assigned, post };
  }
  const submitted = JSON.stringify({ event: 'Tally.FormSubmitted', payload: {} });

  it('a Tally submit fires Lead once and redirects after 500 ms', async () => {
    const page = load('https://thanks.example/');
    page.post(submitted);
    expect(page.leads).toEqual([{ name: 'Lead', params: {} }]);
    await new Promise((r) => setTimeout(r, 450));
    expect(page.assigned).toEqual([]);
    await new Promise((r) => setTimeout(r, 150));
    expect(page.assigned).toEqual(['https://thanks.example/']);
  });

  it('a submit message from another frame or origin is ignored; a second one fires nothing', () => {
    const page = load();
    page.post(submitted, 'https://evil.example');
    page.post(submitted, 'https://tally.so', { other: true });
    page.post(submitted, 'https://tally.so', page.win);
    page.post(JSON.stringify({ event: 'Tally.FormLoaded' }));
    expect(page.leads).toEqual([]);
    page.post(submitted);
    page.post(submitted);
    expect(page.leads).toHaveLength(1);
    expect(page.assigned).toEqual([]);
  });

  it('stays within 1024 bytes minified', () => {
    expect(byteLength(snippet.min)).toBeLessThanOrEqual(1024);
  });
});
