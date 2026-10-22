'use client';

import { ArrowDown, ArrowUp, Copy, Rows3, Trash2, type LucideIcon } from 'lucide-react';
import type { CanvasRect } from '@/lib/editor/canvas/constants';
import { canMoveBlock, canMoveSection, findBlock, type Selection } from '@/lib/editor/structure';
import { useEditor } from '../editor-context';

const TOOLBAR_HEIGHT = 30;
const GAP = 4;

interface Action {
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
  run(): void;
}

/**
 * Actions for the selected block or section, at the top-right of its outline and kept inside the
 * canvas. Every action is a command, so undo covers it.
 */
export function BlockToolbar({
  selection,
  rect,
  scale,
  width,
}: {
  selection: Exclude<Selection, { kind: 'page' }>;
  rect: CanvasRect;
  scale: number;
  width: number;
}) {
  const doc = useEditor((s) => s.doc);
  const dispatch = useEditor((s) => s.dispatch);
  const select = useEditor((s) => s.select);

  let label: string;
  let actions: Action[];
  if (selection.kind === 'block') {
    const { blockId } = selection;
    const at = findBlock(doc, blockId);
    label = 'Block actions';
    actions = [
      {
        label: 'Move up',
        icon: ArrowUp,
        disabled: !canMoveBlock(doc, blockId, 'up'),
        run: () => dispatch({ type: 'moveBlock', blockId, direction: 'up' }),
      },
      {
        label: 'Move down',
        icon: ArrowDown,
        disabled: !canMoveBlock(doc, blockId, 'down'),
        run: () => dispatch({ type: 'moveBlock', blockId, direction: 'down' }),
      },
      { label: 'Duplicate', icon: Copy, run: () => dispatch({ type: 'duplicateBlock', blockId }) },
      { label: 'Delete', icon: Trash2, run: () => dispatch({ type: 'removeBlock', blockId }) },
      {
        label: 'Edit section',
        icon: Rows3,
        disabled: !at,
        run: () => at && select({ kind: 'section', sectionId: doc.sections[at.sectionIndex]!.id }),
      },
    ];
  } else {
    const { sectionId } = selection;
    label = 'Section actions';
    actions = [
      {
        label: 'Move up',
        icon: ArrowUp,
        disabled: !canMoveSection(doc, sectionId, 'up'),
        run: () => dispatch({ type: 'moveSection', sectionId, direction: 'up' }),
      },
      {
        label: 'Move down',
        icon: ArrowDown,
        disabled: !canMoveSection(doc, sectionId, 'down'),
        run: () => dispatch({ type: 'moveSection', sectionId, direction: 'down' }),
      },
      {
        label: 'Duplicate',
        icon: Copy,
        run: () => dispatch({ type: 'duplicateSection', sectionId }),
      },
      { label: 'Delete', icon: Trash2, run: () => dispatch({ type: 'removeSection', sectionId }) },
    ];
  }

  // Above the outline when there is room, otherwise inside it; never outside the canvas.
  const top = rect.top * scale;
  const bottom = (rect.top + rect.height) * scale;
  const above = top - TOOLBAR_HEIGHT - GAP;
  const y = Math.min(
    Math.max(above >= GAP ? above : top + GAP, GAP),
    Math.max(GAP, bottom - TOOLBAR_HEIGHT),
  );
  const right = Math.max(GAP, width - (rect.left + rect.width) * scale);

  return (
    <div
      role="toolbar"
      aria-label={label}
      className="pointer-events-auto absolute flex items-center gap-0.5 rounded-md border bg-background p-0.5 shadow-sm"
      style={{ top: y, right }}
    >
      {actions.map(({ label: name, icon: Icon, disabled, run }) => (
        <button
          key={name}
          type="button"
          aria-label={name}
          title={name}
          disabled={disabled}
          onClick={run}
          className="flex size-6 items-center justify-center rounded text-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-40"
        >
          <Icon className="size-3.5" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
