import { describe, expect, it } from 'vitest';
import { PageSettingsSchema, PRICE_FORMATS } from '@/lib/schema/settings';
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
