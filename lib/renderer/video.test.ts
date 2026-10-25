import { describe, expect, it } from 'vitest';
import { parseVideoUrl, videoEmbedUrl, videoPoster, videoWatchUrl } from './video';

const YT = 'dQw4w9WgXcQ';

describe('parseVideoUrl', () => {
  it('parses the URL forms people paste and rejects others', () => {
    const youtube = { provider: 'youtube', id: YT };
    const cases: [string, unknown][] = [
      [`https://www.youtube.com/watch?v=${YT}`, youtube],
      [`https://youtu.be/${YT}?si=AbC123xyz`, youtube],
      [`https://m.youtube.com/watch?v=${YT}&t=30s`, youtube],
      [`https://www.youtube.com/watch?feature=share&v=${YT}`, youtube],
      [`https://youtube.com/shorts/${YT}?feature=share`, youtube],
      [`https://www.youtube.com/embed/${YT}`, youtube],
      [`https://www.youtube-nocookie.com/embed/${YT}`, youtube],
      [`https://www.youtube.com/live/${YT}`, youtube],
      [`http://youtu.be/${YT}#t=10`, youtube],
      ['https://vimeo.com/76979871#t=10', { provider: 'vimeo', id: '76979871' }],
      ['https://player.vimeo.com/video/76979871?h=abc', { provider: 'vimeo', id: '76979871' }],
      ['  https://vimeo.com/76979871  ', { provider: 'vimeo', id: '76979871' }],
      ['', null],
      ['javascript:alert(1)//youtu.be/dQw4w9WgXcQ', null],
      ['https://example.com/watch?v=abcdefghijk', null],
      ['https://www.youtube.com/watch?v=abcdefghij', null],
      ['https://www.youtube.com/watch?v=abcdefghijkl', null],
      ['https://youtu.be.evil.test/dQw4w9WgXcQ', null],
      ['https://vimeo.com/channels/staffpicks', null],
      ['ftp://youtu.be/dQw4w9WgXcQ', null],
      ['not a url', null],
    ];
    for (const [url, expected] of cases) expect(parseVideoUrl(url), url).toEqual(expected);
  });
  it('builds privacy-friendly player, watch and poster URLs', () => {
    const yt = { provider: 'youtube', id: YT } as const;
    const vimeo = { provider: 'vimeo', id: '76979871' } as const;
    expect(videoEmbedUrl(yt)).toBe(`https://www.youtube-nocookie.com/embed/${YT}?autoplay=1&rel=0`);
    expect(videoEmbedUrl(vimeo)).toBe('https://player.vimeo.com/video/76979871?autoplay=1&dnt=1');
    expect(videoWatchUrl(yt)).toBe(`https://www.youtube.com/watch?v=${YT}`);
    expect(videoWatchUrl(vimeo)).toBe('https://vimeo.com/76979871');
    expect(videoPoster(yt)).toBe(`https://i.ytimg.com/vi/${YT}/hqdefault.jpg`);
    expect(videoPoster(vimeo)).toBeNull();
  });
});
