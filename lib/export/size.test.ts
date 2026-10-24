import { describe, expect, it } from 'vitest';
import { renderPage } from '@/lib/renderer/page';
import { parseDocument } from '@/lib/schema/document';
import { exampleDocument } from '@/tests/fixtures/example-document';
import { formatBytes, sizeReport } from './size';

describe('formatBytes', () => {
  it('uses decimal units', () => {
    expect(formatBytes(812)).toBe('812 B');
    expect(formatBytes(999)).toBe('999 B');
    expect(formatBytes(1000)).toBe('1 KB');
    expect(formatBytes(81_234)).toBe('81 KB');
    expect(formatBytes(999_499)).toBe('999 KB');
    expect(formatBytes(999_999)).toBe('999 KB');
    expect(formatBytes(1_000_000)).toBe('1.0 MB');
    expect(formatBytes(1_420_000)).toBe('1.4 MB');
  });
});

describe('sizeReport', () => {
  it('rows sum to the total and blocks are largest first', () => {
    const doc = parseDocument(exampleDocument);
    const result = renderPage(doc, { mode: 'export' });
    const report = sizeReport(result, doc);
    expect(report.total).toBe(result.bytes);
    expect(report.rows.reduce((sum, row) => sum + row.bytes, 0)).toBe(result.bytes);
    const blocks = report.rows.filter((row) => row.blockId);
    expect(blocks).toHaveLength(result.blocks.length);
    expect(blocks.map((row) => row.bytes)).toEqual(
      [...blocks.map((row) => row.bytes)].sort((a, b) => b - a),
    );
    expect(blocks[0]!.label).toBe('Product Carousel · section 3');
    expect(report.rows.slice(-3).map((row) => row.label)).toEqual([
      'Styles',
      'Scripts',
      'Head and page',
    ]);
  });
});
