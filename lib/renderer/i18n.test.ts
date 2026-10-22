import { describe, expect, it } from 'vitest';
import { t, type MessageKey } from '@/lib/renderer/i18n';
import { LANGS } from '@/lib/schema/settings';

const KEYS: MessageKey[] = [
  'products',
  'prevSlide',
  'nextSlide',
  'goToSlide',
  'slideLabel',
  'rated',
  'reviews',
  'originalPrice',
  'links',
  'untitled',
];

describe('i18n', () => {
  it('interpolates variables in both languages', () => {
    expect(t('id', 'slideLabel', { n: 2, total: 8 })).toBe('2 dari 8');
    expect(t('en', 'slideLabel', { n: 2, total: 8 })).toBe('2 of 8');
  });
  it('has every key in every language', () => {
    for (const lang of LANGS)
      for (const key of KEYS) expect(t(lang, key).length).toBeGreaterThan(0);
  });
});
