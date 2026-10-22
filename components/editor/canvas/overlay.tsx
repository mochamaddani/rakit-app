'use client';

import type { CanvasRect } from '@/lib/editor/canvas/constants';
import { blockTypeLabel, findBlock } from '@/lib/editor/structure';
import { cn } from '@/lib/utils';
import { useEditor } from '../editor-context';
import { BlockToolbar } from './block-toolbar';

export interface CanvasGeometry {
  scrollY: number;
  viewportHeight: number;
  sections: CanvasRect[];
  blocks: CanvasRect[];
}

const visible = (rect: CanvasRect | undefined): rect is CanvasRect =>
  rect !== undefined && rect.width > 0 && rect.height > 0;

/**
 * Hover and selection outlines drawn in the editor over the canvas, from the rects the iframe
 * reports. Unscaled: coordinates are multiplied by the canvas scale so chips keep their size.
 */
export function Overlay({
  geometry,
  hover,
  scale,
  width,
}: {
  geometry: CanvasGeometry | null;
  hover: string | null;
  scale: number;
  /** The overlay's width in editor pixels, to keep the toolbar inside it. */
  width: number;
}) {
  const selection = useEditor((s) => s.selection);
  const selectedType = useEditor((s) => {
    if (s.selection?.kind !== 'block') return null;
    const at = findBlock(s.doc, s.selection.blockId);
    return at ? s.doc.sections[at.sectionIndex]!.blocks[at.blockIndex]!.type : null;
  });
  if (!geometry) return null;

  const box = (rect: CanvasRect) => ({
    top: rect.top * scale,
    left: rect.left * scale,
    width: rect.width * scale,
    height: rect.height * scale,
  });
  const selected =
    selection?.kind === 'block'
      ? geometry.blocks.find((rect) => rect.id === selection.blockId)
      : selection?.kind === 'section'
        ? geometry.sections.find((rect) => rect.id === selection.sectionId)
        : undefined;
  const hovered =
    hover && !(selection?.kind === 'block' && selection.blockId === hover)
      ? geometry.blocks.find((rect) => rect.id === hover)
      : undefined;
  const label =
    selection?.kind === 'section' ? 'Section' : selectedType ? blockTypeLabel(selectedType) : '';

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {visible(hovered) ? (
        <div
          data-testid="canvas-hover"
          className="absolute rounded-sm border border-sky-500/70"
          style={box(hovered)}
        />
      ) : null}
      {visible(selected) ? (
        <div
          data-testid="canvas-selection"
          className={cn(
            'absolute rounded-sm border-2 border-sky-600',
            selection?.kind === 'section' && 'border-dashed',
          )}
          style={box(selected)}
        >
          <span
            className={cn(
              'absolute left-0 rounded-sm bg-sky-600 px-1.5 py-0.5 text-[11px] leading-none font-medium text-white',
              selected.top * scale < 20 ? 'top-0' : '-top-5',
            )}
          >
            {label}
          </span>
        </div>
      ) : null}
      {visible(selected) && selection && selection.kind !== 'page' ? (
        <BlockToolbar selection={selection} rect={selected} scale={scale} width={width} />
      ) : null}
    </div>
  );
}
