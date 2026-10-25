# M4a Remaining Blocks + Carousel Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The block library is complete for v1. It adds Spacer/Divider, Image + text, Logos strip, Gallery, Pricing/offer, Countdown, Video (also as Hero media), Sticky mobile CTA, Cookie banner and Custom HTML. Custom HTML is sanitized, its scripts are sandboxed in the canvas and opt-in in export. The Product Carousel gains autoplay, bulk paste, per-carousel tracking events and JSON-LD. The canvas channel is hardened, so untrusted code can never edit the page.

**Architecture:**
- **Every block follows the CLAUDE.md recipe:** a folder, one registry line, generated inspector. Two schema additions keep the inspectors usable without custom React:
  - `when()` metadata hides a field unless a sibling has one of the listed values.
  - `datetime()` is a deadline control.
- **Floating blocks** (Sticky CTA, Cookie banner) are ordinary blocks in ordinary sections. Their own stylesheet fixes them to the viewport and collapses their band with `:has()`, so the renderer and drag-and-drop need no new cases.
- **Custom HTML never runs in the canvas window.** In preview it renders inside a nested `<iframe sandbox="allow-scripts" srcdoc>`: a second opaque origin that can't read the canvas DOM or its channel id. In export it is sanitized by a parse5 default-deny sanitizer (`lib/sanitize/html.ts`, reused by M6 import), or emitted verbatim when the owner turns on "Run scripts", and the checklist names it.
- **Carousel tracking** reuses the page runtime. Card CTAs carry `data-lp-event` plus JSON `data-lp-params` (Meta) and `data-lp-ga` (GA4/GTM), computed by the pure renderer. The runtime sends each to its vendor with one event id.

**Tech Stack:** Next.js 16.4.2, React 19.3, TypeScript 5 (strict), Zustand 5.0.15, Immer 11.1.21, Zod 4.6.7, esbuild 0.28.2, Vitest 5.0.5 (+ happy-dom), Playwright 1.64.1, html-validate 11. **New dependency:** `parse5@8.0.1` (exact pin; listed in Plan §7 for M6, moved forward; published 2026-04-19).

**Spec:**
- `docs/PRD.md` §6.2 (palette), §6.3 (block library), §6.4.1 (carousel: bulk add, autoplay, tracking, JSON-LD), §6.6 (cookie banner), §8 (inline JS ≤ ~10 KB, security, accessibility), §11 AC4, AC5, AC8.
- `docs/PLAN.md` §2.10, §3 (R6), §5 M4 (blocks and carousel polish).
- `docs/DECISIONS.md`: D-009, D-010, D-012, D-013, D-016, D-018, D-019, D-033, D-039, D-040, D-044, D-046, D-047.
- The M4b plan (written when M4a merges) covers the rest of M4: duplicate, templates, presets, tags/search/filter/archive, the M3 export and data minors, and the AC1–AC9 acceptance review.

## Before Task 1

- Start Docker Desktop (`docker info` must succeed), then `pnpm db:start`. App e2e tests need it; no migration in M4a.
- Create the branch in place: `git switch -c feat/m4a-blocks-carousel`.
- Link this plan from `docs/PLAN.md`:
  - The header's plan list and §5 M4 get "[M4a plan](superpowers/plans/2026-10-25-m4a-blocks-carousel.md)", with the note "M4b (workflow and acceptance) is written when M4a merges".
  - §10 gets an M4a row ("In progress") and an M4b row ("Written when M4a merges").
- Commit: `docs: add M4a blocks and carousel plan`.

## Global Constraints

- **Node 24 on every command:** prefix `pnpm`/`node` with `export PATH="$HOME/.nvm/versions/node/v24.22.1/bin:$PATH";`.
- **Next.js 16:** read the relevant guide in `node_modules/next/dist/docs/` before using an API.
- **Block recipe** (CLAUDE.md "How to add a block") applies to every new block:
  - `text()`/`rich()` for user strings, `code()` for raw owner code; list items have an `id`; `.prefault({})` for nested objects.
  - Markup only through the `html` tag; `ctx.field` markers on every whole-element text/rich field; classes `lp-<type>`.
  - CSS is mobile-first with breakpoints 640 px / 1024 px, and a surface that paints its own background resets `--lp-fg` (D-033).
  - Defaults never invent social proof (`[REPLACE: …]`).
  - Each block has a test file with: schema edge cases, "renders valid HTML with only required fields", behavior assertions and an `.html` file snapshot. Then `pnpm assets`, and one line in `BLOCKS`.
- **Renderer purity:** no `Date`, `Math.random`, `Intl` or I/O in `lib/renderer`, `lib/blocks`, `lib/tracking/*.ts` or `lib/sanitize`. Same document → same bytes. Clocks are read only by snippets in the browser and by the checklist, which receives `now` as an argument.
- **Snippets** (vanilla ES2017, no globals, scoped to their `[data-lp-<type>]` root, idempotent via `data-lp-ready`, honor `prefers-reduced-motion`):
  - A snippet that keeps a timer stops it once its root is no longer connected (`!root.isConnected`), because the canvas replaces block elements on patches.
  - In the canvas (`root.closest('[data-lp-block]')`), nothing moves or hides on its own: no autoplay, no scroll-reveal, and countdowns and banners stay visible.
- **Byte budgets (minified, UTF-8), enforced by tests:**

  | Script | Budget | Change |
  |---|---|---|
  | Carousel snippet | ≤ 2048 | from 1536 (D-054) |
  | Page runtime `lib/tracking/snippet.js` | ≤ 2304 | from 2048 (D-054) |
  | Countdown | ≤ 1024 | new |
  | Video | ≤ 768 | new |
  | Sticky CTA | ≤ 512 | new |
  | Cookie banner | ≤ 512 | new |
  | Canvas runtime | ≤ 10,240 | unchanged |

  A page using every snippet ships ≤ 10,240 bytes of inline JS (PRD §8).
- **Preview carries no third-party code** (Plan §2.10, D-047): no video iframe, no Custom HTML in the canvas window, no vendor tags. Video and Custom HTML are tested in exported files.
- **Exact values:**
  - **Custom HTML:** code ≤ 50,000 characters. The canvas frame height is clamped to 20–4000 px.
  - **Countdown:** `endsAt` is `YYYY-MM-DDTHH:MM` and must be a real date. `utcOffset` ∈ `+07:00` (WIB), `+08:00` (WITA), `+09:00` (WIT), `+00:00` (UTC); default `+07:00`.
  - **Autoplay:** 2–15 s, default 5.
  - **Video:** YouTube ids `[A-Za-z0-9_-]{11}`, Vimeo ids `\d{6,12}`.
  - **Bulk paste:** columns in order `title, price, compare-at price, image URL, link`; it adds at most as many rows as the carousel's 50-item limit leaves room for.
- **Dependencies:** only `parse5@8.0.1` is added (exact). The dependency-policy test stays green.
- **Tests:**
  - Unit tests sit next to the code.
  - Snippets are unit-tested in happy-dom by evaluating `asset.src`. Browser behavior is tested from `file://` in `tests/e2e/renderer/` (Playwright `page.clock` for timers, `page.route` stubs for YouTube/Vimeo).
  - Editor UI is tested in `tests/e2e/app/` (serial, one owner account, pages reset).
- **Editor UI copy** is English, sentence case, with labels in `lib/editor/inspector/labels.ts`. Exported-page strings go through `lib/renderer/i18n.ts` (id and en).
- **Commits:** small conventional commits ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Before committing, run `pnpm format`, then `pnpm assets` after touching any `styles.css`, `snippet.js` or `*.bundle.ts`.

## Review Focus

Inputs the spec implies that feature tests would not naturally hit, most likely first. Each is pinned by the named test.

1. **Rows pasted from Google Sheets or Excel:**
   - Input: TSV with a header row, Indonesian prices (`Rp149.000`, `149.000`), quoted cells holding commas or line breaks, blank trailing lines, a row without a title, and more rows than the carousel has room for.
   - Expected: the header is skipped, prices parse by the page currency, bad rows are skipped and reported by row number, rows past the limit are reported, and everything added is one undo step.
   - Test: `parses a Sheets paste with a header, Rp prices, quoted cells and bad rows` (Task 16).
2. **Custom HTML pasted with scripts while "Run scripts" is off**, or with `onerror`, `javascript:` links, `<iframe>`, `<style>` with `@import`, `<form>`, or broken markup.
   - Expected: the export has no script, handler, frame, form or `javascript:` URL; the markup that remains is well-formed.
   - With "Run scripts" on, the code is verbatim and the checklist names the block.
   - In the canvas, the code's scripts never run in the canvas window.
   - Tests: `removes scripts, handlers, frames, forms and unsafe URLs` (Task 11), `a Custom HTML script cannot edit the page or reach the canvas` (Task 13).
3. **A countdown whose deadline has passed, or a visitor in another time zone.**
   - Expected: the deadline means the owner's chosen offset for every visitor. A passed deadline shows the end state as soon as the page loads, never negative numbers or a flash of the timer. An impossible date (`2026-02-30T10:00`) is rejected by the schema. The checklist warns before exporting a countdown that has ended.
   - Tests: `a visitor in New York sees the same remaining time as one in Jakarta` and `an ended countdown loads in its end state` (Task 7).
