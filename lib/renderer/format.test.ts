import { describe, expect, it } from 'vitest';
import { discountPercent, formatDecimal, formatPrice } from '@/lib/renderer/format';
import { PRICE_FORMATS } from '@/lib/schema/settings';

describe('formatting', () => {
  it.each([
    [149000, 'IDR', 'Rp149.000'],
    [0, 'IDR', 'Rp0'],
    [1250000.4, 'IDR', 'Rp1.250.000'],
    [1234567.5, 'USD', '$1,234,567.50'],
    [19.999, 'USD', '$20.00'],
    [49.9, 'MYR', 'RM49.90'],
    [5, 'SGD', 'S$5.00'],
    [1999, 'PHP', '₱1,999.00'],
  ] as const)('formatPrice(%d, %s) → %s', (amount, code, expected) => {
    expect(formatPrice(amount, PRICE_FORMATS[code])).toBe(expected);
  });
  it('discountPercent rounds and ignores non-discounts', () => {
    expect(discountPercent(149000, 199000)).toBe(25);
    expect(discountPercent(100, 100)).toBeNull();
    expect(discountPercent(120, 100)).toBeNull();
    expect(discountPercent(0, 100)).toBeNull();
    expect(discountPercent(99.6, 100)).toBeNull();
    expect(discountPercent(undefined, 100)).toBeNull();
    expect(discountPercent(100, undefined)).toBeNull();
  });
  it('formatDecimal uses the language decimal separator', () => {
    expect(formatDecimal(4.5, 'id')).toBe('4,5');
    expect(formatDecimal(4.5, 'en')).toBe('4.5');
    expect(formatDecimal(5, 'id')).toBe('5');
  });
});
