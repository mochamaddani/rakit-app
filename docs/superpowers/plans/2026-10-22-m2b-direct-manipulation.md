# M2b Direct Manipulation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish M2. Blocks are added and reordered by dragging (palette → canvas, within and across sections, carousel items in the inspector), text is edited in place in the canvas, and images are uploaded and turned into WebP variants. The M2 exit journey passes end to end.

**Architecture:**
- The drag engine follows the spike (D-034). Drop targets, marker geometry, auto-scroll and the pointer state machine are pure modules in `lib/editor/dnd/`, unit-tested in Node. The React layer in `components/editor/dnd/` binds them to the palette, the block toolbar, the canvas (a shield over the iframe during drags) and the inspector's list control.
- Drops become two new commands, `insertBlockAt` and `moveBlockTo`, so undo, autosave and validation work as for every other edit (D-037).
- Inline editing: in preview mode the renderer marks each text or rich field element with `data-lp-field`. The canvas runtime makes that element `contenteditable` on double-click, holds back patches for the block being edited, and sends the edited DOM as a small node list. The editor validates the field path against the block schema, serializes the nodes to the inline markup (D-009) and dispatches one coalesced `setBlockProp` per typing run.
- Uploads: the browser uploads the original to a private `uploads` bucket under its workspace folder. `POST /api/assets` runs `sharp` with the user's session, writes WebP variants to the public `assets` bucket, inserts the `assets` row and deletes the original. Storage policies scope every path to `is_workspace_member` (D-008).

**Tech Stack:** Next.js 16.4.2 (App Router), React 19.3, TypeScript 5 (strict), Zustand 5.0.15, Immer 11.1.21, Zod 4.6.7, Supabase (Postgres, Storage, RLS; `@supabase/ssr` 0.12.7), sharp 0.35.5, shadcn/ui 4 (Base UI), lucide-react, esbuild 0.28.2, Vitest 5.0.5 (+ happy-dom), Playwright 1.64.1, pgTAP.

**Spec:**
- `docs/PRD.md` §5.2 (drag and drop, inspector, commands), §6.2, §6.4.1 (repeater items draggable), §8 (security, 30+ blocks), §10 (M2) and §11 AC8.
- `docs/PLAN.md` §2.2 (WebP variants), §2.3, §3 (R1, R2, R6) and §5 (M2: DnD, inline editing, uploads, exit e2e).
- `docs/DECISIONS.md`: D-008, D-009, D-016, D-017, D-028, D-034, D-037–D-040, D-042.
- `docs/superpowers/plans/2026-10-22-m2a-editor-core.md` "After M2a" (the scope of this plan).

## Before Task 1

- Start Docker Desktop (`docker info` must succeed), then `pnpm db:start`.
- Create the branch in place: `git switch -c feat/m2b-direct-manipulation`.
- Link this plan from `docs/PLAN.md`: §5 M2 gets an "M2b plan" link next to the M2a one. §10's "M2b Direct manipulation" row gets this plan's path and the status "In progress".
- Commit: `docs: add M2b direct manipulation plan`.

## Global Constraints

- **Node 24 on every command:** prefix `pnpm`/`node` with `export PATH="$HOME/.nvm/versions/node/v24.22.1/bin:$PATH";`.
- **Next.js 16:** read the relevant guide in `node_modules/next/dist/docs/` before using an API. Route handler context is `RouteContext<'/path'>`, page props `PageProps<'/path'>`, and `params` are Promises.
- **Auth on every entry point:** server actions and pages call `requireUser()` first; route handlers call `getApiUser()` and return `unauthorizedResponse()` on `null`.
- **Secrets:** the service-role key appears only in `tests/e2e/**` and `scripts/**`. Server code, the asset route included, runs as the signed-in user, so RLS and storage policies apply.
- **Canvas isolation** stays as in M2a: `sandbox="allow-scripts"` only; the parent accepts a message only from `iframe.contentWindow`, with the `launchpad-canvas` tag, the current channel and a passing Zod schema; it acts only on ids in the document. New for M2b: an `edit` message's field path must resolve to a text or rich field of that block's schema, and its value goes through the normal command validation.
- **Renderer purity** is unchanged: no `Date`, `Math.random`, `Intl` or I/O in `lib/renderer` or `lib/blocks`. Preview-only markup never appears in export output.
- **The document is always valid:** every drop and inline edit is a command; a failing command changes nothing.
- **Exact numbers:**
  - Drag start: mouse and pen after 4 px of movement; touch after a 250 ms long-press, abandoned if the finger moves more than 10 px first.
  - Drop zones: the top and bottom 25% of a section's height drop between sections; the middle half joins the section.
  - Auto-scroll: within 48 px of the canvas's top or bottom edge, `Math.ceil(20 * (48 - d) / 48)` px per frame at distance `d`, so at most 20.
  - Limits (from `LIMITS`): 60 sections, 30 blocks per section, 200 blocks.
  - Uploads: originals up to 10 MiB (10,485,760 bytes) of type JPEG, PNG, WebP, GIF or AVIF; at most 40,000,000 input pixels; WebP variants 1600 and 800 px wide, never enlarged, quality 80.
  - Canvas runtime: ≤ 8192 bytes minified until Task 8, then ≤ 10,240 bytes (D-044).
- **Dependencies:** add only `sharp@0.35.5`, pinned exactly; it is already in the tree through `next`. `pnpm-workspace.yaml` keeps `allowBuilds.sharp: false`, because sharp loads its prebuilt `@img/sharp-*` binary. No DnD, carousel or page-builder packages; the dependency-policy test stays green.
- **Tests:** unit tests sit next to the code. React UI is tested with Playwright in `tests/e2e/app/`, which runs serially against the one owner account and resets its pages. Drags use `page.mouse` with `steps`; touch uses CDP `Input.dispatchTouchEvent` in a `hasTouch` context, as in `spikes/canvas-dnd/measure.ts`.
- **Local database:** apply new migrations with `pnpm supabase migration up --local </dev/null`. Never `db:reset`, which wipes local data. Then run `pnpm db:types`.
- **Editor UI copy** is English, sentence case. Strings that tests rely on are fixed in each task's UI contract.
- **Commits:** small conventional commits ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Run `pnpm format` (and `pnpm assets` after touching `styles.css`, `preview.css` or a `*.bundle.ts`) before committing.

## Review Focus

Inputs the spec implies that feature tests would not naturally hit, most likely first. Each is pinned by the named test.

1. **Fast typing in the canvas while the editor re-renders.** Expected: every character arrives, in order, and the caret never jumps. Test: `typed text arrives intact while the editor saves and re-renders` (Task 8).
2. **Pasting formatted text (Word, a web page) into a canvas field.** Expected: only plain text arrives, with no foreign tags or styles in the stored markup. Test: `pasting formatted text inserts plain text only` (Task 8).
3. **Emptying a required field, or typing past its limit, in the canvas.** Expected: nothing invalid is stored; when editing ends the field shows the stored text again, and a notice says why. Test: `emptying a required headline restores it when editing ends and says why` (Task 8).
4. **An interrupted drag:** Escape, a pointercancel, the window losing focus, or a release outside the canvas. Expected: nothing changes, no undo entry, and the shield is gone so the canvas works again. Tests: `Escape, pointercancel and blur cancel; a later pointerup drops nothing` (Task 3); `a drag released outside the canvas or cancelled with Escape changes nothing` (Task 4).
5. **A bad upload:** a non-image renamed `.jpg`, a file over 10 MiB, an image over 40 megapixels, a corrupt file. Expected: a clear message, no `assets` row, and no original left in `uploads`. Tests: `rejects bytes that are not an image, SVG and images over 40 megapixels` (Task 10); `oversized and unreadable originals are rejected and removed` (Task 10); `a file that is not an image shows an error and changes nothing` (Task 11).

## Folded-in deferred minors (M2a final review)

- M1 (no-op edits become undo steps) → Task 1.
- M5 (property tests lack structural cases) and M6 (defaults stored unparsed) → Task 1.
- M2 (UTM inputs drop spaces and re-encode other parameters) → Task 5.
- M8 (draft route reads bodies without a cap; aborts become 500) → Task 10.
- M4 (success and conflict bodies not validated) → Task 11.
- M9 (PLAN wording and DECISIONS spacing) → Task 12.
- **Still deferred:** M3 (the unload flush skips edits made during an in-flight save) goes to M3.

