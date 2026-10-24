// Shared helpers for the app e2e tests. They use the service-role key, which only ever lives in
// tests and scripts. Every spec shares one owner account and resets its pages (workers: 1).
import { expect, type FrameLocator, type Locator, type Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getBlockDefinition } from '@/lib/blocks/registry';
import { sequentialIds } from '@/lib/schema/ids';
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
  const workspace = await ownerWorkspaceId();
  const { error } = await adminClient().from('pages').delete().eq('workspace_id', workspace);
  if (error) throw error;
  // Stored exports live under '<workspace>/<page>/' and outlive their rows here.
  const versions = adminClient().storage.from('page-versions');
  const { data: folders } = await versions.list(workspace);
  for (const folder of folders ?? []) {
    const { data: files } = await versions.list(`${workspace}/${folder.name}`);
    const paths = (files ?? []).map((file) => `${workspace}/${folder.name}/${file.name}`);
    if (paths.length > 0) await versions.remove(paths);
  }
}

/** Newest first: the page's recorded versions as the server stores them. */
export async function versionsOf(pageId: string) {
  const { data, error } = await adminClient()
    .from('page_versions')
    .select('id, html_path, html_sha256, byte_size, draft_revision, export_settings')
    .eq('page_id', pageId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

/** A stored export file's text (admin client). */
export async function storedExport(path: string): Promise<string> {
  const { data, error } = await adminClient().storage.from('page-versions').download(path);
  if (error) throw error;
  return data.text();
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

/** The editor's canvas iframe. */
export function canvas(page: Page): FrameLocator {
  return page.frameLocator('iframe[title="Page preview"]');
}

/** The `data-lp-type` of every block in the canvas, in page order. */
export function blockTypes(frame: FrameLocator): Promise<string[]> {
  return frame
    .locator('[data-lp-block]')
    .evaluateAll((elements) => elements.map((el) => el.getAttribute('data-lp-type') ?? ''));
}

/** Opens the editor and waits until the canvas runtime has reported ready. */
export async function openEditor(page: Page, pageId: string): Promise<FrameLocator> {
  await page.goto(`/editor/${pageId}`);
  await expect(page.locator('iframe[title="Page preview"][data-ready="true"]')).toBeAttached({
    timeout: 20_000,
  });
  return canvas(page);
}

/** Clicks a block in the editor palette. */
export async function addBlock(page: Page, label: string): Promise<void> {
  await page
    .getByRole('navigation', { name: 'Blocks' })
    .getByRole('button', { name: label })
    .click();
}

export function saveStatus(page: Page) {
  return page.getByTestId('save-status');
}

/** A raw document with one section per block type (s1…, b1…), each holding that block's defaults. */
export function docWith(types: string[]) {
  return {
    schemaVersion: 1,
    sections: types.map((type, i) => ({
      id: `s${i + 1}`,
      blocks: [
        {
          id: `b${i + 1}`,
          type,
          props: getBlockDefinition(type)!.defaultProps(sequentialIds(`b${i + 1}i`)),
        },
      ],
    })),
  };
}

/** The palette row whose button is named `label`. */
export function paletteItem(page: Page, label: string): Locator {
  return page
    .getByRole('navigation', { name: 'Blocks' })
    .getByRole('listitem')
    .filter({ has: page.getByRole('button', { name: label, exact: true }) });
}

export type Point = [number, number];

/** The main-page point at fractions of the element's box (frame elements included). */
export async function pointIn(locator: Locator, fx: number, fy: number): Promise<Point> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('The element has no box');
  return [box.x + box.width * fx, box.y + box.height * fy];
}

/** Presses at `from`, moves to `to` in 12 steps, optionally holds there, and releases. */
export async function dragWithMouse(
  page: Page,
  from: Point,
  to: Point,
  { hold = 0 }: { hold?: number } = {},
): Promise<void> {
  await page.mouse.move(...from);
  await page.mouse.down();
  await page.mouse.move(...to, { steps: 12 });
  for (let waited = 0; waited < hold; waited += 50) {
    await page.mouse.move(to[0], to[1] + ((waited / 50) % 2));
    await page.waitForTimeout(50);
  }
  await page.mouse.up();
}

/** A touch long-press (300 ms) at `from`, then a drag to `to`, through CDP touch events. */
export async function touchDrag(page: Page, from: Point, to: Point): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  const at = ([x, y]: Point) => ({ x, y });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at(from)] });
  await page.waitForTimeout(300);
  for (let i = 1; i <= 12; i++) {
    const p: Point = [
      from[0] + ((to[0] - from[0]) * i) / 12,
      from[1] + ((to[1] - from[1]) * i) / 12,
    ];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [at(p)] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

/** The draft as the server stores it. */
export async function storedDraft(pageId: string): Promise<Record<string, unknown>> {
  const { data, error } = await adminClient()
    .from('pages')
    .select('current_draft')
    .eq('id', pageId)
    .single();
  if (error) throw error;
  return data.current_draft as Record<string, unknown>;
}

/** Exports the open page with the default options and waits until the version is recorded. */
export async function exportPage(page: Page, savePath: string): Promise<string> {
  await page.getByRole('banner').getByRole('button', { name: 'Export', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Export page' });
  const button = dialog.getByRole('button', { name: 'Download HTML' });
  await expect(button).toBeEnabled();
  const [file] = await Promise.all([page.waitForEvent('download'), button.click()]);
  await file.saveAs(savePath);
  await expect(dialog.getByText(/^Recorded · sha256/)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  return file.suggestedFilename();
}
