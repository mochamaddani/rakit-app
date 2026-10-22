import { describe, expect, it } from 'vitest';
import {
  byteLength,
  escapeInlineScript,
  escapeInlineStyle,
  html,
  unsafeRaw,
} from '@/lib/renderer/html';

describe('html tag', () => {
  it('escapes interpolated strings, including quotes for attribute context', () => {
    const v = `"><script>alert(1)</script>'`;
    expect(String(html`<p title="${v}">${v}</p>`)).toBe(
      '<p title="&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;&#39;">&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;&#39;</p>',
    );
  });
  it('inserts SafeHtml unescaped and flattens arrays', () => {
    const items = ['a', 'b'].map((x) => html`<li>${x}</li>`);
    expect(String(html`<ul>${items}${unsafeRaw('<li>c</li>')}</ul>`)).toBe(
      '<ul><li>a</li><li>b</li><li>c</li></ul>',
    );
  });
  it('renders null, undefined and booleans as nothing, numbers as text', () => {
    expect(String(html`<p>${null}${undefined}${false}${true}${0}</p>`)).toBe('<p>0</p>');
  });
  it('counts UTF-8 bytes', () => {
    expect(byteLength('Rp✓')).toBe(5);
    expect(byteLength('😀')).toBe(4);
  });
  it('neutralizes closing tags inside inline scripts and styles', () => {
    expect(escapeInlineScript('a</SCRIPT>b<!--c')).toBe('a<\\/SCRIPT>b<\\!--c');
    expect(escapeInlineStyle('a</style>b')).toBe('a<\\/style>b');
  });
});