---

### Task 1: Drop commands

**Files:**
- Modify: `lib/editor/commands.ts`, `lib/editor/commands.test.ts`, `lib/editor/test-fixtures.ts`, `docs/DECISIONS.md` (add D-043)

**Interfaces:**
- Consumes: `applyCommand`, `commit`, `roomFor`, `locateBlock`, `footerStart`, `LIMITS` (M2a).
- Produces:

```ts
export type DropTarget =
  /** A new section at this index, 0…footerStart(doc). */
  | { kind: 'between'; index: number }
  /** Into this section, before the block now at `index` (0…blocks.length). */
  | { kind: 'into'; sectionId: string; index: number };
// added to EditorCommand
| { type: 'insertBlockAt'; blockType: string; target: DropTarget }
| { type: 'moveBlockTo'; blockId: string; target: DropTarget }
/** A new block instance with parsed default props and default style (used by addBlock and insertBlockAt). */
export function newBlockInstance(definition: AnyBlockDefinition, newId: IdFactory): BlockInstance;
```

**Rules (D-043):**
- Indices refer to the document before the command.
- **`insertBlockAt`:**
  - `between`: a new default section holding the new block.
  - `into`: inserted into that section.
  - A block whose definition has `landmark: 'footer'` ignores the target and goes last, as with `addBlock`.
- **`moveBlockTo`, block alone in its section:**
  - `between` moves the whole section, keeping its id, style and anchor. The final index is `index > from ? index - 1 : index`; `index === from` or `from + 1` is a `noop`.
  - `into` another section moves the block there, and its old section (anchor included) disappears; `into` its own section is a `noop`.
- **`moveBlockTo`, block in a shared section:**
  - `between` leaves into a new section at `index` that copies the source style (no anchor).
  - `into` its own section reorders it; the final index is `index > from ? index - 1 : index`, and `index === from` or `from + 1` is a `noop`.
  - `into` another section moves it there.
- **Failures:**
  - Moving a footer block → `invalid` "The footer always stays at the end".
  - An `into` target at or after `footerStart` → `invalid` "Blocks can't join the footer".
  - A `between` index outside `0…footerStart` → `invalid` "That drop position no longer exists".
  - An unknown section → `not_found`.
  - A 31st block in a section → `limit` "A section holds at most 30 blocks"; new sections use `roomFor`.
- **Copy:**
  - Labels: `Add <Label>` / `Move <Label>`.
  - Announcements: `Added <Label> as section <n> of <total>`, `Added <Label> to section <n>, block <k> of <m>`, `Moved <Label> to section <n> of <total>`, `Moved <Label> into section <n>, block <k> of <m>`.
  - The `noop` reason is `<Label> is already there`.
  - Selection: the inserted or moved block.
- **M1:** `commit` returns `noop` "Nothing changed" when Immer produced no patches, so no command ever records an empty undo step.
- **M6:** `addBlock` and `insertBlockAt` build the block through `newBlockInstance`, which stores `definition.schema.parse(definition.defaultProps(newId))`.

- [ ] **Step 1: Write the failing tests** in `commands.test.ts`, on `editorDoc()` (s1[b1] · s2[b2,b3] · s3[b4] · s4[b5 footer]):

