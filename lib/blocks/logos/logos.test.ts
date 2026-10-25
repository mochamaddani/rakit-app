import { describe, expect, it } from 'vitest';
import { logos } from '@/lib/blocks/logos';
import { renderBlock, singleBlockDoc } from '@/lib/blocks/test-utils';
import { renderPage } from '@/lib/renderer/page';
import { parseDocument } from '@/lib/schema/document';
import { sequentialIds } from '@/lib/schema/ids';
import { validateHtml } from '@/tests/helpers/validate-html';

const props = {
  heading: 'Diliput oleh',
  items: [
    { id: 'l1', image: { src: 'https://x.test/a.png', alt: 'Kompas', width: 300, height: 100 } },
    { id: 'l2', image: { src: 'https://x.test/b.png', alt: 'Detik' } },
  ],
  size: 'lg',
};

describe('logos block', () => {
  it('renders a list of logo images at the chosen height', () => {
    const out = renderBlock(logos, props);
    expect(out).toContain('<div class="lp-logos lp-logos--lg lp-logos--grey">');
    expect(out.match(/<li class="lp-logos__item"><img class="lp-logos__img"/g)).toHaveLength(2);
    expect(out).toContain('<p class="lp-logos__heading">Diliput oleh</p>');
  });
  it('names the list in the page language when there is no heading', () => {
    expect(renderBlock(logos, { ...props, heading: '' })).toContain(
      '<ul class="lp-logos__list" aria-label="Logo">',
    );
    expect(renderBlock(logos, { ...props, heading: '' }, { settings: { lang: 'en' } })).toContain(
      'aria-label="Logos"',
    );
  });
  it('keeps full color when grayscale is off', () => {
    expect(renderBlock(logos, { ...props, grayscale: false })).not.toContain('lp-logos--grey');
  });
  it('defaults invent no brand', () => {
    const defaults = logos.defaultProps(sequentialIds());
    expect(defaults.heading).toMatch(/^\[REPLACE:/);
    expect(defaults.items).toHaveLength(4);
    expect(
      defaults.items.every((item) => /^\[REPLACE:/.test(item.image.alt) && item.image.src === ''),
    ).toBe(true);
  });
  it('renders valid HTML with only required fields', async () => {
    for (const p of [{}, props]) {
      expect(
        await validateHtml(
          renderPage(parseDocument(singleBlockDoc('logos', p)), { mode: 'export' }).html,
        ),
      ).toEqual([]);
    }
  });
  it('matches the snapshot', async () => {
    await expect(renderBlock(logos, props)).toMatchFileSnapshot('./__snapshots__/logos.html');
  });
});
