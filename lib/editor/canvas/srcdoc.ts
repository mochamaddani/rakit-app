import { escapeInlineScript } from '@/lib/renderer/html';
import { renderPage } from '@/lib/renderer/page';
import type { PageDocument } from '@/lib/schema/document';
import { CHANNEL_PATTERN } from './constants';
import { asset as runtime } from './preview-runtime.generated';

const END = '</body></html>';

/** The canvas document: the preview render plus the runtime, tagged with this load's channel. */
export function buildSrcdoc(doc: PageDocument, channel: string): string {
  if (!CHANNEL_PATTERN.test(channel)) throw new Error('Invalid canvas channel');
  const page = renderPage(doc, { mode: 'preview' }).html;
  if (!page.endsWith(END)) throw new Error('The preview render does not end with </body></html>');
  return `${page.slice(0, -END.length)}<script data-lp-channel="${channel}">${escapeInlineScript(
    runtime.min,
  )}</script>${END}`;
}