```ts
it('insertBlockAt between makes a new section; into joins one', () => {
  const between = run({ type: 'insertBlockAt', blockType: 'faq', target: { kind: 'between', index: 1 } });
  expect(order(between.doc)).toEqual(['s1:b1', 'n1:n2', 's2:b2,b3', 's3:b4', 's4:b5']);
  expect(between.announcement).toBe('Added FAQ as section 2 of 5');
  const into = run({ type: 'insertBlockAt', blockType: 'faq', target: { kind: 'into', sectionId: 's2', index: 1 } });
  expect(order(into.doc)).toEqual(['s1:b1', 's2:b2,n1,b3', 's3:b4', 's4:b5']);
});
it('a lone block moves its whole section; a shared block leaves into a copy of its band', () => {
  expect(order(run({ type: 'moveBlockTo', blockId: 'b1', target: { kind: 'between', index: 3 } }).doc))
    .toEqual(['s2:b2,b3', 's3:b4', 's1:b1', 's4:b5']);
  const left = run({ type: 'moveBlockTo', blockId: 'b3', target: { kind: 'between', index: 0 } });
  expect(order(left.doc)).toEqual(['n1:b3', 's1:b1', 's2:b2', 's3:b4', 's4:b5']);
  expect(left.doc.sections[0]!.style.tone).toBe('muted');
});
it('moveBlockTo into another section removes an emptied section; within a section it reorders', () => {
  expect(order(run({ type: 'moveBlockTo', blockId: 'b4', target: { kind: 'into', sectionId: 's2', index: 0 } }).doc))
    .toEqual(['s1:b1', 's2:b4,b2,b3', 's4:b5']);
  expect(order(run({ type: 'moveBlockTo', blockId: 'b2', target: { kind: 'into', sectionId: 's2', index: 2 } }).doc))
    .toEqual(['s1:b1', 's2:b3,b2', 's3:b4', 's4:b5']);
});
it('dropping a block where it already is is a noop', () => {
  for (const target of [{ kind: 'between', index: 0 }, { kind: 'between', index: 1 }, { kind: 'into', sectionId: 's1', index: 0 }] as const)
    expect(fail({ type: 'moveBlockTo', blockId: 'b1', target }).code).toBe('noop');
  expect(fail({ type: 'moveBlockTo', blockId: 'b2', target: { kind: 'into', sectionId: 's2', index: 1 } }).code).toBe('noop');
});
it('the footer stays last and nothing joins it', () => {
  expect(fail({ type: 'moveBlockTo', blockId: 'b5', target: { kind: 'between', index: 0 } }).reason).toBe('The footer always stays at the end');
  expect(fail({ type: 'insertBlockAt', blockType: 'faq', target: { kind: 'into', sectionId: 's4', index: 0 } }).reason).toBe("Blocks can't join the footer");
  expect(fail({ type: 'insertBlockAt', blockType: 'faq', target: { kind: 'between', index: 4 } }).code).toBe('invalid');
});
it('a section holds at most 30 blocks', () => { /* fill s2 to 30, then insertBlockAt into s2 → code 'limit', reason 'A section holds at most 30 blocks' */ });
it('an edit that changes nothing is a noop (M1)', () => {
  const price = { type: 'setBlockProp', blockId: 'b4', path: ['items', 0, 'price'], value: 12.5 } as const;
  const priced = run(price).doc;
  expect(applyCommand(priced, price, null, deps())).toMatchObject({ ok: false, code: 'noop' });
});
it('new blocks store parsed defaults (M6)', () => {
  const stub = { ...hero, defaultProps: () => ({ headline: 'x', primaryCta: { label: 'Pesan', link: { kind: 'default' } } }) };
  expect(newBlockInstance(stub as typeof hero, deps().newId).props).toEqual(hero.schema.parse(stub.defaultProps()));
});
```

  - `run`/`fail` are local helpers over `applyCommand(editorDoc(), command, null, deps())` that assert `ok` (or not) and return the result.
  - Extend `everyCommand()` with the moves the reviewer listed: a split (`moveBlock` b3 down out of s2), an in-section swap, a shared duplicate and a delete that empties a section. Add one `insertBlockAt` and one `moveBlockTo` of each kind. The existing property tests ("every command keeps the document valid and its inverse restores it"; the store's undo/redo walk) then cover them.

- [ ] **Step 2: Run them and watch them fail.**
  - Run: `pnpm exec vitest run lib/editor`
  - Expected: FAIL. The new command types are unknown, and the M1 test gets `ok`.
- [ ] **Step 3: Implement** the types, the two commands, the `commit` noop and the defaults helper in `commands.ts`. Add **D-043 "Drag and drop: drop targets and moves"** with the rules above (Task 2 adds the zone rule, Task 4 the interaction rules).
- [ ] **Step 4: Run** `pnpm exec vitest run lib/editor`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(editor): insertBlockAt and moveBlockTo commands for drops; no-op edits record nothing`.

---

### Task 2: Drop-target geometry and auto-scroll math

**Files:**
- Create: `lib/editor/dnd/geometry.ts`, `lib/editor/dnd/geometry.test.ts`
- Modify: `docs/DECISIONS.md` (D-043: the zones)

**Interfaces:**
- Consumes: `DropTarget` (Task 1); `CanvasRect` (`lib/editor/canvas/constants.ts`); `footerStart`.
- Produces:

```ts
export interface LayoutSection {
  id: string; index: number; top: number; bottom: number; left: number; width: number;
  /** Visible blocks only (height > 0), each with its index in the section. */
  blocks: { id: string; index: number; top: number; bottom: number }[];
  blockCount: number;
}
export interface CanvasLayout { sections: LayoutSection[]; end: number; width: number }
export const EDGE_FRACTION = 0.25;
export const AUTO_SCROLL_EDGE = 48;
export const AUTO_SCROLL_MAX = 20;
/** Sections before footerStart(doc) with a visible rect, in document order. */
export function buildLayout(doc: PageDocument, rects: { sections: CanvasRect[]; blocks: CanvasRect[] }, width: number): CanvasLayout;
/** `y` is in canvas px from the iframe viewport's top, like the rects. */
export function findDropTarget(layout: CanvasLayout, y: number): DropTarget;
export interface DropMarker { top: number; left: number; width: number; kind: DropTarget['kind'] }
export function dropMarker(layout: CanvasLayout, target: DropTarget): DropMarker;
/** `y` from the scroll area's top, `height` its height (same units); −20…20, 0 outside the edge zones. */
export function autoScrollDelta(y: number, height: number): number;
/** Gap index 0…rects.length from item midpoints. */
export function listDropIndex(rects: readonly { top: number; bottom: number }[], y: number): number;
/** listMove's `to` for a gap index, or null when the item would not move. */
export function listMoveTo(from: number, gap: number): number | null;
```

**Rules:**
- **`findDropTarget`:**
  - With no sections, or with `y` above the first one: `{ between, index: 0 }`. With `y` below the last one: `{ between, index: end }`.
  - In section S, the top `EDGE_FRACTION` of its height gives `{ between, S.index }` and the bottom fraction `{ between, S.index + 1 }`.
  - The middle gives `{ into, S.id, index }`. The index is that of the first visible block whose midpoint lies below `y`, or `blockCount` when there is none.
  - A `y` in a gap between section rects goes to the nearer boundary, as `between`.
- **`dropMarker`:**
  - `between` is a full-width line (`left: 0`, `width: layout.width`) at the section's top, or at the bottom of the last section for `index === end`.
  - `into` is inset 16 px on both sides of the section. It sits at the first visible block's top, at the last one's bottom, or halfway between two neighbours.

- [ ] **Step 1: Write the failing tests** on a synthetic layout: s1 0–400 (b1 40–360), s2 400–1000 (b2 440–700, b3 700–960), with `end = 2` and `width = 390`.

```ts
expect(findDropTarget(layout, -5)).toEqual({ kind: 'between', index: 0 });
expect(findDropTarget(layout, 90)).toEqual({ kind: 'between', index: 0 });            // top 25% of s1
expect(findDropTarget(layout, 150)).toEqual({ kind: 'into', sectionId: 's1', index: 0 });
expect(findDropTarget(layout, 250)).toEqual({ kind: 'into', sectionId: 's1', index: 1 });
expect(findDropTarget(layout, 360)).toEqual({ kind: 'between', index: 1 });           // bottom 25% of s1
expect(findDropTarget(layout, 720)).toEqual({ kind: 'into', sectionId: 's2', index: 1 });
expect(findDropTarget(layout, 5000)).toEqual({ kind: 'between', index: 2 });
expect(findDropTarget(empty, 100)).toEqual({ kind: 'between', index: 0 });
expect(dropMarker(layout, { kind: 'between', index: 2 })).toEqual({ top: 1000, left: 0, width: 390, kind: 'between' });
expect(dropMarker(layout, { kind: 'into', sectionId: 's2', index: 1 })).toMatchObject({ top: 700, left: 16, width: 358 });
expect([autoScrollDelta(0, 600), autoScrollDelta(24, 600), autoScrollDelta(300, 600), autoScrollDelta(599, 600), autoScrollDelta(700, 600)]).toEqual([-20, -10, 0, 20, 0]);
expect(listMoveTo(2, 0)).toBe(0); expect(listMoveTo(0, 3)).toBe(2); expect(listMoveTo(1, 1)).toBeNull(); expect(listMoveTo(1, 2)).toBeNull();
```

  - Also test `buildLayout`: it skips footer sections, hidden (zero-height) blocks and sections without a rect, and keeps in-section indices from the document.
- [ ] **Step 2: Run** `pnpm exec vitest run lib/editor/dnd/geometry.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `geometry.ts` and add the zone rule to D-043.
- [ ] **Step 4: Run** it again. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(dnd): drop targets, marker geometry and auto-scroll from cached rects`.

---

### Task 3: Drag controller

**Files:**
- Create: `lib/editor/dnd/controller.ts`, `lib/editor/dnd/controller.test.ts`

**Interfaces:**
- Produces:

```ts
export const DRAG_THRESHOLD_PX = 4; export const LONG_PRESS_MS = 250; export const TOUCH_SLOP_PX = 10;
export interface PointerInput { pointerId: number; pointerType: string; clientX: number; clientY: number; button: number }
export interface Point { x: number; y: number }
export interface DragHandlers { start(p: Point): void; move(p: Point): void; drop(p: Point): void; cancel(): void }
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
export function createDragController(): DragController;
```

- Uses the global `setTimeout`/`clearTimeout`, so tests drive it with fake timers. It never touches the DOM.

- [ ] **Step 1: Write the failing tests:**
  - `mouse starts after 4 px, not before` (a 3 px move leaves `pending`, a 5 px move calls `start` then `move`).
  - `a press without movement is a click: up() drops nothing`.
  - `touch starts after a 250 ms long-press; moving 10 px first abandons it`: `advanceTimersByTime(249)` stays `pending`, 250 starts; a separate press that moves 11 px before the timer never starts.
  - `Escape, pointercancel and blur cancel; a later pointerup drops nothing` (Review Focus 4): `cancel()` while dragging calls `handlers.cancel` once; a following `up()` calls no `drop`; the state is `idle`.
  - `events from another pointer are ignored`.
  - `drop receives the last pointer position`.
- [ ] **Step 2: Run** `pnpm exec vitest run lib/editor/dnd/controller.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `controller.ts`.
- [ ] **Step 4: Run** it. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(dnd): pointer drag controller with mouse threshold and touch long-press`.

---

### Task 4: Drag and drop in the editor

**Files:**
- Create: `components/editor/dnd/drag-context.tsx`, `components/editor/canvas/canvas-handle.ts`, `tests/e2e/app/editor-dnd.spec.ts`
- Modify:
  - Canvas: `lib/editor/canvas/protocol.ts`, `lib/editor/canvas/runtime.ts`, `lib/editor/canvas/runtime.test.ts`, `lib/editor/canvas/preview-runtime.generated.ts` (via `pnpm assets`).
  - Store: `lib/editor/store.ts`, `lib/editor/store.test.ts`.
  - UI: `components/editor/canvas/canvas.tsx`, `components/editor/canvas/overlay.tsx`, `components/editor/canvas/block-toolbar.tsx`, `components/editor/palette.tsx`, `components/editor/editor.tsx`.
  - Tests and docs: `tests/e2e/app/helpers.ts`, `docs/DECISIONS.md` (D-043: interaction).

**Interfaces:**
- Consumes: Tasks 1–3; `CanvasGeometry` (M2a overlay, gains `viewportWidth`).
- Produces:

```ts
// protocol.ts: CanvasCommand gains
| { type: 'scrollBy'; dy: number }
// store.ts: EditorActions gains
announce(text: string): void;   // sets `announcement` only
// canvas-handle.ts
export interface CanvasHandle {
  frame(): HTMLIFrameElement | null;
  scale(): number;
  geometry(): CanvasGeometry | null;
  /** Canvas px; the iframe answers with rects even at the scroll edge (D-034). */
  scrollBy(dy: number): void;
  onGeometry(listener: () => void): () => void;
}
// canvas.tsx: <Canvas onKey={…} handleRef={RefObject<CanvasHandle | null>} />
// drag-context.tsx
export type DragSource =
  | { kind: 'palette'; blockType: string; label: string }
  | { kind: 'block'; blockId: string; label: string };
export function DragProvider(props: { canvas: RefObject<CanvasHandle | null>; children: ReactNode }): JSX.Element;
export function useDragSource(source: DragSource): { onPointerDown(e: PointerEvent): void; onContextMenu(e: MouseEvent): void; onClickCapture(e: MouseEvent): void };
export function useDragState(): { source: DragSource | null; target: DropTarget | null; marker: DropMarker | null };
```

**Runtime:**
- `scrollBy` runs `win.scrollBy(0, dy)` (`dy` finite, clamped to ±2000) and then always `scheduleRects()`.
- The bundle stays ≤ 8192 bytes.

**Interaction rules (D-043):**
- **Wiring:** `EditorShell` creates the handle ref, passes it to `<Canvas handleRef>` (which fills it) and to `<DragProvider canvas>`, and wraps the palette, canvas and inspector in the provider.
- **Listeners:**
  - `pointerdown` on a source calls `setPointerCapture`.
  - The provider listens on `window` for `pointermove`, `pointerup` and `pointercancel`, and for `blur`, which cancels.
  - A capture-phase `keydown` on `window` swallows every key while dragging (so editor shortcuts never fire mid-drag), and Escape cancels.
  - Keys the canvas forwards (`onKey`) are ignored while dragging.
- **Hit-testing:**
  - The pointer becomes a canvas point: `(clientY - frame.top) / scale`, using `getBoundingClientRect()` of the iframe.
  - Outside the frame there is no target and no marker.
  - The target is recomputed on every move and on every new geometry.
- **Auto-scroll:** a `requestAnimationFrame` loop runs while dragging and calls `canvas.scrollBy(autoScrollDelta(...) / scale)` while the pointer is inside the frame horizontally.
- **Drop:**
  - With a target, a palette source dispatches `insertBlockAt` and a block source `moveBlockTo`.
  - Without a target the drag is cancelled.
  - The click that ends a drag is swallowed (`onClickCapture`), so a palette drag never also adds by click.

**UI contract:**
- **Palette:**
  - Each `<li>` holds the existing button (unchanged name; a click still adds) and a grip `<span data-drag-handle aria-hidden="true">` with `GripVertical`, `touch-action: none` and no context menu.
  - The grip shows on row hover and always under `(pointer: coarse)`.
  - Mouse drags start from the button or the grip; touch drags only from the grip.
- **Block toolbar:**
  - A first button "Drag to move" (`GripVertical`, `title` "Drag to move", `touch-action: none`).
  - It is absent for blocks whose definition has `landmark: 'footer'`.
- **While dragging:**
  - `data-testid="canvas-shield"` covers the iframe.
  - The overlay draws the source block with a dashed outline.
  - `data-testid="drop-marker"` is a 2 px sky line with a chip "New section" (`between`) or "Into this section" (`into`).
  - `data-testid="drag-ghost"` follows the pointer with the block's label.
- **Announcements:**
  - On start, "Dragging <Label>. Press Escape to cancel."
  - On cancel, "Drag cancelled."
  - On drop, the command's own announcement.

- [ ] **Step 1: Write the failing tests:**
  - `runtime.test.ts`: `scrollBy scrolls the canvas and reports rects even at the edge` (at `scrollY` 0, `scrollBy -50` still posts `rects`).
  - `store.test.ts`: `announce sets the announcement without touching history`.
  - `tests/e2e/app/editor-dnd.spec.ts`. Helpers in `helpers.ts`:
    - `docWith(types)` returns a raw document with one section per block type (`s1…`, `b1…`), each holding that block's registry defaults.
    - `paletteItem(page, label)` returns the palette `<li>` whose button is named `label` (exact).
    - `pointIn(locator, fx, fy)` returns the main-page point at fractions of the element's box.
    - `dragWithMouse(page, from, to, { hold? })` does move, down, `move(to, { steps: 12 })`, an optional hold that keeps moving 1 px every 50 ms, then up.
    - `touchDrag(page, from, to)` sends CDP touchStart, waits 300 ms, then 12 touchMoves and touchEnd.
  - The e2e tests:

```ts
test('drags Hero from the palette to a new section between two others', async ({ page }) => {
  const frame = await openEditor(page, await seedPage({ name: 'Dnd', document: docWith(['benefits', 'faq']) }));
  const grip = paletteItem(page, 'Hero').locator('[data-drag-handle]');
  await page.mouse.move(...(await pointIn(grip, 0.5, 0.5)));
  await page.mouse.down();
  await page.mouse.move(...(await pointIn(frame.locator('[data-lp-section]').nth(1), 0.5, 0.1)), { steps: 12 });
  await expect(page.getByTestId('drop-marker')).toContainText('New section');
  await expect(page.getByTestId('canvas-shield')).toBeVisible();
  await page.mouse.up();
  await expect.poll(() => blockTypes(frame)).toEqual(['benefits', 'hero', 'faq']);
  await expect(page.getByTestId('announcer')).toHaveText('Added Hero as section 2 of 3');
  await expect(page.getByTestId('canvas-shield')).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(() => blockTypes(frame)).toEqual(['benefits', 'faq']);
});
test('a drop over the middle of a section joins it', /* drag Hero to 0.3 of the FAQ section → marker "Into this section"; section 2 holds ['hero','faq'] */);
test('reorders a block by dragging its toolbar grip', /* seed hero|benefits|faq; select faq; drag "Drag to move" to 0.1 of section 1 → ['faq','hero','benefits']; undo restores */);
test('a drag released outside the canvas or cancelled with Escape changes nothing', /* release over the inspector; then drag into the canvas and press Escape before up → types unchanged, Undo disabled, no canvas-shield, announcer "Drag cancelled." */);
test('auto-scrolls the canvas while the pointer stays near its bottom edge', /* perfDocument(); drag Hero to 8 px above the frame's bottom with hold 1500 ms; frame scrollY > 0; release at 0.5 of the frame → indexOf('hero') > 5 */);
test('touch: a long-press on the palette grip drags', /* new hasTouch context (signIn again), touchDrag the Hero grip into the canvas → ['hero'] */);
```

- [ ] **Step 2: Run** the unit tests and `pnpm exec playwright test --project=app tests/e2e/app/editor-dnd.spec.ts` (with `PW_APP=1`). Expected: FAIL (no `scrollBy`, no grip, no marker).
- [ ] **Step 3: Implement:**
  - the runtime command, the store action and `canvas-handle.ts`;
  - `Canvas`: register the handle, add `viewportWidth` to the geometry and render the shield while dragging;
  - `DragProvider` in `EditorShell`, the overlay's marker and source outline, and the palette and toolbar sources;
  - `pnpm assets`, and D-043's interaction section.
- [ ] **Step 4: Run** the same tests, then `pnpm test`. Expected: PASS; the runtime is still ≤ 8192 bytes.
- [ ] **Step 5: Commit:** `feat(dnd): drag blocks from the palette and reorder them in the canvas`.

---

### Task 5: Drag reorder in the list control, and UTM fields that keep spaces

**Files:**
- Create: `components/editor/dnd/use-list-drag.ts`
- Modify: `components/editor/inspector/controls/list-control.tsx`, `components/editor/inspector/controls/link-control.tsx`, `lib/editor/utm.ts`, `lib/editor/utm.test.ts`, `tests/e2e/app/editor-inspector.spec.ts`

**Interfaces:**
- Consumes: `createDragController` (Task 3); `listDropIndex`, `listMoveTo`, `autoScrollDelta` (Task 2); `FieldActions.listMove` (M2a).
- Produces:

```ts
export function useListDrag(options: {
  count: number;
  list: RefObject<HTMLElement | null>;   // items carry data-list-item
  scroller: RefObject<HTMLElement | null>; // the inspector <aside>, auto-scrolled near its edges
  onMove(from: number, to: number): void;
}): { handleProps(index: number): HTMLAttributes<HTMLElement>; dragging: number | null; markerTop: number | null };
```

**Rules:**
- Items are hit-tested on their `getBoundingClientRect()` at every move. A drop calls `onMove(from, listMoveTo(from, gap))` unless that is `null`. Escape and blur cancel, as in Task 4.
- Announcements: on start "Dragging item <n>. Press Escape to cancel.", on cancel "Drag cancelled.", on drop the `listMove` command's own announcement.
- **UTM (M2):**
  - `writeUtm` keeps every parameter it doesn't touch exactly as typed: it splits the query on `&` without decoding.
  - It writes UTM values with `encodeURIComponent`, so a space becomes `%20`.
  - The link control keeps a local draft per UTM input, writes on every change without trimming, and trims on blur.

**UI contract:**
- Each list row starts with a button "Drag to reorder" (`GripVertical`, `touch-action: none`).
- `data-testid="list-drop-marker"` shows the gap while dragging, and the dragged row is dimmed.
- "Move item up/down" stay, as the keyboard path.

- [ ] **Step 1: Write the failing tests:**

```ts
// utm.test.ts
expect(writeUtm('https://wa.me/62812?text=Halo%20kak', { utm_source: 'meta' })).toBe('https://wa.me/62812?text=Halo%20kak&utm_source=meta');
expect(writeUtm('https://x.example/?utm_campaign=a', { utm_campaign: 'promo oktober' })).toBe('https://x.example/?utm_campaign=promo%20oktober');
expect(readUtm('https://x.example/?utm_campaign=promo%20oktober')).toEqual({ utm_campaign: 'promo oktober' });
```

  - E2e:
    - `drags a carousel item to a new position; undo restores the order`: drag item 3's "Drag to reorder" above item 1, expect cards `['Product 3', 'Product 1', 'Product 2']`, then Undo restores `['Product 1', 'Product 2', 'Product 3']`.
    - `typing a UTM campaign with a space keeps it`: `pressSequentially('promo oktober')` into Campaign, then the hero button `href` contains `utm_campaign=promo%20oktober`.
- [ ] **Step 2: Run** `pnpm exec vitest run lib/editor/utm.test.ts` and the inspector spec. Expected: FAIL.
- [ ] **Step 3: Implement** the hook, the grips and the UTM changes.
- [ ] **Step 4: Run** both. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(inspector): drag to reorder list items; UTM fields keep spaces and other parameters`.

---

### Task 6: Field markers in preview

**Files:**
- Create: `lib/blocks/registry-fields.test.ts`
- Modify:
  - Renderer: `lib/renderer/context.ts`, `lib/renderer/fragments.ts`.
  - Blocks: `lib/blocks/{hero,benefits,testimonials,faq,footer}/render.ts`, `lib/blocks/special/product-carousel/render.ts`.
  - Field paths: `lib/editor/inspector/fields.ts`, `lib/editor/inspector/fields.test.ts`.
  - Snapshots only if a block snapshot renders in preview mode.

**Interfaces:**
- Produces:

```ts
// lib/editor/inspector/fields.ts
/** 'items.2.title' → ['items', 2, 'title']; null unless ≤ 6 segments of [A-Za-z][A-Za-z0-9]* or ≤ 3 digits. */
export function parseFieldPath(path: string): PropPath | null;
/** The field at a prop path, walking groups and list items; null if there is none. */
export function fieldSpecAt(fields: readonly FieldSpec[], path: PropPath): FieldSpec | null;
// RenderContext
/** Preview only: marks the element whose whole content is this field, for inline editing (D-044). */
field(path: string, kind: 'text' | 'rich'): SafeHtml;   // ' data-lp-field="<path>"' (+ ' data-lp-rich' for rich); '' in export
// CtaExtras
field?: string;   // the label's prop path; renderCta adds ctx.field(field, 'text') to the <a>
```

**Markers** (path → element):

| Block | Fields |
|---|---|
| hero | `eyebrow` (text), `headline` (rich), `subheadline` (rich), `trustLine` (text); `primaryCta.label`, `secondaryCta.label` (via `renderCta`) |
| benefits | `heading`, `subheading` (rich); `items.<i>.title` (text); `items.<i>.text` (rich) |
| testimonials | `heading` (rich); `items.<i>.quote` (rich, on the `<p>`); `items.<i>.name`, `items.<i>.detail` (text) |
| faq | `heading` (rich); `items.<i>.question` (text, on `<summary>`); `items.<i>.answer` (rich, on `.lp-faq__a`) |
| footer | `brand`, `copyright` (text); `disclaimer` (rich); `links.<i>.label` (text, on the `<a>`) |
| product-carousel | `heading`, `subheading` (rich); `items.<i>.title`, `items.<i>.badge` (text); `items.<i>.description` (rich); `items.<i>.cta.label` (via `renderCta`) |

- [ ] **Step 1: Write the failing tests:**
  - `fields.test.ts`: `parseFieldPath reads dotted paths and refuses anything else` ('items.2.title', and null for '', 'a..b', '__proto__.x', '1234.x', seven segments); `fieldSpecAt walks groups and list items` (hero `['primaryCta', 'label']` → text; carousel `['items', 0, 'title']` → text; `['items', 0, 'nope']` → null).

  The rest go in `registry-fields.test.ts`, over every block of `exampleDocument` and every registry default:
  - `every field marker names a text or rich field of its block, with data-lp-rich exactly on rich fields` (via `parseFieldPath` and `fieldSpecAt`).
  - `every text and rich value the example renders is marked`. For hero, benefits and the carousel, the listed paths appear.
  - `export output carries no field markers`: `renderPage(exampleDocument, { mode: 'export' })` contains neither `data-lp-field` nor `data-lp-rich`.
- [ ] **Step 2: Run** `pnpm exec vitest run lib/blocks lib/renderer`. Expected: FAIL (no markers).
- [ ] **Step 3: Implement** `ctx.field`, `CtaExtras.field` and the markers. If any block snapshot renders in preview mode, update it with `pnpm exec vitest run <file> --update`. Its diff must only add `data-lp-field`/`data-lp-rich`; export snapshots must not change.
- [ ] **Step 4: Run** `pnpm test`. Expected: PASS, including "renders valid HTML".
- [ ] **Step 5: Commit:** `feat(renderer): mark editable text fields in preview mode`.

---

### Task 7: Reading edited fields and writing inline markup

**Files:**
- Create: `lib/editor/canvas/inline-nodes.ts`, `lib/editor/canvas/inline-nodes.test.ts`, `lib/editor/inline-serialize.ts`, `lib/editor/inline-serialize.test.ts`

**Interfaces:**
- Consumes: `renderInline`, `renderText` (`lib/renderer/inline.ts`); `sanitizeUrl`.
- Produces:

```ts
// lib/editor/canvas/inline-nodes.ts: zod-free; bundled into the canvas runtime in Task 8
export type InlineNode =
  | { t: 'text'; v: string }
  | { t: 'strong' | 'em' | 'mark'; v: string }
  | { t: 'br' }
  | { t: 'link'; href: string; label: InlineNode[] };
export function readInlineNodes(root: Element): InlineNode[];
// lib/editor/inline-serialize.ts
/** Canonical markup (D-009): an escape is kept only where removing it would change the rendered HTML. */
export function serializeInline(nodes: readonly InlineNode[]): string;
/** A text field's value: formatting dropped, line breaks become single spaces. */
export function serializeText(nodes: readonly InlineNode[]): string;
```

**Rules:**
- **`readInlineNodes`**, by element:
  - `STRONG`/`B` → `strong`, `EM`/`I` → `em`, `MARK.lp-hl` → `mark`. The value is the element's whole `textContent`; marks never nest.
  - `MARK.lp-replace` → `text` (the placeholder literal).
  - `A[href]` → `link`, with a label read recursively (marks and text only).
  - `BR` → `br`; `DIV`/`P` line wrappers → a `br` before every wrapper but the first.
  - Any other element contributes its children.
  - Adjacent text merges; one trailing `br` (Chrome's placeholder) is dropped.
- **`serializeInline`:**
  - Writes `**v**`, `*v*`, `==v==`, `\n` and `[label](href)`.
  - A link whose `sanitizeUrl(href, 'link')` is `null` becomes its label text.
  - Text escapes each of `* = [ ] \` with a backslash. Escapes are then removed greedily from left to right whenever `renderInline` of the result stays identical.

- [ ] **Step 1: Write the failing tests:**

```ts
// round trip: canonical markup survives render → DOM → nodes → markup (happy-dom parses the HTML)
for (const markup of [
  'Pilih **warnamu**', '*miring* dan ==sorot==', 'Baris 1\nBaris 2',
  'Kunjungi [toko kami](https://botolku.example/) sekarang', '[**Tebal** di tautan](https://x.example/)',
  '2 * 3 = 6', '\\*a*', 'Harga ==Rp 10.000==', '[REPLACE: nama produk] terbaik', 'a\\b',
]) it(`round-trips ${JSON.stringify(markup)}`, () =>
  expect(serializeInline(readInlineNodes(fragment(renderInline(markup, { highlightPlaceholders: true }).value)))).toBe(markup));
it('reads what contenteditable produces', () => {
  expect(readInlineNodes(fragment('<b>a<i>b</i></b><div>c</div><span style="color:red">d</span><br>')))
    .toEqual([{ t: 'strong', v: 'ab' }, { t: 'br' }, { t: 'text', v: 'cd' }]);
});
it('drops redundant escapes and unsafe links', () => {
  expect(serializeInline([{ t: 'text', v: 'a\\b' }])).toBe('a\\b');
  expect(serializeInline([{ t: 'link', href: 'javascript:alert(1)', label: [{ t: 'text', v: 'x' }] }])).toBe('x');
});
it('text fields get plain text', () => expect(serializeText([{ t: 'text', v: 'a' }, { t: 'br' }, { t: 'strong', v: 'b' }])).toBe('a b'));
```

  - `inline-nodes.test.ts` starts with `// @vitest-environment happy-dom`.
  - `fragment(html)` is a test helper returning a `<div>` with that `innerHTML`.
- [ ] **Step 2: Run** `pnpm exec vitest run lib/editor/canvas/inline-nodes.test.ts lib/editor/inline-serialize.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** both modules.
- [ ] **Step 4: Run** them. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(editor): read edited canvas fields as nodes and serialize them to inline markup`.

---

### Task 8: Inline editing in the canvas

**Files:**
- Create: `lib/editor/inline-edit.ts`, `lib/editor/inline-edit.test.ts`, `tests/e2e/app/editor-inline.spec.ts`
- Modify:
  - Canvas: `lib/editor/canvas/protocol.ts` (+test), `lib/editor/canvas/runtime.ts` (+test), `lib/editor/canvas/srcdoc.test.ts` (budget 10,240), `lib/renderer/preview.css` (+ generated).
  - Editor logic: `lib/editor/store.ts` (+test).
  - UI and docs: `components/editor/canvas/canvas.tsx`, `docs/DECISIONS.md` (add D-044).

**Interfaces:**
- Consumes: Tasks 6 and 7 (`ctx.field` markers, `parseFieldPath`, `fieldSpecAt`, `readInlineNodes`, `serializeInline`, `serializeText`); `describeFields`, `fieldError` (M2a).
- Produces:

```ts
// protocol.ts: CanvasEvent gains (InlineNodeSchema: ≤ 2000 nodes, text ≤ 20,000 chars, href ≤ 2048)
| { type: 'edit'; blockId: string; path: string; nodes: InlineNode[] }
| { type: 'editEnd'; blockId: string; path: string }
// store.ts: EditorActions gains
notify(text: string): void;   // sets `notice` and `announcement`
// inline-edit.ts
/** Validates the block and field, serializes, and dispatches one coalesced setBlockProp ('<blockId>:<path>'). */
export function applyInlineEdit(store: EditorStore, edit: { blockId: string; path: string; nodes: InlineNode[] }): void;
export function finishInlineEdit(store: EditorStore): void;   // endCoalescing()
```

**Runtime rules (D-044):**
- **Starting:**
  - A `dblclick` inside `[data-lp-field]` (within a `[data-lp-block]`) makes that element editable: `contenteditable="plaintext-only"`, or `"true"` when it has `data-lp-rich`.
  - It also sets `data-lp-editing` and focuses the element, keeping the word selection.
- **While editing:**
  - Each `input` posts `edit` with `readInlineNodes` (at most one per animation frame).
  - Sync patches for the edited block are skipped, and skeleton patches reuse its element, so the caret stays put.
  - Clicks inside the field `preventDefault` (no link navigation, no `<details>` toggle).
  - `paste` and `drop` insert `text/plain` only, via `execCommand('insertText')`; text fields turn line breaks into spaces.
- **Keys while editing:**
  - Escape ends editing.
  - Enter ends editing in text fields; in rich fields it inserts a line break (`insertLineBreak`).
  - Mod+Z and Mod+Y end editing and are then forwarded.
  - Mod+D and Mod+U are swallowed.
  - Every other key (Backspace and Delete included) stays in the field and is never forwarded.
- **Ending:** `focusout`, window `blur` or the keys above remove the attributes and post `editEnd`.
- **Parent:**
  - `edit` → `applyInlineEdit`. A failure other than `noop` calls `notify('<Field label>: <fieldError(spec, value) ?? reason>')`, e.g. "Headline: Required".
  - `editEnd` → `finishInlineEdit`. The canvas also drops that block from its sent state, so the next flush re-renders it from the document.
- **Styles:** `preview.css` adds `[data-lp-field]:hover { cursor: text }` and `[data-lp-editing] { outline: 2px solid #0284c7; outline-offset: 2px }`.
- **Budget:** the runtime budget becomes 10,240 bytes (D-044).

- [ ] **Step 1: Write the failing tests:**
  - `inline-edit.test.ts`, with a real store on `editorDoc()`:
    - `an edit to a rich field stores markup and coalesces a typing run into one undo step`;
    - `a path that is not a text or rich field, or a missing block, changes nothing`;
    - `an invalid value notifies with the field label` (empty headline → notice "Headline: Required").
  - `protocol.test.ts`: `edit messages are validated` (a node over the limits, an unknown `t`, or a non-string path → null).
  - `runtime.test.ts`:
    - `dblclick makes the field editable and input posts edit nodes`;
    - `patches for the block being edited wait until editing ends`;
    - `Backspace is not forwarded while editing; Mod+Z ends editing and is`.
  - `tests/e2e/app/editor-inline.spec.ts`:

```ts
test('double-click the headline, type, and the inspector follows; one undo reverts the run', ...);
test('typed text arrives intact while the editor saves and re-renders', async ({ page }) => {   // Review Focus 1
  // carousel card 1 title: dblclick, ControlOrMeta+A, pressSequentially('Botol stainless 750ml warna biru laut', { delay: 0 }), Escape
  // expect the card title text and the inspector Title to equal the typed string exactly
});
test('Backspace and Delete edit text instead of deleting the block', ...);
test('pasting formatted text inserts plain text only', async ({ page }) => {          // Review Focus 2
  // dblclick the hero subheadline, select all, then in the frame dispatch
  // new ClipboardEvent('paste', { clipboardData: dt }) with text/html '<b>Tebal</b> <span style="color:red">merah</span>' and text/plain 'Tebal merah'
  // Escape → the inspector Subheadline is 'Tebal merah'
});
test('emptying a required headline restores it when editing ends and says why', async ({ page }) => {   // Review Focus 3
  // dblclick the headline, ControlOrMeta+A, Backspace → the top bar shows 'Headline: Required'; Escape → the canvas shows the old headline
});
test('Mod+B in a rich field stores bold markup', ...);       // inspector Headline matches /\*\*\S+\*\*/
test('Mod+Z while editing ends the edit and reverts it', ...);
test('editing an FAQ question does not toggle its answer', ...);   // details stays closed
```

- [ ] **Step 2: Run** the unit tests and `editor-inline.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the protocol, runtime, store, canvas wiring and CSS, then run `pnpm assets`. Add **D-044 "Inline editing in the canvas"**:
  - double-click to edit;
  - what can be formatted inline (bold and italic shortcuts, existing highlights and links kept; new links and highlights come from the inspector);
  - plain-text paste and drop;
  - deferred patches;
  - the key rules;
  - canonical serialization;
  - restore on failure;
  - the 10 KB budget.
- [ ] **Step 4: Run** `pnpm test` and the app e2e suite. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(canvas): edit text in place, serialized to inline markup`.

---

### Task 9: Storage buckets and policies

**Files:**
- Create: `supabase/migrations/<timestamp>_asset_storage.sql` (via `pnpm supabase migration new asset_storage </dev/null`), `supabase/tests/storage_assets.test.sql`
- Modify: `lib/supabase/database.types.ts` (`pnpm db:types`), `docs/DECISIONS.md` (add D-045, mark D-008 Accepted)

**Interfaces:**
- Produces: the buckets, the policies and the helper below.

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('uploads', 'uploads', false, 10485760, array['image/jpeg','image/png','image/webp','image/gif','image/avif']),
  ('assets',  'assets',  true,  10485760, array['image/webp']);
-- '<workspace uuid>/…' → that uuid; anything else → null (so is_workspace_member is false, never an error)
create function public.workspace_from_path(name text) returns uuid language sql immutable ...;
```

**Policies:** on `storage.objects`, all `to authenticated`, each `bucket_id = '<bucket>' and public.is_workspace_member(public.workspace_from_path(name))`:
- `uploads`: insert, select, delete;
- `assets`: insert, delete (public read comes from the bucket flag).
- Revoke `workspace_from_path` from `public, anon`; grant it to `authenticated`.

- [ ] **Step 1: Write the failing pgTAP tests** in `storage_assets.test.sql`. Insert into `storage.objects` as `authenticated` with JWT claims, as `rls_editor.test.sql` does.

```sql
select results_eq($$ select public, file_size_limit from storage.buckets where id in ('uploads','assets') order by id $$,
  $$ values (true, 10485760::bigint), (false, 10485760::bigint) $$, 'assets is public, uploads private, both capped at 10 MiB');
select lives_ok($$ insert into storage.objects (bucket_id, name) values ('uploads', '<own ws>/a.jpg') $$, 'a member uploads into their workspace folder');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('uploads', '<other ws>/a.jpg') $$, '42501', null, 'not into another workspace');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('uploads', 'loose.jpg') $$, '42501', null, 'not outside a workspace folder');
select is_empty($$ select 1 from storage.objects where name like '<other ws>/%' $$, 'members cannot see other workspaces'' uploads');
select is(public.workspace_from_path('not-a-uuid/x'), null, 'non-uuid folders map to null');
-- anon: insert throws 42501
```

- [ ] **Step 2: Run** `pnpm db:test`. Expected: FAIL (no buckets, no function).
- [ ] **Step 3: Write the migration**, then apply it: `pnpm supabase migration up --local </dev/null`, then `pnpm db:types`. Add **D-045 "Uploads"**:
  - the buckets, paths (`uploads/<ws>/<uuid>.<ext>`, `assets/<ws>/<assetId>-{1600,800}.webp`), policies and limits;
  - originals deleted after processing; the first frame of animations;
  - HEIC is unsupported (iOS converts to JPEG on upload); metadata is stripped.

  Mark D-008 "Accepted (M2b; details in D-045)".
- [ ] **Step 4: Run** `pnpm db:test`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(db): upload and asset buckets with workspace-scoped storage policies`.

