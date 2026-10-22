import { footerStart } from '@/lib/renderer/page';
import type { PageDocument } from '@/lib/schema/document';
import type { CanvasRect } from '../canvas/constants';
import type { DropTarget } from '../commands';

// Where a drag would drop, computed from the rects the canvas last reported (docs/DECISIONS.md
// D-043). Pure: the drag layer feeds it canvas coordinates and draws what it returns.

export interface LayoutSection {
  id: string;
  index: number;
  top: number;
  bottom: number;
  left: number;
  width: number;
  /** Visible blocks only (height > 0), each with its index in the section. */
  blocks: { id: string; index: number; top: number; bottom: number }[];
  blockCount: number;
}

export interface CanvasLayout {
  sections: LayoutSection[];
  /** footerStart(doc): drops never go at or after this section index. */
  end: number;
  width: number;
}

/** The top and bottom quarter of a section drop between sections; the middle half joins it. */
export const EDGE_FRACTION = 0.25;
export const AUTO_SCROLL_EDGE = 48;
export const AUTO_SCROLL_MAX = 20;
const INSET = 16;

/** Sections before footerStart(doc) with a visible rect, in document order. */
export function buildLayout(
  doc: PageDocument,
  rects: { sections: CanvasRect[]; blocks: CanvasRect[] },
  width: number,
): CanvasLayout {
  const end = footerStart(doc);
  const sectionRects = new Map(rects.sections.map((rect) => [rect.id, rect]));
  const blockRects = new Map(rects.blocks.map((rect) => [rect.id, rect]));
  const sections: LayoutSection[] = [];
  doc.sections.slice(0, end).forEach((section, index) => {
    const rect = sectionRects.get(section.id);
    if (!rect || rect.height <= 0) return;
    const blocks = section.blocks.flatMap((block, i) => {
      const b = blockRects.get(block.id);
      return b && b.height > 0
        ? [{ id: block.id, index: i, top: b.top, bottom: b.top + b.height }]
        : [];
    });
    sections.push({
      id: section.id,
      index,
      top: rect.top,
      bottom: rect.top + rect.height,
      left: rect.left,
      width: rect.width,
      blocks,
      blockCount: section.blocks.length,
    });
  });
  return { sections, end, width };
}

/** `y` is in canvas px from the iframe viewport's top, like the rects. */
export function findDropTarget(layout: CanvasLayout, y: number): DropTarget {
  const { sections, end } = layout;
  if (sections.length === 0 || y < sections[0]!.top) return { kind: 'between', index: 0 };
  let previous: LayoutSection | null = null;
  for (const section of sections) {
    if (y < section.top) {
      // Between two section rects: the nearer boundary wins.
      const after = previous ? previous.index + 1 : 0;
      return previous && y - previous.bottom < section.top - y
        ? { kind: 'between', index: after }
        : { kind: 'between', index: section.index };
    }
    if (y < section.bottom) {
      const edge = (section.bottom - section.top) * EDGE_FRACTION;
      if (y < section.top + edge) return { kind: 'between', index: section.index };
      if (y >= section.bottom - edge) return { kind: 'between', index: section.index + 1 };
      const next = section.blocks.find((block) => (block.top + block.bottom) / 2 > y);
      return {
        kind: 'into',
        sectionId: section.id,
        index: next ? next.index : section.blockCount,
      };
    }
    previous = section;
  }
  return { kind: 'between', index: end };
}

export interface DropMarker {
  top: number;
  left: number;
  width: number;
  kind: DropTarget['kind'];
}

export function dropMarker(layout: CanvasLayout, target: DropTarget): DropMarker {
  if (target.kind === 'between') {
    const at = layout.sections.find((section) => section.index >= target.index);
    const before = layout.sections.filter((section) => section.index < target.index).at(-1);
    const top = at && at.index === target.index ? at.top : (before?.bottom ?? at?.top ?? 0);
    return { top, left: 0, width: layout.width, kind: 'between' };
  }
  const section = layout.sections.find((s) => s.id === target.sectionId);
  if (!section) return { top: 0, left: 0, width: 0, kind: 'into' };
  const previous = section.blocks.filter((block) => block.index < target.index).at(-1);
  const next = section.blocks.find((block) => block.index >= target.index);
  const top =
    previous && next
      ? (previous.bottom + next.top) / 2
      : (next?.top ?? previous?.bottom ?? (section.top + section.bottom) / 2);
  return {
    top,
    left: section.left + INSET,
    width: Math.max(0, section.width - INSET * 2),
    kind: 'into',
  };
}

/** `y` from the scroll area's top, `height` its height (same units); −20…20, 0 outside the edge zones. */
export function autoScrollDelta(y: number, height: number): number {
  if (y < 0 || y > height) return 0;
  const step = (distance: number) =>
    Math.ceil((AUTO_SCROLL_MAX * (AUTO_SCROLL_EDGE - distance)) / AUTO_SCROLL_EDGE);
  if (y < AUTO_SCROLL_EDGE) return -step(y);
  if (height - y < AUTO_SCROLL_EDGE) return step(height - y);
  return 0;
}

/** Gap index 0…rects.length from item midpoints. */
export function listDropIndex(
  rects: readonly { top: number; bottom: number }[],
  y: number,
): number {
  const index = rects.findIndex((rect) => (rect.top + rect.bottom) / 2 > y);
  return index === -1 ? rects.length : index;
}

/** listMove's `to` for a gap index, or null when the item would not move. */
export function listMoveTo(from: number, gap: number): number | null {
  if (gap === from || gap === from + 1) return null;
  return gap > from ? gap - 1 : gap;
}
