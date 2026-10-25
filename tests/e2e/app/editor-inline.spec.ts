import { expect, test, type FrameLocator, type Locator, type Page } from '@playwright/test';
import {
  blockTypes,
  docWith,
  ensureOwner,
  openEditor,
  pointIn,
  resetOwnerPages,
  seedPage,
  signIn,
} from './helpers';

test.beforeAll(ensureOwner);
test.beforeEach(async ({ page }) => {
  await resetOwnerPages();
  await signIn(page);
});

const field = (frame: FrameLocator, type: string, path: string) =>
  frame.locator(`[data-lp-type="${type}"] [data-lp-field="${path}"]`);
const editing = (frame: FrameLocator) => frame.locator('[data-lp-editing]');
// exact: "Subheadline" contains "headline".
const inspector = (page: Page, label: string) => page.getByLabel(label, { exact: true });
// Home and End move by visual line, and canvas text wraps: collapse a select-all instead.
const caretToEnd = async (page: Page) => {
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('ArrowRight');
};
const caretToStart = async (page: Page) => {
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('ArrowLeft');
};
/** The page point over an element's first character, so a double-click there hits its first word. */
const firstCharacter = async (locator: Locator) => {
  const [fx, fy] = await locator.evaluate((el) => {
    const text = document.createTreeWalker(el, NodeFilter.SHOW_TEXT).nextNode()!;
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, 1);
    const char = range.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    return [
      (char.left + char.width / 2 - box.left) / box.width,
      (char.top + char.height / 2 - box.top) / box.height,
    ];
  });
  return pointIn(locator, fx!, fy!);
};

test('double-click the headline, type, and the inspector follows; one undo reverts the run', async ({
  page,
}) => {
  const frame = await openEditor(
    page,
    await seedPage({ name: 'Inline', document: docWith(['hero']) }),
  );
  const headline = field(frame, 'hero', 'headline');
  const before = (await headline.textContent())!;
  await headline.dblclick();
  await expect(editing(frame)).toHaveCount(1);
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('Botol anti bocor');
  await expect(inspector(page, 'Headline')).toHaveValue('Botol anti bocor');
  await page.keyboard.press('Escape');
  await expect(editing(frame)).toHaveCount(0);
  await expect(headline).toHaveText('Botol anti bocor');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(headline).toHaveText(before);
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
});

test('typed text arrives intact while the editor saves and re-renders', async ({ page }) => {
  const frame = await openEditor(
    page,
    await seedPage({ name: 'Inline', document: docWith(['hero', 'product-carousel']) }),
  );
  const title = field(frame, 'product-carousel', 'items.0.title');
  await title.dblclick();
  await page.keyboard.press('ControlOrMeta+A');
  const typed = 'Botol stainless 750ml warna biru laut';
  await page.keyboard.type(typed, { delay: 20 });
  await page.keyboard.press('Escape');
  await expect(title).toHaveText(typed);
  await expect(
    page.getByRole('list', { name: 'Items' }).getByRole('listitem').first(),
  ).toContainText(typed);
});

test('Backspace and Delete edit text instead of deleting the block', async ({ page }) => {
  const frame = await openEditor(
    page,
    await seedPage({ name: 'Inline', document: docWith(['hero', 'faq']) }),
  );
  const headline = field(frame, 'hero', 'headline');
  const before = (await headline.textContent())!;
  await headline.dblclick();
  await caretToEnd(page);
  for (let i = 0; i < 3; i++) await page.keyboard.press('Backspace');
  await caretToStart(page);
  await page.keyboard.press('Delete');
  await page.keyboard.press('Escape');
  await expect(headline).toHaveText(before.slice(1, -3));
  expect(await blockTypes(frame)).toEqual(['hero', 'faq']);
});

test('pasting formatted text inserts plain text only', async ({ page }) => {
  const frame = await openEditor(
    page,
    await seedPage({ name: 'Inline', document: docWith(['hero']) }),
  );
  const subheadline = field(frame, 'hero', 'subheadline');
  await subheadline.dblclick();
  await page.keyboard.press('ControlOrMeta+A');
  await subheadline.evaluate((el) => {
    const data = new DataTransfer();
    data.setData('text/html', '<b>Tebal</b> <span style="color:red">merah</span>');
    data.setData('text/plain', 'Tebal merah');
    el.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
    );
  });
  await page.keyboard.press('Escape');
  await expect(inspector(page, 'Subheadline')).toHaveValue('Tebal merah');
  await expect(subheadline.locator('b, span')).toHaveCount(0);
});

test('emptying a required headline restores it when editing ends and says why', async ({
  page,
}) => {
  const frame = await openEditor(
    page,
    await seedPage({ name: 'Inline', document: docWith(['hero']) }),
  );
  const headline = field(frame, 'hero', 'headline');
  const before = (await headline.textContent())!;
  await headline.dblclick();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('Backspace');
  await expect(page.getByRole('banner')).toContainText('Headline: Required');
  await page.keyboard.press('Escape');
  await expect(headline).toHaveText(before);
});