---

### Task 10: Image processing route

**Files:**
- Create:
  - Asset core: `lib/assets/limits.ts`, `lib/assets/process.ts` (+test), `lib/assets/upload.ts` (+test), `lib/assets/asset-store.ts`.
  - HTTP: `lib/http/json-request.ts` (+test), `app/api/assets/route.ts` (+`route.test.ts`).
  - E2e: `tests/e2e/app/assets-api.spec.ts`.
- Modify: `app/api/pages/[pageId]/draft/route.ts` (+test; M8), `package.json`, `pnpm-lock.yaml`

**Interfaces:**
- Consumes: the buckets and policies (Task 9); `getApiUser`, `getWorkspaceId`, `createSupabaseServerClient`.
- Produces:

```ts
// lib/assets/limits.ts (no server imports; the client uses it too)
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_INPUT_PIXELS = 40_000_000;
export const VARIANT_WIDTHS = [1600, 800] as const;
export const WEBP_QUALITY = 80;
export const UPLOAD_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' } as const;
export const variantPath = (assetPath: string, width: (typeof VARIANT_WIDTHS)[number]) => `${assetPath}-${width}.webp`;
// lib/assets/process.ts ('server-only'; sharp)
export class ImageRejected extends Error { constructor(readonly reason: 'unsupported' | 'too_large') }
export interface Variant { width: number; height: number; data: Uint8Array }
export function processImage(input: Uint8Array): Promise<{ large: Variant; small: Variant }>;
// lib/assets/upload.ts
export interface AssetStore {
  download(path: string): Promise<Uint8Array | null>;          // uploads bucket
  removeUpload(path: string): Promise<void>;
  putVariant(path: string, data: Uint8Array): Promise<void>;   // assets bucket, image/webp, cache 1 year
  insertAsset(row: { id: string; workspace_id: string; path: string; mime: 'image/webp'; width: number; height: number; size: number }): Promise<void>;
  publicUrl(path: string): string;
}
export type ProcessUploadResult =
  | { status: 201; body: { assetId: string; src: string; width: number; height: number } }
  | { status: 400; body: { error: 'bad_path' } } | { status: 403; body: { error: 'forbidden' } }
  | { status: 404; body: { error: 'not_found' } } | { status: 413; body: { error: 'too_large'; reason: 'bytes' | 'pixels' } }
  | { status: 415; body: { error: 'unsupported' } };
export function processUpload(store: AssetStore, input: { workspaceId: string; path: string; newId(): string },
  process?: typeof processImage): Promise<ProcessUploadResult>;
// lib/http/json-request.ts
/** JSON media type (415), same Origin (403), body ≤ maxBytes, streamed with a cap (413), readable (400). */
export function readJsonRequest(request: Request, maxBytes: number): Promise<{ ok: true; text: string } | { ok: false; response: Response }>;
```

