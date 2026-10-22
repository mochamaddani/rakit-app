import { expect, it } from 'vitest';
import { editorDoc } from '../test-fixtures';
import { asset } from './preview-runtime.generated';
import { createBlockHtmlCache } from './render-cache';
import { buildSrcdoc } from './srcdoc';
import { canvasState } from './sync';

it('injects the runtime with its channel right before </body>, after the page script', () => {
  const html = buildSrcdoc(editorDoc(), 'abcdefghij');
  expect(html.endsWith('</script></body></html>')).toBe(true);
  expect(html).toContain('<script data-lp-channel="abcdefghij">');
  expect(html.indexOf('<script>')).toBeLessThan(html.indexOf('data-lp-channel'));
});
it('its body equals the canvas state with every slot filled', () => {
  const doc = editorDoc();
  const s = canvasState(doc, createBlockHtmlCache());
  const filled = s.skeleton.replace(/<div data-lp-slot="([^"]+)"><\/div>/g, (_, id: string) =>
    s.blocks.get(id)!,
  );
  expect(buildSrcdoc(doc, 'abcdefghij')).toContain(`<body>${filled}<script>`);
});
it('rejects a malformed channel', () => expect(() => buildSrcdoc(editorDoc(), 'x"><b')).toThrow());
it('the runtime stays within 8 KB minified', () =>
  expect(new TextEncoder().encode(asset.min).byteLength).toBeLessThanOrEqual(8192));