test('Mod+B in a rich field stores bold markup', async ({ page }) => {
  // The subheadline: in a bold heading Chrome's Mod+B would remove bold instead.
  const frame = await openEditor(
    page,
    await seedPage({ name: 'Inline', document: docWith(['hero']) }),
  );
  const subheadline = field(frame, 'hero', 'subheadline');
  await subheadline.dblclick();
  await page.keyboard.press('ControlOrMeta+B');
  await page.keyboard.press('Escape');
  await expect(inspector(page, 'Subheadline')).toHaveValue(/\*\*\S+\*\*/);
  await expect(subheadline.locator('strong')).toHaveCount(1);
});

test('Mod+Z while editing ends the edit and reverts it', async ({ page }) => {
  const frame = await openEditor(
    page,
    await seedPage({ name: 'Inline', document: docWith(['hero']) }),
  );
  const headline = field(frame, 'hero', 'headline');
  const before = (await headline.textContent())!;
  await headline.dblclick();
  await caretToEnd(page);
  await page.keyboard.type(' baru');
  await expect(inspector(page, 'Headline')).toHaveValue(/ baru/);
  await page.keyboard.press('ControlOrMeta+Z');
  await expect(editing(frame)).toHaveCount(0);
  await expect(headline).toHaveText(before);
});

test('editing an FAQ question does not toggle its answer', async ({ page }) => {
  const frame = await openEditor(
    page,
    await seedPage({ name: 'Inline', document: docWith(['faq']) }),
  );
  const question = field(frame, 'faq', 'items.1.question');
  const details = frame.locator('details').nth(1);
  await expect(details).not.toHaveAttribute('open');
  await question.dblclick();
  await caretToEnd(page);
  await page.keyboard.type(' sekarang ya');
  await page.keyboard.press('Escape');
  await expect(question).toContainText('sekarang ya');
  await expect(details).not.toHaveAttribute('open');
});

test('double-clicking a word in a button label or a footer link selects that word', async ({
  page,
}) => {
  const frame = await openEditor(
    page,
    await seedPage({ name: 'Inline', document: docWith(['hero', 'footer']) }),
  );
  for (const [type, path, rest] of [
    ['hero', 'primaryCta.label', ' now'],
    ['footer', 'links.0.label', ' Policy'],
  ] as const) {
    const label = field(frame, type, path);
    await label.scrollIntoViewIfNeeded();
    await page.mouse.dblclick(...(await firstCharacter(label)));
    await expect(editing(frame)).toHaveCount(1);
    await page.keyboard.type('X');
    await page.keyboard.press('Escape');
    await expect(label).toHaveText(`X${rest}`);
  }
});

test('arrow keys move the caret in a carousel card instead of scrolling the cards', async ({
  page,
}) => {
  const frame = await openEditor(
    page,
    await seedPage({ name: 'Inline', document: docWith(['product-carousel']) }),
  );
  const title = field(frame, 'product-carousel', 'items.0.title');
  await title.dblclick();
  await caretToEnd(page);
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.type('X');
  await page.keyboard.press('Escape');
  await expect(title).toHaveText('ProductX 1');
  expect(await frame.locator('.lp-carousel__track').evaluate((el) => el.scrollLeft)).toBe(0);
});

test('after Escape the field never shows an older value', async ({ page }) => {
  const frame = await openEditor(
    page,
    await seedPage({ name: 'Inline', document: docWith(['hero', 'product-carousel']) }),
  );
  const headline = field(frame, 'hero', 'headline');
  const canvasFrame = page.frames().find((f) => f.parentFrame() === page.mainFrame())!;
  // Every value the headline shows, and where the list stood when Escape was pressed (a window
  // capture listener runs before the runtime's own).
  await canvasFrame.evaluate(() => {
    const w = window as unknown as { seen: string[]; escapedAt: number };
    w.seen = [];
    w.escapedAt = -1;
    const read = () =>
      document.querySelector('[data-lp-type="hero"] [data-lp-field="headline"]')?.textContent ??
      '(none)';
    new MutationObserver(() => {
      const value = read();
      if (w.seen.at(-1) !== value) w.seen.push(value);
    }).observe(document.body, { subtree: true, childList: true, characterData: true });
    window.addEventListener(
      'keydown',
      (event) => {
        if (event.key === 'Escape') w.escapedAt = w.seen.length;
      },
      true,
    );
  });
  for (let run = 0; run < 5; run++) {
    const text = `Botol anti bocor ${run}`;
    await headline.dblclick();
    await expect(editing(frame)).toHaveCount(1);
    await page.keyboard.press('ControlOrMeta+A');
    // Typed without pauses and ended at once, like the M2 journey that first showed the flash.
    await page.keyboard.type(text);
    await page.keyboard.press('Escape');
    await expect(editing(frame)).toHaveCount(0);
    await expect(inspector(page, 'Headline')).toHaveValue(text);
    await expect(headline).toHaveText(text);
    await page.waitForTimeout(300);
    const { seen, escapedAt } = await canvasFrame.evaluate(() => {
      const w = window as unknown as { seen: string[]; escapedAt: number };
      return { seen: w.seen, escapedAt: w.escapedAt };
    });
    expect(seen.slice(escapedAt).filter((value) => value !== text)).toEqual([]);
  }
});