**Rules:**
- **`processImage`:**
  - `sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })`. Accepted formats are jpeg, png, webp, gif and heif (AVIF); anything else, SVG included, is `unsupported`.
  - Then `.rotate()` (EXIF orientation), `.resize({ width, withoutEnlargement: true })` and `.webp({ quality: 80 })` per variant.
  - A pixel-limit error → `too_large`; any other decode error → `unsupported`.
- **`processUpload`:**
  - The path must match `^<uuid>/<uuid>\.(jpg|png|webp|gif|avif)$` (400), and its first folder must equal `workspaceId` (403).
  - A missing upload → 404; over `MAX_UPLOAD_BYTES` → 413 `bytes`.
  - On success: put the variants at `variantPath('<ws>/<assetId>', w)`, insert the row (path `<ws>/<assetId>`, the 1600 variant's width, height and byte size), and answer `src` as the 1600 variant's public URL.
  - The original is removed in every outcome after the download, failures included.
- **`POST /api/assets` body `{ path }`:**
  - `getApiUser` (401), then `readJsonRequest(request, 4096)`.
  - Then `processUpload(createSupabaseAssetStore(client), { workspaceId: await getWorkspaceId(client), path, newId: crypto.randomUUID })`.
- **M8:** the draft route uses `readJsonRequest(request, MAX_DRAFT_BYTES)` in place of its own checks and `request.text()`.

- [ ] **Step 1: Write the failing tests:**

```ts
// process.test.ts (inputs generated with sharp)
it('a 3000×2000 JPEG becomes 1600×1067 and 800×533 WebP', ...);           // sharp(out).metadata(): format 'webp'
it('small images are never enlarged', ...);                               // 600×400 PNG → both 600×400
it('EXIF orientation is applied', ...);                                   // 400×300 tagged orientation 6 → 300×400
it('transparency survives', ...);                                         // RGBA PNG → hasAlpha
it('GIF and AVIF inputs are accepted', ...);
it('rejects bytes that are not an image, SVG and images over 40 megapixels', ...); // Review Focus 5; a PNG header claiming 10000×10000 (IHDR built with zlib.crc32) → too_large
// upload.test.ts (memory AssetStore, stub processImage)
it('processes an upload into two variants and an assets row, and removes the original', ...);
it('rejects malformed paths (400) and other workspaces (403) without touching storage', ...);
it('a missing upload answers 404', ...);
it('oversized and unreadable originals are rejected and removed', ...);  // Review Focus 5: 413 bytes, 415; removeUpload called
it('when storing a variant fails the original is still removed and the error propagates', ...);
// json-request.test.ts
it.each(['text/plain → 415', 'foreign Origin → 403', 'content-length over the cap → 413', 'a chunked body over the cap → 413', 'an erroring body stream → 400'])(...);
// app/api/assets/route.test.ts: 401 without a session; the result's status and body pass through
// tests/e2e/app/assets-api.spec.ts: the admin client uploads a generated 2400×1600 JPEG to uploads/<ws>/<uuid>.jpg;
//   page.request.post('/api/assets', { data: { path } }) → 201; GET src → image/webp 1600×1067;
//   the assets row exists; the upload is gone; another workspace's path → 403
```

- [ ] **Step 2: Run** `pnpm exec vitest run lib/assets lib/http app/api` and `assets-api.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement:**
  - Run `pnpm add sharp@0.35.5 --save-exact`.
  - Check `node -e "require('sharp')"` loads, and that `pnpm-workspace.yaml` still has `sharp: false`.
  - Write the modules, the Supabase store (the user's server client; `upload(path, data, { contentType: 'image/webp', cacheControl: '31536000', upsert: false })`) and the route.
  - Move the draft route onto `readJsonRequest`.
- [ ] **Step 4: Run** the unit tests, `assets-api.spec.ts`, `draft-api.spec.ts` and `pnpm test`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(assets): process uploads into WebP variants with sharp; capped JSON request reading`.

---

### Task 11: Upload in the image control

**Files:**
- Create: `lib/assets/client.ts`, `lib/assets/client.test.ts`, `tests/e2e/app/editor-upload.spec.ts`
- Modify:
  - Image control: `components/editor/inspector/controls/image-control.tsx`.
  - Editor plumbing: `components/editor/editor-context.tsx` (`useWorkspaceId`), `components/editor/editor.tsx`, `app/(editor)/editor/[pageId]/page.tsx`.
  - Draft sender (M4): `lib/editor/draft-sender.ts`, `lib/editor/draft-sender.test.ts`.

**Interfaces:**
- Consumes: `limits.ts`, `POST /api/assets` (Task 10); `createSupabaseBrowserClient`.
- Produces:

```ts
export interface UploadDeps {
  workspaceId: string;
  upload(path: string, file: Blob, contentType: string): Promise<{ ok: boolean }>;   // storage.from('uploads').upload(..., { upsert: false })
  fetch: typeof fetch;
  newId(): string;
}
export type UploadResult =
  | { ok: true; image: { src: string; width: number; height: number; assetId: string } }
  | { ok: false; message: string };
export function uploadImage(file: File, deps: UploadDeps): Promise<UploadResult>;
```

**Rules:**
- **Checks before uploading:** type in `UPLOAD_TYPES`, else "Choose a JPEG, PNG, WebP, GIF or AVIF image."; size ≤ 10 MiB, else "This image is larger than 10 MB.".
- **Upload:** the path is `<workspaceId>/<newId()>.<ext>`. A failed storage upload or network error → "The upload failed. Check your connection and try again.".
- **Route answers:**
  - 413 `pixels` → "This image is too large to process (over 40 megapixels)."; 413 `bytes` → the size message.
  - 415 → "This file isn't an image LaunchPad can read."; any other status → "The image couldn't be processed (HTTP <status>).".
  - A 201 whose body lacks a string `src`, positive integer `width`/`height` and a string `assetId` counts as a failure (M4).
- **M4 (draft sender):** a 200 or 409 whose `revision` is not a non-negative integer returns `{ kind: 'network' }`.

**UI contract:**
- The image fieldset gets a button "Upload image" that opens a hidden `<input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif">`.
- **Image absent:** with an optional image absent, "Upload image" sits next to "Add image" and creates the image object.
- **Uploading:** shows "Uploading…" (`role="status"`) and disables the button.
- **Success:** dispatches one `setBlockProp` for the whole image, keeping its `alt`, so one undo restores the previous image.
- **Errors:** shown under the button in the field-error style.

- [ ] **Step 1: Write the failing tests:**
  - `client.test.ts`:
    - `uploads the original under the workspace folder and returns the processed image`;
    - `refuses wrong types and files over 10 MiB before uploading`;
    - `maps route errors to messages`;
    - `a malformed success response is a failure`.
  - `draft-sender.test.ts`: `a 200 or 409 without a valid revision counts as a network failure`.
  - E2e:
    - `uploading a JPEG replaces the hero image with its 1600 px WebP`. `setInputFiles` gets a generated 2400×1600 JPEG. The canvas hero `img` `src` matches `/\/storage\/v1\/object\/public\/assets\/[0-9a-f-]{36}\/[0-9a-f-]{36}-1600\.webp$/`, with `width="1600"` and `height="1067"`. The alt is unchanged, the workspace's `uploads` folder is empty (admin client), and Undo restores the old `src`.
    - `a file that is not an image shows an error and changes nothing` (Review Focus 5). A `notes.txt` with `text/plain` shows "Choose a JPEG, PNG, WebP, GIF or AVIF image."; Undo stays disabled.
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement.** The editor page fetches `getWorkspaceId` and passes `workspaceId` through `Editor` to `EditorProvider`.
- [ ] **Step 4: Run** the unit tests, `editor-upload.spec.ts` and the app suite. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(inspector): upload images from the image control`.

---

### Task 12: M2 exit journey, spike removal and docs

**Files:**
- Modify:
  - Tests: `tests/e2e/app/editor-journey.spec.ts`.
  - Docs: `CLAUDE.md`, `docs/PLAN.md`, `docs/DECISIONS.md`.
- Delete: `spikes/`

- [ ] **Step 1: Write the exit test** next to the M2a journey (which stays). It keeps the M2a `state()`/`steps` pattern and adds the carousel heading (`.lp-h2`) to the captured state:

```ts
test('M2 exit: add by drag, edit inline and in the inspector, reorder items and blocks by drag, undo/redo all, reload', async ({ page }) => {
  // New page "Exit" → drag Hero from the palette into the empty canvas → step
  // drag Product Carousel to the bottom 10% of the hero section → step
  // dblclick the hero headline, ControlOrMeta+A, type 'Botol anti bocor', Escape → step
  // select the carousel; inspector Heading (exact) fill 'Pilih warnamu' → step
  // drag item 3's 'Drag to reorder' above item 1 → step
  // drag the carousel's 'Drag to move' to the top 10% of the hero section → step
  // Undo back through every step, Redo forward through every step, expect.poll(state) at each
  // 'Saved' → reload → state equals the last step
});
```

- [ ] **Step 2: Run** `editor-journey.spec.ts`. Expected: PASS (it is the exit gate, not a red step). If it fails, fix the owning task's code.
- [ ] **Step 3: Remove** `spikes/` (D-034 already says so). Update the docs:
  - **`CLAUDE.md`:**
    - The `render.ts` bullet in "How to add a block": mark each text or rich field rendered as an element's whole content with `ctx.field(path, kind)`, and CTA labels with `renderCta(…, { field })`. The registry test checks the markers (D-044).
    - Rules: "Storage objects live under `<workspaceId>/`; policies use `public.is_workspace_member(public.workspace_from_path(name))` (D-045)".
    - Rules: "The drag engine is pure in `lib/editor/dnd/` (geometry, controller); drops are `insertBlockAt`/`moveBlockTo` commands (D-043)".
  - **`docs/PLAN.md`:**
    - §5 M2: the dashboard bullet says drafts use a revision counter (D-035) instead of "optimistic concurrency on `updated_at`" (M9).
    - §10: M2b "Done", plus a row "M3 Export + tracking" "Next".
  - **`docs/DECISIONS.md`:** remove the double blank line before D-040 (M9).
- [ ] **Step 4: Run the full gate:** `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm assets:check && pnpm build && pnpm db:test && pnpm test:e2e && pnpm test:e2e:app`. Expected: every command exits 0, and `editor-perf.spec.ts` still reports p95 < 100 ms.
- [ ] **Step 5: Commit:** `test(e2e): M2 exit journey by drag and inline editing; remove the canvas spike`.

---

## After M2b

M3 (Export + tracking) gets its own plan once this branch is merged. It starts from:
- the WebP variants (Portable mode inlines `-1600.webp` and can use `-800.webp`);
- the pre-export checklist;
- the still-deferred minors: M3 (unload flush during an in-flight save) and the M0/M1 m-6 composite foreign key.
