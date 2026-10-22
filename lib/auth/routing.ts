// Default-deny: every route needs a session unless it sits under one of these prefixes.
// Hosted pages get their own domain (D-022), so there is no public /p prefix on the editor origin.
export const PUBLIC_PATH_PREFIXES = ['/login', '/auth', '/api/public'] as const;

const DEFAULT_AFTER_LOGIN = '/dashboard';

function underPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some((prefix) => underPrefix(pathname, prefix));
}

function hasControlCharacter(value: string): boolean {
  return [...value].some((ch) => {
    const code = ch.charCodeAt(0);
    return code < 0x20 || code === 0x7f;
  });
}

/** Only same-origin paths survive; anything that could leave the site falls back. */
export function safeNextPath(
  next: string | null | undefined,
  fallback = DEFAULT_AFTER_LOGIN,
): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return fallback;
  if (next.includes('\\') || hasControlCharacter(next)) return fallback;
  const path = next.split(/[?#]/, 1)[0] ?? '';
  if (underPrefix(path, '/login')) return fallback;
  return next;
}

export type AuthDecision =
  { kind: 'continue' } | { kind: 'redirect'; location: string } | { kind: 'unauthorized' };

export function decideAuthRoute(input: {
  pathname: string;
  search: string;
  isAuthenticated: boolean;
}): AuthDecision {
  const { pathname, search, isAuthenticated } = input;
  if (isAuthenticated && underPrefix(pathname, '/login')) {
    return { kind: 'redirect', location: DEFAULT_AFTER_LOGIN };
  }
  if (isPublicPath(pathname) || isAuthenticated) return { kind: 'continue' };
  if (underPrefix(pathname, '/api')) return { kind: 'unauthorized' };
  return { kind: 'redirect', location: `/login?next=${encodeURIComponent(pathname + search)}` };
}
