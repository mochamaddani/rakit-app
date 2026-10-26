import { SLUG_MAX_LENGTH } from './slug';

// Names and slug bases for duplicated pages (docs/DECISIONS.md D-056). A copy of a copy keeps one
// suffix: its name stays "<name> (copy)" and its slug base "<slug>-copy", which uniqueSlug numbers.

const NAME_MAX_LENGTH = 120;
const NAME_SUFFIX = ' (copy)';
const SLUG_SUFFIX = '-copy';

export function copyName(name: string): string {
  const base = name.endsWith(NAME_SUFFIX) ? name.slice(0, -NAME_SUFFIX.length) : name;
  return `${base.slice(0, NAME_MAX_LENGTH - NAME_SUFFIX.length).trimEnd()}${NAME_SUFFIX}`;
}

export function copySlugBase(slug: string): string {
  const base = slug.replace(/-copy(-\d+)?$/, '');
  const cut = base.slice(0, SLUG_MAX_LENGTH - SLUG_SUFFIX.length).replace(/-+$/, '');
  return `${cut || 'page'}${SLUG_SUFFIX}`;
}
