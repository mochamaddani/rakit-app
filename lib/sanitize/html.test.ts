import { describe, expect, it } from 'vitest';
import { validateHtml } from '@/tests/helpers/validate-html';
import { hasScripts, sanitizeHtml } from './html';

const clean = (input: string) => sanitizeHtml(input).html;

describe('sanitizeHtml', () => {
  it('removes scripts, handlers, frames, forms and unsafe URLs', () => {
    const out = clean(
      [
        '<p>Halo <script>alert(1)</script>dunia</p>',
        '<img src="x.png" onerror="alert(1)" alt="x">',
        '<a href="javascript:alert(1)">a</a>',
        '<a href="  JaVa\tscript:alert(1)">b</a>',
        '<iframe src="https://evil.test"></iframe>',
        '<form action="/x"><input name="q"><button>Go</button></form>',
        '<svg onload="alert(1)"><circle r="4"></circle></svg>',
        '<object data="x.swf"></object><embed src="x.swf">',
        '<meta http-equiv="refresh" content="0;url=https://evil.test">',
        '<base href="https://evil.test/">',
        '<link rel="stylesheet" href="https://evil.test/x.css">',
        '<noscript><img src="x"></noscript><template><p>t</p></template>',
        '<marquee>moving <b>text</b></marquee>',
        '<!-- a comment -->',
      ].join(''),
    );
    expect(out).toBe(
      '<p>Halo dunia</p><img src="x.png" alt="x"><a>a</a><a>b</a>moving <b>text</b>',
    );
    for (const bad of [
      'script',
      'onerror',
      'onload',
      'javascript',
      'iframe',
      'form',
      'input',
      'svg',
      'object',
      'embed',
      'meta',
      'base',
      'link',
      '<!--',
    ])
      expect(out.toLowerCase()).not.toContain(bad);
  });

  it('reports what it removed', () => {
    const { report } = sanitizeHtml('<p onclick="x()">a</p><script>1</script><marquee>m</marquee>');
    expect(report).toEqual({
      removedTags: ['script', 'marquee'],
      removedAttributes: 1,
      hadScripts: true,
    });
    expect(sanitizeHtml('<p>a</p>').report).toEqual({
      removedTags: [],
      removedAttributes: 0,
      hadScripts: false,
    });
  });

  it('keeps ordinary markup byte-stable', () => {
    const markup = [
      '<div class="promo" id="promo" data-x="1" aria-label="Promo"><h2>Judul</h2><p>Teks <strong>tebal</strong>, <em>miring</em> &amp; <a href="https://x.test/p" target="_blank" rel="noopener">tautan</a>.</p></div>',
      '<table><thead><tr><th scope="col">A</th></tr></thead><tbody><tr><td colspan="2">1</td></tr></tbody></table>',
      '<ul><li>satu</li><li>dua</li></ul><ol start="3"><li>tiga</li></ol>',
      '<figure><picture><source srcset="https://x.test/a.webp 1x, https://x.test/b.webp 2x" type="image/webp"><img src="https://x.test/a.jpg" alt="Foto" width="800" height="600" loading="lazy"></picture><figcaption>Keterangan</figcaption></figure>',
      '<details open=""><summary>Tanya</summary><p>Jawab</p></details>',
      '<p style="color: red; font-weight: 700">merah</p><time datetime="2026-11-01">1 Nov</time>',
    ].join('');
    expect(clean(markup)).toBe(markup);
    expect(clean(clean(markup))).toBe(clean(markup));
  });

  it('adds noopener to new-tab links and drops other targets', () => {
    expect(clean('<a href="https://x.test" target="_blank">a</a>')).toBe(
      '<a href="https://x.test" target="_blank" rel="noopener">a</a>',
    );
    expect(clean('<a href="https://x.test" target="_top" rel="opener">a</a>')).toBe(
      '<a href="https://x.test">a</a>',
    );
  });

  it('cleans style elements and attributes', () => {
    const out = clean(
      '<style>@import url(https://evil.test/x.css); .a{color:red;background:url(https://evil.test/t.png)} .b{background:url(data:image/png;base64,AAA)} .c{width:expression(alert(1))} .d{back\\67 round:u\\72l(x)}</style>' +
        '<p style="background:url(https://evil.test/t.png)">p</p><p style="color:blue">q</p>',
    );
    expect(out).toContain('.a{color:red;}');
    expect(out).toContain('.b{background:url(data:image/png;base64,AAA)}');
    expect(out).not.toMatch(/@import|evil\.test|expression|\\/);
    expect(out).toContain('<p>p</p><p style="color:blue">q</p>');
    expect(clean('<style>p{}</style><script>alert(1)</script>')).toBe('<style>p{}</style>');
    expect(clean('<style>a{}</sty' + 'le><script>alert(1)</script>')).not.toContain('script');
  });

  it('drops ids that collide with generated ones and data-lp attributes', () => {
    expect(clean('<div id="b-hero" data-lp-block="x" data-lp-field="h" data-ok="1">x</div>')).toBe(
      '<div data-ok="1">x</div>',
    );
    expect(clean('<div id="s-top">x</div><div id="promo">y</div>')).toBe(
      '<div>x</div><div id="promo">y</div>',
    );
  });

  it('repairs broken markup', async () => {
    const out = clean('<p><b>x</p><div>y');
    expect(out).toBe('<p><b>x</b></p><div><b>y</b></div>');
    expect(
      await validateHtml(
        `<!doctype html><html lang="en"><head><title>t</title></head><body>${clean('<ul><li>a<li>b</ul><p>c')}</body></html>`,
      ),
    ).toEqual([]);
  });
});

describe('hasScripts', () => {
  it('sees script elements and handlers, not the word script in text', () => {
    expect(hasScripts('<script>x()</script>')).toBe(true);
    expect(hasScripts('<img src=x onerror=alert(1)>')).toBe(true);
    expect(hasScripts('<svg><a onclick="x"></a></svg>')).toBe(true);
    expect(hasScripts('<p>This script is a description</p>')).toBe(false);
    expect(hasScripts('<p data-onx="1">ok</p>')).toBe(false);
  });
});
