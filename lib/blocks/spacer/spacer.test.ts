import { describe, expect, it } from 'vitest';
import { renderBlock, singleBlockDoc } from '@/lib/blocks/test-utils';
import { renderPage } from '@/lib/renderer/page';
import { parseDocument } from '@/lib/schema/document';
import { validateHtml } from '@/tests/helpers/validate-html';
import { spacer } from '@/lib/blocks/spacer';

describe('spacer block', () => {
  it('renders only a spacer by default', () => {
    expect(renderBlock(spacer, {})).toBe(
      '<div class="lp-spacer lp-spacer--md" aria-hidden="true"></div>',
    );
  });
  it('adds a short line when asked', () => {
    expect(renderBlock(spacer, { size: 'lg', line: true, lineWidth: 'short' })).toBe(
      '<div class="lp-spacer lp-spacer--lg" aria-hidden="true"><hr class="lp-spacer__line lp-spacer__line--short"></div>',
    );
  });
  it('rejects unknown sizes', () => {
    expect(spacer.schema.safeParse({ size: 'xxl' }).success).toBe(false);
  });
  it('needs no JavaScript', () => {
    expect(spacer.snippet).toBeUndefined();
  });
  it('renders valid HTML with only required fields', async () => {
    for (const props of [{}, { line: true }]) {
      expect(
        await validateHtml(
          renderPage(parseDocument(singleBlockDoc('spacer', props)), { mode: 'export' }).html,
        ),
      ).toEqual([]);
    }
  });
  it('matches the snapshot', async () => {
    await expect(renderBlock(spacer, { size: 'xl', line: true })).toMatchFileSnapshot(
      './__snapshots__/spacer.html',
    );
  });
});
