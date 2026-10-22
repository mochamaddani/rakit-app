// Static UTM parameters on a web link, edited from the link control. Incoming UTM and click ids
// are passed through at export time instead (M3).

export const UTM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
] as const;
export type UtmKey = (typeof UTM_KEYS)[number];

function httpUrl(url: string): URL | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed : null;
  } catch {
    return null;
  }
}

/** null unless `url` is an absolute http(s) URL. */
export function readUtm(url: string): Partial<Record<UtmKey, string>> | null {
  const parsed = httpUrl(url);
  if (!parsed) return null;
  const values: Partial<Record<UtmKey, string>> = {};
  for (const key of UTM_KEYS) {
    const value = parsed.searchParams.get(key);
    if (value !== null) values[key] = value;
  }
  return values;
}

const pairName = (pair: string): string => {
  const name = pair.split('=', 1)[0] ?? '';
  try {
    return decodeURIComponent(name.replace(/\+/g, ' '));
  } catch {
    return name;
  }
};

/**
 * Sets non-empty values and removes empty ones. Every other parameter and the hash stay exactly
 * as typed (no re-encoding: `%20` stays `%20`), and values are written with encodeURIComponent.
 */
export function writeUtm(url: string, values: Partial<Record<UtmKey, string>>): string {
  if (!httpUrl(url)) return url;
  const hashAt = url.indexOf('#');
  const hash = hashAt === -1 ? '' : url.slice(hashAt);
  const base = hashAt === -1 ? url : url.slice(0, hashAt);
  const queryAt = base.indexOf('?');
  const path = queryAt === -1 ? base : base.slice(0, queryAt);
  const pairs =
    queryAt === -1
      ? []
      : base
          .slice(queryAt + 1)
          .split('&')
          .filter(Boolean);
  let changed = false;
  for (const key of UTM_KEYS) {
    const value = values[key];
    if (value === undefined) continue;
    const next = value === '' ? null : `${key}=${encodeURIComponent(value)}`;
    const at = pairs.findIndex((pair) => pairName(pair) === key);
    if (at === -1) {
      if (next !== null) {
        pairs.push(next);
        changed = true;
      }
    } else if (next === null) {
      pairs.splice(at, 1);
      changed = true;
    } else if (pairs[at] !== next) {
      pairs[at] = next;
      changed = true;
    }
  }
  // Untouched parameters: keep the address exactly as typed.
  if (!changed) return url;
  return `${path}${pairs.length ? `?${pairs.join('&')}` : ''}${hash}`;
}
