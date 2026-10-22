import { describe, expect, it } from 'vitest';
import { footer } from '@/lib/blocks/footer';
import { renderBlock, singleBlockDoc } from '@/lib/blocks/test-utils';
import { renderPage } from '@/lib/renderer/page';
import { parseDocument } from '@/lib/schema/document';
import { sequentialIds } from '@/lib/schema/ids';
import { validateHtml } from '@/tests/helpers/validate-html';

const props = {
  brand: 'Botolku',
  links: [
    {
      id: 'l1',
      label: 'Kebijakan Privasi',
      link: { kind: 'url', url: 'https://botolku.id/privasi' },
    },
    { id: 'l2', label: 'Syarat', link: { kind: 'url', url: '' } },
  ],
  disclaimer: 'Hasil dapat berbeda.',
  copyright: '© 2026 Botolku',
};

describe('footer block', () => {
  it('renders a footer with a labelled link list', () => {
    const out = renderBlock(footer, props);
    expect(out).toContain('<footer class="lp-footer">');
    expect(out).toContain(
      '<nav class="lp-footer__nav" aria-label="Tautan"><ul><li><a href="https://botolku.id/privasi">Kebijakan Privasi</a></li><li><a href="#">Syarat</a></li></ul></nav>',
    );
  });
  it('declares itself a footer landmark and defaults to the compliance links', () => {
    expect(footer.landmark).toBe('footer');
    expect(footer.defaultProps(sequentialIds()).links.map((l) => l.label)).toEqual([
      'Privacy Policy',
      'Terms',
      'Contact',
    ]);
  });
  it('renders valid HTML with only required fields', async () => {
    expect(
      await validateHtml(
        renderPage(parseDocument(singleBlockDoc('footer', {})), { mode: 'export' }).html,
      ),
    ).toEqual([]);
  });
  it('matches the snapshot', async () => {
    await expect(renderBlock(footer, props)).toMatchFileSnapshot('./__snapshots__/footer.html');
  });
});
