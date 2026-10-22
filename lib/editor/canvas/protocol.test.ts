import { describe, expect, it } from 'vitest';
import { CANVAS_SOURCE, isForwardedShortcut } from './constants';
import { parseCanvasEvent } from './protocol';

const CH = 'abcdefghij';
const msg = (body: Record<string, unknown>) => ({ source: CANVAS_SOURCE, channel: CH, ...body });
const rect = { id: 'b1', top: 0, left: 0, width: 390, height: 200 };

describe('parseCanvasEvent', () => {
  it('accepts each valid event', () => {
    expect(parseCanvasEvent(msg({ type: 'ready' }), CH)).toEqual({ type: 'ready' });
    expect(
      parseCanvasEvent(msg({ type: 'select', target: { kind: 'block', blockId: 'b1' } }), CH),
    ).toEqual({ type: 'select', target: { kind: 'block', blockId: 'b1' } });
    expect(
      parseCanvasEvent(
        msg({
          type: 'rects',
          rev: 3,
          scrollY: 0,
          viewportWidth: 390,
          viewportHeight: 800,
          docHeight: 4000,
          sections: [rect],
          blocks: [rect],
        }),
        CH,
      )?.type,
    ).toBe('rects');
    expect(
      parseCanvasEvent(
        msg({ type: 'key', input: { key: 'z', mod: true, shift: false, alt: false } }),
        CH,
      )?.type,
    ).toBe('key');
  });
  it('rejects messages that are malformed or out of bounds', () => {
    for (const bad of [
      null,
      'ready',
      [],
      {},
      { ...msg({ type: 'ready' }), source: 'other' },
      { ...msg({ type: 'ready' }), channel: 'zzzzzzzzzz' },
      msg({ type: 'navigate', url: 'https://evil.example' }),
      msg({ type: 'select', target: { kind: 'block', blockId: 'b-1"><x' } }),
      msg({
        type: 'rects',
        rev: 1,
        scrollY: Number.POSITIVE_INFINITY,
        viewportWidth: 1,
        viewportHeight: 1,
        docHeight: 1,
        sections: [],
        blocks: [],
      }),
      msg({
        type: 'rects',
        rev: 1,
        scrollY: 0,
        viewportWidth: 1,
        viewportHeight: 1,
        docHeight: 1,
        sections: [],
        blocks: Array(201).fill(rect),
      }),
      msg({ type: 'error', message: 'x'.repeat(501) }),
    ])
      expect(parseCanvasEvent(bad, CH)).toBeNull();
  });
});

it('forwards only editor shortcuts', () => {
  const k = (key: string, mod = false, shift = false, alt = false) =>
    isForwardedShortcut({ key, mod, shift, alt });
  expect([
    k('z', true),
    k('Z', true, true),
    k('y', true),
    k('d', true),
    k('Delete'),
    k('Backspace'),
    k('Escape'),
    k('ArrowUp', false, false, true),
    k('ArrowDown', false, false, true),
  ]).toEqual(Array(9).fill(true));
  expect([k('z'), k('ArrowLeft'), k('ArrowUp'), k('Home'), k('a', true), k('Enter')]).toEqual(
    Array(6).fill(false),
  );
});
