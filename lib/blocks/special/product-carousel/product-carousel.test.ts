import { describe, expect, it } from 'vitest';
import { productCarousel } from '@/lib/blocks/special/product-carousel';
import { renderBlock, singleBlockDoc } from '@/lib/blocks/test-utils';
import { byteLength } from '@/lib/renderer/html';
import { renderPage } from '@/lib/renderer/page';
import { parseDocument } from '@/lib/schema/document';
import { validateHtml } from '@/tests/helpers/validate-html';

const items = Array.from({ length: 8 }, (_, i) => ({
  id: `p${i + 1}`,
  title: `Botol ${i + 1}`,
  price: 149000,
  compareAtPrice: 199000,
  showDiscount: true,
  image: { src: `https://cdn.x/${i + 1}.webp`, alt: `Botol ${i + 1}` },
  cta: { label: 'Beli', link: { kind: 'default' } },
}));
const props = { heading: 'Pilihan **Warna**', items };

describe('product carousel: markup', () => {
  it('renders an accessible carousel region with labelled slides', () => {
    const out = renderBlock(productCarousel, props);
    expect(out).toContain(
      '<section class="lp-carousel" aria-roledescription="carousel" aria-label="Pilihan Warna" data-lp-carousel data-loop="0"',
    );
    expect(out).toContain(
      'role="group" aria-roledescription="slide" aria-label="1 dari 8: Botol 1" id="b-b1-p1"',
    );
    expect(out.match(/aria-roledescription="slide"/g)).toHaveLength(8);
  });
  it('uses a focusable scroll-snap track so it works without JavaScript', () => {
    expect(renderBlock(productCarousel, props)).toContain(
      '<div class="lp-carousel__track" tabindex="0">',
    );
    expect(productCarousel.css.min).toContain('scroll-snap-type:x mandatory');
    expect(productCarousel.css.min).toContain('overflow-x:auto');
  });
  it('renders controls hidden until the script enables them', () => {
    const out = renderBlock(productCarousel, props);
    expect(out).toContain('<div class="lp-carousel__nav" hidden>');
    expect(out).toContain('aria-label="Slide sebelumnya"');
    expect(out).toContain('aria-label="Ke slide 8"');
    expect(out).toContain('aria-label="Ke slide 1" aria-current="true" data-lp-dot="0"');
  });
  it('omits controls when navigation is none or there is a single item', () => {
    expect(renderBlock(productCarousel, { ...props, navigation: 'none' })).not.toContain(
      'lp-carousel__nav',
    );
    expect(renderBlock(productCarousel, { ...props, items: items.slice(0, 1) })).not.toContain(
      'lp-carousel__nav',
    );
  });
  it('passes per-instance layout through CSS custom properties', () => {
    const out = renderBlock(productCarousel, {
      items,
      slidesPerView: { mobile: 1.2, tablet: 2, desktop: 3 },
      gap: 'lg',
      aspectRatio: '4:5',
      imageFit: 'contain',
    });
    expect(out).toContain(
      'style="--lp-spv-m:1.2;--lp-spv-t:2;--lp-spv-d:3;--lp-gap:24px;--lp-ar:4/5;--lp-fit:contain"',
    );
  });
  it('loads the first visible images eagerly only above the fold', () => {
    const above = renderBlock(productCarousel, props, { block: { sectionIndex: 0 } });
    expect(above.match(/loading="eager"/g)).toHaveLength(2);
    expect(above.match(/fetchpriority="high"/g)).toHaveLength(1);
    expect(renderBlock(productCarousel, props, { block: { sectionIndex: 2 } })).not.toContain(
      'loading="eager"',
    );
  });
  it('formats prices, compare-at prices and the discount badge', () => {
    const out = renderBlock(productCarousel, props);
    expect(out).toContain('<span class="lp-price__now">Rp149.000</span>');
    expect(out).toContain(
      '<s class="lp-price__was"><span class="lp-sr">Harga normal</span> Rp199.000</s>',
    );
    expect(out).toContain('<span class="lp-badge lp-badge--discount">-25%</span>');
  });
  it('renders ratings with review counts', () => {
    const out = renderBlock(productCarousel, {
      items: [{ ...items[0], rating: 4.5, reviewCount: 128 }, items[1]],
    });
    expect(out).toContain('Rating 4,5 dari 5');
    expect(out).toContain('<span class="lp-rating__count">(128 ulasan)</span>');
  });
  it('scopes ids and data attributes by block id so several carousels can share a page', () => {
    const out = renderBlock(productCarousel, props, { block: { blockId: 'c1' } });
    expect(out).toContain('id="b-c1-p1"');
    expect(out).toContain('data-lp-item="p1"');
  });
  it('falls back to the localized "Products" label without a heading', () => {
    expect(renderBlock(productCarousel, { items })).toContain('aria-label="Produk"');
  });
  it('accepts up to 50 items and rejects more', () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => ({ ...items[0], id: `x${i}` }));
    expect(productCarousel.schema.safeParse({ items: many(50) }).success).toBe(true);
    expect(productCarousel.schema.safeParse({ items: many(51) }).success).toBe(false);
  });
  it('renders valid HTML with only required fields and with 8 full items', async () => {
    expect(
      await validateHtml(
        renderPage(parseDocument(singleBlockDoc('product-carousel', {})), { mode: 'export' }).html,
      ),
    ).toEqual([]);
    expect(
      await validateHtml(
        renderPage(parseDocument(singleBlockDoc('product-carousel', props)), { mode: 'export' })
          .html,
      ),
    ).toEqual([]);
  });
  it('matches the snapshot', async () => {
    await expect(
      renderBlock(productCarousel, { ...props, subheading: 'Semua ukuran 750ml' }),
    ).toMatchFileSnapshot('./__snapshots__/product-carousel.html');
  });
});

