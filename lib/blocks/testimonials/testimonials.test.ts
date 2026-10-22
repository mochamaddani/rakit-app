import { describe, expect, it } from 'vitest';
import { renderBlock, singleBlockDoc } from '@/lib/blocks/test-utils';
import { testimonials } from '@/lib/blocks/testimonials';
import { renderPage } from '@/lib/renderer/page';
import { parseDocument } from '@/lib/schema/document';
import { sequentialIds } from '@/lib/schema/ids';
import { validateHtml } from '@/tests/helpers/validate-html';

const props = {
  heading: 'Kata mereka',
  items: [
    {
      id: 't1',
      quote: 'Botolnya **awet**',
      name: 'Rina',
      detail: 'Bandung',
      rating: 5,
      avatar: { src: 'https://cdn.x/r.webp', alt: '' },
    },
    { id: 't2', quote: 'Mantap', name: 'Budi' },
  ],
};

describe('testimonials block', () => {
  it('renders each testimonial as a figure with blockquote and caption', () => {
    const out = renderBlock(testimonials, props);
    expect(out.match(/<figure class="lp-quote">/g)).toHaveLength(2);
    expect(out).toContain(
      '<blockquote class="lp-quote__text"><p>Botolnya <strong>awet</strong></p></blockquote>',
    );
    expect(out).toContain(
      '<span class="lp-quote__name">Rina</span><span class="lp-quote__detail">Bandung</span>',
    );
  });
  it('shows stars only when a rating is set', () => {
    const out = renderBlock(testimonials, props);
    expect(out.match(/class="lp-stars"/g)).toHaveLength(1);
    expect(out).toContain('Rating 5 dari 5');
  });
  it('lazy-loads avatars', () => {
    expect(renderBlock(testimonials, props)).toContain(
      'class="lp-quote__avatar" src="https://cdn.x/r.webp" alt="" width="800" height="800" loading="lazy"',
    );
  });
  it('ships placeholder defaults instead of invented quotes', () => {
    expect(
      testimonials
        .defaultProps(sequentialIds())
        .items.every((i) => i.quote.startsWith('[REPLACE:')),
    ).toBe(true);
  });
  it('renders valid HTML with only required fields', async () => {
    expect(
      await validateHtml(
        renderPage(parseDocument(singleBlockDoc('testimonials', {})), { mode: 'export' }).html,
      ),
    ).toEqual([]);
  });
  it('matches the snapshot', async () => {
    await expect(renderBlock(testimonials, props)).toMatchFileSnapshot(
      './__snapshots__/testimonials.html',
    );
  });
});
