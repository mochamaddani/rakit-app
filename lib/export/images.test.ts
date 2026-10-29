import { describe, expect, it } from 'vitest';
import { parseDocument } from '@/lib/schema/document';
import { collectImages, inlineImages, portableVariant, type FetchedImage } from './images';

const doc = parseDocument({
  schemaVersion: 2,
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

const ASSET = (width: number) =>
  `http://127.0.0.1:54321/storage/v1/object/public/assets/11111111-2222-4333-8444-555555555555/66666666-7777-4888-9999-000000000000-${width}.webp`;

describe('portableVariant', () => {
  it('portableVariant swaps only asset 1600 URLs', () => {
    expect(portableVariant(ASSET(1600))).toBe(ASSET(800));
    expect(portableVariant(ASSET(800))).toBe(ASSET(800));
    expect(portableVariant('https://cdn.example/photo-1600.webp')).toBe(
      'https://cdn.example/photo-1600.webp',
    );
  });
});

describe('inlineImages', () => {
  const png = (bytes: number[]): FetchedImage => ({
    ok: true,
    mime: 'image/png',
    bytes: new Uint8Array(bytes),
  });
  const withImages = (srcs: string[]) =>
    parseDocument({
      schemaVersion: 2,
      sections: [
        {
          id: 's1',
          blocks: [
            {
              id: 'bCar',
              type: 'product-carousel',
              props: {
                items: srcs.map((src, i) => ({
                  id: `p${i}`,
                  title: 'A',
                  image: { src, alt: 'x' },
                })),
              },
            },
          ],
        },
      ],
      settings: { seo: { favicon: { src: 'https://cdn.example/f.png' } } },
    });
  const srcs = (doc: ReturnType<typeof withImages>) =>
    (doc.sections[0]!.blocks[0]!.props as { items: { image: { src: string } }[] }).items.map(
      (item) => item.image.src,
    );

  it('inlines each URL once as a data URI and leaves the input untouched', async () => {
    const doc = withImages([ASSET(1600), ASSET(1600), 'data:image/png;base64,AA==', '']);
    const fetched: string[] = [];
    const result = await inlineImages(doc, {
      fetchImage: async (url) => {
        fetched.push(url);
        return png([1, 2, 3]);
      },
    });
    expect(fetched).toEqual([ASSET(800)]);
    expect(srcs(result.doc)).toEqual([
      'data:image/png;base64,AQID',
      'data:image/png;base64,AQID',
      'data:image/png;base64,AA==',
      '',
    ]);
    expect(srcs(doc)[0]).toBe(ASSET(1600));
    expect(result.doc.settings.seo.favicon?.src).toBe('https://cdn.example/f.png');
    expect(result.failed).toEqual([]);
  });

  it("an image that can't be fetched stays a link and is reported", async () => {
    const doc = withImages(['https://blocked.example/a.jpg', 'https://site.example/page']);
    const result = await inlineImages(doc, {
      fetchImage: async (url) =>
        url.includes('blocked')
          ? { ok: false, reason: 'Failed to fetch' }
          : { ok: true, mime: 'text/html; charset=utf-8', bytes: new Uint8Array([60]) },
    });
    expect(srcs(result.doc)).toEqual([
      'https://blocked.example/a.jpg',
      'https://site.example/page',
    ]);
    expect(result.failed.map((ref) => ref.src)).toEqual([
      'https://blocked.example/a.jpg',
      'https://site.example/page',
    ]);
  });

  it('flags data URIs over 300 KB', async () => {
    const doc = withImages(['https://cdn.example/big.webp', 'https://cdn.example/small.webp']);
    const result = await inlineImages(doc, {
      fetchImage: async (url) => ({
        ok: true,
        mime: 'image/webp',
        bytes: new Uint8Array(url.includes('big') ? 240_000 : 1000),
      }),
    });
    expect(result.large.map((ref) => ref.path)).toEqual([['items', 0, 'image']]);
  });

  it('requests every image before waiting for any', async () => {
    const doc = withImages([
      'https://a.example/1.webp',
      'https://a.example/2.webp',
      'https://a.example/3.webp',
    ]);
    const requested: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const done = inlineImages(doc, {
      fetchImage: async (url) => {
        requested.push(url);
        await gate;
        return { ok: true, mime: 'image/webp', bytes: new Uint8Array([1]) };
      },
    });
    await Promise.resolve();
    expect(requested).toHaveLength(3);
    release();
    expect((await done).failed).toEqual([]);
  });
});