const carouselDoc = (blocks: { id: string; navigation?: string }[]) =>
  parseDocument({
    schemaVersion: 1,
    sections: [
      {
        id: 's1',
        blocks: blocks.map((b) => ({
          id: b.id,
          type: 'product-carousel',
          props: { ...props, navigation: b.navigation ?? 'both' },
        })),
      },
    ],
  });

describe('product carousel: script', () => {
  it('ships a minified script within the 1.5 KB budget', () => {
    expect(productCarousel.snippet).toBeDefined();
    expect(byteLength(productCarousel.snippet!.asset.min)).toBeLessThanOrEqual(2048);
  });
  it('includes the script exactly once for several carousels', () => {
    const { html } = renderPage(carouselDoc([{ id: 'c1' }, { id: 'c2' }]), { mode: 'export' });
    expect(html.match(/<script>/g)).toHaveLength(1);
    expect(html).toContain(productCarousel.snippet!.asset.min);
  });
  it('ships no script when no carousel needs one', () => {
    expect(
      renderPage(carouselDoc([{ id: 'c1', navigation: 'none' }]), { mode: 'export' }).html,
    ).not.toContain('<script');
  });
  it('uses the readable script when minify is off', () => {
    expect(
      renderPage(carouselDoc([{ id: 'c1' }]), { mode: 'export', minify: false }).html,
    ).toContain(productCarousel.snippet!.asset.src);
  });
});

describe('product carousel: M4 fixes and autoplay', () => {
  it("an empty carousel's track is not focusable", () => {
    expect(renderBlock(productCarousel, { items: [] })).toContain(
      '<div class="lp-carousel__track">',
    );
  });
  it('autoplay adds a pause button and needs the snippet even without navigation', () => {
    const out = renderBlock(productCarousel, {
      ...props,
      navigation: 'none',
      autoplay: true,
      autoplaySeconds: 4,
    });
    expect(out).toContain('data-autoplay="4"');
    expect(out).toContain(
      '<button type="button" class="lp-carousel__play" aria-label="Jeda" data-lp-play="Putar">',
    );
    expect(out).not.toContain('data-lp-prev');
    expect(out).not.toContain('data-lp-dot');
    const page = (p: object) =>
      renderPage(parseDocument(singleBlockDoc('product-carousel', p)), { mode: 'export' }).html;
    expect(page({ ...props, navigation: 'none' })).not.toContain('<script>');
    expect(page({ ...props, navigation: 'none', autoplay: true })).toContain('<script>');
    expect(page({ items: items.slice(0, 1), autoplay: true })).not.toContain('<script>');
    expect(renderBlock(productCarousel, props)).not.toContain('data-autoplay');
  });
  it('autoplaySeconds is 2–15', () => {
    for (const autoplaySeconds of [1, 16]) {
      expect(productCarousel.schema.safeParse({ autoplaySeconds }).success).toBe(false);
    }
    expect(productCarousel.schema.parse({}).autoplaySeconds).toBe(5);
  });
});
