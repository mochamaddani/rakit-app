// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { renderBlock, singleBlockDoc } from '@/lib/blocks/test-utils';
import { video } from '@/lib/blocks/video';
import { byteLength } from '@/lib/renderer/html';
import { renderPage } from '@/lib/renderer/page';
import { parseDocument } from '@/lib/schema/document';
import { validateHtml } from '@/tests/helpers/validate-html';

const YT = 'dQw4w9WgXcQ';
const props = {
  heading: 'Lihat cara seduhnya',
  video: { url: `https://youtu.be/${YT}`, title: 'Cara seduh' },
  caption: 'Dua menit saja',
};

describe('video block', () => {
  it('renders a facade link that works without JavaScript', () => {
    const out = renderBlock(video, props);
    expect(out).toContain(
      `<a class="lp-video__play" href="https://www.youtube.com/watch?v=${YT}" target="_blank" rel="noopener" data-lp-video="https://www.youtube-nocookie.com/embed/${YT}?autoplay=1&amp;rel=0" data-lp-title="Cara seduh" aria-label="Putar: Cara seduh">`,
    );
    expect(out).toContain('<div class="lp-video" style="--lp-ratio:16/9">');
    expect(out).not.toContain('<iframe');
  });
  it('uses the YouTube thumbnail unless a poster is set', () => {
    expect(renderBlock(video, props)).toContain(`src="https://i.ytimg.com/vi/${YT}/hqdefault.jpg"`);
    const own = renderBlock(video, {
      ...props,
      video: { ...props.video, poster: { src: 'https://x.test/p.webp', alt: 'ignored' } },
    });
    expect(own).toContain('src="https://x.test/p.webp" alt=""');
    expect(own).not.toContain('i.ytimg.com');
  });
  it('a Vimeo video without a poster shows a dark box with the play button', () => {
    const out = renderBlock(video, { video: { url: 'https://vimeo.com/76979871' } });
    expect(out).not.toContain('<img');
    expect(out).toContain('aria-label="Putar: Video"');
  });
  it('shows "Video address missing" for a bad URL', () => {
    const out = renderBlock(video, { video: { url: 'https://example.com/v' } });
    expect(out).toContain('Alamat video belum diisi.');
    expect(out).not.toContain('data-lp-video');
  });
  it('preview never carries the snippet', () => {
    const doc = parseDocument(singleBlockDoc('video', props));
    expect(renderPage(doc, { mode: 'preview' }).html).not.toContain('<script>');
    expect(renderPage(doc, { mode: 'export' }).html).toContain('<script>');
    const missing = parseDocument(singleBlockDoc('video', { video: { url: '' } }));
    expect(renderPage(missing, { mode: 'export' }).html).not.toContain('<script>');
  });
  it('snippet stays within 768 bytes', () => {
    expect(byteLength(video.snippet!.asset.min)).toBeLessThanOrEqual(768);
  });
  it('renders valid HTML with only required fields', async () => {
    for (const p of [{}, props, { video: { url: 'https://vimeo.com/76979871', ratio: '9:16' } }]) {
      expect(
        await validateHtml(
          renderPage(parseDocument(singleBlockDoc('video', p)), { mode: 'export' }).html,
        ),
      ).toEqual([]);
    }
  });
  it('matches the snapshot', async () => {
    await expect(renderBlock(video, props)).toMatchFileSnapshot('./__snapshots__/video.html');
  });
});

describe('video snippet', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });
  const run = () => {
    document.body.innerHTML = renderBlock(video, props);
    new Function(video.snippet!.asset.src)();
    return document.querySelector<HTMLAnchorElement>('[data-lp-video]')!;
  };

  it('swaps in the player on click and ignores modified clicks', () => {
    const link = run();
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }));
    expect(document.querySelector('iframe')).toBeNull();
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    const frame = document.querySelector('iframe')!;
    expect(frame.getAttribute('src')).toBe(
      `https://www.youtube-nocookie.com/embed/${YT}?autoplay=1&rel=0`,
    );
    expect(frame.title).toBe('Cara seduh');
    expect(frame.getAttribute('allow')).toContain('autoplay');
    expect(document.querySelector('[data-lp-video]')).toBeNull();
  });
});
