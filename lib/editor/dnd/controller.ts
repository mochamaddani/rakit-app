// The pointer side of a drag (docs/DECISIONS.md D-034, D-043): mouse and pen drags start after a
// small movement, touch drags after a long-press. No DOM access: the caller feeds it pointer
// events and gets start/move/drop/cancel back. Time comes from the global timers.

export const DRAG_THRESHOLD_PX = 4;
export const LONG_PRESS_MS = 250;
export const TOUCH_SLOP_PX = 10;

export interface PointerInput {
  pointerId: number;
  pointerType: string;
  clientX: number;
  clientY: number;
  button: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface DragHandlers {
  start(p: Point): void;
  move(p: Point): void;
  drop(p: Point): void;
  cancel(): void;
}

export interface DragController {
  readonly state: 'idle' | 'pending' | 'dragging';
  /** Ignores buttons other than the primary one, and a second pointer while one is down. */
  down(input: PointerInput, handlers: DragHandlers): void;
  move(input: PointerInput): void;
  /** Drops when dragging; otherwise just ends the press (a click stays a click). */
  up(input: PointerInput): void;
  /** Escape, pointercancel, window blur, unmount: `cancel()` runs only if a drag started. */
  cancel(): void;
}

interface Press {
  pointerId: number;
  touch: boolean;
  origin: Point;
  last: Point;
  handlers: DragHandlers;
  timer: ReturnType<typeof setTimeout> | undefined;
}

export function createDragController(): DragController {
  let state: DragController['state'] = 'idle';
  let press: Press | null = null;

  const reset = () => {
    if (press?.timer !== undefined) clearTimeout(press.timer);
    press = null;
    state = 'idle';
  };
  const begin = (current: Press) => {
    current.timer = undefined;
    state = 'dragging';
    current.handlers.start(current.last);
  };
  const own = (input: PointerInput) => press !== null && input.pointerId === press.pointerId;
  const pointOf = (input: PointerInput): Point => ({ x: input.clientX, y: input.clientY });

  return {
    get state() {
      return state;
    },

    down(input, handlers) {
      if (press || input.button !== 0) return;
      const origin = pointOf(input);
      const current: Press = {
        pointerId: input.pointerId,
        touch: input.pointerType === 'touch',
        origin,
        last: origin,
        handlers,
        timer: undefined,
      };
      press = current;
      state = 'pending';
      if (current.touch) current.timer = setTimeout(() => begin(current), LONG_PRESS_MS);
    },

    move(input) {
      if (!own(input)) return;
      const current = press!;
      current.last = pointOf(input);
      if (state === 'dragging') {
        current.handlers.move(current.last);
        return;
      }
      const distance = Math.hypot(
        current.last.x - current.origin.x,
        current.last.y - current.origin.y,
      );
      if (current.touch) {
        // Moving before the long-press fires is a scroll, not a drag.
        if (distance > TOUCH_SLOP_PX) reset();
        return;
      }
      if (distance < DRAG_THRESHOLD_PX) return;
      begin(current);
      current.handlers.move(current.last);
    },

    up(input) {
      if (!own(input)) return;
      const current = press!;
      current.last = pointOf(input);
      const dragging = state === 'dragging';
      reset();
      if (dragging) current.handlers.drop(current.last);
    },

    cancel() {
      const current = press;
      const dragging = state === 'dragging';
      reset();
      if (dragging) current?.handlers.cancel();
    },
  };
}
