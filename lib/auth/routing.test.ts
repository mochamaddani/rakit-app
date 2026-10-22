import { describe, expect, it } from 'vitest';
import { decideAuthRoute, isPublicPath, safeNextPath } from '@/lib/auth/routing';

describe('isPublicPath', () => {
  it.each([
    ['/login', true],
    ['/login/', true],
    ['/auth/callback', true],
    ['/p/my-page', false],
    ['/api/public/beacon', true],
    ['/loginx', false],
    ['/pages', false],
    ['/', false],
    ['/dashboard', false],
    ['/editor/abc', false],
    ['/api/pages', false],
  ])('%s → %s', (path, expected) => expect(isPublicPath(path)).toBe(expected));
});

describe('safeNextPath', () => {
  it.each([
    ['/editor/abc?tab=seo', '/editor/abc?tab=seo'],
    [null, '/dashboard'],
    [undefined, '/dashboard'],
    ['', '/dashboard'],
    ['https://evil.example', '/dashboard'],
    ['//evil.example', '/dashboard'],
    ['/\\evil.example', '/dashboard'],
    ['javascript:alert(1)', '/dashboard'],
    ['dashboard', '/dashboard'],
    ['/login', '/dashboard'],
    ['/login?next=/x', '/dashboard'],
  ])('%j → %s', (next, expected) => expect(safeNextPath(next)).toBe(expected));
});

describe('decideAuthRoute', () => {
  it('lets anyone through public paths', () => {
    expect(
      decideAuthRoute({ pathname: '/api/public/beacon', search: '', isAuthenticated: false }),
    ).toEqual({ kind: 'continue' });
  });
  it('protects /p until hosted pages exist on their own domain (D-022)', () => {
    expect(decideAuthRoute({ pathname: '/p/offer', search: '', isAuthenticated: false })).toEqual({
      kind: 'redirect',
      location: '/login?next=%2Fp%2Foffer',
    });
  });
  it('redirects anonymous page requests to /login with the full return path', () => {
    expect(
      decideAuthRoute({ pathname: '/editor/abc', search: '?x=1', isAuthenticated: false }),
    ).toEqual({
      kind: 'redirect',
      location: '/login?next=%2Feditor%2Fabc%3Fx%3D1',
    });
  });
  it('answers anonymous API requests with unauthorized', () => {
    expect(decideAuthRoute({ pathname: '/api/pages', search: '', isAuthenticated: false })).toEqual(
      { kind: 'unauthorized' },
    );
  });
  it('sends signed-in users away from /login to /dashboard', () => {
    expect(decideAuthRoute({ pathname: '/login', search: '', isAuthenticated: true })).toEqual({
      kind: 'redirect',
      location: '/dashboard',
    });
  });
  it('lets signed-in users through protected paths', () => {
    expect(decideAuthRoute({ pathname: '/dashboard', search: '', isAuthenticated: true })).toEqual({
      kind: 'continue',
    });
  });
});
