import { describe, expect, it } from 'vitest';
import { hero } from '@/lib/blocks/hero';
import { renderBlock } from '@/lib/blocks/test-utils';
import { renderPage } from '@/lib/renderer/page';
import { parseDocument } from '@/lib/schema/document';
import { sequentialIds } from '@/lib/schema/ids';

const base = {
  headline: 'Botol **Anti Bocor**',
  subheadline: 'Dingin 24 jam',
  primaryCta: { label: 'Pesan', link: { kind: 'default' } },
};

describe('hero block', () => {
  it('renders the first block headline as the page h1 with inline formatting', () => {
    expect(renderBlock(hero, base)).toContain(
      '<h1 class="lp-h1">Botol <strong>Anti Bocor</strong></h1>',
    );
  });
  it('uses h2 when the hero is not the first block on the page', () => {
    expect(renderBlock(hero, base, { block: { indexInSection: 1 } })).toContain(
      '<h2 class="lp-h1">',
    );
  });
  it('omits empty optional parts', () => {
    const out = renderBlock(hero, { headline: 'Halo' });
    for (const cls of ['lp-eyebrow', 'lp-lead', 'lp-actions', 'lp-trust', 'lp-hero__media'])
      expect(out).not.toContain(cls);
  });
  it('loads the image eagerly with high priority above the fold, lazily below it', () => {
    const image = { src: 'https://cdn.x/h.webp', alt: 'Botol', width: 1200, height: 1200 };
    const above = renderBlock(hero, { ...base, image });
    expect(above).toContain('loading="eager"');
    expect(above).toContain('fetchpriority="high"');
    expect(renderBlock(hero, { ...base, image }, { block: { sectionIndex: 1 } })).toContain(
      'loading="lazy"',
    );
  });
  it('rejects an empty headline and accepts its own defaults', () => {
    expect(hero.schema.safeParse({ headline: '' }).success).toBe(false);
    expect(hero.schema.safeParse(hero.defaultProps(sequentialIds())).success).toBe(true);
  });
  it('matches the split-layout snapshot', async () => {
    const out = renderBlock(
      hero,
      {
        ...base,
        eyebrow: 'Baru',
        trustLine: 'Gratis ongkir · Garansi 30 hari',
        layout: 'split',
        align: 'left',
        image: { src: 'https://cdn.x/h.webp', alt: 'Botol biru', width: 1200, height: 1200 },
        secondaryCta: {
          label: 'Lihat detail',
          link: { kind: 'section', sectionId: 's2' },
          variant: 'secondary',
        },
      },
      { sectionAnchors: { s2: 'detail' } },
    );
    await expect(out).toMatchFileSnapshot('./__snapshots__/hero.split.html');
  });
});

describe('hero video', () => {
  const YT = 'dQw4w9WgXcQ';
  const withVideo = {
    headline: 'H',
    image: { src: 'https://x.test/hero.webp', alt: 'Teh' },
    video: { url: `https://youtu.be/${YT}`, title: 'Cara seduh' },
  };
  it('renders a video facade in the media slot with the hero image as poster', () => {
    const out = renderBlock(hero, withVideo);
    expect(out).toContain('<div class="lp-hero__media"><div class="lp-video"');
    expect(out).toContain('src="https://x.test/hero.webp" alt=""');
    expect(out).not.toContain('i.ytimg.com');
    expect(out).toContain('fetchpriority="high"');
  });
  it('an unparseable video falls back to the image', () => {
    const out = renderBlock(hero, { ...withVideo, video: { url: 'nope' } });
    expect(out).not.toContain('lp-video');
    expect(out).toContain('class="lp-hero__img"');
  });
  it('hero and a video block ship the video snippet once', () => {
    const doc = parseDocument({
      schemaVersion: 2,
      sections: [
        {
          id: 's1',
          blocks: [
            { id: 'h', type: 'hero', props: withVideo },
            { id: 'v', type: 'video', props: { video: { url: `https://youtu.be/${YT}` } } },
          ],
        },
      ],
    });
    const html = renderPage(doc, { mode: 'export' }).html;
    expect(html.split('[data-lp-video]').length - 1).toBe(1);
  });
});
