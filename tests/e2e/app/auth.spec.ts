import { expect, test, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const email = process.env.E2E_OWNER_EMAIL ?? 'owner@launchpad.test';
const password = process.env.E2E_OWNER_PASSWORD ?? 'correct-horse-battery-1';

test.beforeAll(async () => {
  const admin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error && !/already/i.test(error.message)) throw error;
});

async function signIn(page: Page, next?: string) {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : '/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

test('anonymous visitors are sent to /login with a return path', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL('/login?next=%2Fdashboard');
});

test('the owner signs in and lands on the dashboard', async ({ page }) => {
  await signIn(page);
  await expect(page).toHaveURL('/dashboard');
  await expect(page.getByRole('heading', { name: 'Your pages' })).toBeVisible();
  await expect(page.getByText('No pages yet.')).toBeVisible();
});

test('a wrong password shows an error and stays on /login', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
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
