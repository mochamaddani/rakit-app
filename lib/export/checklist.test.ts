import { describe, expect, it } from 'vitest';
import { parseDocument, type PageDocument } from '@/lib/schema/document';
import { trackingDocument } from '@/tests/fixtures/example-document';
import { STORELINK_SNIPPET } from '@/tests/fixtures/forms';
import { preExportChecklist, type ChecklistInput } from './checklist';

type Raw = typeof trackingDocument;
/** trackingDocument without its custom code, which the checklist always names. */
const variant = (change: (raw: Raw) => void): PageDocument => {
  const raw = structuredClone(trackingDocument);
  raw.settings.tracking.headCode = '';
  raw.settings.tracking.bodyCode = '';
  change(raw);
  return parseDocument(raw);
};
const complete = variant(() => {});
const input = (doc: PageDocument, extra: Partial<ChecklistInput> = {}): ChecklistInput => ({
  doc,
  tracking: true,
  bytes: 120_000,
  images: { failed: 0, large: 0 },
  ...extra,
});
const ids = (i: ChecklistInput) => preExportChecklist(i).map((item) => item.id);
const item = (i: ChecklistInput, id: string) => preExportChecklist(i).find((x) => x.id === id);
type RawBlock = { id: string; type: string; props: Record<string, unknown> };
const blocks = (raw: Raw) => raw.sections.flatMap((s) => s.blocks as unknown as RawBlock[]);
const form = (raw: Raw) => blocks(raw).find((b) => b.type === 'form-embed')!;

