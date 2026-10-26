import { renderPage } from '@/lib/renderer/page';
import { loadTemplateDocument } from './catalog';

/**
 * A template as the gallery shows it: preview mode, which never carries vendor tags or form embeds
 * (D-047, D-048) and keeps Custom HTML in a nested frame (D-053). The gallery puts it in an
 * `<iframe sandbox="" srcdoc>`, so nothing in it runs scripts.
 */
export function templatePreviewHtml(raw: unknown): string | null {
  const loaded = loadTemplateDocument(raw);
  return loaded.ok ? renderPage(loaded.doc, { mode: 'preview' }).html : null;
}
