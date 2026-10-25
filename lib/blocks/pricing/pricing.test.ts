import { describe, expect, it } from 'vitest';
import { pricing } from '@/lib/blocks/pricing';
import { renderBlock, singleBlockDoc } from '@/lib/blocks/test-utils';
import { renderPage } from '@/lib/renderer/page';
import { parseDocument } from '@/lib/schema/document';
import { sequentialIds } from '@/lib/schema/ids';
import { validateHtml } from '@/tests/helpers/validate-html';

const offer = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: `Paket ${id}`,
  features: [{ id: `${id}f`, text: 'Gratis ongkir' }],
  cta: { label: 'Pesan', link: { kind: 'default' } },
  ...extra,
});
const props = {
  heading: 'Pilih paket',
  offers: [
    offer('a', { price: 149000 }),
    offer('b', {
      price: 249000,
      compareAtPrice: 349000,
      showDiscount: true,
      badge: 'Terlaris',
      highlighted: true,
    }),
  ],
  note: 'Bayar di tempat',
};

describe('pricing block', () => {
  it('formats prices in the page currency with a discount badge', () => {
    const out = renderBlock(pricing, props);
    expect(out).toContain('<span class="lp-pricing__now">Rp249.000</span>');
    expect(out).toContain(
      '<s class="lp-pricing__was"><span class="lp-sr">Harga normal</span> Rp349.000</s>',
    );
    expect(out).toContain('<span class="lp-pricing__off">-29%</span>');
    expect(out).toContain('lp-pricing__offer lp-pricing__offer--hl');
    expect(out).toContain('style="--lp-offers:2"');
  });
  it('rejects zero and five offers', () => {
    expect(pricing.schema.safeParse({ offers: [] }).success).toBe(false);
    const five = ['a', 'b', 'c', 'd', 'e'].map((id) => offer(id));
    expect(pricing.schema.safeParse({ offers: five }).success).toBe(false);
  });
  it('an offer without a price shows no price row', () => {
    expect(renderBlock(pricing, { offers: [offer('a')] })).not.toContain('lp-pricing__price');
  });
  it('marks names, features and CTA labels', () => {
    const out = renderBlock(pricing, props, { mode: 'preview' });
    expect(out).toContain('data-lp-field="offers.1.name"');
    expect(out).toContain('data-lp-field="offers.0.features.0.text"');
    expect(out).toContain('data-lp-field="offers.1.cta.label"');
    expect(out).toContain('data-lp-field="note"');
  });
  it('defaults invent no price or package', () => {
    const defaults = pricing.defaultProps(sequentialIds());
    expect(defaults.offers).toHaveLength(1);
    expect(defaults.offers[0]!.name).toMatch(/^\[REPLACE:/);
    expect(defaults.offers[0]!.price).toBeUndefined();
  });
  it('renders valid HTML with only required fields', async () => {
    for (const p of [{ offers: [{ id: 'o', name: 'N' }] }, props]) {
      expect(
        await validateHtml(
          renderPage(parseDocument(singleBlockDoc('pricing', p)), { mode: 'export' }).html,
        ),
      ).toEqual([]);
    }
  });
  it('matches the snapshot', async () => {
    await expect(renderBlock(pricing, props)).toMatchFileSnapshot('./__snapshots__/pricing.html');
  });
});
