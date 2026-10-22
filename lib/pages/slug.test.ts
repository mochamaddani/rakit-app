import { describe, expect, it } from 'vitest';
import { SLUG_MAX_LENGTH, slugify, uniqueSlug } from './slug';

const DB_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

describe('slugify', () => {
  it.each([
    ['Botol Minum Anti Bocor!', 'botol-minum-anti-bocor'],
    ['  Café déjà vu  ', 'cafe-deja-vu'],
    ['Promo 12.12 — Meta', 'promo-12-12-meta'],
    ['日本語', 'page'],
    ['!!!', 'page'],
    ['', 'page'],
  ])('%j → %s', (name, slug) => expect(slugify(name)).toBe(slug));
  it('stays within 80 characters without a trailing dash', () => {
    const slug = slugify(`${'a'.repeat(79)} b`);
    expect(slug.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH);
    expect(slug).toMatch(DB_SLUG);
  });
});

describe('uniqueSlug', () => {
  it('returns the base when it is free, else the first free -n suffix', () => {
    expect(uniqueSlug('test', new Set())).toBe('test');
    expect(uniqueSlug('test', new Set(['test', 'test-2']))).toBe('test-3');
  });
  it('shortens long bases so the suffix still fits', () => {
    const base = 'a'.repeat(80);
    const slug = uniqueSlug(base, new Set([base]));
    expect(slug).toBe(`${'a'.repeat(78)}-2`);
    expect(slug).toMatch(DB_SLUG);
  });
});
