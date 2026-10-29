import { describe, expect, it } from 'vitest';
import { STORELINK_SNIPPET } from '@/tests/fixtures/forms';
import { validateHtml } from '@/tests/helpers/validate-html';
import { BUILTIN_TEMPLATES } from './builtin';
import { templatePreviewHtml } from './preview';

describe('templatePreviewHtml', () => {
  it('renders a built-in as a valid page', async () => {
    const html = templatePreviewHtml(BUILTIN_TEMPLATES[0]!.document());
    expect(html).not.toBeNull();
    expect(await validateHtml(html!)).toEqual([]);
  });

  it('leaves out tracking and form embeds, and keeps owner code inside its nested frame', () => {
    const html = templatePreviewHtml({
      schemaVersion: 2,
      settings: {
        tracking: {
          metaPixelId: '123456789012345',
          ga4Id: 'G-ABCDEF1234',
          headCode: '<script>window.head=1</script>',
        },
      },
      sections: [
        {
          id: 's1',
          blocks: [
            {
              id: 'b1',
              type: 'custom-html',
              props: { html: '<script>window.custom=1</script>', runScripts: true },
            },
            { id: 'b2', type: 'form-embed', props: { mode: 'snippet', code: STORELINK_SNIPPET } },
          ],
        },
      ],
    })!;
    // Custom HTML previews in a nested frame (D-053); the gallery's sandbox="" frame stops its
    // scripts too, since nested frames inherit the stricter sandbox.
    const frames = html.match(/<iframe [^>]*data-lp-custom-frame[^>]*>/g) ?? [];
    expect(frames).toHaveLength(1);
    const outside = html.replace(/<iframe [^>]*data-lp-custom-frame[^>]*><\/iframe>/g, '');
    for (const forbidden of ['fbq(', 'gtag(', 'window.head=1', 'window.custom=1', 'storelink.id'])
      expect(outside).not.toContain(forbidden);
  });

  it('returns null for a document that does not parse', () => {
    expect(templatePreviewHtml({ schemaVersion: 99 })).toBeNull();
  });
});
