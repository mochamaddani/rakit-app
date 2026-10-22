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

/** Sets non-empty values and removes empty ones, keeping other parameters and the hash. */
export function writeUtm(url: string, values: Partial<Record<UtmKey, string>>): string {
  const parsed = httpUrl(url);
  if (!parsed) return url;
  const before = parsed.search;
  for (const key of UTM_KEYS) {
    if (!(key in values)) continue;
    const value = values[key]?.trim();
    if (value) parsed.searchParams.set(key, value);
    else parsed.searchParams.delete(key);
  }
  // Untouched parameters: keep the address exactly as typed (no normalization).
  return parsed.search === before ? url : parsed.toString();
}
