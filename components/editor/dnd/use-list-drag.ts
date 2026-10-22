'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type RefObject,
} from 'react';
import { createDragController, type DragHandlers, type Point } from '@/lib/editor/dnd/controller';
import { autoScrollDelta, listDropIndex, listMoveTo } from '@/lib/editor/dnd/geometry';
import { useEditorStore } from '../editor-context';
import { followPress } from './follow-press';

/**
 * Drag to reorder the rows of an inspector list (docs/DECISIONS.md D-043). Rows are the list's
 * `[data-list-item]` children, hit-tested on their live rects; the scroller auto-scrolls near its
 * edges. A drop becomes one `onMove(from, to)`, so undo covers it.
 */
export function useListDrag({
  count,
  list,
  scroller,
  onMove,
}: {
  count: number;
  list: RefObject<HTMLElement | null>;
  scroller: RefObject<HTMLElement | null>;
  onMove(from: number, to: number): void;
}): {
  handleProps(index: number): HTMLAttributes<HTMLElement>;
  dragging: number | null;
  markerTop: number | null;
} {
  const store = useEditorStore();
  const [controller] = useState(createDragController);
  const [dragging, setDragging] = useState<number | null>(null);
  const [markerTop, setMarkerTop] = useState<number | null>(null);
  const live = useRef({
    from: -1,
    pointer: null as Point | null,
    gap: null as number | null,
    raf: 0,
    detach: () => {},
  });
  const onMoveRef = useRef(onMove);
  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  const locate = useCallback(() => {
    const l = live.current;
    const el = list.current;
    if (!el || !l.pointer) return;
    const rows = Array.from(el.querySelectorAll(':scope > [data-list-item]')).map((row) =>
      row.getBoundingClientRect(),
    );
    l.gap = listDropIndex(rows, l.pointer.y);
    const top = el.getBoundingClientRect().top;
    const y = l.gap < rows.length ? rows[l.gap]!.top : (rows.at(-1)?.bottom ?? top);
    setMarkerTop(y - top);
  }, [list]);

  const stop = useCallback(() => {
    const l = live.current;
    cancelAnimationFrame(l.raf);
    l.detach();
    l.from = -1;
    l.pointer = null;
    l.gap = null;
    setDragging(null);
    setMarkerTop(null);
  }, []);

  const handlersFor = useCallback(
    (index: number): DragHandlers => ({
      start(point) {
        const l = live.current;
        l.from = index;
        l.pointer = point;
        setDragging(index);
        store.getState().announce(`Dragging item ${index + 1}. Press Escape to cancel.`);
        locate();
        const loop = () => {
          const current = live.current;
          if (current.from < 0) return;
          const area = scroller.current;
          const box = area?.getBoundingClientRect();
          if (area && box && current.pointer) {
            const delta = autoScrollDelta(current.pointer.y - box.top, box.height);
            if (delta) {
              area.scrollBy(0, delta);
              locate();
            }
          }
          current.raf = requestAnimationFrame(loop);
        };
        l.raf = requestAnimationFrame(loop);
      },
      move(point) {
        live.current.pointer = point;
        locate();
      },
      drop(point) {
        const l = live.current;
        l.pointer = point;
        locate();
        const { from, gap } = l;
        stop();
        const to = gap === null ? null : listMoveTo(from, gap);
        if (to !== null) onMoveRef.current(from, to);
      },
      cancel() {
        stop();
        store.getState().announce('Drag cancelled.');
      },
    }),
    [locate, scroller, stop, store],
  );

  useEffect(() => {
    const l = live.current;
    return () => {
      controller.cancel();
      l.detach();
      cancelAnimationFrame(l.raf);
    };
  }, [controller]);

  const handleProps = (index: number): HTMLAttributes<HTMLElement> => ({
    onPointerDown(event) {
      if (controller.state !== 'idle' || index >= count) return;
      controller.down(event.nativeEvent, handlersFor(index));
      if (controller.state === 'idle') return;
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // The window listeners still see every event.
      }
      live.current.detach = followPress(controller);
    },
    onContextMenu(event) {
      event.preventDefault();
    },
    style: { touchAction: 'none' },
  });

  return { handleProps, dragging, markerTop };
}
