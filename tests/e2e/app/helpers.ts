// Shared helpers for the app e2e tests. They use the service-role key, which only ever lives in
// tests and scripts. Every spec shares one owner account and resets its pages (workers: 1).
import type { Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/supabase/database.types';

export const OWNER = {
  email: process.env.E2E_OWNER_EMAIL ?? 'owner@launchpad.test',
  password: process.env.E2E_OWNER_PASSWORD ?? 'correct-horse-battery-1',
};

export const EMPTY_DOC = { schemaVersion: 1, sections: [] };

let admin: SupabaseClient<Database> | undefined;

export function adminClient(): SupabaseClient<Database> {
  admin ??= createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  return admin;
}

export async function ensureOwner(): Promise<void> {
  const { error } = await adminClient().auth.admin.createUser({
    email: OWNER.email,
    password: OWNER.password,
    email_confirm: true,
  });
  if (error && !/already/i.test(error.message)) throw error;
}

let workspaceId: string | undefined;

export async function ownerWorkspaceId(): Promise<string> {
  if (workspaceId) return workspaceId;
  const { data: users, error } = await adminClient().auth.admin.listUsers();
  if (error) throw error;
  const owner = users.users.find((user) => user.email === OWNER.email);
  if (!owner) throw new Error(`No user ${OWNER.email}; call ensureOwner() first`);
  const { data, error: workspaceError } = await adminClient()
    .from('workspaces')
    .select('id')
    .eq('owner_id', owner.id)
    .single();
  if (workspaceError) throw workspaceError;
  workspaceId = data.id;
  return workspaceId;
}

export async function resetOwnerPages(): Promise<void> {
  const { error } = await adminClient()
    .from('pages')
    .delete()
    .eq('workspace_id', await ownerWorkspaceId());
  if (error) throw error;
}

/** Inserts a page whose draft is `document` exactly as given (it may be invalid on purpose). */
export async function seedPage(input: {
  name: string;
  document: unknown;
  slug?: string;
}): Promise<string> {
  const { data, error } = await adminClient()
    .from('pages')
    .insert({
      workspace_id: await ownerWorkspaceId(),
      name: input.name,
      slug: input.slug ?? `seed-${crypto.randomUUID().slice(0, 8)}`,
      current_draft: input.document as NonNullable<Json>,
      schema_version: 1,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function signIn(page: Page, next?: string): Promise<void> {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : '/login');
  await page.getByLabel('Email').fill(OWNER.email);
  await page.getByLabel('Password').fill(OWNER.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}
