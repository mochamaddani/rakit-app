import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { renderPage } from '@/lib/renderer/page';
import { parseDocument } from '@/lib/schema/document';

/** Validates and renders a raw document in export mode, writes it, returns its file:// URL. */
export function renderToFile(path: string, raw: unknown): string {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, renderPage(parseDocument(raw), { mode: 'export' }).html);
  return pathToFileURL(path).href;
}
