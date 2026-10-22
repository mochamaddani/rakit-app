import { describe, expect, it } from 'vitest';
import { findPlaceholders, renderInline, renderText, toPlainText } from '@/lib/renderer/inline';

const plain = { highlightPlaceholders: false };

describe('inline markup', () => {
  it('formats bold, italic, highlight and line breaks', () => {
    expect(String(renderInline('**Hemat** *hari ini* ==50%==\nSaja', plain))).toBe(
      '<strong>Hemat</strong> <em>hari ini</em> <mark class="lp-hl">50%</mark><br>Saja',
    );
  });
  it('renders safe links and drops unsafe ones to their label', () => {
    expect(String(renderInline('[Pesan](https://wa.me/62812)', plain))).toBe(
      '<a href="https://wa.me/62812">Pesan</a>',
    );
    expect(String(renderInline('[Klik](javascript:alert%281%29)', plain))).toBe('Klik');
  });
  it('escapes HTML in every position', () => {
    expect(String(renderInline('<b>x</b> **<i>y</i>** [<img>](https://a.b/"x)', plain))).toBe(
      '&lt;b&gt;x&lt;/b&gt; <strong>&lt;i&gt;y&lt;/i&gt;</strong> <a href="https://a.b/&quot;x">&lt;img&gt;</a>',
    );
  });
  it('supports backslash escapes and leaves unmatched markers literal', () => {
    expect(String(renderInline('5\\*4 = 20', plain))).toBe('5*4 = 20');
    expect(String(renderInline('**unclosed and * lone', plain))).toBe('**unclosed and * lone');
  });
  it('highlights [REPLACE: …] placeholders only when asked', () => {
    const t = 'Harga [REPLACE: harga promo]';
    expect(String(renderInline(t, { highlightPlaceholders: true }))).toBe(
      'Harga <mark class="lp-replace">[REPLACE: harga promo]</mark>',
    );
    expect(String(renderInline(t, plain))).toBe('Harga [REPLACE: harga promo]');
    expect(String(renderText('[REPLACE: x]', { highlightPlaceholders: true }))).toBe(
      '<mark class="lp-replace">[REPLACE: x]</mark>',
    );
  });
  it('renderText escapes but never interprets markup', () => {
    expect(String(renderText('**Rp**<b>', plain))).toBe('**Rp**&lt;b&gt;');
  });
  it('toPlainText strips markup and keeps link labels', () => {
    expect(toPlainText('**Hemat** [di sini](https://x.y) ==50%==\nyes')).toBe(
      'Hemat di sini 50% yes',
    );
  });
  it('findPlaceholders lists every placeholder', () => {
    expect(findPlaceholders('[REPLACE: a] x [REPLACE: b]')).toEqual([
      '[REPLACE: a]',
      '[REPLACE: b]',
    ]);
  });
});
