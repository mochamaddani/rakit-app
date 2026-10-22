import { expect, test, type Page } from '@playwright/test';
import { adminClient, EMPTY_DOC, ensureOwner, resetOwnerPages, seedPage, signIn } from './helpers';

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