describe('pre-export checklist', () => {
  it('a complete page has no items', () => {
    expect(preExportChecklist(input(complete))).toEqual([]);
  });

  it('a Storelink page has exactly formSelf and customCode', () => {
    const doc = variant((raw) => {
      form(raw).props = { mode: 'snippet', code: STORELINK_SNIPPET };
    });
    expect(ids(input(doc))).toEqual(['formSelf', 'customCode']);
    expect(item(input(doc), 'formSelf')?.message).toBe(
      "Storelink sends its own conversion events: check that its Meta Pixel ID matches this page's.",
    );
    expect(item(input(doc), 'customCode')?.message).toBe(
      'Custom code runs on this page: form embed code.',
    );
  });

  it('title and description', () => {
    const doc = variant((raw) => {
      raw.settings.seo.title = ' ';
      raw.settings.seo.description = '';
    });
    expect(item(input(doc), 'title')?.message).toBe(
      'Add a page title (Page settings → Search engines).',
    );
    expect(item(input(doc), 'description')?.message).toBe('Add a page description.');
  });

  it('privacy link', () => {
    const doc = variant((raw) => {
      (blocks(raw).find((b) => b.type === 'footer')!.props.links as { label: string }[])[0]!.label =
        'Kontak';
    });
    expect(item(input(doc), 'privacy')?.message).toBe('Add a privacy policy link to the footer.');
    const noFooter = variant((raw) => {
      raw.sections = raw.sections.filter((s) => s.id !== 'sFoot');
    });
    expect(ids(input(noFooter))).toContain('privacy');
  });

  it('no form, forms without a signal and two Storelink forms', () => {
    const none = variant((raw) => {
      raw.sections = raw.sections.filter((s) => s.id !== 'sOrder');
      raw.settings.defaultCta = { kind: 'url', url: 'https://shop.example/' } as never;
    });
    expect(item(input(none), 'form')?.message).toBe('The page has no form.');
    const google = variant((raw) => {
      form(raw).props = { mode: 'iframe', url: 'https://docs.google.com/forms/d/e/x/viewform' };
    });
    expect(item(input(google), 'formSignal')).toMatchObject({
      message: "Lead can't be tracked for this form: Google Forms doesn't report submits.",
      blockIds: ['bForm'],
    });
    const other = variant((raw) => {
      form(raw).props = { mode: 'iframe', url: 'https://forms.example/x' };
    });
    expect(item(input(other), 'formSignal')?.message).toBe(
      "Lead can't be tracked for this form: the provider doesn't report submits.",
    );
    const twice = variant((raw) => {
      form(raw).props = { mode: 'snippet', code: STORELINK_SNIPPET };
      raw.sections[1]!.blocks.push({
        id: 'bForm2',
        type: 'form-embed',
        props: { mode: 'snippet', code: STORELINK_SNIPPET },
      } as never);
    });
    expect(item(input(twice), 'formTwice')).toMatchObject({
      message: 'Only one Storelink form works per page.',
      blockIds: ['bForm', 'bForm2'],
    });
  });

  it('tracking ids only matter when tracking is included', () => {
    const doc = variant((raw) => {
      Object.assign(raw.settings.tracking, {
        metaPixelId: '',
        ga4Id: '',
        googleAdsId: '',
        gtmId: '',
      });
    });
    expect(item(input(doc), 'tracking')?.message).toBe('No tracking IDs are set.');
    expect(ids(input(doc, { tracking: false }))).not.toContain('tracking');
  });

  it('default button target', () => {
    const doc = variant((raw) => {
      delete (raw.settings as { defaultCta?: unknown }).defaultCta;
    });
    expect(item(input(doc), 'defaultCta')?.message).toBe(
      'Buttons set to the page default go nowhere. Set a default button target.',
    );
  });

  it('alt text and placeholders', () => {
    const doc = variant((raw) => {
      const hero = blocks(raw).find((b) => b.type === 'hero')!;
      hero.props.image = { src: 'https://cdn.example/h.webp', alt: '' };
      hero.props.headline = 'Teh [REPLACE: nama] [REPLACE: rasa]';
      raw.settings.seo.description = '[REPLACE: deskripsi]';
    });
    expect(item(input(doc), 'alt')).toEqual({
      id: 'alt',
      level: 'warn',
      message: '1 image has no alt text.',
      blockIds: ['bHero'],
    });
    expect(item(input(doc), 'placeholder')).toMatchObject({
      message: '3 [REPLACE: …] placeholders remain.',
      blockIds: ['bHero'],
    });
  });

  it('custom code is named only while tracking is included', () => {
    const withCode = parseDocument(trackingDocument);
    expect(item(input(withCode), 'customCode')?.message).toBe(
      'Custom code runs on this page: head code, body code.',
    );
    expect(ids(input(withCode, { tracking: false }))).not.toContain('customCode');
  });

  it('images that stayed links, large images and the file size', () => {
    expect(
      item(input(complete, { images: { failed: 2, large: 1 } }), 'imagesFailed')?.message,
    ).toBe("2 images couldn't be inlined and stay links.");
    expect(item(input(complete, { images: { failed: 0, large: 1 } }), 'largeImages')?.message).toBe(
      '1 image is over 300 KB.',
    );
    expect(item(input(complete, { bytes: 1_000_000 }), 'size')).toBeUndefined();
    expect(item(input(complete, { bytes: 1_400_000 }), 'size')).toEqual({
      id: 'size',
      level: 'warn',
      message: 'The file is 1.4 MB, over 1 MB. Hosted images make it lighter.',
    });
    expect(item(input(complete, { bytes: 3_200_000 }), 'size')).toEqual({
      id: 'size',
      level: 'hard',
      message: 'The file is 3.2 MB, over 3 MB. Use Hosted images.',
    });
  });

  it('an empty or unreadable form is named, and gets no signal warning', () => {
    for (const props of [
      { mode: 'snippet', code: '  ' },
      { mode: 'iframe', url: 'tally.so/r/abc' },
    ]) {
      const doc = variant((raw) => {
        form(raw).props = props;
      });
      expect(item(input(doc), 'formMissing')).toEqual({
        id: 'formMissing',
        level: 'hard',
        message: 'A form has no embed code or address, so the page shows "Form address missing".',
        blockIds: ['bForm'],
      });
      expect(ids(input(doc))).not.toContain('formSignal');
    }
  });
});
