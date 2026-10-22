import { describe, expect, it } from 'vitest';
import { editorDoc } from '../test-fixtures';
import {
  autoScrollDelta,
  buildLayout,
  dropMarker,
  findDropTarget,
  listDropIndex,
  listMoveTo,
  type CanvasLayout,
} from './geometry';

// s1 0–400 (b1 40–360) · s2 400–1000 (b2 440–700, b3 700–960); footer sections start at 2.
const layout: CanvasLayout = {
  end: 2,
  width: 390,
  sections: [
    {
      id: 's1',
      index: 0,
      top: 0,
      bottom: 400,
      left: 0,
      width: 390,
      blockCount: 1,
      blocks: [{ id: 'b1', index: 0, top: 40, bottom: 360 }],
    },
    {
      id: 's2',
      index: 1,
      top: 400,
      bottom: 1000,
      left: 0,
      width: 390,
      blockCount: 2,
      blocks: [
        { id: 'b2', index: 0, top: 440, bottom: 700 },
        { id: 'b3', index: 1, top: 700, bottom: 960 },
      ],
    },
  ],
};
const empty: CanvasLayout = { sections: [], end: 0, width: 390 };
const rect = (id: string, top: number, height: number) => ({
  id,
  top,
  left: 0,
  width: 390,
  height,
});

describe('buildLayout', () => {
  it('keeps visible sections before the footer, with visible blocks and their document indices', () => {
    const built = buildLayout(
      editorDoc(),
      {
        // s3 has no rect, s4 is the footer; b3 is hidden at this viewport.
        sections: [rect('s1', 0, 400), rect('s2', 400, 600), rect('s4', 1000, 100)],
        blocks: [
          rect('b1', 40, 320),
          rect('b2', 440, 260),
          rect('b3', 700, 0),
          rect('b5', 1000, 100),
        ],
      },
      390,
    );
    expect(built.end).toBe(3);
    expect(built.width).toBe(390);
    expect(built.sections).toEqual([
      {
        id: 's1',
        index: 0,
        top: 0,
        bottom: 400,
        left: 0,
        width: 390,
        blockCount: 1,
        blocks: [{ id: 'b1', index: 0, top: 40, bottom: 360 }],
      },
      {
        id: 's2',
        index: 1,
        top: 400,
        bottom: 1000,
        left: 0,
        width: 390,
        blockCount: 2,
        blocks: [{ id: 'b2', index: 0, top: 440, bottom: 700 }],
      },
    ]);
  });
});

describe('findDropTarget', () => {
  it('uses the outer quarters of a section for between and the middle for into', () => {
    expect(findDropTarget(layout, -5)).toEqual({ kind: 'between', index: 0 });
    expect(findDropTarget(layout, 90)).toEqual({ kind: 'between', index: 0 });
    expect(findDropTarget(layout, 150)).toEqual({ kind: 'into', sectionId: 's1', index: 0 });
    expect(findDropTarget(layout, 250)).toEqual({ kind: 'into', sectionId: 's1', index: 1 });
    expect(findDropTarget(layout, 360)).toEqual({ kind: 'between', index: 1 });
    expect(findDropTarget(layout, 720)).toEqual({ kind: 'into', sectionId: 's2', index: 1 });
    expect(findDropTarget(layout, 5000)).toEqual({ kind: 'between', index: 2 });
  });
  it('an empty page takes the first position', () => {
    expect(findDropTarget(empty, 100)).toEqual({ kind: 'between', index: 0 });
  });
  it('a pointer between two section rects goes to the nearer boundary', () => {
    const gapped: CanvasLayout = {
      end: 3,
      width: 390,
      sections: [
        { ...layout.sections[0]!, index: 0 },
        { ...layout.sections[1]!, index: 2, top: 500, bottom: 900, blocks: [] },
      ],
    };
    expect(findDropTarget(gapped, 430)).toEqual({ kind: 'between', index: 1 });
    expect(findDropTarget(gapped, 480)).toEqual({ kind: 'between', index: 2 });
  });
});

describe('dropMarker', () => {
  it('draws between targets full width and into targets inset at the gap', () => {
    expect(dropMarker(layout, { kind: 'between', index: 0 })).toEqual({
      top: 0,
      left: 0,
      width: 390,
      kind: 'between',
    });
    expect(dropMarker(layout, { kind: 'between', index: 2 })).toEqual({
      top: 1000,
      left: 0,
      width: 390,
      kind: 'between',
    });
    expect(dropMarker(layout, { kind: 'into', sectionId: 's2', index: 1 })).toMatchObject({
      top: 700,
      left: 16,
      width: 358,
    });
    expect(dropMarker(layout, { kind: 'into', sectionId: 's1', index: 0 }).top).toBe(40);
    expect(dropMarker(layout, { kind: 'into', sectionId: 's1', index: 1 }).top).toBe(360);
  });
});

describe('autoScrollDelta', () => {
  it('scrolls up to 20 px per frame within 48 px of either edge', () => {
    expect([0, 24, 300, 599, 700].map((y) => autoScrollDelta(y, 600))).toEqual([
      -20, -10, 0, 20, 0,
    ]);
  });
});

describe('list drops', () => {
  it('finds the gap from item midpoints and the final index for listMove', () => {
    const rows = [
      { top: 0, bottom: 100 },
      { top: 100, bottom: 200 },
      { top: 200, bottom: 300 },
    ];
    expect([40, 60, 160, 290].map((y) => listDropIndex(rows, y))).toEqual([0, 1, 2, 3]);
    expect(listMoveTo(2, 0)).toBe(0);
    expect(listMoveTo(0, 3)).toBe(2);
    expect(listMoveTo(1, 1)).toBeNull();
    expect(listMoveTo(1, 2)).toBeNull();
  });
});
