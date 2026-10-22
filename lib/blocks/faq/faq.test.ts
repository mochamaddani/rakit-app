import { describe, expect, it } from 'vitest';
import { faq } from '@/lib/blocks/faq';
import { renderBlock, singleBlockDoc } from '@/lib/blocks/test-utils';
import { renderPage } from '@/lib/renderer/page';
import { parseDocument } from '@/lib/schema/document';
import { validateHtml } from '@/tests/helpers/validate-html';

const props = {
  heading: 'Pertanyaan',
  items: [
    { id: 'q1', question: 'Berapa lama **pengiriman**?', answer: '2-3 hari.\nGratis ongkir.' },
    { id: 'q2', question: 'Bisa COD?', answer: 'Bisa.' },
  ],
};

describe('faq block', () => {
  it('uses native details/summary and keeps questions as plain text', () => {
    expect(renderBlock(faq, props)).toContain(
      '<details class="lp-faq__item"><summary class="lp-faq__q">Berapa lama **pengiriman**?</summary><div class="lp-faq__a">2-3 hari.<br>Gratis ongkir.</div></details>',
    );
  });
  it('opens only the first item when openFirst is set', () => {
    expect(
      renderBlock(faq, { ...props, openFirst: true }).match(/<details[^>]*\sopen[\s>]/g),
    ).toHaveLength(1);
  });
  it('groups items into an exclusive accordion when asked', () => {
    expect(
      renderBlock(faq, { ...props, exclusive: true }, { block: { blockId: 'f1' } }).match(
        /name="faq-f1"/g,
      ),
    ).toHaveLength(2);
  });
  it('needs no JavaScript', () => {
    expect(faq.snippet).toBeUndefined();
  });
  it('renders valid HTML with only required fields and with an exclusive group', async () => {
    expect(
      await validateHtml(
        renderPage(parseDocument(singleBlockDoc('faq', {})), { mode: 'export' }).html,
      ),
    ).toEqual([]);
    expect(
      await validateHtml(
        renderPage(
          parseDocument(singleBlockDoc('faq', { ...props, exclusive: true, openFirst: true })),
          { mode: 'export' },
        ).html,
      ),
    ).toEqual([]);
  });
  it('matches the snapshot', async () => {
    await expect(renderBlock(faq, { ...props, openFirst: true })).toMatchFileSnapshot(
      './__snapshots__/faq.html',
    );
  });
});
