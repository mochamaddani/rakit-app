import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import {
  adminClient,
  canvas,
  ensureOwner,
  exportPage,
  openEditor,
  ownerWorkspaceId,
  resetOwnerPages,
  saveStatus,
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

const DOC = {
  schemaVersion: 2,
  sections: [
    { id: 'sHero', blocks: [{ id: 'bHero', type: 'hero', props: { headline: 'Versi ekspor' } }] },
  ],
};
const headline = (page: Page) => canvas(page).locator('h1');
const versionsDialog = (page: Page) => page.getByRole('dialog', { name: 'Versions' });

async function editHeadline(page: Page, text: string) {
  await canvas(page)
    .locator('[data-lp-type="hero"]')
    .click({ position: { x: 8, y: 8 } });
  await page.getByLabel('Headline', { exact: true }).fill(text);
  await expect(headline(page)).toHaveText(text);
  await expect(saveStatus(page)).toHaveText('Saved');
}

test('restoring a version is one undo step; an invalid stored document changes nothing', async ({
  page,
}, info) => {
  const pageId = await seedPage({ name: 'Versi', document: DOC });
  await openEditor(page, pageId);
  await exportPage(page, info.outputPath('versi.html'));
  await editHeadline(page, 'Versi baru');

  await page.getByRole('button', { name: 'Versions' }).click();
  const rows = versionsDialog(page).getByRole('listitem');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Latest');
  await rows.first().getByRole('button', { name: 'Restore' }).click();
  await expect(versionsDialog(page)).toBeHidden();
  await expect(headline(page)).toHaveText('Versi ekspor');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(headline(page)).toHaveText('Versi baru');
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(headline(page)).toHaveText('Versi ekspor');
  await expect(saveStatus(page)).toHaveText('Saved');
  await page.reload();
  await expect(headline(page)).toHaveText('Versi ekspor');

  // A stored document that no longer validates (a hero without its headline).
  const id = crypto.randomUUID();
  const { error } = await adminClient()
    .from('page_versions')
    .insert({
      id,
      page_id: pageId,
      document: {
        schemaVersion: 2,
        sections: [{ id: 's', blocks: [{ id: 'b', type: 'hero', props: {} }] }],
      },
      html_path: `${await ownerWorkspaceId()}/${pageId}/${id}.html`,
      byte_size: 1,
      html_sha256: '0'.repeat(64),
      kind: 'export',
    });
  if (error) throw error;
  await page.getByRole('button', { name: 'Versions' }).click();
  await expect(rows).toHaveCount(2);
  await rows.first().getByRole('button', { name: 'Restore' }).click();
  await expect(versionsDialog(page).getByRole('alert')).toContainText(
    "This version can't be restored",
  );
  await expect(headline(page)).toHaveText('Versi ekspor');
});

test('Download fetches the stored file', async ({ page }, info) => {
  const pageId = await seedPage({ name: 'Versi', document: DOC, slug: 'versi' });
  await openEditor(page, pageId);
  await exportPage(page, info.outputPath('first.html'));
  await page.getByRole('button', { name: 'Versions' }).click();
  const [file] = await Promise.all([
    page.waitForEvent('download'),
    versionsDialog(page).getByRole('button', { name: 'Download' }).click(),
  ]);
  expect(file.suggestedFilename()).toBe('versi.html');
  const path = info.outputPath('again.html');
  await file.saveAs(path);
  const [version] = await versionsOf(pageId);
  expect(await readFile(path, 'utf8')).toBe(await storedExport(version!.html_path));
});
