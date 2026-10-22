import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDragController, type DragHandlers, type PointerInput } from './controller';

const mouse = (x: number, y: number, extra: Partial<PointerInput> = {}): PointerInput => ({
  pointerId: 1,
  pointerType: 'mouse',
  clientX: x,
  clientY: y,
  button: 0,
  ...extra,
});
const touch = (x: number, y: number): PointerInput => mouse(x, y, { pointerType: 'touch' });

let calls: string[];
const handlers = (): DragHandlers => ({
  start: (p) => calls.push(`start ${p.x},${p.y}`),
  move: (p) => calls.push(`move ${p.x},${p.y}`),
  drop: (p) => calls.push(`drop ${p.x},${p.y}`),
  cancel: () => calls.push('cancel'),
});

beforeEach(() => {
  vi.useFakeTimers();
  calls = [];
});
afterEach(() => vi.useRealTimers());

describe('drag controller', () => {
  it('mouse starts after 4 px, not before', () => {
    const drag = createDragController();
    drag.down(mouse(10, 10), handlers());
    drag.move(mouse(13, 10));
    expect(drag.state).toBe('pending');
    expect(calls).toEqual([]);
    drag.move(mouse(15, 10));
    expect(drag.state).toBe('dragging');
    expect(calls).toEqual(['start 15,10', 'move 15,10']);
  });

  it('a press without movement is a click: up() drops nothing', () => {
    const drag = createDragController();
    drag.down(mouse(10, 10), handlers());
    drag.up(mouse(10, 10));
    expect(drag.state).toBe('idle');
    expect(calls).toEqual([]);
  });

  it('touch starts after a 250 ms long-press; moving 10 px first abandons it', () => {
    const drag = createDragController();
    drag.down(touch(10, 10), handlers());
    drag.move(touch(15, 12));
    vi.advanceTimersByTime(249);
    expect(drag.state).toBe('pending');
    vi.advanceTimersByTime(1);
    expect(drag.state).toBe('dragging');
    expect(calls).toEqual(['start 15,12']);
    drag.move(touch(40, 80));
    drag.up(touch(40, 80));
    expect(calls).toEqual(['start 15,12', 'move 40,80', 'drop 40,80']);

    calls = [];
    const scroll = createDragController();
    scroll.down(touch(10, 10), handlers());
    scroll.move(touch(10, 21));
    vi.advanceTimersByTime(500);
    expect(scroll.state).toBe('idle');
    expect(calls).toEqual([]);
  });

  it('Escape, pointercancel and blur cancel; a later pointerup drops nothing', () => {
    const drag = createDragController();
    drag.down(mouse(0, 0), handlers());
    drag.move(mouse(0, 20));
    drag.cancel();
    expect(drag.state).toBe('idle');
    drag.up(mouse(0, 30));
    drag.cancel();
    expect(calls).toEqual(['start 0,20', 'move 0,20', 'cancel']);

    calls = [];
    const pending = createDragController();
    pending.down(touch(0, 0), handlers());
    pending.cancel();
    vi.advanceTimersByTime(500);
    expect(pending.state).toBe('idle');
    expect(calls).toEqual([]);
  });

  it('events from another pointer, and buttons other than the primary one, are ignored', () => {
    const drag = createDragController();
    drag.down(mouse(0, 0, { button: 2 }), handlers());
    expect(drag.state).toBe('idle');
    drag.down(mouse(0, 0), handlers());
    drag.down(mouse(50, 50, { pointerId: 2 }), handlers());
    drag.move(mouse(0, 40, { pointerId: 2 }));
    drag.up(mouse(0, 40, { pointerId: 2 }));
    expect(drag.state).toBe('pending');
    expect(calls).toEqual([]);
  });

  it('drop receives the last pointer position', () => {
    const drag = createDragController();
    drag.down(mouse(0, 0), handlers());
    drag.move(mouse(0, 10));
    drag.move(mouse(0, 50));
    drag.up(mouse(3, 55));
    expect(calls.at(-1)).toBe('drop 3,55');
    expect(drag.state).toBe('idle');
  });
});
