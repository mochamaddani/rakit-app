import { describe, expect, it } from 'vitest';
import { themeCss } from '@/lib/renderer/theme-css';
import { DEFAULT_THEME } from '@/lib/schema/theme';

describe('themeCss', () => {
  it('emits theme tokens as custom properties in a fixed order', () => {
    expect(themeCss(DEFAULT_THEME)).toBe(
      ':root{--lp-primary:#2563EB;--lp-on-primary:#FFFFFF;--lp-accent:#F59E0B;--lp-on-accent:#111827;--lp-background:#FFFFFF;--lp-surface:#F3F4F6;--lp-text:#111827;--lp-muted:#4B5563;--lp-border:#E5E7EB;--lp-dark:#111827;--lp-on-dark:#F9FAFB;--lp-font:system-ui, sans-serif;--lp-heading-font:system-ui, sans-serif;--lp-radius:8px;--lp-btn-radius:8px}',
    );
  });
  it('maps button shapes to radii', () => {
    expect(themeCss({ ...DEFAULT_THEME, buttonShape: 'pill' })).toContain('--lp-btn-radius:999px');
    expect(themeCss({ ...DEFAULT_THEME, buttonShape: 'square' })).toContain('--lp-btn-radius:0px');
  });
});
