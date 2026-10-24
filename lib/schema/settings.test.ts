import { describe, expect, it } from 'vitest';
import { hasTrackingIds, PageSettingsSchema, PRICE_FORMATS } from '@/lib/schema/settings';
import { DEFAULT_THEME, FONT_STACKS, ThemeSchema } from '@/lib/schema/theme';

describe('page settings', () => {
  it('parse({}) yields Indonesian, noindex, IDR and the default theme', () => {
    const s = PageSettingsSchema.parse({});
    expect(s.lang).toBe('id');
    expect(s.seo).toEqual({ title: '', description: '', noindex: true });
    expect(s.price).toEqual(PRICE_FORMATS.IDR);
    expect(s.theme).toEqual(DEFAULT_THEME);
    expect(s.defaultCta).toBeUndefined();
  });
  it('the parsed theme is a copy, not the shared DEFAULT_THEME object', () => {
    expect(PageSettingsSchema.parse({}).theme).not.toBe(DEFAULT_THEME);
  });
  it('DEFAULT_THEME validates and uses allowlisted font stacks', () => {
    expect(ThemeSchema.parse(DEFAULT_THEME)).toEqual(DEFAULT_THEME);
    expect(FONT_STACKS[DEFAULT_THEME.font]).toBe('system-ui, sans-serif');
  });
  it('rejects fonts outside the allowlist and a url-kind default CTA with a bad shape', () => {
    expect(ThemeSchema.safeParse({ ...DEFAULT_THEME, font: 'Comic Sans' }).success).toBe(false);
    expect(PageSettingsSchema.safeParse({ defaultCta: { kind: 'default' } }).success).toBe(false);
  });
});

describe('tracking settings', () => {
  const tracking = (value: Record<string, string>) =>
    PageSettingsSchema.safeParse({ tracking: value }).success;

  it('accepts empty or well-formed tracking ids and rejects the rest', () => {
    const cases: [string, string, boolean][] = [
      ['metaPixelId', '1234567890', true],
      ['metaPixelId', '123', false],
      ['metaPixelId', '12345678901234567890', true],
      ['metaPixelId', '1234567890a', false],
      ['ga4Id', 'G-ABC123', true],
      ['ga4Id', 'g-abc123', false],
      ['googleAdsId', 'AW-123456789', true],
      ['googleAdsId', 'AW-12', false],
      ['googleAdsLeadLabel', 'aBc_-12', true],
      ['googleAdsLeadLabel', 'a b', false],
      ['gtmId', 'GTM-ABCD12', true],
      ['gtmId', 'GTM-<x>', false],
    ];
    for (const [key, value, ok] of cases)
      expect(tracking({ [key]: value }), `${key}=${value}`).toBe(ok);
    for (const [key] of cases) expect(tracking({ [key]: '' }), `${key} empty`).toBe(true);
  });
  it('explains a malformed id', () => {
    const result = PageSettingsSchema.safeParse({ tracking: { metaPixelId: 'abc' } });
    expect(result.error?.issues[0]?.message).toBe('Meta Pixel IDs are 10–20 digits');
  });
  it('old documents parse with empty tracking', () => {
    const s = PageSettingsSchema.parse({});
    expect(s.tracking).toEqual({
      metaPixelId: '',
      ga4Id: '',
      googleAdsId: '',
      googleAdsLeadLabel: '',
      gtmId: '',
      headCode: '',
      bodyCode: '',
    });
    expect(hasTrackingIds(s.tracking)).toBe(false);
    expect(hasTrackingIds({ ...s.tracking, gtmId: 'GTM-ABCD12' })).toBe(true);
    expect(hasTrackingIds({ ...s.tracking, headCode: '<meta name="x">' })).toBe(false);
  });
  it('code over 20,000 characters is rejected', () => {
    expect(tracking({ headCode: 'x'.repeat(20_000) })).toBe(true);
    expect(tracking({ bodyCode: 'x'.repeat(20_001) })).toBe(false);
  });
  it('social image and favicon are optional images', () => {
    const s = PageSettingsSchema.parse({ seo: { ogImage: { src: 'https://x.test/a.webp' } } });
    expect(s.seo.ogImage).toEqual({ src: 'https://x.test/a.webp', alt: '' });
    expect(s.seo.favicon).toBeUndefined();
  });
});
