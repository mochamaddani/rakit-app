import { expect, it } from 'vitest';
import { readUtm, writeUtm } from './utm';

it('reads and writes UTM parameters, keeping everything else', () => {
  expect(writeUtm('https://wa.me/62812', { utm_source: 'meta' })).toBe(
    'https://wa.me/62812?utm_source=meta',
  );
  expect(readUtm('https://x.test/p?a=1&utm_medium=cpc#f')).toEqual({ utm_medium: 'cpc' });
  expect(
    writeUtm('https://x.test/p?a=1&utm_medium=cpc#f', { utm_medium: '', utm_campaign: 'oct' }),
  ).toBe('https://x.test/p?a=1&utm_campaign=oct#f');
});
it('leaves non-http links alone', () => {
  for (const url of ['mailto:a@b.test', '#order', '/thanks', '', 'tel:+62812']) {
    expect(readUtm(url)).toBeNull();
    expect(writeUtm(url, { utm_source: 'x' })).toBe(url);
  }
});
it('keeps parameters it does not touch exactly as typed, and encodes spaces as %20 (M2)', () => {
  expect(writeUtm('https://wa.me/62812?text=Halo%20kak', { utm_source: 'meta' })).toBe(
    'https://wa.me/62812?text=Halo%20kak&utm_source=meta',
  );
  expect(writeUtm('https://x.example/?utm_campaign=a', { utm_campaign: 'promo oktober' })).toBe(
    'https://x.example/?utm_campaign=promo%20oktober',
  );
  expect(readUtm('https://x.example/?utm_campaign=promo%20oktober')).toEqual({
    utm_campaign: 'promo oktober',
  });
  // A trailing space survives while typing; the control trims on blur.
  expect(writeUtm('https://x.example/', { utm_campaign: 'promo ' })).toBe(
    'https://x.example/?utm_campaign=promo%20',
  );
});
