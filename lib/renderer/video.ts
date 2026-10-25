// Video URLs as people paste them → a provider and id (docs/DECISIONS.md D-052). Pure; the
// players are privacy-friendly (youtube-nocookie, Vimeo dnt) and load only after a click.

export type VideoRef = { provider: 'youtube'; id: string } | { provider: 'vimeo'; id: string };

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^\d{6,12}$/;
const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);
const YOUTUBE_PATH = /^\/(?:shorts|embed|live)\/([^/]+)\/?$/;

function youtube(id: string | null | undefined): VideoRef | null {
  return id && YOUTUBE_ID.test(id) ? { provider: 'youtube', id } : null;
}

export function parseVideoUrl(input: string): VideoRef | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.toLowerCase();
  if (host === 'youtu.be') return youtube(url.pathname.slice(1).replace(/\/$/, ''));
  if (YOUTUBE_HOSTS.has(host)) {
    if (url.pathname === '/watch') return youtube(url.searchParams.get('v'));
    return youtube(YOUTUBE_PATH.exec(url.pathname)?.[1]);
  }
  const vimeo =
    host === 'vimeo.com' || host === 'www.vimeo.com'
      ? /^\/(\d+)\/?$/.exec(url.pathname)
      : host === 'player.vimeo.com'
        ? /^\/video\/(\d+)\/?$/.exec(url.pathname)
        : null;
  const id = vimeo?.[1];
  return id && VIMEO_ID.test(id) ? { provider: 'vimeo', id } : null;
}

export function videoEmbedUrl(ref: VideoRef): string {
  return ref.provider === 'youtube'
    ? `https://www.youtube-nocookie.com/embed/${ref.id}?autoplay=1&rel=0`
    : `https://player.vimeo.com/video/${ref.id}?autoplay=1&dnt=1`;
}

export function videoWatchUrl(ref: VideoRef): string {
  return ref.provider === 'youtube'
    ? `https://www.youtube.com/watch?v=${ref.id}`
    : `https://vimeo.com/${ref.id}`;
}

/** YouTube's own thumbnail; Vimeo needs an API call, so it has none (set a poster instead). */
export function videoPoster(ref: VideoRef): string | null {
  return ref.provider === 'youtube' ? `https://i.ytimg.com/vi/${ref.id}/hqdefault.jpg` : null;
}
