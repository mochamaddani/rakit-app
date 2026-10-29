import { expect, test, type Page } from '@playwright/test';
import { renderToFile } from './render-to-file';

const YT = 'dQw4w9WgXcQ';
const url = renderToFile('test-results/video/video.html', {
  schemaVersion: 2,
  settings: { lang: 'en' },
  sections: [
    { id: 's1', blocks: [{ id: 'h1', type: 'hero', props: { headline: 'Watch' } }] },
    {
      id: 's2',
      blocks: [
        {
          id: 'v1',
          type: 'video',
          props: { video: { url: `https://youtu.be/${YT}?si=x`, title: 'How to brew' } },
        },
      ],
    },
  ],
});

/** Answers the player and the thumbnail locally and records player requests. */
async function stubYouTube(page: Page): Promise<string[]> {
  const requests: string[] = [];
  await page.route('**/*youtube-nocookie.com/**', (route) => {
    requests.push(route.request().url());
    return route.fulfill({ contentType: 'text/html', body: '<title>player</title><p>player</p>' });
  });
  await page.route('https://i.ytimg.com/**', (route) => route.fulfill({ status: 404 }));
  return requests;
}

test('no player request before the click', async ({ page }) => {
  const requests = await stubYouTube(page);
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  expect(requests).toEqual([]);
  await expect(page.locator('iframe')).toHaveCount(0);
});

test('click loads the player in place and focuses it', async ({ page }) => {
  const requests = await stubYouTube(page);
  await page.goto(url);
  await page.getByRole('link', { name: 'Play: How to brew' }).click();
  const frame = page.locator('.lp-video iframe');
  await expect(frame).toHaveAttribute(
    'src',
    `https://www.youtube-nocookie.com/embed/${YT}?autoplay=1&rel=0`,
  );
  await expect(frame).toBeFocused();
  await expect.poll(() => requests.length).toBe(1);
  expect(page.url()).toBe(url);
});

test('keyboard Enter on the facade loads the player', async ({ page }) => {
  await stubYouTube(page);
  await page.goto(url);
  await page.getByRole('link', { name: 'Play: How to brew' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.lp-video iframe')).toHaveCount(1);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('the facade links to YouTube', async ({ page }) => {
    await page.goto(url);
    await expect(page.getByRole('link', { name: 'Play: How to brew' })).toHaveAttribute(
      'href',
      `https://www.youtube.com/watch?v=${YT}`,
    );
  });
});
