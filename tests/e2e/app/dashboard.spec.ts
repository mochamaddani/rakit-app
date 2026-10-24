import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import {
  adminClient,
  EMPTY_DOC,
  ensureOwner,
  exportPage,
  openEditor,
  ownerWorkspaceId,
  resetOwnerPages,
  seedPage,
  signIn,
  storedExport,
  versionsOf,
} from './helpers';

test.beforeAll(ensureOwner);
test.beforeEach(async ({ page }) => {
  await resetOwnerPages();
  await signIn(page);
});

async function createPage(page: Page, name: string) {
  await page.getByRole('button', { name: 'New page' }).click();
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Create page' }).click();
  await expect(page).toHaveURL(/\/editor\/[0-9a-f-]{36}$/, { timeout: 20_000 });
}

test('creates a blank page and opens it in the editor', async ({ page }) => {
  await createPage(page, 'Botol test');
  await expect(page.getByRole('heading', { name: 'Botol test' })).toBeVisible();
});

test('two pages with the same name get distinct slugs', async ({ page }) => {
  await createPage(page, 'Botol test');
  await page.goto('/dashboard');
  await createPage(page, 'Botol test');
  const { data } = await adminClient().from('pages').select('slug').eq('name', 'Botol test');
  expect(data!.map((row) => row.slug).sort()).toEqual(['botol-test', 'botol-test-2']);
});

test('lists pages newest first with status and last edited', async ({ page }) => {
  await seedPage({ name: 'Older', document: EMPTY_DOC });
  await seedPage({ name: 'Newer', document: EMPTY_DOC });
  await page.reload();
  const items = page.getByRole('listitem');
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toContainText('Newer');
  await expect(items.nth(0)).toContainText('Draft');
  await expect(items.nth(0)).toContainText('Edited just now');
  await expect(items.nth(1)).toContainText('Older');
});

test('renames a page', async ({ page }) => {
  await seedPage({ name: 'Old name', document: EMPTY_DOC });
  await page.reload();
  await page.getByRole('button', { name: 'Actions for Old name' }).click();
  await page.getByRole('menuitem', { name: 'Rename' }).click();
  await page.getByLabel('Name', { exact: true }).fill('New name');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('link', { name: 'New name' })).toBeVisible();
});

test('deletes a page only after confirmation', async ({ page }) => {
  await seedPage({ name: 'Doomed', document: EMPTY_DOC });
  await page.reload();
  for (const confirm of [false, true]) {
    await page.getByRole('button', { name: 'Actions for Doomed' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await expect(page.getByRole('alertdialog')).toContainText('Delete “Doomed”?');
    await page.getByRole('button', { name: confirm ? 'Delete page' : 'Cancel' }).click();
    await expect(page.getByRole('link', { name: 'Doomed' })).toHaveCount(confirm ? 0 : 1);
  }
  await expect(page.getByText('No pages yet.')).toBeVisible();
});

test('unknown or malformed page ids show the not-found page', async ({ page }) => {
  for (const id of [crypto.randomUUID(), 'not-a-uuid']) {
    const response = await page.goto(`/editor/${id}`);
    expect(response?.status()).toBe(404);
  }
});

const HERO = {
  schemaVersion: 1,
  sections: [{ id: 's1', blocks: [{ id: 'b1', type: 'hero', props: { headline: 'Teh' } }] }],
};

test('an exported page shows its export time and downloads its latest HTML', async ({
  page,
}, info) => {
  const pageId = await seedPage({ name: 'Teh', document: HERO, slug: 'teh' });
  await openEditor(page, pageId);
  await exportPage(page, info.outputPath('teh.html'));
  await page.goto('/dashboard');
  const row = page.getByRole('listitem').filter({ hasText: 'Teh' });
  await expect(row).toContainText('Exported just now');
  await expect(row).toContainText('Exported', { useInnerText: true });
  await page.getByRole('button', { name: 'Actions for Teh' }).click();
  const [file] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('menuitem', { name: 'Download HTML' }).click(),
  ]);
  expect(file.suggestedFilename()).toBe('teh.html');
  const path = info.outputPath('downloaded.html');
  await file.saveAs(path);
  const [version] = await versionsOf(pageId);
  expect(await readFile(path, 'utf8')).toBe(await storedExport(version!.html_path));
});

test('a page that was never exported cannot be downloaded', async ({ page }) => {
  await seedPage({ name: 'Draft only', document: HERO });
  await page.reload();
  await page.getByRole('button', { name: 'Actions for Draft only' }).click();
  await expect(page.getByRole('menuitem', { name: 'Download HTML' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
});

test('deleting a page removes its stored exports', async ({ page }, info) => {
  const pageId = await seedPage({ name: 'Doomed export', document: HERO });
  await openEditor(page, pageId);
  await exportPage(page, info.outputPath('doomed.html'));
  const folder = `${await ownerWorkspaceId()}/${pageId}`;
  const listed = async () =>
    (await adminClient().storage.from('page-versions').list(folder)).data?.length ?? 0;
  expect(await listed()).toBe(1);
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Actions for Doomed export' }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Delete page' }).click();
  await expect(page.getByRole('link', { name: 'Doomed export' })).toHaveCount(0);
  await expect.poll(listed).toBe(0);
});
