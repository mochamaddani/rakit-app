import { describe, expect, it } from 'vitest';
import { productCarousel } from '@/lib/blocks/special/product-carousel';
import { hero } from '@/lib/blocks/hero';
import { findImages } from './images';

describe('findImages', () => {
  it('finds images through control metadata, in order, with their paths', () => {
    const props = productCarousel.schema.parse({
      items: [
        { id: 'a', title: 'A', image: { src: 'https://x.test/a.webp', alt: 'A' } },
        { id: 'b', title: 'B' },
      ],
    });
    expect(findImages(productCarousel.schema, props)).toEqual([
      { path: ['items', 0, 'image'], src: 'https://x.test/a.webp', alt: 'A' },
      { path: ['items', 1, 'image'], src: '', alt: '' },
    ]);
  });

  it('skips absent optional images and prefixes the given path', () => {
    const props = hero.schema.parse({ headline: 'H' });
    expect(findImages(hero.schema, props)).toEqual([]);
    const withImage = hero.schema.parse({ headline: 'H', image: { src: 'a.png', alt: '' } });
    expect(findImages(hero.schema, withImage, ['props'])).toEqual([
      { path: ['props', 'image'], src: 'a.png', alt: '' },
    ]);
  });
});
