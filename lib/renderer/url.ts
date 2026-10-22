const SCHEME = /^([a-zA-Z][a-zA-Z0-9+.-]*):/;
const LINK_SCHEMES = new Set(['http', 'https', 'mailto', 'tel', 'sms']);
const IMAGE_SCHEMES = new Set(['http', 'https']);
const DATA_IMAGE = /^data:image\/(png|jpeg|webp|gif|avif|svg\+xml)[;,]/i;

function hasControlOrSpace(value: string): boolean {
  return [...value].some((ch) => {
    const code = ch.charCodeAt(0);
    return code <= 0x20 || code === 0x7f;
  });
}

/**
 * Allowlist URL check for href/src attributes. Returns the trimmed URL, or null when it must not
 * be emitted. Browsers ignore tabs, newlines and control characters inside a scheme
 * ("java\tscript:"), so any of them before the first ':' disqualifies the URL.
 */
export function sanitizeUrl(input: string, kind: 'link' | 'image'): string | null {
  const url = input.trim();
  if (!url) return null;

  const colon = url.indexOf(':');
  if (colon !== -1 && hasControlOrSpace(url.slice(0, colon))) return null;

  const scheme = SCHEME.exec(url)?.[1]?.toLowerCase();
  if (scheme === undefined) {
    if (kind === 'image') return url;
    return /^[#/?]/.test(url) ? url : null;
  }
  if (kind === 'link') return LINK_SCHEMES.has(scheme) ? url : null;
  if (IMAGE_SCHEMES.has(scheme)) return url;
  return scheme === 'data' && DATA_IMAGE.test(url) ? url : null;
}
