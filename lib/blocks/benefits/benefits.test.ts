import { describe, expect, it } from 'vitest';
import { benefits } from '@/lib/blocks/benefits';
import { renderBlock, singleBlockDoc } from '@/lib/blocks/test-utils';
import { renderPage } from '@/lib/renderer/page';
import { parseDocument } from '@/lib/schema/document';
import { validateHtml } from '@/tests/helpers/validate-html';

const props = {
  heading: 'Kenapa **kami**',
  items: [
    { id: 'i1', icon: 'truck', title: 'Gratis ongkir', text: 'Ke seluruh Indonesia' },
    { id: 'i2', icon: 'none', title: 'Garansi' },
  ],
};

describe('benefits block', () => {
  it('renders a heading and one list item per benefit', () => {
    const out = renderBlock(benefits, props);
    expect(out).toContain('<h2 class="lp-h2">Kenapa <strong>kami</strong></h2>');
    expect(out.match(/<li class="lp-benefit">/g)).toHaveLength(2);
  });
  it('inlines only the chosen icons', () => {
    expect(renderBlock(benefits, props).match(/<svg/g)).toHaveLength(1);
  });
  it('passes the desktop column count as a custom property', () => {
    expect(renderBlock(benefits, { ...props, columns: 4 })).toContain('style="--lp-cols:4"');
  });
  it('renders valid HTML with only required fields', async () => {
    expect(
      await validateHtml(
        renderPage(parseDocument(singleBlockDoc('benefits', {})), { mode: 'export' }).html,
      ),
    ).toEqual([]);
  });
  it('matches the snapshot', async () => {
    await expect(
      renderBlock(benefits, { ...props, subheading: 'Tiga alasan' }),
    ).toMatchFileSnapshot('./__snapshots__/benefits.html');
  });
});
