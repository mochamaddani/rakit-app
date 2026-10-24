import { blockTypeLabel } from '@/lib/editor/structure';
import type { RenderResult } from '@/lib/renderer/page';
import type { PageDocument } from '@/lib/schema/document';

// The export summary's size numbers (PRD §6.7, §8): decimal units, as the budget is stated.

export const SIZE_WARN_BYTES = 1_000_000;
export const SIZE_HARD_BYTES = 3_000_000;
export const LARGE_IMAGE_BYTES = 300_000;

/** 812 → "812 B", 81_234 → "81 KB", 1_420_000 → "1.4 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${Math.floor(bytes / 1000)} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

export interface SizeRow {
  key: string;
  label: string;
  bytes: number;
  blockId?: string;
}

/** Blocks (largest first, "<Block label> · section <n>"), then styles, scripts and the rest. */
export function sizeReport(
  result: RenderResult,
  doc: PageDocument,
): { total: number; rows: SizeRow[] } {
  const sectionNumber = new Map(doc.sections.map((section, i) => [section.id, i + 1]));
  const blocks = result.blocks
    .map((stat): SizeRow => ({
      key: stat.blockId,
      blockId: stat.blockId,
      label: `${blockTypeLabel(stat.type)} · section ${sectionNumber.get(stat.sectionId) ?? '?'}`,
      bytes: stat.bytes,
    }))
    .sort((a, b) => b.bytes - a.bytes);
  const counted =
    blocks.reduce((sum, row) => sum + row.bytes, 0) + result.cssBytes + result.jsBytes;
  return {
    total: result.bytes,
    rows: [
      ...blocks,
      { key: 'css', label: 'Styles', bytes: result.cssBytes },
      { key: 'js', label: 'Scripts', bytes: result.jsBytes },
      { key: 'rest', label: 'Head and page', bytes: result.bytes - counted },
    ],
  };
}
