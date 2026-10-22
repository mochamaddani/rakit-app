import { createHmac, randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { ensureOwner, OWNER, resetOwnerPages, signIn } from './helpers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

test.beforeAll(ensureOwner);

test('anonymous visitors are sent to /login with a return path', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL('/login?next=%2Fdashboard');
});

test('the owner signs in and lands on the dashboard', async ({ page }) => {
  await resetOwnerPages();
  await signIn(page);
  await expect(page).toHaveURL('/dashboard');
  await expect(page.getByRole('heading', { name: 'Your pages' })).toBeVisible();
  await expect(page.getByText('No pages yet.')).toBeVisible();
});

test('a wrong password shows an error and stays on /login', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(OWNER.email);
  await page.getByLabel('Password').fill('definitely-wrong-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  // Scoped to the form: Next.js also renders a route announcer with role="alert".
  await expect(page.locator('form').getByRole('alert')).toHaveText('Wrong email or password.');
  await expect(page).toHaveURL(/\/login/);
});

test('sign-in returns to a safe next path but never off-site', async ({ page }) => {
  await signIn(page, 'https://evil.example/phish');
  await expect(page).toHaveURL('/dashboard');
});

test('signing out protects the dashboard again', async ({ page }) => {
  await signIn(page);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL('/login');
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login\?next=/);
});

test('a tampered session cookie is rejected', async ({ page, context }) => {
  await signIn(page);
  await expect(page).toHaveURL('/dashboard');
  const authCookies = (await context.cookies()).filter((c) => /^sb-.+-auth-token/.test(c.name));
  expect(authCookies.length).toBeGreaterThan(0);
  await context.addCookies(authCookies.map((c) => ({ ...c, value: 'tampered' })));
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login\?next=/);
});

/** A well-formed Supabase session cookie whose access token is signed with the wrong key. */
function forgedSessionCookie(): string {
  const now = Math.floor(Date.now() / 1000);
  const b64url = (value: string) => Buffer.from(value).toString('base64url');
  const user = {
    id: randomUUID(),
    aud: 'authenticated',
    role: 'authenticated',
    email: 'forged@evil.example',
  };
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(
    JSON.stringify({
      sub: user.id,
      aud: user.aud,
      role: user.role,
      email: user.email,
      iat: now,
      exp: now + 3600,
    }),
  );
  const signature = createHmac('sha256', 'not-the-project-jwt-secret-not-the-project-jwt-secret')
    .update(`${header}.${payload}`)
    .digest('base64url');
  const session = {
    access_token: `${header}.${payload}.${signature}`,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: 'forged',
    user,
  };
  return `base64-${b64url(JSON.stringify(session))}`;
}

// getSession() would accept this cookie (it only decodes it); getClaims() verifies the signature.
test('a well-formed session cookie with a forged signature is rejected', async ({
  page,
  context,
}) => {
  await signIn(page);
  await expect(page).toHaveURL('/dashboard');
  const real = (await context.cookies()).find((c) => /^sb-.+-auth-token/.test(c.name));
  if (!real) throw new Error('no Supabase auth cookie after sign-in');
  await context.clearCookies({ name: /^sb-.+-auth-token/ });
  await context.addCookies([
    { ...real, name: real.name.replace(/\.\d+$/, ''), value: forgedSessionCookie() },
  ]);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login\?next=/);
});

test('API routes answer 401 instead of redirecting', async ({ request }) => {
  const res = await request.get('/api/pages', { maxRedirects: 0 });
  expect(res.status()).toBe(401);
  expect(await res.json()).toEqual({ error: 'unauthorized' });
});

test('public sign-up is disabled', async () => {
  const anon = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  const { error } = await anon.auth.signUp({
    email: `intruder-${Date.now()}@launchpad.test`,
    password: 'whatever-123456',
  });
  expect(error?.message).toMatch(/signups not allowed/i);
});
