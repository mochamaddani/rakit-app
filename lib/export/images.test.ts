import { describe, expect, it } from 'vitest';
import { parseDocument } from '@/lib/schema/document';
import { collectImages } from './images';

const doc = parseDocument({
  schemaVersion: 1,
  settings: {
    seo: {
      ogImage: { src: 'https://cdn.example/og.webp' },
      favicon: { src: 'https://cdn.example/f.png' },
    },
  },
  sections: [
    {
      id: 's1',
      blocks: [
        {
          id: 'bHero',
          type: 'hero',
          props: { headline: 'H', image: { src: 'https://cdn.example/h.webp', alt: 'Hero' } },
        },
        {
          id: 'bCar',
          type: 'product-carousel',
          props: {
            items: [
              { id: 'p1', title: 'A', image: { src: 'https://cdn.example/a.webp', alt: '' } },
              { id: 'p2', title: 'B' },
            ],
          },
        },
      ],
    },
  ],
});

describe('collectImages', () => {
  it('finds images in nested props, lists and settings', () => {
    expect(collectImages(doc)).toEqual([
      { blockId: 'bHero', path: ['image'], src: 'https://cdn.example/h.webp', alt: 'Hero' },
      { blockId: 'bCar', path: ['items', 0, 'image'], src: 'https://cdn.example/a.webp', alt: '' },
      { blockId: 'bCar', path: ['items', 1, 'image'], src: '', alt: '' },
      { blockId: null, path: ['seo', 'ogImage'], src: 'https://cdn.example/og.webp', alt: '' },
      { blockId: null, path: ['seo', 'favicon'], src: 'https://cdn.example/f.png', alt: '' },
    ]);
  });
});
