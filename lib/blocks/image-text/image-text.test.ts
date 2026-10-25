import { describe, expect, it } from 'vitest';
import { imageText } from '@/lib/blocks/image-text';
import { renderBlock, singleBlockDoc } from '@/lib/blocks/test-utils';
import { renderPage } from '@/lib/renderer/page';
import { parseDocument } from '@/lib/schema/document';
import { sequentialIds } from '@/lib/schema/ids';
import { validateHtml } from '@/tests/helpers/validate-html';

const props = {
  eyebrow: 'Kenapa kami',
  heading: 'Diseduh **alami**',
  body: 'Daun pilihan.\nTanpa pengawet.',
  points: [
    { id: 'p1', text: 'Tanpa gula' },
    { id: 'p2', text: 'Halal' },
  ],
  cta: { label: 'Pesan', link: { kind: 'default' } },
  image: { src: 'https://x.test/a.webp', alt: 'Teh', width: 800, height: 1000 },
  imageSide: 'right',
};

describe('image-text block', () => {
  it('puts the image first in the markup and flips it with a class', () => {
    const out = renderBlock(imageText, props);
    expect(out).toMatch(
      /^<div class="lp-image-text lp-image-text--right" style="--lp-ar:4\/5"><div class="lp-image-text__media"><img/,
    );
    expect(out.indexOf('lp-image-text__media')).toBeLessThan(out.indexOf('lp-image-text__text'));
    expect(renderBlock(imageText, { ...props, imageSide: 'left' })).toContain(
      'lp-image-text--left',
    );
  });
  it('marks heading, body and points for inline editing', () => {
    const out = renderBlock(imageText, props, { mode: 'preview' });
    expect(out).toContain('<h2 class="lp-h2" data-lp-field="heading" data-lp-rich>');
    expect(out).toContain('data-lp-field="body" data-lp-rich');
    expect(out).toContain('data-lp-field="points.1.text"');
    expect(out).toContain('data-lp-field="cta.label"');
  });
  it('never takes the page h1', () => {
    expect(renderBlock(imageText, props)).not.toContain('<h1');
  });
  it('gives its image priority only when it owns the page priority', () => {
    expect(renderBlock(imageText, props)).toContain('fetchpriority="high"');
    expect(renderBlock(imageText, props, { priorityBlockId: null })).not.toContain('fetchpriority');
  });
  it('defaults invent nothing', () => {
    const defaults = imageText.defaultProps(sequentialIds());
    expect(defaults.body).toMatch(/^\[REPLACE:/);
    expect(defaults.points.every((p) => p.text.startsWith('[REPLACE:'))).toBe(true);
    expect(defaults.cta).toBeUndefined();
  });
  it('requires a heading', () => {
    expect(imageText.schema.safeParse({}).success).toBe(false);
  });
  it('renders valid HTML with only required fields', async () => {
    for (const p of [{ heading: 'H' }, props]) {
      expect(
        await validateHtml(
          renderPage(parseDocument(singleBlockDoc('image-text', p)), { mode: 'export' }).html,
        ),
      ).toEqual([]);
    }
  });
  it('matches the snapshot', async () => {
    await expect(renderBlock(imageText, props)).toMatchFileSnapshot(
      './__snapshots__/image-text.html',
    );
  });
});