4. **Video URLs as people copy them:** `youtu.be/<id>?si=…`, `m.youtube.com/watch?v=<id>&t=30s`, `youtube.com/shorts/<id>`, `vimeo.com/<id>#t=10`, and a non-video URL.
   - Expected: each one either parses or shows "Video address missing", and no player request is made before the click.
   - Test: `parses the URL forms people paste and rejects others` (Task 8) and `no player request before the click` (Task 8 e2e).
5. **A visitor who touches an autoplaying carousel**, a hidden tab, or reduced motion.
   - Expected: autoplay stops for good after the visitor swipes, clicks or presses a key in the carousel. It pauses while hovered, focused or off-screen, never runs with reduced motion, and the pause button toggles it with a correct label.
   - Test: `autoplay stops after a swipe and never runs with reduced motion` (Task 14).

## Folded-in deferred minors

- **M0/M1:**
  - m-3 (two fast "next" clicks advance one card; desktop dots past the last scroll position) → Task 14.
  - m-4 (an empty carousel track keeps `tabindex="0"`) → Task 14.
  - m-5 (two `fetchpriority="high"` images in the first section) → Task 2.
- **M2a M4** (canvas channel: `error` rebuilds unthrottled; a second iframe `load` isn't treated as navigation) → Task 13.
- **M2b:**
  - M3 (edits accepted for any field at any time; untrusted scripts in the canvas window) → Tasks 12, 13.
  - M13 (an edit can carry ~4M nodes) → Task 13.
- **M3:**
  - The canvas flash after Escape ends inline editing → Task 13.
  - Ruling "Form Embed inspector shows both modes' fields" → Task 1.
- **Still deferred to M4b:** M3 export-dialog items (M-1…M-4, M-11, singular copy), data items (M-5…M-10), M-12…M-14. **To M7:** M2b a11y items (M2, M7, M9) and the remaining M2b list per its memory note.

---

### Task 1: Conditional inspector fields and the Utility category

**Files:**
- Modify: `lib/schema/primitives.ts`, `lib/schema/primitives.test.ts`, `lib/editor/inspector/fields.ts`, `lib/editor/inspector/fields.test.ts`, `components/editor/inspector/field-list.tsx`, `lib/blocks/types.ts`, `components/editor/palette.tsx`, `lib/blocks/form-embed/schema.ts`
- Test: `tests/e2e/app/editor-inspector.spec.ts`

**Interfaces:**
- Produces:

```ts
// lib/schema/primitives.ts
export interface ShowWhen { key: string; in: readonly (string | boolean)[] }
/** Shows the field in the inspector only while sibling `key` has one of `values` (inspector-only metadata). */
export function when<T extends z.ZodType>(schema: T, key: string, values: readonly (string | boolean)[]): T;
// lib/editor/inspector/fields.ts — BaseSpec gains:
showWhen?: ShowWhen;
export function isFieldShown(spec: FieldSpec, siblings: Record<string, unknown> | undefined): boolean;
// lib/blocks/types.ts
export type BlockCategory = 'content' | 'conversion' | 'special' | 'utility';
```

**Rules:**
- `when()` merges `{ showWhen }` into the schema's existing `meta()`; `describeFields` reads `showWhen` from the declared schema or any optional/default/prefault wrapper inside it, so `when(text(80).default(''), …)` and `when(text(80), …).default('')` both work.
- `isFieldShown` is true when there is no `showWhen`, or `siblings[key]` is in `in`. A missing sibling counts as the sibling's default (the panel passes the parsed props, so it is always present).
- `FieldList` skips hidden fields. Hidden values are kept, never cleared (switching back restores them).
- Form Embed: `url`, `height`, `title` show for `mode: 'iframe'`; `code` for `'snippet'`; `thankYouUrl` for both (the provider decides whether it applies).
- Palette groups: Content, Conversion, Special, Utility (in that order).

- [ ] **Step 1: Write the failing tests:**
  - `primitives.test.ts`: `when() keeps the control metadata and adds showWhen` (`when(text(10), 'mode', ['a']).meta()` → `{ control: 'text', showWhen: { key: 'mode', in: ['a'] } }`).
  - `fields.test.ts`:
    - `showWhen is read through default and optional wrappers`;
    - `isFieldShown follows the sibling value`;
    - `form embed hides iframe fields in snippet mode` (`describeFields(formEmbed.schema)` → `url.showWhen` is `{ key: 'mode', in: ['iframe'] }`).
- [ ] **Step 2: Run** `pnpm exec vitest run lib/schema lib/editor/inspector`. Expected: FAIL (`when` is not exported).
- [ ] **Step 3: Implement** the interfaces and rules above.
- [ ] **Step 4: Add an app e2e** to `editor-inspector.spec.ts`: `form embed shows only the fields of its mode`. Add a Form Embed: "Embed code" is visible and "Form address" isn't. Choose "Iframe": "Form address" and "Height" appear and "Embed code" disappears. Type a code, switch twice, and the code is still there.
- [ ] **Step 5: Run** `pnpm exec vitest run lib` and `pnpm test:e2e:app -g "form embed shows only"`. Expected: PASS.
- [ ] **Step 6: Commit:** `feat(inspector): show fields only while a sibling has a given value; Utility palette group`.

---

### Task 2: One high-priority image and the shared image walker (m-5)

**Files:**
- Create: `lib/schema/images.ts`, `lib/schema/images.test.ts`
- Modify: `lib/export/images.ts` (uses the shared walker), `lib/renderer/context.ts`, `lib/renderer/page.ts`, `lib/renderer/page.test.ts`, `lib/blocks/hero/render.ts`, `lib/blocks/special/product-carousel/render.ts`, `lib/blocks/test-utils.ts`

**Interfaces:**
- Produces:

```ts
// lib/schema/images.ts — the walker moved from lib/export/images.ts (control: 'image' metadata)
export interface FoundImage { path: PropPath; src: string; alt: string }
export function findImages(schema: z.ZodType, value: unknown, path?: PropPath): FoundImage[];
// lib/renderer/context.ts
RenderEnv.priorityBlockId: string | null;
RenderContext.highPriority: boolean;   // export only: this block owns the page's one fetchpriority="high"
```

**Rules:**
- `createRenderEnv` sets `priorityBlockId` to the first block of the first section with at least one image whose `src` is non-empty. `ctx.highPriority` is `mode === 'export' && block.blockId === priorityBlockId`. Preview never emits `fetchpriority`, so the canvas render cache stays position-independent.
- A block passes `highPriority: ctx.highPriority` for its first rendered image only. Hero: its image. Carousel: card 0. New blocks in later tasks do the same.
- `lib/export/images.ts` keeps `collectImages(doc)` and `ImageRef`, now built on `findImages`. Its tests stay green unchanged.
- `PropPath` moves with the walker: `lib/schema/images.ts` imports the type from `lib/editor/structure`, matching how `lib/export/images.ts` does today.

- [ ] **Step 1: Write the failing tests** in `page.test.ts`:
  - `only one image is high priority when the first section has a hero and a carousel`: one `fetchpriority="high"`, on the hero image.
  - `the carousel's first card is high priority when the hero has no image`.
  - `preview never marks fetchpriority`.
- [ ] **Step 2: Run** `pnpm exec vitest run lib/renderer lib/export lib/schema`. Expected: FAIL.
- [ ] **Step 3: Implement**. Snapshot changes are limited to `fetchpriority` in preview snapshots; review the diff, then `pnpm exec vitest run lib --update`.
- [ ] **Step 4: Run** `pnpm test`. Expected: PASS.
- [ ] **Step 5: Commit:** `fix(renderer): only the first image above the fold gets fetchpriority`.

---

### Task 3: Spacer / Divider

**Files:** Create `lib/blocks/spacer/{schema.ts,render.ts,styles.css,index.ts,spacer.test.ts}`; modify `lib/blocks/registry.ts`.

**Interfaces:** Produces block `spacer` (category `utility`, label "Spacer / Divider", icon `separator-horizontal`).

```ts
SpacerPropsSchema = z.object({
  size: z.enum(['sm', 'md', 'lg', 'xl']).default('md'),   // 16 / 32 / 64 / 96 px
  line: z.boolean().default(false),
  lineWidth: when(z.enum(['short', 'full']).default('full'), 'line', [true]),
});
```

**Rules:** Renders `<div class="lp-spacer lp-spacer--<size>" aria-hidden="true">`, plus a `<hr class="lp-spacer__line lp-spacer__line--<lineWidth>">` when `line`. A short line is 64 px wide and centered. The line color is `var(--lp-border)`, falling back to `currentColor` at 20% opacity on dark tones. No text fields, no snippet.

- [ ] **Step 1: Write the failing tests** in `spacer.test.ts`:
  - `renders only a spacer by default`;
  - `adds a short line when asked`;
  - `renders valid HTML with only required fields`;
  - `matches the snapshot`.
- [ ] **Step 2: Run** `pnpm exec vitest run lib/blocks/spacer`. Expected: FAIL.
- [ ] **Step 3: Implement**, `pnpm assets`, register.
- [ ] **Step 4: Run** `pnpm test`. Expected: PASS, including the registry-wide tests.
- [ ] **Step 5: Commit:** `feat(blocks): Spacer / Divider`.

---

### Task 4: Image + text

**Files:** Create `lib/blocks/image-text/{schema.ts,render.ts,styles.css,index.ts,image-text.test.ts}`; modify `lib/blocks/registry.ts`, `lib/editor/inspector/labels.ts`.

**Interfaces:** Block `image-text` (category `content`, label "Image + text", icon `panels-top-left`).

```ts
ImageTextPropsSchema = z.object({
  eyebrow: text(80).default(''),
  heading: rich(200, 1),
  body: rich(2000).default(''),
  points: z.array(z.object({ id: IdSchema, text: text(160, 1) })).max(8).default([]),
  cta: CtaSchema.optional(),
  image: ImageSchema.prefault({}),
  imageSide: z.enum(['left', 'right']).default('left'),
  aspectRatio: AspectRatioSchema.default('4:5'),
});
```

**Rules:**
- Mobile: the image stacks above the text whatever `imageSide` is. From 640 px the layout is two columns, with the image on `imageSide`.
- `points` render as a `<ul>` with the `check` icon.
- The heading is `h2` (never the page's h1).
- `highPriority` on the image (Task 2); `eager` when above the fold.
- Default props: heading "Why it works", body "[REPLACE: explain the benefit in two or three sentences]", 3 points "[REPLACE: point]", no CTA.

- [ ] **Step 1: Write the failing tests:**
  - `puts the image first in the markup and flips it with a class`;
  - `marks heading, body and points for inline editing`;
  - `renders valid HTML with only required fields`;
  - `matches the snapshot`.
- [ ] **Step 2: Run** `pnpm exec vitest run lib/blocks/image-text`. Expected: FAIL.
- [ ] **Step 3: Implement**, `pnpm assets`, register, and add the label `imageSide: 'Image side'`.
- [ ] **Step 4: Run** `pnpm test`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(blocks): Image + text`.

---

### Task 5: Logos strip and Gallery

**Files:** Create `lib/blocks/logos/…` and `lib/blocks/gallery/…` (each: `schema.ts`, `render.ts`, `styles.css`, `index.ts`, `<type>.test.ts`); modify `lib/blocks/registry.ts`, `lib/editor/inspector/labels.ts`.

**Interfaces:**

```ts
// logos — category content, label "Logos strip", icon 'award'
LogosPropsSchema = z.object({
  heading: text(120).default(''),
  items: z.array(z.object({ id: IdSchema, image: ImageSchema.prefault({}) })).max(24).default([]),
  height: z.enum(['sm', 'md', 'lg']).default('md'),     // 24 / 32 / 48 px tall
  grayscale: z.boolean().default(true),
});
// gallery — category content, label "Gallery", icon 'images'
GalleryPropsSchema = z.object({
  heading: rich(160).default(''),
  subheading: rich(300).default(''),
  items: z.array(z.object({ id: IdSchema, image: ImageSchema.prefault({}), caption: text(160).default('') })).max(24).default([]),
  columns: z.object({ mobile: z.union([z.literal(1), z.literal(2)]).default(2), desktop: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3) }).prefault({}),
  aspectRatio: AspectRatioSchema.default('1:1'),
  imageFit: z.enum(['cover', 'contain']).default('cover'),
});
```

**Rules:**
- **Logos:**
  - A centered, wrapping flex row. Each `img` gets `height: var(--lp-logo-h); width: auto`.
  - Grayscale is `filter: grayscale(1)` at 0.7 opacity, full color on hover.
  - With no heading the strip is a `<ul aria-label>` using the i18n key `logos` ("Logo" / "Logos").
  - Defaults: heading `[REPLACE: As seen in]`, and 4 items with an empty `src` and alt `[REPLACE: brand name]`, so no brand is invented.
- **Gallery:**
  - A CSS grid with `--lp-cols-m` / `--lp-cols-d` (from 1024 px).
  - Each item is a `<figure>`, with `<figcaption>` only when a caption is set.
  - Images are lazy except in the first section. Card 0 takes `highPriority`.
  - Defaults: heading "See it up close", and 3 items with an empty `src` and empty captions.
- Both register their images through `control: 'image'`, so Portable export inlines them (D-046) with no export change. A test asserts `collectImages` finds them.

- [ ] **Step 1: Write the failing tests:**
  - **logos:**
    - `renders a list of logo images at the chosen height`;
    - `defaults invent no brand` (every default alt matches `/^\[REPLACE:/`);
    - `renders valid HTML with only required fields`;
    - the snapshot.
  - **gallery:**
    - `sets column variables and captions only when present`;
    - `collectImages finds every gallery image`;
    - `renders valid HTML with only required fields`;
    - the snapshot.
- [ ] **Step 2: Run** `pnpm exec vitest run lib/blocks/logos lib/blocks/gallery`. Expected: FAIL.
- [ ] **Step 3: Implement** both, `pnpm assets`, register, and add the labels (`grayscale: 'Grey until hovered'`, `columns: 'Columns'`).
- [ ] **Step 4: Run** `pnpm test`. Expected: PASS. If `describeFields` throws on the literal unions in `columns`, extend its literal-union handling (D-040 already lists literal unions as choices) and add a `fields.test.ts` case.
- [ ] **Step 5: Commit:** `feat(blocks): Logos strip and Gallery`.

---

### Task 6: Pricing / offer box

**Files:** Create `lib/blocks/pricing/{schema.ts,render.ts,styles.css,index.ts,pricing.test.ts}`; modify `lib/blocks/registry.ts`, `lib/editor/inspector/labels.ts`, `lib/renderer/i18n.ts`.

**Interfaces:** Block `pricing` (category `conversion`, label "Pricing / offer", icon `badge-percent`).

```ts
OfferSchema = z.object({
  id: IdSchema,
  name: text(80, 1),
  description: rich(300).default(''),
  price: z.number().min(0).max(1e12).optional(),
  compareAtPrice: z.number().min(0).max(1e12).optional(),
  showDiscount: z.boolean().default(false),
  badge: text(30).default(''),
  highlighted: z.boolean().default(false),
  features: z.array(z.object({ id: IdSchema, text: text(160, 1) })).max(12).default([]),
  cta: CtaSchema.optional(),
});
PricingPropsSchema = z.object({
  heading: rich(160).default(''),
  subheading: rich(300).default(''),
  offers: z.array(OfferSchema).min(1).max(4),
  note: text(200).default(''),    // "Free shipping across Indonesia"
});
```

**Rules:**
- Each offer is a card (`--lp-fg` reset, D-033) with `<h3>` name, badge, price block (same markup and `formatPrice`/`discountPercent` as the carousel, with the `originalPrice` screen-reader text), features `<ul>` with the `check` icon, and a full-width CTA via `renderCta(…, { field: 'offers.<i>.cta.label' })`.
- Layout: one column on mobile, `min(offers, 3)` columns from 1024 px. A `highlighted` card gets `lp-pricing__offer--hl`, with an accent border and the badge on top.
- An offer without `price` shows no price row. Defaults: 1 offer named "[REPLACE: package name]", 3 features "[REPLACE: what's included]", CTA "Order now" to the default link, no price, so nothing is invented.

- [ ] **Step 1: Write the failing tests:**
  - `formats prices in the page currency with a discount badge`;
  - `rejects zero and five offers`;
  - `an offer without a price shows no price row`;
  - `marks names, features and CTA labels`;
  - `renders valid HTML with only required fields`;
  - the snapshot (2 offers, one highlighted, IDR).
- [ ] **Step 2: Run** `pnpm exec vitest run lib/blocks/pricing`. Expected: FAIL.
- [ ] **Step 3: Implement**, `pnpm assets`, register, and add labels (`highlighted: 'Highlight this offer'`, `offers: 'Offers'`, `note: 'Note under the offers'`).
- [ ] **Step 4: Run** `pnpm test`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(blocks): Pricing / offer box`.

---

### Task 7: Countdown and the deadline control

**Files:**
- Create: `lib/blocks/countdown/{schema.ts,render.ts,styles.css,snippet.js,index.ts,countdown.test.ts}`, `components/editor/inspector/controls/datetime-control.tsx`, `tests/e2e/renderer/countdown.spec.ts`
- Modify: `lib/schema/primitives.ts` (`datetime()`), `lib/editor/inspector/fields.ts` (`DateTimeSpec`), `components/editor/inspector/field-list.tsx`, `lib/export/checklist.ts` (+ test, `ChecklistInput.now`), `components/editor/export/export-dialog.tsx` (passes `now: new Date()`), `lib/renderer/i18n.ts`, `lib/blocks/registry.ts`, `lib/editor/inspector/labels.ts`

**Interfaces:**

```ts
// lib/schema/primitives.ts
/** 'YYYY-MM-DDTHH:MM' wall-clock time, '' for unset; rejects impossible dates. Inspector: datetime-local. */
export function datetime(): z.ZodString;      // meta { control: 'datetime' }
export const UTC_OFFSETS = ['+07:00', '+08:00', '+09:00', '+00:00'] as const;
// lib/blocks/countdown/schema.ts — block 'countdown', category conversion, label "Countdown", icon 'timer'
CountdownPropsSchema = z.object({
  heading: rich(160).default(''),
  endsAt: datetime().default(''),
  utcOffset: z.enum(UTC_OFFSETS).default('+07:00'),
  onEnd: z.enum(['hide', 'message']).default('message'),
  endedText: when(text(160).default(''), 'onEnd', ['message']),
  showDays: z.boolean().default(true),
});
// lib/blocks/countdown/schema.ts
export function countdownEndMs(props: CountdownProps): number | null;   // pure: parses endsAt + offset; no Date
// lib/export/checklist.ts — ChecklistInput gains:
now: Date;
```

**Rules (D-051):**
- **Fixed deadlines only:**
  - There is no per-visitor "evergreen" timer. A timer that restarts for every visitor states an urgency that isn't real, which Meta and Google ad policies treat as misleading.
  - The deadline is a wall-clock time in the chosen offset, so it is the same instant for every visitor.
  - `countdownEndMs` computes it arithmetically (days from civil date, no `Date`), so it can run in the renderer and its tests.
- **Markup:**
  - The root is `<div class="lp-countdown" data-lp-countdown data-end="<ms>" data-on-end="<hide|message>" role="timer" aria-live="off">`, with the heading, then four units: days (omitted when `showDays` is off; hours then carry the full count), hours, minutes, seconds.
  - Each unit is `<span class="lp-countdown__n" data-u="d|h|m|s">--</span>` with its label from i18n (`days`, `hours`, `minutes`, `seconds`: id "Hari", "Jam", "Menit", "Detik").
  - The ended message is `<p class="lp-countdown__end" hidden>` holding `endedText` or the i18n `offerEnded` ("Promo telah berakhir" / "This offer has ended").
- **Without a deadline:**
  - Export renders nothing.
  - Preview renders the root with "Set an end date in the inspector" (`lp-countdown__hint`, a preview-only element).
- **Snippet (≤ 1024 bytes):**
  - Ticks every second, aligned to the next whole second. Shows two-digit units.
  - When the time is ≤ 0, shows the message, or sets `hidden` on the block's root `.lp-b` wrapper when `data-on-end="hide"`. It does this already at load, before the first paint it controls.
  - In the canvas it never hides; it shows zeros and the message.
  - Stops when `!root.isConnected`.
- **Checklist** (`now` from the dialog): `countdownEnded` ("A countdown has already ended.") for a block with a deadline ≤ `now`; `countdownUnset` ("A countdown has no end date.") for an empty `endsAt`. Both list the `blockIds`.
- **Datetime control:** `<input type="datetime-local" step="60">` bound to the string. Clearing it sets `''`.

- [ ] **Step 1: Write the failing unit tests:**
  - `countdown.test.ts`:
    - `countdownEndMs("2026-11-01T00:00", "+07:00") is 1793466000000`;
    - `rejects 2026-02-30T10:00 and 24:00`;
    - `renders nothing in export without a deadline`;
    - `renders the units and the hidden end message`;
    - `snippet: an ended countdown shows its message at once; hide mode hides the block but never in the canvas` (happy-dom with `vi.setSystemTime`);
    - `snippet stays within 1024 bytes`;
    - `renders valid HTML with only required fields`;
    - the snapshot.
  - `checklist.test.ts`: `warns about an ended and an unset countdown`.
  - `fields.test.ts`: `datetime fields describe as datetime`.
- [ ] **Step 2: Run** `pnpm exec vitest run lib/blocks/countdown lib/export lib/editor/inspector`. Expected: FAIL.
- [ ] **Step 3: Implement** the schema, render, snippet, control, checklist and dialog `now`; `pnpm assets`; register; labels (`endsAt: 'Ends at'`, `utcOffset: 'Time zone'` with option labels "WIB (UTC+7)", "WITA (UTC+8)", "WIT (UTC+9)", "UTC"; `onEnd: 'When it ends'`, options "Hide the block" / "Show a message"; `endedText: 'Message after the end'`).
- [ ] **Step 4: Write the renderer e2e tests** in `countdown.spec.ts` (`page.clock.install({ time })` before `goto`):
  - `a visitor in New York sees the same remaining time as one in Jakarta` (two contexts, `timezoneId` `America/New_York` and `Asia/Jakarta`, same clock: identical digits);
  - `ticks down each second and shows the message at zero`;
  - `an ended countdown loads in its end state` (hide mode: the block is not visible at first paint);
  - `reduced motion still updates the numbers` (no animation is involved; a guard that the snippet doesn't skip under reduced motion).
- [ ] **Step 5: Run** `pnpm test` and `pnpm test:e2e -g countdown`. Expected: PASS.
- [ ] **Step 6: Commit:** `feat(blocks): Countdown to a fixed deadline, with a deadline control and checklist warnings`.

---

### Task 8: Video embed (lazy facade) and Hero video

**Files:**
- Create: `lib/renderer/video.ts`, `lib/renderer/video.test.ts`, `lib/blocks/video/{schema.ts,render.ts,styles.css,snippet.js,index.ts,video.test.ts}`, `tests/e2e/renderer/video.spec.ts`
- Modify: `lib/blocks/hero/{schema.ts,render.ts,index.ts,hero.test.ts}`, `lib/renderer/fragments.ts` (`renderVideo`), `lib/renderer/collect.ts` (shared snippets once), `lib/renderer/i18n.ts`, `lib/blocks/registry.ts`, `lib/editor/inspector/labels.ts`

**Interfaces:**

```ts
// lib/renderer/video.ts (pure)
export type VideoRef = { provider: 'youtube'; id: string } | { provider: 'vimeo'; id: string };
export function parseVideoUrl(url: string): VideoRef | null;
export function videoEmbedUrl(ref: VideoRef): string;   // youtube-nocookie.com/embed/<id>?autoplay=1&rel=0 | player.vimeo.com/video/<id>?autoplay=1&dnt=1
export function videoWatchUrl(ref: VideoRef): string;   // https://www.youtube.com/watch?v=<id> | https://vimeo.com/<id>
export function videoPoster(ref: VideoRef): string | null; // https://i.ytimg.com/vi/<id>/hqdefault.jpg | null for Vimeo
// lib/schema/primitives.ts
export const VideoSchema = z.object({
  url: z.string().max(2048).default(''),
  title: text(120).default(''),           // the player's accessible name; '' → i18n 'video'
  poster: ImageSchema.prefault({}),        // overrides the YouTube thumbnail; needed for Vimeo
  ratio: z.enum(['16:9', '9:16', '1:1', '4:5']).default('16:9'),
});
export type Video = z.output<typeof VideoSchema>;
// lib/renderer/fragments.ts
export function renderVideo(video: Video, ctx: RenderContext, opts: { eager: boolean; highPriority: boolean }): SafeHtml;
// lib/blocks/video — block 'video', category content, label "Video", icon 'circle-play'
VideoPropsSchema = z.object({ heading: rich(160).default(''), video: VideoSchema.prefault({}), caption: text(200).default('') });
// Hero gains: video: VideoSchema.optional()  (shown instead of the image; the image becomes the poster)
```

**Rules (D-052):**
- **URL forms:** `parseVideoUrl` accepts:
  - YouTube: `youtube.com/watch?v=`, `m.youtube.com`, `youtu.be/<id>`, `/shorts/<id>`, `/embed/<id>`, `/live/<id>`, ignoring any other parameters and hashes.
  - Vimeo: `vimeo.com/<id>`, `player.vimeo.com/video/<id>`.
  - http(s) only.
- **Facade:**
  - Markup: `<a class="lp-video" href="<watch url>" target="_blank" rel="noopener" data-lp-video="<embed url>" style="--lp-ratio:<ratio>">` holding the poster `<img>` (lazy unless above the fold) and a play icon. The link's accessible name is "Play: <title>" (i18n `playVideo`).
  - Without JavaScript the link opens the video on YouTube or Vimeo.
  - Poster: the `poster` image when it has a `src`, else `videoPoster(ref)`, else a dark placeholder.
- **An unparseable or empty URL** renders the i18n `videoMissing` ("Alamat video belum diisi." / "Video address missing.") in a ratio box, in both modes.
- **Snippet** (`exportOnly`, ≤ 768 bytes): on click (not on a modified click), replaces the link with `<iframe src="<embed url>" title="<title>" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen loading="eager">` in the same ratio box and focuses it. No player request happens before the click. Shipped only when some video URL parses.
- **Sharing:** the Video block and Hero (`snippet: { asset: video snippet, isNeeded: (p) => !!p.video && parseVideoUrl(p.video.url) !== null, exportOnly: true }`) share one asset. `collectJs` now emits each distinct `GeneratedAsset` once.
- **Hero:** with a parseable `video`, the media slot renders `renderVideo` with the hero image as poster override when the video's own poster is empty; `highPriority` goes to that poster.
- **Portable export:** the `poster` field is a `control: 'image'`, so it is inlined. The derived YouTube thumbnail stays a URL; D-052 says so, and the checklist doesn't count it as a failed image.

- [ ] **Step 1: Write the failing tests:**
  - `video.test.ts` (renderer): `parses the URL forms people paste and rejects others`. It is table-driven over the forms in Review Focus 4, plus `javascript:`, `https://example.com/watch?v=abcdefghijk` and a 10-character id.
  - `video.test.ts` (block):
    - `renders a facade link that works without JavaScript`;
    - `uses the YouTube thumbnail unless a poster is set`;
    - `shows "Video address missing" for a bad URL`;
    - `snippet swaps in the player on click and ignores modified clicks` (happy-dom);
    - `snippet stays within 768 bytes`;
    - `preview never carries the snippet`;
    - valid HTML; the snapshot.
  - `hero.test.ts`:
    - `renders a video facade in the media slot with the hero image as poster`;
    - `hero and a video block ship the video snippet once`.
- [ ] **Step 2: Run** `pnpm exec vitest run lib/renderer/video lib/blocks/video lib/blocks/hero`. Expected: FAIL.
- [ ] **Step 3: Implement**, `pnpm assets`, register, labels (`ratio: 'Shape'`, `poster: 'Poster image'`).
- [ ] **Step 4: Write the renderer e2e tests** in `video.spec.ts`, with `page.route('**/*youtube-nocookie.com/**')` answering a stub page and recording requests:
  - `no player request before the click`;
  - `click loads the player in place and focuses it`;
  - `keyboard Enter on the facade loads the player`;
  - `without JavaScript the facade links to YouTube` (`javaScriptEnabled: false`: the `href` is the watch URL).
- [ ] **Step 5: Run** `pnpm test` and `pnpm test:e2e -g video`. Expected: PASS.
- [ ] **Step 6: Commit:** `feat(blocks): Video embed with a lazy facade, also as Hero media`.

---

### Task 9: Sticky mobile CTA

**Files:** Create `lib/blocks/sticky-cta/{schema.ts,render.ts,styles.css,snippet.js,index.ts,sticky-cta.test.ts}`, `tests/e2e/renderer/floating.spec.ts`; modify `lib/blocks/registry.ts`, `lib/editor/inspector/labels.ts`, `lib/editor/canvas/runtime.ts` only if the e2e below shows the canvas can't select it (see rules).

**Interfaces:** Block `sticky-cta` (category `conversion`, label "Sticky CTA bar", icon `panel-bottom`).

```ts
StickyCtaPropsSchema = z.object({
  text: text(80).default(''),
  cta: CtaSchema,
  showOn: z.enum(['mobile', 'all']).default('mobile'),
  reveal: z.enum(['always', 'afterFirstSection']).default('afterFirstSection'),
});
```

**Rules (D-050, floating blocks):**
- **Layout:**
  - The bar is `position: fixed; inset: auto 0 0 0`, with `padding-bottom: env(safe-area-inset-bottom)`, the dark tone, and a full-width CTA beside the optional text.
  - `showOn: 'mobile'` hides it from 1024 px.
  - The block's stylesheet collapses its band: `.lp-s:has(> .lp-c > .lp-b > .lp-sticky:only-child) { padding: 0 }`.
  - `body:has(.lp-sticky)` gets `padding-bottom: 72px` below 1024 px (or always, for `all`), so the bar never covers the footer.
- **Reveal:**
  - `afterFirstSection` renders the bar with `data-reveal`. CSS shows it only once the snippet adds `lp-sticky--on`.
  - The snippet (≤ 512 bytes) uses an `IntersectionObserver` on the first `.lp-s`, so the bar slides in once the first section leaves the viewport, without a transition under reduced motion.
  - Without JavaScript, `data-reveal` has no effect: CSS hides the bar only when `html.lp-js` is set, and the snippet sets that class first.
  - In the canvas the bar is always shown.
- **Canvas:** the bar's fixed box reports a rect like any block, so clicking it selects the block. If the e2e shows the rect at height 0 (fixed inside a zero-height band), the runtime measures the `.lp-b` wrapper's first child instead. Fix only if the test fails.
- **CTA:** its `event` and link go through `renderCta` with `field: 'cta.label'`. The text field is marked.

- [ ] **Step 1: Write the failing tests:**
  - `sticky-cta.test.ts`:
    - `renders a fixed bar with the CTA and optional text`;
    - `reveal mode marks the bar for the snippet`;
    - `snippet reveals the bar after the first section and never hides it in the canvas`;
    - `snippet stays within 512 bytes`;
    - valid HTML; the snapshot.
  - `floating.spec.ts`:
    - `the sticky bar appears after the first section and never covers the footer at 390 px` (scroll to the bottom: the footer's last link is not under the bar);
    - `without JavaScript the bar is always visible`.
- [ ] **Step 2: Run** `pnpm exec vitest run lib/blocks/sticky-cta`. Expected: FAIL.
- [ ] **Step 3: Implement**, `pnpm assets`, register, labels (`showOn: 'Show on'`, options "Phones only" / "All screens"; `reveal: 'Appears'`, options "Always" / "After the first section").
- [ ] **Step 4: Add an app e2e** to `editor-blocks.spec.ts`: `a sticky CTA can be added, selected and edited in the canvas`. Add it from the palette, click the bar in the canvas, check that the inspector shows "Sticky CTA bar", then double-click the label and type.
- [ ] **Step 5: Run** `pnpm test`, `pnpm test:e2e -g sticky`, `pnpm test:e2e:app -g "sticky CTA"`. Expected: PASS.
- [ ] **Step 6: Commit:** `feat(blocks): Sticky mobile CTA bar`.

---

### Task 10: Cookie banner

**Files:** Create `lib/blocks/cookie-banner/{schema.ts,render.ts,styles.css,snippet.js,index.ts,cookie-banner.test.ts}`; modify `tests/e2e/renderer/floating.spec.ts`, `lib/blocks/registry.ts`, `lib/renderer/i18n.ts`, `lib/editor/inspector/labels.ts`.

**Interfaces:** Block `cookie-banner` (category `utility`, label "Cookie banner", icon `cookie`).

```ts
CookieBannerPropsSchema = z.object({
  message: rich(400).default(''),   // '' → i18n 'cookieNotice'
  buttonLabel: text(40).default(''), // '' → i18n 'cookieOk' ("Oke" / "OK")
  privacyLink: LinkSchema.optional(),
});
```

**Rules (D-050):**
- **A notice, not a consent gate.** Tracking loads either way. D-050 says so, and that pages aimed at EU/UK visitors need a consent manager in the custom head code.
- **Markup:** `<div class="lp-cookie" data-lp-cookie role="region" aria-label="<i18n cookieRegion>" hidden>` holding the message, an optional privacy link (i18n `privacy`) and a `<button type="button">`.
- **Snippet** (≤ 512 bytes):
  - Unhides the banner unless `localStorage['lp-cookie-ok']` is `'1'`. The button sets the key, hides the banner and moves focus to `<main>` (`tabindex="-1"` set on the fly).
  - Storage errors (`file://` in some browsers, blocked storage) only lose the memory.
  - Without JavaScript the banner never shows (there is no tracking either).
  - In the canvas it always shows and the button does nothing.
- **Placement:** fixed at the bottom, above the sticky bar when both exist: `body:has(.lp-sticky) .lp-cookie { bottom: 80px }` below 1024 px. Its band collapses like the sticky bar's.

- [ ] **Step 1: Write the failing tests:**
  - `cookie-banner.test.ts`:
    - `renders hidden with the default message in the page language`;
    - `snippet shows it once and remembers the dismissal`;
    - `storage errors only lose the memory`;
    - `snippet stays within 512 bytes`;
    - valid HTML; the snapshot.
  - `floating.spec.ts`:
    - `the cookie banner sits above the sticky bar and stays dismissed after reload`;
    - `the banner's button is reachable by keyboard and focus moves to main`.
- [ ] **Step 2: Run** `pnpm exec vitest run lib/blocks/cookie-banner`. Expected: FAIL.
- [ ] **Step 3: Implement**, `pnpm assets`, register, labels (`privacyLink: 'Privacy policy link'`, `buttonLabel: 'Button label'`).
- [ ] **Step 4: Run** `pnpm test` and `pnpm test:e2e -g "cookie|sticky"`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(blocks): Cookie banner (a notice, not a consent gate)`.

---

### Task 11: Default-deny HTML sanitizer

**Files:** Create `lib/sanitize/html.ts`, `lib/sanitize/html.test.ts`; modify `package.json`, `pnpm-lock.yaml`, `docs/PLAN.md` §7 (parse5 moves to M4).

**Interfaces:**

```ts
export interface SanitizeReport { removedTags: string[]; removedAttributes: number; hadScripts: boolean }
/** Parses with parse5 (never executes), keeps only allowed tags/attributes, serializes. Pure. */
export function sanitizeHtml(input: string): { html: string; report: SanitizeReport };
/** True when the code holds a <script> element or an on* attribute (for the checklist). */
export function hasScripts(input: string): boolean;
```

**Rules (D-053):**
- **Install:** `pnpm add parse5@8.0.1 --save-exact`. Use `parseFragment` and `serialize`, walking the default tree adapter.
- **Allowed tags** (anything else is removed with its content when it is `script`, `style` (see below), `template`, `iframe`, `object`, `embed`, `frame`, `frameset`, `noscript`, `form`, `input`, `button`, `select`, `textarea`, `link`, `meta`, `base`, `svg` or `math`; any other unknown tag is unwrapped, keeping its children):
  `a abbr article aside b blockquote br caption cite code col colgroup dd del details dfn div dl dt em figcaption figure footer h1 h2 h3 h4 h5 h6 header hr i img ins kbd li mark ol p picture pre q s section small source span strong sub summary sup table tbody td tfoot th thead time tr u ul`, plus `style` (kept, see below).
- **Allowed attributes:**
  - Global: `class`, `id` (dropped when it starts with `b-` or `s-`, D-028), `title`, `lang`, `dir`, `role`, `aria-*`, `data-*` (except `data-lp-*`), `style` (dropped when it contains `url(`, `expression(`, `@import` or `\`).
  - Per tag:
    - `a`: `href` (through `sanitizeUrl(…, 'link')`), `target` (`_blank` adds `rel="noopener"`).
    - `img`/`source`: `src`, `srcset` (each URL through `sanitizeUrl(…, 'image')`), `alt`, `width`, `height`, `loading`, `decoding`, `sizes`, `media`, `type`.
    - `td`/`th`: `colspan`, `rowspan`, `scope`.
    - `ol`: `start`, `reversed`.
    - `time`: `datetime`.
    - `details`: `open`.
- **`<style>`:**
  - Kept, but its text loses every `@import` rule and any declaration containing `url(` (except `url(data:image/…)`) or `expression(`.
  - The result is escaped through `escapeInlineStyle`.
- **Deterministic:** the same input gives the same output. Comments are dropped.

- [ ] **Step 1: Write the failing tests** in `html.test.ts`:
  - `removes scripts, handlers, frames, forms and unsafe URLs`. Inputs: `<script>`, `<img src=x onerror=…>`, `<a href="javascript:…">`, `<a href="  JaVa\tscript:…">`, `<iframe>`, `<form><input></form>`, `<svg onload>`, `<object>`, `<meta http-equiv=refresh>`, `<base href>`. None survive; text content of unwrapped tags stays.
  - `keeps ordinary markup byte-stable`: a table, a list, a figure with `img srcset`, and a `details` element round-trip unchanged after one pass. Sanitizing twice equals sanitizing once.
  - `cleans style elements and attributes`: `@import`, `url(https://…)` and `expression()` are dropped, `url(data:image/png…)` is kept, and `</style><script>` can't break out.
  - `drops ids that collide with generated ones and data-lp attributes`.
  - `repairs broken markup` (`<p><b>x</p>` → well-formed; html-validate on the result inside a page reports nothing).
  - `hasScripts sees script elements and handlers, not the word script in text`.
- [ ] **Step 2: Run** `pnpm exec vitest run lib/sanitize`. Expected: FAIL.
- [ ] **Step 3: Install parse5 and implement.** Update Plan §7: move `parse5` from "(M6)" to "(M4: Custom HTML sanitizer; M6 import)".
- [ ] **Step 4: Run** `pnpm test`. Expected: PASS (the dependency-policy test included).
- [ ] **Step 5: Commit:** `feat(sanitize): default-deny HTML sanitizer on parse5`.

---

### Task 12: Custom HTML block

**Files:**
- Create: `lib/blocks/custom-html/{schema.ts,render.ts,styles.css,index.ts,custom-html.test.ts}`, `tests/e2e/renderer/custom-html.spec.ts`
- Modify: `lib/editor/canvas/runtime.ts` (+ test; frame height), `lib/export/checklist.ts` (+ test), `lib/blocks/registry.ts`, `lib/editor/inspector/labels.ts`, `lib/renderer/i18n.ts`

**Interfaces:**

```ts
// block 'custom-html', category utility, label "Custom HTML", icon 'code-xml'
CustomHtmlPropsSchema = z.object({
  code: code(50_000).default('<p>Your HTML here</p>'),
  runScripts: z.boolean().default(false),
  label: text(80).default(''),   // names the block in the checklist and the canvas frame title
});
```

**Rules (D-053):**
- **Export:**
  - `runScripts: false` emits `<div class="lp-custom">` + `sanitizeHtml(code).html`.
  - `runScripts: true` emits the code verbatim (`unsafeRaw`) inside the same wrapper.
- **Preview** never puts the code in the canvas document. It renders:
  - `<iframe class="lp-custom__frame" sandbox="allow-scripts" title="<label or i18n customHtml>" data-lp-custom-frame srcdoc="…">`.
  - The srcdoc is a full document: `themeCss(ctx.settings.theme)` + base CSS + `body{margin:0;background:transparent}`, then the sanitized or raw code (by `runScripts`), then a reporter script. The reporter posts `{ lpHeight: document.documentElement.scrollHeight }` to `parent` on load and on every `ResizeObserver` change.
  - The frame is a second opaque origin: it can't read the canvas DOM or the channel id.
- **Canvas runtime:** accepts a message whose `event.source` is the `contentWindow` of an `iframe[data-lp-custom-frame]` in the document and whose data is `{ lpHeight: number }`. It sets that frame's height to the value clamped to 20–4000 px, at most once per frame per iframe, then reports rects. Every other message from a child frame is ignored.
- **Checklist:**
  - `customHtmlScripts` names each block with `runScripts` on, by its label or "Custom HTML N": "Custom HTML runs scripts on this page: …".
  - `customHtmlRemoved` names each block with scripts off whose code `hasScripts`: "Scripts in Custom HTML were removed (turn on Run scripts to keep them): …".
  - Both list the `blockIds`.
- **Safety test:** the registry-wide tests pass unchanged. Preview output contains no `<script>` element outside the `srcdoc` attribute (it is escaped there).

- [ ] **Step 1: Write the failing tests:**
  - `custom-html.test.ts`:
    - `export sanitizes the code unless scripts are on`;
    - `run scripts emits the code verbatim`;
    - `preview puts the code only inside a sandboxed srcdoc frame` (parse the preview HTML: one `iframe[sandbox="allow-scripts"]`, no `script` element in the canvas document, and the srcdoc contains the code);
    - `the srcdoc carries the theme and the height reporter`;
    - valid HTML for both export variants; the snapshot.
  - `runtime.test.ts`:
    - `a custom frame's height message resizes only that frame, clamped`;
    - `other child-frame messages are ignored`.
  - `checklist.test.ts`: `names Custom HTML that runs scripts and Custom HTML whose scripts were removed`.
- [ ] **Step 2: Run** `pnpm exec vitest run lib/blocks/custom-html lib/editor/canvas lib/export`. Expected: FAIL.
- [ ] **Step 3: Implement**, `pnpm assets` (the runtime bundle), register, labels (`code: 'HTML'`, `runScripts: 'Run scripts in the exported page'`, `label: 'Name (for the checklist)'`).
- [ ] **Step 4: Write the renderer e2e tests** in `custom-html.spec.ts` (export, `file://`):
  - `with scripts off, a pasted script never runs` (the code sets `window.__canary`; it stays undefined);
  - `with scripts on, the script runs once`.
- [ ] **Step 5: Run** `pnpm test` and `pnpm test:e2e -g "custom html"`. Expected: PASS.
- [ ] **Step 6: Commit:** `feat(blocks): Custom HTML, sanitized in export unless scripts are on, sandboxed in the canvas`.

---

### Task 13: Canvas channel hardening and the post-Escape flash

**Files:** Modify `lib/editor/canvas/protocol.ts` (+ test), `lib/editor/inline-edit.ts` (+ test), `lib/editor/canvas/runtime.ts` (+ test), `components/editor/canvas/canvas.tsx`, `lib/editor/canvas/constants.ts`; test `tests/e2e/app/editor-canvas.spec.ts`, `tests/e2e/app/editor-inline.spec.ts`.

**Interfaces:**
- Produces: `applyInlineEdit` drops edits for any block other than the current selection. `REBUILD_LIMIT = { count: 3, windowMs: 10_000 }` in `constants.ts`.

**Rules (D-053; closes M2a M4, M2b M3/M13, the M3 flash):**
- **Edits are scoped (M2b M3):**
  - `applyInlineEdit` ignores an `edit` whose `blockId` isn't the selected block (`selection.kind === 'block'`). An inline edit always starts with a double-click, which selects the block first.
  - `editEnd` for another block is ignored too.
- **Node cap (M2b M13):** `InlineNodesSchema` caps the total leaf count, top-level leaves plus every link's label leaves, at 2000, through the existing `refine`.
- **Runtime source check:** the canvas runtime acts on editor commands only when `event.source === window.parent`.
- **Navigation (M2a M4):**
  - A second `load` event on the canvas iframe for the same `srcdoc` means the frame navigated away. The editor rebuilds the frame (new channel) and posts nothing to the old window.
  - `post()` sends only after `ready` for the current channel.
- **Error rebuilds are rate-limited:**
  - More than 3 `error` rebuilds in 10 s stop rebuilding and show a notice: "The preview stopped responding. Reload the editor to try again."
  - A successful `ready` resets the count.
- **Post-Escape flash (M3 deferred):** reproduce first, following `superpowers:systematic-debugging`.
  - The e2e below records every text value the field shows (a `MutationObserver` installed through the test-only hook the inline journeys already use, or via `page.evaluate` on `frame`).
  - Find which sync carries the older text. Likely: the edited block's held-back patch is sent before the last coalesced `setBlockProp` lands, or the cache entry deleted on `editEnd` is rebuilt from an older doc.
  - Fix it at the source and state the cause in the commit body.

- [ ] **Step 1: Write the failing tests:**
  - `inline-edit.test.ts`: `an edit for a block that isn't selected changes nothing`.
  - `protocol.test.ts`: `rejects an edit whose link labels exceed 2000 nodes in total`.
  - `runtime.test.ts`: `ignores commands that don't come from the parent window`.
  - `editor-canvas.spec.ts` (app):
    - `a Custom HTML script cannot edit the page or reach the canvas`. Custom HTML with Run scripts on: its script tries `parent.document`, `top.postMessage` with a forged edit for every block and the field `headline`, and `parent.postMessage` with a forged sync. Expected: the document's headline is unchanged after 1 s, the script recorded a `SecurityError` for `parent.document`, and no console error comes from the editor.
    - `a canvas that navigates away is rebuilt` (Playwright's `frame.evaluate(() => { location.href = 'about:blank'; })` on the canvas frame; the canvas returns to ready with a new channel and the overlay works again).
  - `editor-inline.spec.ts`: `after Escape the field never shows an older value`.
- [ ] **Step 2: Run** the unit tests and `pnpm test:e2e:app -g "cannot edit the page|navigates away|never shows an older"`. Expected: FAIL. The flash test fails, demonstrating the bug; if it doesn't, tighten it with a slower `requestAnimationFrame` until it reproduces, and record the conditions.
- [ ] **Step 3: Implement** the rules; `pnpm assets`.
- [ ] **Step 4: Run** `pnpm test` and `pnpm test:e2e:app`. Expected: PASS (the whole app suite: inline editing must still work everywhere).
- [ ] **Step 5: Commit** (two commits):
  - `fix(canvas): accept edits only for the selected block; rebuild on navigation; throttle error rebuilds`
  - `fix(canvas): <cause> no longer flashes an older value after Escape`

---

### Task 14: Carousel fixes and autoplay (m-3, m-4)

**Files:** Modify `lib/blocks/special/product-carousel/{schema.ts,render.ts,snippet.js,styles.css,product-carousel.test.ts}`, `lib/renderer/i18n.ts`, `lib/editor/inspector/labels.ts`, `tests/e2e/renderer/carousel.spec.ts`.

**Interfaces:** Schema gains

```ts
autoplay: z.boolean().default(false),
autoplaySeconds: when(z.number().min(2).max(15).default(5), 'autoplay', [true]),
```

**Rules (D-054):**
- **m-3, fast clicks:** `go(i)` records a pending target. `step()` steps from the pending target while a scroll is still on its way. `update()` clears the target once the track is within 2 px of it.
- **m-3, dots:** dot `i` is hidden (`hidden`) when dot `i - 1` already scrolls to the end (`offset(i - 1) >= maxScroll - 1`). At the end, the last visible dot is current. The script re-checks on resize (`ResizeObserver` on the track).
- **m-4:** the track gets `tabindex="0"` only when the carousel has items.
- **Autoplay:**
  - It runs only in exported pages and only when `autoplay` is on, there are at least 2 cards, and reduced motion is off.
  - It advances one card every `autoplaySeconds` and wraps to the first card at the end, whatever `loop` is.
  - It pauses while the pointer is over the carousel, while focus is inside it, while the tab is hidden and while the carousel is out of view (`IntersectionObserver`).
  - It stops for good after a visitor's `pointerdown`, `wheel` or key press inside the carousel.
- **Pause button (WCAG 2.2.2):** with autoplay, the nav gets `<button type="button" class="lp-carousel__play" data-lp-play aria-label="<i18n pauseSlides>">`. It toggles autoplay and its label ("Jeda" / "Pause", "Putar" / "Play"); pressing it doesn't count as the stop gesture.
- **Snippet need:** the snippet is now needed when navigation isn't `'none'` or autoplay is on, and there are at least 2 items. A carousel with `navigation: 'none'` and autoplay still renders the nav, holding only the pause button.
- **Budget:** ≤ 2048 bytes. Update the test's budget and the file header comment.

- [ ] **Step 1: Write the failing tests:**
  - `product-carousel.test.ts`:
    - `an empty carousel's track is not focusable`;
    - `autoplay adds a pause button and needs the snippet even without navigation`;
    - `autoplaySeconds is 2–15`;
    - `snippet stays within 2048 bytes`.
  - `carousel.spec.ts` (8 items, `page.clock`):
    - `two fast next clicks advance two cards`;
    - `at 1280 px there is one dot per scroll position`;
    - `autoplay advances every 5 s, wraps, and pauses on hover and focus`;
    - `autoplay stops after a swipe and never runs with reduced motion`;
    - `the pause button toggles autoplay and its label`;
    - `autoplay never runs in the canvas preview` (render with `mode: 'preview'` and wrap in a `[data-lp-block]` element: no movement after 15 s).
- [ ] **Step 2: Run** `pnpm exec vitest run lib/blocks/special` and `pnpm test:e2e -g carousel`. Expected: FAIL.
- [ ] **Step 3: Implement**, `pnpm assets`, labels (`autoplay: 'Play automatically'`, `autoplaySeconds: 'Seconds per card'`).
- [ ] **Step 4: Run** `pnpm test` and `pnpm test:e2e`. Expected: PASS (the existing carousel journeys included).
- [ ] **Step 5: Commit:** `feat(carousel): autoplay with a pause button; fast clicks and desktop dots fixed`.

---

### Task 15: Carousel tracking events and JSON-LD

**Files:** Modify `lib/blocks/special/product-carousel/{schema.ts,render.ts,product-carousel.test.ts}`, `lib/tracking/snippet.js`, `lib/tracking/snippet.test.ts`, `tests/e2e/renderer/tracking.spec.ts`, `lib/editor/inspector/labels.ts`.

**Interfaces:**

```ts
// carousel schema gains
event: z.enum(['ViewContent', 'AddToCart', 'none']).default('ViewContent'),
jsonLd: z.boolean().default(false),
// page runtime: a click on [data-lp-event] sends JSON data-lp-params to Meta and data-lp-ga
// (falling back to data-lp-params) to gtag and GTM; lp:track events may carry detail.ga likewise.
```

**Rules (D-019 carousel row; D-054):**
- Each card CTA gets `data-lp-event="<event>"` (unless `'none'`), `data-lp-params` and `data-lp-ga`, sorted with the other data attributes by `renderCta`. Prices are numbers as stored; keys with no value are omitted.
  - **Meta params:** `{"content_ids":["<itemId>"],"content_name":"<title>","content_type":"product","value":<price>,"currency":"<page currency>"}`.
  - **GA params:** `{"item_list_id":"<blockId>","item_list_name":"<heading as plain text>","items":[{"item_id":"<itemId>","item_name":"<title>","price":<price>,"index":<i>}]}`; for `AddToCart`, `value` and `currency` are added too.
- **GA names:** `ViewContent` → `select_item` (exists), `AddToCart` → `add_to_cart` (new in the runtime's map).
- **Page runtime:**
  - `track(name, params, ga)`: `fbq` gets `params`; `gtag` and the GTM push get `ga || params`. The Ads conversion still fires on `Lead` only.
  - A `data-lp-params` value that doesn't parse is ignored, and the event is sent without params.
  - Budget ≤ 2304 bytes; update the test and the D-047 text.
- **JSON-LD** (export only, `jsonLd` on):
  - Emits `<script type="application/ld+json">` after the track: an `ItemList` of `ListItem` (`position`, `item: { @type: Product, name, image?, offers? }`).
  - `image` only when the card image is an absolute http(s) URL (a Portable data URI is skipped). `offers` = `{ @type: Offer, price: "<decimal string>", priceCurrency }` only when a price is set.
  - No ratings: review markup must come from real reviews, and the owner's ratings are self-reported (D-054).
  - The JSON goes through `escapeInlineScript`, so `</script>` in a title can't break out.

- [ ] **Step 1: Write the failing tests:**
  - `product-carousel.test.ts`:
    - `card CTAs carry the event and both parameter sets`;
    - `event none adds no tracking attributes`;
    - `JSON-LD lists products with prices and only absolute images`;
    - `JSON-LD survives a hostile title` (`</script><script>alert(1)</script>` stays inside one script element whose JSON parses back to the title);
    - `preview has no JSON-LD`.
  - `snippet.test.ts`:
    - `a carousel click sends Meta and GA params to their vendors with one event id`;
    - `an unparseable data-lp-params sends the event without params`;
    - `runtime stays within 2304 bytes`.
  - `tracking.spec.ts`: `a carousel card CTA fires ViewContent and select_item with the item and keeps UTM passthrough` (with the existing vendor stubs).
- [ ] **Step 2: Run** `pnpm exec vitest run lib/blocks/special lib/tracking` and `pnpm test:e2e -g "carousel card CTA"`. Expected: FAIL.
- [ ] **Step 3: Implement**, `pnpm assets`, labels (`event: 'Event on card buttons'`, `jsonLd: 'Product structured data (JSON-LD)'`).
- [ ] **Step 4: Run** `pnpm test` and `pnpm test:e2e`. Expected: PASS.
- [ ] **Step 5: Commit:** `feat(carousel): card events with item parameters for Meta and GA4; optional JSON-LD`.

---

### Task 16: Bulk paste carousel rows

**Files:**
- Create: `lib/editor/bulk-paste.ts`, `lib/editor/bulk-paste.test.ts`, `components/editor/inspector/controls/bulk-paste-dialog.tsx`
- Modify: `lib/editor/commands.ts` (+ test; `listInsertMany`), `components/editor/inspector/types.ts` (`listInsertMany` action), `components/editor/inspector/block-panel.tsx`, `components/editor/inspector/controls/list-control.tsx`
- Test: `tests/e2e/app/editor-inspector.spec.ts`

**Interfaces:**

```ts
// lib/editor/bulk-paste.ts (pure)
export interface PastedRow { line: number; title: string; price?: number; compareAtPrice?: number; imageUrl?: string; linkUrl?: string }
export interface PasteResult { rows: PastedRow[]; errors: { line: number; message: string }[] }
export function parseRows(text: string, format: PriceFormat): PasteResult;
export function parsePrice(text: string, format: PriceFormat): number | null;
export function rowsToCarouselItems(rows: PastedRow[], newId: IdFactory): ProductItem[];
// lib/editor/commands.ts
| { type: 'listInsertMany'; blockId: string; path: PropPath; index: number; items: unknown[] }  // one undo step, label "Add N items"
// FieldActions gains
listInsertMany(path: PropPath, index: number, items: unknown[]): CommandResult;
```

**Rules (D-054):**
- **Delimiter and cells:**
  - Tab when the first non-empty line has a tab, else comma, else semicolon (Excel in Indonesian locales).
  - CSV quoting: `"…"` with `""` escapes; a quoted cell may hold the delimiter and line breaks.
  - Blank lines are skipped. Cells are trimmed.
- **Header:** the first row is a header when its price cell isn't a number and its title cell matches `/^(title|name|nama|judul|produk|product)$/i`.
- **Columns:** title (required, ≤ 120 characters, else "Row N: the title is missing" / "Row N: the title is longer than 120 characters"), price, compare-at price, image URL, link URL.
- **`parsePrice`:**
  - Strips everything but digits, `.` and `,`.
  - For a 0-decimal currency (IDR) every separator is a thousands separator: `Rp149.000` → 149000, `149,000` → 149000.
  - Otherwise the last separator is the decimal point when it is followed by 1–2 digits (`$12.99`, `12,99`) and a thousands separator when followed by exactly 3 (`1,234` → 1234).
  - An empty cell is "no price". Anything else that doesn't parse is the error "Row N: \"x\" isn't a price".
- **URLs:**
  - The image and link must be absolute http(s) URLs (`sanitizeUrl` and the scheme check), else "Row N: the image address must start with https://" (the link the same).
  - The link becomes `{ kind: 'url', url, newTab: false }`, else `{ kind: 'default' }`.
  - The CTA label is "Buy now" (i18n-independent editor copy: the owner edits it).
- **Room:** rows beyond the carousel's free room (50 − current items) are not added; the dialog says "Only N rows fit; the carousel holds 50 products."
- **`listInsertMany`:**
  - Validates every item with the list's element schema and the whole list's `max`. Any failure changes nothing (`invalid` or `limit`).
  - An empty `items` is `noop`.
  - Announcement: "Added N items".
- **UI:**
  - The list control shows "Paste rows" under the product carousel's `items` list only. The panel passes `context.definition`, so `list-control` checks `definition?.type === 'product-carousel' && path is ['items']`.
  - The dialog is titled "Paste products". It has a `Rows` textarea, the hint "One product per row: title, price, compare-at price, image URL, link. Copy cells straight from a spreadsheet.", a live summary ("3 products ready", then the error lines), and "Add 3 products" (disabled at 0).
  - The paste becomes one command.

- [ ] **Step 1: Write the failing tests:**
  - `bulk-paste.test.ts`:
    - `parses a Sheets paste with a header, Rp prices, quoted cells and bad rows` (TSV header `Nama\tHarga\tHarga coret\tGambar\tLink`, rows with `Rp149.000`, a quoted title holding a tab and a line break, a row without a title, a row with `abc` as price, two trailing blank lines → 3 rows, 2 errors naming rows 4 and 5);
    - `parses CSV with quotes and semicolon files`;
    - `parsePrice follows the currency` (table: IDR `Rp149.000`/`149,000`/`1.250.000`; USD `$12.99`/`1,234`/`1,234.50`/`12,99`; empty → null);
    - `rejects non-https image and link addresses per row`;
    - `rowsToCarouselItems makes valid items with fresh ids`.
  - `commands.test.ts`:
    - `listInsertMany adds every item as one undo step`;
    - `listInsertMany past the list limit changes nothing`;
    - `an empty listInsertMany is a noop`.
- [ ] **Step 2: Run** `pnpm exec vitest run lib/editor`. Expected: FAIL.
- [ ] **Step 3: Implement** the parser, command, action and dialog.
- [ ] **Step 4: Add an app e2e** in `editor-inspector.spec.ts`: `paste rows adds products in one undo step`. Add a carousel (3 items), open "Paste rows", paste 8 TSV rows with a header, and check that the summary says "8 products ready". Then "Add 8 products": the canvas shows 11 cards. Mod+Z returns to 3 cards, and Mod+Y brings back 11.
- [ ] **Step 5: Run** `pnpm test` and `pnpm test:e2e:app -g "paste rows"`. Expected: PASS.
- [ ] **Step 6: Commit:** `feat(carousel): paste spreadsheet rows as products in one undo step`.

---

### Task 17: Every block in the example, the JS budget, decisions and docs

**Files:** Modify `tests/fixtures/example-document.ts`, `lib/renderer/example.test.ts`, `lib/renderer/__snapshots__/*`, `lib/blocks/registry.test.ts`, `docs/DECISIONS.md`, `docs/PLAN.md`, `CLAUDE.md`, `README.md` (block list, if it has one).

**Rules:**
- **Example document:** add one instance of each new block in sensible order: Logos after the hero; Image + text; Gallery; Pricing with 2 offers; Countdown with a deadline in 2099; Video with a YouTube URL; Custom HTML (scripts off); Spacer with a line; Sticky CTA; Cookie banner. Give the carousel `autoplay` and `event: 'ViewContent'`. Existing renderer e2e (focus rings in every tone, no overflow at 360 px, carousel) then cover the new blocks.
- `registry.test.ts`: `every registered block type appears in the example document`.
- `example.test.ts`: `a page using every snippet ships at most 10,240 bytes of inline JS` (`renderPage(example, { mode: 'export' }).jsBytes`, with tracking ids set so the page runtime ships).
- **DECISIONS** (newest at the bottom, after D-046):
  - **D-050 Remaining blocks:** the list and categories (Utility group), conditional fields (`when()`), one high-priority image (D-016 refined: the first block above the fold that has an image, export only), floating blocks via `:has()`, and the cookie banner being a notice, not a consent gate.
  - **D-051 Countdown:** fixed deadline only, why there is no evergreen timer, the offsets, and the end behavior.
  - **D-052 Video facade:** the URL forms, nocookie/dnt players, the thumbnail URL not inlined, and Hero media.
  - **D-053 Custom HTML and the canvas channel:** the sanitizer allowlist summary, parse5 moved from M6, the nested sandbox frame, opt-in scripts and checklist, edits scoped to the selected block, the node cap, the parent-source check, navigation rebuild and rebuild throttle. This closes M2a M4 and M2b M3/M13.
  - **D-054 Carousel M4:** autoplay rules and pause button, fast-click and dot fixes, card events with Meta/GA params, JSON-LD without ratings, bulk paste rules, and budgets (carousel 2048, page runtime 2304).
- **Updates:** D-018 ("M4 adds …" → done, see D-054), D-019 (the carousel row is live; `AddToCart` → `add_to_cart`), D-047 (runtime budget 2304, `data-lp-params`/`data-lp-ga`).
- **CLAUDE.md:**
  - The block recipe gains "`when(schema, key, values)` hides a field unless a sibling has one of `values`".
  - Snippets that keep timers stop once their root is disconnected.
  - "Untrusted or owner code in the canvas only ever runs in a nested `sandbox="allow-scripts"` frame".
- **PLAN:** §5 M4 marks the blocks and carousel lines "(M4a)". §10's M4a row changes to "Done" when merged.

- [ ] **Step 1: Write the failing tests** (`registry.test.ts`, `example.test.ts`) and update the fixture.
- [ ] **Step 2: Run** `pnpm exec vitest run lib/renderer lib/blocks`. Expected: the new tests pass, and the example snapshots differ. Review the snapshot diff (only new blocks and carousel attributes), then `pnpm exec vitest run lib/renderer/example.test.ts --update`.
- [ ] **Step 3: Run the full gate:** `pnpm lint && pnpm typecheck && pnpm test && pnpm assets:check && pnpm test:e2e && pnpm test:e2e:app && pnpm build`. Expected: all green. Then `pnpm render` writes `out/example.html`, which opens via `file://` with only YouTube thumbnail requests (the example's video) and no other external requests.
- [ ] **Step 4: Write the docs** per the rules.
- [ ] **Step 5: Commit:** `docs: M4a decisions, block recipe additions and the example covering every block`.

## M4a exit

- All gates in Task 17 Step 3 are green.
- Manual check, run once in Chrome at 390 px on the exported example:
  - the countdown ticks;
  - the video plays after a tap;
  - the sticky bar appears after the hero;
  - the cookie banner dismisses and stays dismissed;
  - the carousel autoplays and stops on swipe.
- Then the whole-branch review, the merge into `main`, and the M4b plan.
