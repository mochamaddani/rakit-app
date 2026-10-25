import { renderPage } from '@/lib/renderer/page';
import type { PageDocument } from '@/lib/schema/document';
import { preExportChecklist, type ChecklistItem } from './checklist';
import { sha256Hex } from './hash';
import {
  imageType,
  inlineImages,
  portableVariant,
  type FetchedImage,
  type ImageDeps,
} from './images';
import { sizeReport, type SizeRow } from './size';

// The export file, built in the browser (docs/DECISIONS.md D-007, D-046): an export copy of the
// document (images inlined, favicon rasterized), rendered, hashed, measured and checked.

export interface ExportOptions {
  images: 'portable' | 'hosted';
  minify: boolean;
  tracking: boolean;
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  images: 'portable',
  minify: true,
  tracking: true,
};

export interface ExportBuild {
  html: string;
  bytes: number;
  sha256: string;
  report: { total: number; rows: SizeRow[] };
  checklist: ChecklistItem[];
}

export type { FetchedImage };

export interface BuildDeps extends ImageDeps {
  /** A 64×64 PNG data URI, or null when the image can't be read. */
  rasterizeFavicon(image: FetchedImage & { ok: true }): Promise<string | null>;
}

/** The favicon as a PNG data URI; a favicon that can't be read is dropped (false). */
async function inlineFavicon(doc: PageDocument, deps: BuildDeps): Promise<boolean> {
  const favicon = doc.settings.seo.favicon;
  const src = favicon?.src.trim() ?? '';
  if (!favicon || !/^https?:\/\//i.test(src)) return true;
  const image = await deps
    .fetchImage(portableVariant(src))
    .catch((error: unknown): FetchedImage => ({ ok: false, reason: String(error) }));
  const uri = image.ok && imageType(image) ? await deps.rasterizeFavicon(image) : null;
  if (uri) favicon.src = uri;
  else delete doc.settings.seo.favicon;
  return uri !== null;
}

export async function buildExport(
  doc: PageDocument,
  options: ExportOptions,
  deps: BuildDeps,
): Promise<ExportBuild> {
  const inlined =
    options.images === 'portable'
      ? await inlineImages(doc, deps)
      : { doc: structuredClone(doc), failed: [], large: [] };
  const exportDoc = inlined.doc;
  const faviconOk = await inlineFavicon(exportDoc, deps);

  const result = renderPage(exportDoc, {
    mode: 'export',
    minify: options.minify,
    tracking: options.tracking,
  });
  return {
    html: result.html,
    bytes: result.bytes,
    sha256: await sha256Hex(result.html),
    report: sizeReport(result, exportDoc),
    checklist: preExportChecklist({
      doc,
      tracking: options.tracking,
      bytes: result.bytes,
      images: {
        failed: inlined.failed.length + (faviconOk ? 0 : 1),
        large: inlined.large.length,
      },
      now: new Date(),
    }),
  };
}
