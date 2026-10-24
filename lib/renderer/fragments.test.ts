import { describe, expect, it } from 'vitest';
import { testContext } from '@/lib/blocks/test-utils';
import { renderCta, renderIcon, renderImage, renderStars } from '@/lib/renderer/fragments';

const ctx = testContext();

describe('fragments', () => {
  it('renders a lazy image sized from the aspect ratio when intrinsic size is unknown', () => {
    expect(
      String(
        renderImage(
          { src: 'https://cdn.x/a.webp', alt: 'Botol' },
          { className: 'lp-card__img', aspectRatio: '4:5' },
          ctx,
        ),
      ),
    ).toBe(
      '<img class="lp-card__img" src="https://cdn.x/a.webp" alt="Botol" width="800" height="1000" loading="lazy" decoding="async">',
    );
  });
  it('uses intrinsic size, eager loading and high priority when asked', () => {
    expect(
      String(
        renderImage(
          { src: 'https://cdn.x/h.webp', alt: '', width: 1600, height: 900 },
          { className: 'lp-hero__img', eager: true, highPriority: true },
          ctx,
        ),
      ),
    ).toBe(
      '<img class="lp-hero__img" src="https://cdn.x/h.webp" alt="" width="1600" height="900" loading="eager" decoding="async" fetchpriority="high">',
    );
  });
  it('omits width and height when neither size nor ratio is known', () => {
    expect(
      String(renderImage({ src: 'https://x.y/z.webp', alt: 'a' }, { className: 'c' }, ctx)),
    ).toBe('<img class="c" src="https://x.y/z.webp" alt="a" loading="lazy" decoding="async">');
  });
  it('renders a placeholder for a missing or unsafe image', () => {
    expect(
      String(
        renderImage(
          { src: '', alt: 'Botol' },
          { className: 'lp-card__img', aspectRatio: '1:1' },
          ctx,
        ),
      ),
    ).toBe('<div class="lp-card__img lp-img-ph" role="img" aria-label="Botol"></div>');
    expect(String(renderImage({ src: 'javascript:x', alt: '' }, { className: 'c' }, ctx))).toBe(
      '<div class="c lp-img-ph" aria-hidden="true"></div>',
    );
  });
  it('renders CTAs with tracking hooks and safe new-tab links', () => {
    expect(
      String(
        renderCta(
          {
            label: 'Pesan Sekarang',
            link: { kind: 'url', url: 'https://wa.me/62', newTab: true },
            variant: 'primary',
            event: 'none',
          },
          ctx,
        ),
      ),
    ).toBe(
      '<a class="lp-btn lp-btn--primary" href="https://wa.me/62" target="_blank" rel="noopener" data-lp-cta>Pesan Sekarang</a>',
    );
    expect(
      String(
        renderCta(
          { label: 'Beli', link: { kind: 'default' }, variant: 'secondary', event: 'none' },
          ctx,
          {
            className: 'lp-btn--block',
            dataAttrs: { 'lp-item': 'p1' },
          },
        ),
      ),
    ).toBe(
      '<a class="lp-btn lp-btn--secondary lp-btn--block" href="#" data-lp-cta data-lp-item="p1">Beli</a>',
    );
  });
  it('renders stars with an accessible, localized label and clamps the rating', () => {
    expect(String(renderStars(4.5, ctx))).toBe(
      '<span class="lp-stars" style="--lp-rating:90%" aria-hidden="true"></span><span class="lp-sr">Rating 4,5 dari 5</span>',
    );
    expect(String(renderStars(7, ctx))).toContain('--lp-rating:100%');
  });
  it('renders decorative inline SVG icons', () => {
    const svg = String(renderIcon('check'));
    expect(
      svg.startsWith(
        '<svg class="lp-icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor"',
      ),
    ).toBe(true);
    expect(svg).toContain('aria-hidden="true"');
  });
});
