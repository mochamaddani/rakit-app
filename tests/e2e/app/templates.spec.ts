import { expect, test } from '@playwright/test';
import {
  adminClient,
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
  schemaVersion: 1,
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
