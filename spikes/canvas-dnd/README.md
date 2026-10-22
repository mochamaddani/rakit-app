# Canvas and drag spike (throwaway)

This spike tests the canvas design in `docs/PLAN.md` §2.3 before the real editor engine is built. A parent page draws an overlay over a sandboxed `srcdoc` iframe, which reports its block rects by `postMessage`. While a drag is in progress, a transparent shield covers the iframe.

Findings are in `docs/DECISIONS.md` D-034. M2b deletes this folder once the real drag engine passes its e2e tests.

## Measure

Run `pnpm exec tsx spikes/canvas-dnd/measure.ts`. It runs headless Chromium and prints one PASS/FAIL line per check:

- rect round-trip
- mouse drag
- auto-scroll
- touch long-press
- isolation

It exits 1 if any check fails.

## Try it by hand

Double-click `index.html`. It runs from `file://`, so there is nothing to install.

- **Mouse drag:**
  - Drag "Hero" or "Card" onto the canvas. An orange line marks where it would drop.
  - Release to drop, or press Escape to cancel.
  - Click a block in the canvas to outline it. Scroll the canvas: the outline follows.
- **Touch drag:** in Chrome DevTools, turn on device mode with touch. Press and hold an item for a quarter of a second, then drag it. The page should not scroll.
- **Auto-scroll:** while dragging, hold the pointer near the top or bottom edge of the canvas.
  - The canvas scrolls, faster the closer you get to the edge.
  - The line keeps snapping to block edges.
