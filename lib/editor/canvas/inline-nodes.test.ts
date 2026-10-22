// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { renderInline } from '@/lib/renderer/inline';
import { serializeInline } from '../inline-serialize';
import { readInlineNodes } from './inline-nodes';

const fragment = (html: string) => {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div;
};

describe('readInlineNodes', () => {
  // Canonical markup survives render → DOM → nodes → markup.
  for (const markup of [
    'Pilih **warnamu**',
    '*miring* dan ==sorot==',
    'Baris 1\nBaris 2',
    'Kunjungi [toko kami](https://botolku.example/) sekarang',
    '[**Tebal** di tautan](https://x.example/)',
    '2 * 3 = 6',
    '\\*a*',
    'Harga ==Rp 10.000==',
    '[REPLACE: nama produk] terbaik',
    'a\\b',
  ]) {
    it(`round-trips ${JSON.stringify(markup)}`, () => {
      const html = renderInline(markup, { highlightPlaceholders: true }).value;
      expect(serializeInline(readInlineNodes(fragment(html)))).toBe(markup);
    });
  }

  it('reads what contenteditable produces', () => {
    expect(
      readInlineNodes(fragment('<b>a<i>b</i></b><div>c</div><span style="color:red">d</span><br>')),
    ).toEqual([{ t: 'strong', v: 'ab' }, { t: 'br' }, { t: 'text', v: 'cd' }]);
  });

  it('reads Chrome line wrappers, with an empty line as one break', () => {
    expect(readInlineNodes(fragment('<div>a</div><div><br></div><div>b</div>'))).toEqual([
      { t: 'text', v: 'a' },
      { t: 'br' },
      { t: 'br' },
      { t: 'text', v: 'b' },
    ]);
  });

  it('keeps link labels on one line and placeholders as text', () => {
    expect(
      readInlineNodes(
        fragment(
          '<a href="https://x.example/">a<br>b</a> <mark class="lp-replace">[REPLACE: x]</mark>',
        ),
      ),
    ).toEqual([
      { t: 'link', href: 'https://x.example/', label: [{ t: 'text', v: 'a b' }] },
      { t: 'text', v: ' [REPLACE: x]' },
    ]);
  });
});
