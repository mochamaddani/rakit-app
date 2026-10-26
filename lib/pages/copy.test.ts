import { describe, expect, it } from 'vitest';
import { copyName, copySlugBase } from './copy';
import { SLUG_MAX_LENGTH, uniqueSlug } from './slug';

const DB_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

describe('copyName', () => {
  it('adds " (copy)"', () => expect(copyName('Teh')).toBe('Teh (copy)'));
  it('does not stack suffixes on a copy of a copy', () =>
    expect(copyName('Teh (copy)')).toBe('Teh (copy)'));
  it('stays within 120 characters, trimming the name before the suffix', () => {
    expect(copyName('a'.repeat(120))).toBe(`${'a'.repeat(113)} (copy)`);
    expect(copyName(`${'a'.repeat(112)} ${'b'.repeat(7)}`)).toBe(`${'a'.repeat(112)} (copy)`);
  });
});

describe('copySlugBase', () => {
  it('adds -copy', () => expect(copySlugBase('teh')).toBe('teh-copy'));
  it('reuses the -copy base for a copy of a copy', () => {
    expect(copySlugBase('teh-copy')).toBe('teh-copy');
    expect(copySlugBase('teh-copy-3')).toBe('teh-copy');
  });
  it('stays a valid slug within 80 characters', () => {
    const slug = copySlugBase(`${'a'.repeat(74)}-bcdef`);
    expect(slug.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH);
    expect(slug).toMatch(DB_SLUG);
    expect(slug.endsWith('-copy')).toBe(true);
  });
  it('becomes unique with the shared suffix rule', () => {
    expect(uniqueSlug(copySlugBase('teh'), new Set(['teh-copy']))).toBe('teh-copy-2');
    const long = copySlugBase('a'.repeat(80));
    const unique = uniqueSlug(long, new Set([long]));
    expect(unique.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH);
    expect(unique).toMatch(DB_SLUG);
  });
});
