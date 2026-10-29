import { describe, expect, it } from 'vitest';
import { isWhatsAppNumber, normalizeWhatsAppNumber, whatsAppUrl } from './whatsapp';

describe('normalizeWhatsAppNumber', () => {
  it.each([
    ['0', '62'],
    ['08', '628'],
    ['081234567890', '6281234567890'],
    ['+62 812-3456-7890', '6281234567890'],
    ['62 0812 3456 7890', '6281234567890'],
    ['0062 812 3456 7890', '6281234567890'],
    ['(0812) 3456.7890', '6281234567890'],
    ['6281234567890', '6281234567890'],
    ['+1 (415) 555-0100', '14155550100'],
    ['', ''],
    ['abc', ''],
  ])('%j → %j', (input, expected) => {
    expect(normalizeWhatsAppNumber(input)).toBe(expected);
  });
  it('is stable when run again on every keystroke', () => {
    let value = '';
    for (const key of '081234567890') value = normalizeWhatsAppNumber(value + key);
    expect(value).toBe('6281234567890');
    expect(normalizeWhatsAppNumber(value)).toBe(value);
  });
  it('keeps at most 15 digits', () => {
    expect(normalizeWhatsAppNumber('62812345678901234567')).toBe('628123456789012');
  });
});

describe('whatsAppUrl', () => {
  it('links to wa.me with the number in international form', () => {
    expect(whatsAppUrl('0812-3456-7890')).toBe('https://wa.me/6281234567890');
  });
  it('prefills the message, encoded', () => {
    expect(whatsAppUrl('6281234567890', ' Halo kak, saya mau pesan & tanya? ')).toBe(
      'https://wa.me/6281234567890?text=Halo%20kak%2C%20saya%20mau%20pesan%20%26%20tanya%3F',
    );
  });
  it('is null without a usable number', () => {
    expect(whatsAppUrl('')).toBeNull();
    expect(whatsAppUrl('62')).toBeNull();
    expect(isWhatsAppNumber('0812345')).toBe(true);
    expect(isWhatsAppNumber('081234')).toBe(false);
  });
});
