import { describe, expect, it } from 'vitest';
import { gallery } from '@/lib/blocks/gallery';
import { renderBlock, singleBlockDoc } from '@/lib/blocks/test-utils';
import { collectImages } from '@/lib/export/images';
import { renderPage } from '@/lib/renderer/page';
import { parseDocument } from '@/lib/schema/document';
import { validateHtml } from '@/tests/helpers/validate-html';

const props = {
  heading: 'Lihat **lebih dekat**',
  items: [
    { id: 'g1', image: { src: 'https://x.test/1.webp', alt: 'Satu' }, caption: 'Kemasan' },
    { id: 'g2', image: { src: 'https://x.test/2.webp', alt: 'Dua' } },
  ],
  columns: { mobile: 1, desktop: 4 },
  aspectRatio: '4:5',
};

describe('gallery block', () => {
  it('sets column variables and captions only when present', () => {
    const out = renderBlock(gallery, props);
    expect(out).toContain('style="--lp-cols-m:1;--lp-cols-d:4;--lp-ar:4/5;--lp-fit:cover"');
    expect(out.match(/<figure class="lp-gallery__item">/g)).toHaveLength(2);
    expect(out.match(/<figcaption/g)).toHaveLength(1);
    expect(out).toContain('<figcaption class="lp-gallery__caption">Kemasan</figcaption>');
  });
  it('gives only the first image priority', () => {
    expect(renderBlock(gallery, props).match(/fetchpriority="high"/g)).toHaveLength(1);
    const later = renderBlock(gallery, props, { block: { sectionIndex: 2 } });
    expect(later).not.toContain('fetchpriority');
    expect(later).not.toContain('loading="eager"');
  });
  it('rejects 3 columns on phones', () => {
    expect(gallery.schema.safeParse({ columns: { mobile: 3 } }).success).toBe(false);
  });
  it('collectImages finds every gallery image', () => {
    const doc = parseDocument(singleBlockDoc('gallery', props));
    expect(collectImages(doc).map((image) => image.path)).toEqual([
      ['items', 0, 'image'],
      ['items', 1, 'image'],
    ]);
  });
  it('renders valid HTML with only required fields', async () => {
    for (const p of [{}, props]) {
      expect(
        await validateHtml(
          renderPage(parseDocument(singleBlockDoc('gallery', p)), { mode: 'export' }).html,
        ),
      ).toEqual([]);
    }
  });
  it('matches the snapshot', async () => {
    await expect(renderBlock(gallery, props)).toMatchFileSnapshot('./__snapshots__/gallery.html');
  });
});
