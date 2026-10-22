'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import type { DropTarget } from '@/lib/editor/commands';
import { createDragController, type DragHandlers, type Point } from '@/lib/editor/dnd/controller';
import {
  autoScrollDelta,
  buildLayout,
  dropMarker,
  findDropTarget,
  type DropMarker,
} from '@/lib/editor/dnd/geometry';
import type { CanvasHandle } from '../canvas/canvas-handle';
import { useEditorStore } from '../editor-context';

// Drags from the palette and the block toolbar onto the canvas (docs/DECISIONS.md D-043). The
// pointer logic and the drop geometry are pure (lib/editor/dnd); this binds them to the window,
// the canvas handle and the store.

export type DragSource =
  | { kind: 'palette'; blockType: string; label: string }
  | { kind: 'block'; blockId: string; label: string };

export interface DragState {
  source: DragSource | null;
  target: DropTarget | null;
  marker: DropMarker | null;
  pointer: Point | null;
}

interface DragApi {
  state: DragState;
  begin(event: PointerEvent<Element>, source: DragSource): void;
  /** True once, for the click that ends a drag. */
  consumeClick(): boolean;
}

const IDLE: DragState = { source: null, target: null, marker: null, pointer: null };
const DragContext = createContext<DragApi | null>(null);

export function DragProvider({
  canvas,
  children,
}: {
  canvas: RefObject<CanvasHandle | null>;
  children: ReactNode;
}) {
  const store = useEditorStore();
  const [controller] = useState(createDragController);
  const [state, setState] = useState<DragState>(IDLE);
  const live = useRef({
    source: null as DragSource | null,
    pointer: null as Point | null,
    target: null as DropTarget | null,
    raf: 0,
    swallowClick: false,
    detach: () => {},
    unsubscribe: () => {},
  });

  const frameBox = useCallback(
    () => canvas.current?.frame()?.getBoundingClientRect() ?? null,
    [canvas],
  );

  const retarget = useCallback(() => {
    const l = live.current;
    if (!l.source || !l.pointer) return;
    const handle = canvas.current;
    const geometry = handle?.geometry();
    const box = frameBox();
    let target: DropTarget | null = null;
    let marker: DropMarker | null = null;
    const [x, y] = [l.pointer.x, l.pointer.y];
    if (
      handle &&
      geometry &&
      box &&
      x >= box.left &&
      x <= box.right &&
      y >= box.top &&
      y <= box.bottom
    ) {
      const layout = buildLayout(store.getState().doc, geometry, geometry.viewportWidth);
      target = findDropTarget(layout, (y - box.top) / handle.scale());
      marker = dropMarker(layout, target);
    }
    l.target = target;
    setState({ source: l.source, target, marker, pointer: l.pointer });
  }, [canvas, frameBox, store]);

  /** One auto-scroll step: near the canvas's top or bottom edge, ask the iframe to scroll. */
  const autoScroll = useCallback(() => {
    const l = live.current;
    const handle = canvas.current;
    const box = frameBox();
    if (handle && box && l.pointer && l.pointer.x >= box.left && l.pointer.x <= box.right) {
      const delta = autoScrollDelta(l.pointer.y - box.top, box.height);
      if (delta) handle.scrollBy(delta / handle.scale());
    }
  }, [canvas, frameBox]);

  const finish = useCallback(() => {
    const l = live.current;
    cancelAnimationFrame(l.raf);
    l.unsubscribe();
    l.detach();
    l.source = null;
    l.pointer = null;
    l.target = null;
    // The click that follows this pointerup belongs to the drag, not to the source button.
    l.swallowClick = true;
    setTimeout(() => {
      l.swallowClick = false;
    }, 0);
    setState(IDLE);
  }, []);

  const handlersFor = useCallback(
    (source: DragSource): DragHandlers => ({
      start(point) {
        const l = live.current;
        l.source = source;
        l.pointer = point;
        l.unsubscribe = canvas.current?.onGeometry(retarget) ?? (() => {});
        store.getState().announce(`Dragging ${source.label}. Press Escape to cancel.`);
        retarget();
        const loop = () => {
          if (!live.current.source) return;
          autoScroll();
          live.current.raf = requestAnimationFrame(loop);
        };
        l.raf = requestAnimationFrame(loop);
      },
      move(point) {
        live.current.pointer = point;
        retarget();
      },
      drop(point) {
        const l = live.current;
        l.pointer = point;
        retarget();
        const target = l.target;
        finish();
        if (!target) {
          store.getState().announce('Drag cancelled.');
          return;
        }
        const { dispatch } = store.getState();
        if (source.kind === 'palette') {
          dispatch({ type: 'insertBlockAt', blockType: source.blockType, target });
        } else {
          dispatch({ type: 'moveBlockTo', blockId: source.blockId, target });
        }
      },
      cancel() {
        finish();
        store.getState().announce('Drag cancelled.');
      },
    }),
    [autoScroll, canvas, finish, retarget, store],
  );

  const begin = useCallback(
    (event: PointerEvent<Element>, source: DragSource) => {
      if (controller.state !== 'idle') return;
      controller.down(event.nativeEvent, handlersFor(source));
      if (controller.state === 'idle') return;
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // The window listeners below still see every event.
      }
      const onMove = (e: globalThis.PointerEvent) => controller.move(e);
      const onUp = (e: globalThis.PointerEvent) => {
        controller.up(e);
        if (controller.state === 'idle') detach();
      };
      const onCancel = () => {
        controller.cancel();
        detach();
      };
      // While dragging, no key reaches the editor's shortcuts; Escape cancels.
      const onKey = (e: KeyboardEvent) => {
        if (controller.state !== 'dragging') return;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (e.key === 'Escape') onCancel();
      };
      const detach = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onCancel);
        window.removeEventListener('blur', onCancel);
        window.removeEventListener('keydown', onKey, true);
        live.current.detach = () => {};
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);
      window.addEventListener('blur', onCancel);
      window.addEventListener('keydown', onKey, true);
      live.current.detach = detach;
    },
    [controller, handlersFor],
  );

  useEffect(() => {
    const l = live.current;
    return () => {
      controller.cancel();
      l.detach();
    };
  }, [controller]);

  const consumeClick = useCallback(() => {
    const swallow = live.current.swallowClick;
    live.current.swallowClick = false;
    return swallow;
  }, []);

  return (
    <DragContext.Provider value={{ state, begin, consumeClick }}>
      {children}
      {state.source && state.pointer ? (
        <div
          data-testid="drag-ghost"
          className="pointer-events-none fixed z-50 rounded-md bg-sky-600 px-2 py-1 text-xs font-medium text-white shadow-md"
          style={{ left: state.pointer.x + 12, top: state.pointer.y + 12 }}
        >
          {state.source.label}
        </div>
      ) : null}
    </DragContext.Provider>
  );
}

function useDrag(): DragApi {
  const api = useContext(DragContext);
  if (!api) throw new Error('useDrag must be used inside <DragProvider>');
  return api;
}

export function useDragState(): DragState {
  return useDrag().state;
}

/**
 * Pointer handlers for a drag source. `touch: false` leaves touch to the element's own behavior
 * (a palette button still taps to add and lets the list scroll); grips drag on touch too.
 */
export function useDragSource(
  source: DragSource | null,
  { touch = true }: { touch?: boolean } = {},
) {
  const { begin, consumeClick } = useDrag();
  return {
    onPointerDown(event: PointerEvent<Element>) {
      if (!source || (!touch && event.pointerType === 'touch')) return;
      begin(event, source);
    },
    onContextMenu(event: MouseEvent) {
      if (source && touch) event.preventDefault();
    },
    onClickCapture(event: MouseEvent) {
      if (!consumeClick()) return;
      event.preventDefault();
      event.stopPropagation();
    },
  };
}
