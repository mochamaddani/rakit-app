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
