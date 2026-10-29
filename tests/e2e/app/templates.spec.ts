import { expect, test, type Page } from '@playwright/test';
import {
  adminClient,
  blockTypes,
  canvas,
  ensureOwner,
  resetOwnerPages,
  resetOwnerTemplates,
  seedPage,
  signIn,
  storedDraft,
} from './helpers';

test.beforeAll(ensureOwner);
test.beforeEach(async ({ page }) => {
  await resetOwnerPages();
  await resetOwnerTemplates();
  await signIn(page);
});

const HERO = {
  schemaVersion: 2,
  sections: [{ id: 's1', blocks: [{ id: 'b1', type: 'hero', props: { headline: 'Teh' } }] }],
};

async function pageRow(id: string) {
  const { data, error } = await adminClient()
    .from('pages')
    .select('name, slug, tags, status')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

test('duplicates a page and opens the copy', async ({ page }) => {
  const sourceId = await seedPage({ name: 'Teh', document: HERO, slug: 'teh' });
  await adminClient()
    .from('pages')
    .update({ tags: ['tes'] })
    .eq('id', sourceId);
  const copies: string[] = [];
  for (const slug of ['teh-copy', 'teh-copy-2']) {
    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'Actions for Teh', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Duplicate' }).click();
    await expect(page).toHaveURL(/\/editor\/[0-9a-f-]{36}$/, { timeout: 20_000 });
    const copyId = page.url().split('/').pop()!;
    expect(copyId).not.toBe(sourceId);
    expect(await pageRow(copyId)).toEqual({
      name: 'Teh (copy)',
      slug,
      tags: ['tes'],
      status: 'draft',
    });
    expect(await storedDraft(copyId)).toEqual(await storedDraft(sourceId));
    copies.push(copyId);
  }
  expect(new Set(copies).size).toBe(2);
});

function card(page: Page, name: string) {
  return page
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { name, exact: true }) });
}

async function useTemplate(page: Page, name: string, pageName?: string) {
  await card(page, name).getByRole('button', { name: 'Use template' }).click();
  const dialog = page.getByRole('dialog', { name: `New page from ${name}` });
  if (pageName) await dialog.getByLabel('Name').fill(pageName);
  await dialog.getByRole('button', { name: 'Create page' }).click();
  await expect(page).toHaveURL(/\/editor\/[0-9a-f-]{36}$/, { timeout: 20_000 });
  await expect(page.locator('iframe[title="Page preview"][data-ready="true"]')).toBeAttached({
    timeout: 20_000,
  });
}

test('filters built-in templates by category', async ({ page }) => {
  await page.goto('/dashboard');
  await page.getByRole('link', { name: 'Templates' }).click();
  await expect(page.getByRole('heading', { name: 'Templates', level: 1 })).toBeVisible();
  await page.getByRole('link', { name: 'Herbal & health' }).click();
  await expect(page).toHaveURL(/category=herbal/);
  await expect(page.getByRole('link', { name: 'Herbal & health' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(card(page, 'Teh herbal')).toBeVisible();
  await expect(card(page, 'Koleksi fashion')).toHaveCount(0);
  await page.getByRole('link', { name: 'All', exact: true }).click();
  await expect(card(page, 'Teh herbal')).toBeVisible();
  await expect(card(page, 'Koleksi fashion')).toBeVisible();
  await page.goto('/dashboard/templates?category=nope');
  await expect(card(page, 'Koleksi fashion')).toBeVisible();
  await expect(page.getByRole('link', { name: 'All', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('creates a page from a built-in template', async ({ page }) => {
  await page.goto('/dashboard/templates');
  await useTemplate(page, 'Koleksi fashion', 'Kaos tes');
  await expect(page.getByRole('heading', { name: 'Kaos tes' })).toBeVisible();
  const types = await blockTypes(canvas(page));
  expect(types.slice(0, 2)).toEqual(['hero', 'product-carousel']);
});

test('previews a template in a script-less sandbox', async ({ page }) => {
  await page.goto('/dashboard/templates');
  await card(page, 'Teh herbal').getByRole('button', { name: 'Preview' }).click();
  const frame = page.locator('iframe[title="Template preview"]');
  await expect(frame).toHaveAttribute('sandbox', '');
  await expect(
    page.frameLocator('iframe[title="Template preview"]').getByRole('heading', { level: 1 }),
  ).toHaveText('[REPLACE: Nama Teh Anda]');
});

test('saves a page as a template, uses it, edits and deletes it', async ({ page }) => {
  await seedPage({ name: 'Teh', document: HERO });
  await page.reload();
  await page.getByRole('button', { name: 'Actions for Teh' }).click();
  await page.getByRole('menuitem', { name: 'Save as template' }).click();
  const save = page.getByRole('dialog', { name: 'Save as template' });
  await save.getByLabel('Name').fill('Template tes');
  await save.getByLabel('Category').selectOption({ label: 'Fashion' });
  await save.getByLabel('Description').fill('Satu hero');
  await save.getByRole('button', { name: 'Save template' }).click();
  await expect(save).toBeHidden();

  await page.goto('/dashboard/templates');
  await page.getByRole('link', { name: 'Fashion', exact: true }).click();
  await expect(card(page, 'Template tes')).toContainText('Saved');
  await expect(card(page, 'Template tes')).toContainText('Satu hero');
  await useTemplate(page, 'Template tes');
  await expect(canvas(page).getByRole('heading', { name: 'Teh' })).toBeVisible();

  await page.goto('/dashboard/templates');
  await page.getByRole('button', { name: 'Actions for Template tes' }).click();
  await page.getByRole('menuitem', { name: 'Edit' }).click();
  const edit = page.getByRole('dialog', { name: 'Edit template' });
  await edit.getByLabel('Category').selectOption({ label: 'Beauty & skincare' });
  await edit.getByRole('button', { name: 'Save' }).click();
  await expect(edit).toBeHidden();
  await page.getByRole('link', { name: 'Beauty & skincare' }).click();
  await expect(card(page, 'Template tes')).toBeVisible();
  await page.getByRole('link', { name: 'Fashion', exact: true }).click();
  await expect(card(page, 'Template tes')).toHaveCount(0);

  await page.getByRole('link', { name: 'All', exact: true }).click();
  await page.getByRole('button', { name: 'Actions for Template tes' }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await expect(page.getByRole('alertdialog')).toContainText('Delete template “Template tes”?');
  await page.getByRole('button', { name: 'Delete template' }).click();
  // The open dialog hides the page from the accessibility tree; check the card once it closes.
  await expect(page.getByRole('alertdialog')).toBeHidden();
  await expect(card(page, 'Template tes')).toHaveCount(0);
  await expect
    .poll(async () => {
      const { data } = await adminClient()
        .from('templates')
        .select('id')
        .eq('name', 'Template tes');
      return data?.length;
    })
    .toBe(0);
});
