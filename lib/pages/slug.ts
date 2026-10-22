/** pages.slug allows at most 80 characters of lowercase kebab-case (see the core migration). */
export const SLUG_MAX_LENGTH = 80;

const trimDashes = (value: string) => value.replace(/^-+|-+$/g, '');

/** A slug for file names and URLs: accents fold to ASCII, anything else becomes a dash. */
export function slugify(name: string): string {
  const slug = trimDashes(
    name
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-'),
  );
  return trimDashes(slug.slice(0, SLUG_MAX_LENGTH)) || 'page';
}

/** `base` when free, else `base-2`, `base-3`, …, shortened so the suffix still fits. */
export function uniqueSlug(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const suffix = `-${n}`;
    const candidate = `${trimDashes(base.slice(0, SLUG_MAX_LENGTH - suffix.length))}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}
