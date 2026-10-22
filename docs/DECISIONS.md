# Decisions Log

Assumptions and decisions made while planning and building LaunchPad. "PRD" means `docs/PRD.md`; "Plan" means `docs/PLAN.md`.

Status values: **Accepted**: in effect. **Proposed**: in effect unless the owner objects at plan review. **Superseded**: replaced by a later entry. Newest entries go at the bottom.

---

## D-001 Keep Supabase (not Firebase) — Accepted
Pages, versions, templates and assets are relational. Documents fit JSONB, tags fit `text[]` with a GIN index, workspace scoping fits RLS, and Storage gives RLS-protected buckets plus public CDN URLs. AI daily caps (M5) become one atomic SQL function. With Firebase, joins, quotas and authorization would move into app code and security rules.

## D-002 Toolchain versions — Accepted
- **Node 24 LTS.** The machine currently runs Node 20.20 (via nvm). Node 20 reached end of life in April 2026, and it is below the minimum of `@supabase/supabase-js` (≥ 22), Vitest 5 (≥ 22.12) and html-validate 11 (≥ 22.22).
- **pnpm 12.14** (`packageManager` field). pnpm ≥ 11 blocks dependency build scripts unless they are listed under `allowBuilds` in `pnpm-workspace.yaml`. With `strictDepBuilds` (the default), an unlisted package with a build script fails the install.
- **Next.js 16.4** (App Router, Turbopack), React 19.3, Tailwind 4.3, Zod 4.6, Vitest 5, Playwright 1.64, esbuild 0.28, shadcn CLI 4.
- **TypeScript 5.x**, as installed by `create-next-app`. TypeScript 7 (native) is released, but `typescript-eslint` only supports `<6.1`. Revisit when it supports 7.

## D-003 `proxy.ts` instead of `middleware.ts` — Accepted
Next.js 16 renamed the middleware file convention to `proxy.ts` (exported function `proxy`, Node.js runtime). The PRD (§9) lists `/middleware.ts`. The proxy only refreshes the Supabase session and redirects. Every server action and route handler checks auth again, as Next.js recommends.

## D-004 Env var names stay as in the PRD — Accepted
`NEXT_PUBLIC_SUPABASE_ANON_KEY` holds Supabase's publishable key (`sb_publishable_…`) or the legacy anon key. `SUPABASE_SERVICE_ROLE_KEY` holds the secret key (`sb_secret_…`) or the legacy service_role key. Supabase's own docs now call the first one `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; we keep the PRD's names.

## D-005 Single-tenant auth — Accepted
- Login is email and password through Supabase Auth.
- **Public sign-ups are disabled**: `[auth] enable_signup = false` in `supabase/config.toml`, and "Allow new users to sign up" off in the hosted project's dashboard. The owner account is created with `pnpm owner:create`. Without this, anyone holding the public key could create an account and spend AI quota and storage. Keep `[auth.email] enable_signup = true` and the Email provider enabled: in this CLI version, turning that key off disables email *logins* too (`email_provider_disabled`).
- A trigger creates one workspace for each new user.
- Every RLS policy calls `public.is_workspace_member(workspace_id)`. Today that function checks `workspaces.owner_id`. To add multi-user later, add a `workspace_members` table and change only that function.

## D-006 Version HTML lives in Storage, not in `page_versions.html` — Proposed (deviates from PRD §7)
`page_versions` keeps `html_path` (private bucket `page-versions`), `byte_size` and `html_sha256`. A Portable export is 0.3–3 MB, and base64 compresses poorly, so a few hundred exports would fill the free plan's 500 MB database and bloat backups. Storage is cheaper, and downloads come straight from it. Revisit if you prefer the HTML in Postgres; that is a single-column migration.

## D-007 Export runs in the browser — Proposed (M3)
`renderPage` runs on both server and browser. Portable mode inlines image variants that were already resized to WebP at upload (D-008), so export needs no server-side re-encoding. The browser assembles the file, downloads it as a Blob, uploads the same bytes to `page-versions`, and inserts the `page_versions` row under RLS. This avoids Vercel's 4.5 MB function response limit and server compute, and the download is immediate. Images on third-party hosts that block CORS stay as URLs, with a checklist warning.

## D-008 Upload pipeline — Proposed (M2)
The browser uploads the original file straight to Storage, which bypasses Vercel's 4.5 MB request limit. A server route then uses `sharp` to produce WebP variants at 1600 px and 800 px wide (quality 80), writes the `assets` row, and deletes the original.

## D-009 Rich text is a tiny inline markup, not HTML — Accepted
Supported syntax: `**bold**`, `*italic*`, `==highlight==`, `[label](url)`, newline → `<br>`, and a backslash to escape a marker. The renderer tokenizes, escapes every character, and sanitizes link URLs. This is safe by construction and deterministic, needs no HTML parser in the browser, and is easy for the AI to produce. In M2, inline canvas editing serializes the edited DOM (limited to b/i/mark/a/br) back to this markup.

## D-010 Renderer output safety — Accepted
All markup is built with the `html` tagged template, which escapes every interpolated value. `unsafeRaw()` is used only for our own generated CSS and JS, and (M4) for the Custom HTML block. Every `href` and `src` goes through `sanitizeUrl`, which allows only listed schemes: links accept http, https, mailto, tel, sms, `#anchor` and relative paths; images accept http, https, relative paths and `data:image/*`. A registry-wide test injects hostile strings into every field of every block.

## D-011 Determinism — Accepted
The renderer never uses `Date`, `Math.random`, `Intl` or I/O. Prices go through our own formatter with per-currency presets (IDR → `Rp149.000`, USD → `$1,234.50`, MYR, SGD, PHP), because `Intl` output varies between ICU builds (Node vs. browsers), and that would break "same document → same bytes".

## D-012 CSS strategy — Accepted
- Theme tokens are CSS custom properties on `:root`.
- Base CSS is always included, with a budget of ≤ 4 KB minified.
- Each block type ships one static stylesheet. It is included once, and only if that type is on the page, ordered by type name so reordering blocks never changes the cascade.
- Per-instance options (for example, carousel slides per view) are custom properties in a `style` attribute, so there are no per-instance rules.
- Every class is prefixed `lp-`.

## D-013 CSS/JS assets are compiled into committed modules — Accepted (deviates from PRD §9 naming)
Block CSS and JS are written as real files (`styles.css`, `snippet.js`) in the block folder. `pnpm assets` runs esbuild and writes `styles.generated.ts` / `snippet.generated.ts`, each exporting `{ min, src }`, and these generated files are committed. A unit test fails when they are stale. `renderPage` must also run in the browser, where esbuild cannot run, so compiling ahead of time keeps the renderer pure and its output byte-stable. The PRD names this file `snippet.ts`; here it is `snippet.js` plus `snippet.generated.ts`.

## D-014 Block registry split — Accepted
Pure block definitions (type, category, label, description, icon, schema, defaults, CSS, optional snippet, render; no React) live in `lib/blocks/*`. The renderer, the AI catalog (M5) and the importer (M6) all use them. In M2 the editor's inspector is generated from the Zod schema, and any custom inspector components are registered separately on the client. A block whose inspector is generated needs its own folder plus one registry line.

## D-015 Section model — Accepted
A section is a full-width band with a `tone` (`base | muted | primary | dark`, each mapped to a theme color pair), vertical padding (`none | sm | md | lg`) and a content width (`narrow | normal | wide | full`). Blocks stack inside a section. Tones replace free colors, so contrast stays checkable (M5 validates theme pairs).

## D-016 Above-the-fold heuristic — Accepted
Blocks in the first section count as above the fold: their images load eagerly, and the first image gets `fetchpriority="high"`. Everything else is lazy.

## D-017 Footer landmark — Accepted
Trailing sections whose blocks all declare `landmark: 'footer'` render after `</main>`, so the footer becomes the page's `contentinfo` landmark.

## D-018 Product Carousel scope split — Accepted
**M1** covers the scroll-snap layout, cards (image, title, description, price, compare-at price, discount badge, badge, rating and review count, CTA), arrows, dots, loop, keyboard, accessibility, eager/lazy images and per-instance layout. **M4** adds autoplay, bulk paste, tracking events and the JSON-LD toggle (PRD §10). M4 fields arrive with Zod defaults, so M1 documents still parse.

## D-019 Tracking event mapping (PRD Q3) — Proposed (M3/M4)
| Trigger | Meta Pixel | GA4 | Google Ads |
|---|---|---|---|
| Page load | `PageView` | `page_view` (sent by `gtag('config')`) | — |
| Carousel card CTA | `ViewContent` `{content_ids:[itemId], content_name, content_type:'product', value: price, currency}` | `select_item` `{item_list_id: blockId, item_list_name: heading, items:[{item_id, item_name, price, index}]}` | — |
| Other CTA (hero, pricing, sticky) | none by default; configurable (`Contact`, `InitiateCheckout`, `Lead`, custom) | none by default; configurable | — |
| Form submit (when detectable) | `Lead` | `generate_lead` | `conversion` `{send_to: 'AW-…/label'}` |

The carousel default is `ViewContent`, not `AddToCart`: a card click shows interest in a product, and there is no cart, so `AddToCart` would feed the ad algorithm a misleading signal. The event is configurable per carousel.

## D-020 Form providers (PRD Q1) — Proposed (M3)
Every form can be added as a generic iframe URL or as a pasted snippet. Presets: Tally, Typeform, Jotform, Google Forms. A preset tracks submits through postMessage only where its provider emits a submit message; Google Forms emits none, and the UI says so. **Owner input wanted:** which providers you actually use (including local COD order-form services). M3 adds those first.

## D-021 Keep room for server-side conversions (PRD Q5) — Accepted
Every browser event carries an `event_id` (Meta `eventID`). Meta Conversions API or Google offline conversions can then be added later with deduplication and without changing exported pages.

## D-022 Hosted pages on a separate domain (PRD Q4, M7) — Proposed
The default is path-based: `https://<APP_BASE_DOMAIN>/<slug>`, on a registrable domain different from the editor's, with optional custom domains per page. Pages are **never** served from the editor's origin: they run third-party scripts (pixels, form embeds) and optional Custom HTML, and the Supabase session cookies on the editor origin are readable by JavaScript.

## D-023 Other PRD open questions — Accepted
- Q2: carousel data is manual in v1 (repeater + bulk paste, in M4).
- Q6: the wizard supports Indonesian and English.
- Q7: import limit 5 MB. Unknown scripts are removed unless explicitly kept as sandboxed Custom HTML, which is opt-in and flagged by the checklist. High-risk scripts can never be kept.
- Q8: the product-URL reader comes later.

## D-024 AI defaults (M5) — Proposed
- `AI_MODEL=claude-opus-5-5` in `.env.example`.
- Structured outputs use `client.messages.parse` with `zodOutputFormat(schema)`. The result is then validated against our full Zod and business rules, with up to 2 retries that feed the validation errors back.
- `cache_control` on the stable prefix (system prompt + block catalog).
- `output_config.effort` is set explicitly for each step (Opus 5.5 defaults to `medium`).
- Server-side refusal fallbacks are on (`fallbacks: "default"`).
- `ai_runs` logs `input_tokens`, `output_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens`, latency and status.

## D-025 Naming — Accepted
The product is "LaunchPad" in the UI, as in the PRD. The repo and package are named `rakit-app`, after the folder.

## D-026 Test layout — Accepted
- Unit tests sit next to the code as `*.test.ts`.
- Repo-level unit tests (dependency policy) live in `tests/unit`.
- Playwright tests live in `tests/e2e/{renderer,app}`; pgTAP RLS tests in `supabase/tests`.
- `pnpm test` is the single unit-test gate. It includes the generated-asset staleness check and the dependency policy.

## D-027 Dependency policy (PRD AC3) — Accepted
`tests/unit/dependency-policy.test.ts` fails if `package.json` lists any page-builder, DnD or carousel framework. The list is in Plan §7.

## D-028 IDs and anchors — Accepted
- IDs are 10 random characters from `[a-z0-9]`, generated with `crypto.getRandomValues`.
- `IdSchema` accepts `[A-Za-z0-9]{1,32}` only. DOM ids join ids with `-` (`b-<block>-<item>`), so allowing `-` would let block `carousel` + item `2` collide with block `carousel-2` (found in the M0/M1 final review).
- Section and block IDs must be unique in a document. Item IDs must be unique within their list.
- A section anchor is a user-settable slug that cannot start with `b-` or `s-`; those prefixes are reserved for generated DOM IDs.

## D-029 Document version field — Accepted
The PRD's `PageDocument.version` and `schemaVersion` are one field, `schemaVersion` (currently `1`). Additive changes rely on Zod defaults; breaking changes bump the version and add a migration.

## D-030 React Compiler off — Accepted
It is disabled at scaffold time to keep builds simple. Revisit in M2 if profiling the editor shows render cost from props that should be memoized.

## D-031 shadcn/ui 4 output and the editor font — Accepted
`shadcn@4.22` (style `base-nova`) builds components on `@base-ui/react` (not Radix), merges classes with `cn` (shadcn's own replacement for clsx + tailwind-merge, repo `shadcn-ui/cn`), and needs the `shadcn` package at runtime for `@import "shadcn/tailwind.css"`. These replace the Radix/clsx/tailwind-merge entries expected in Plan §7. The editor UI uses the system font stack: the scaffold's and shadcn's `next/font/google` (Geist) was removed so builds never fetch Google Fonts.

## D-032 Type-checking setup — Accepted
`tsconfig` targets ES2022 (type-checking only; Next compiles with SWC), so ES2018+ regex features (the `s` flag, lookbehind) type-check. `pnpm typecheck` runs `next typegen` before `tsc`, because the global `PageProps`/`LayoutProps` route types are generated into `.next/` and are missing from fresh clones and CI.

## D-033 Focus ring color — Accepted
The focus ring is a 3px solid outline, offset 2px, in `--lp-fg`: the text color of the surface it is drawn on. Tone pairs are what M5 validates (D-015), so the ring inherits their contrast (at least 4.5:1 once validated, against the 3:1 that WCAG 1.4.11 needs). The accent color is not used, because no check pairs it with a background (it measured 1.95–2.41:1 on the default theme). A surface that paints its own background (product cards, testimonial quotes, benefit cards) resets `--lp-fg` to its own text color. `tests/e2e/renderer/focus.spec.ts` tabs through the example page in every tone and checks each ring against the background behind it.

## D-034 Canvas overlay and drag design, validated by a spike — Accepted
`spikes/canvas-dnd/` (deleted in M2b) put a parent overlay over an `<iframe sandbox="allow-scripts" srcdoc>` that reports block rects by `postMessage`, with a transparent shield over the iframe during drags.

Measured in headless Chromium over 3 runs:
- **Rect round-trip:** median 14.6–14.8 ms (p95 15.7–17.5 ms), about one animation frame.
- **Mouse drag:** 0 pointer events reached the iframe while the button was down.
- **Auto-scroll:** about 930 px/s. Once it stopped, the insertion line sat 0 px from the block boundary in the iframe's real DOM.
- **Touch:** a long-press (250 ms) started a drag without scrolling the page.

Consequences:
- The overlay redraws on every `rects` message. One frame of lag needs no prediction.
- The iframe answers every scroll request with rects, even at the scroll edge, because the parent keys its state on them.
- When the shield is removed under a stationary cursor, Chrome sends the iframe a `pointerover`. The drag engine (M2b) therefore commits drops from the parent's `pointerup` only, and treats that hover as ordinary.
- Drag handles need `touch-action: none` and a suppressed `contextmenu`. With both, a long-press drag works on touch screens.

## D-035 Draft saves: a route handler and a revision counter — Proposed (deviates from Plan §5 M2)
- The editor saves with `PUT /api/pages/[pageId]/draft` and a JSON body `{ document, baseRevision, saveId }`.
- This is a route handler, not a server action, for two reasons:
  - Next.js runs server actions one at a time per client, so a slow save would block dashboard actions.
  - An unload flush needs `fetch(…, { keepalive: true })`, which only a plain HTTP endpoint can receive.
- The server validates the document with `safeParseDocument`, rejects bodies over 4 MiB (Vercel caps requests at 4.5 MB) and stores the parsed document.
- Optimistic concurrency uses an integer, `pages.draft_revision`, instead of `updated_at`. Renames and status changes also bump `updated_at`, and they must not make the next draft save conflict. An integer also avoids carrying microsecond timestamps through JavaScript.
- The update matches `id` and `draft_revision = baseRevision`, and sets `baseRevision + 1`. When no row matches, the answer is 409 with the current revision, or 404 when the page is gone.
- Each attempt carries a fresh `saveId` (a UUID), stored as `pages.draft_save_id`, and a 409 also names the id that wrote the current draft. A save can land while its answer is lost (a Wi-Fi switch mid-request, a gateway error after the write). The client then finds its own id in the 409 and builds on that revision, instead of reporting a conflict that would offer to discard its newer edits (M2a final review, I1).
- Dashboard mutations (create, rename, delete) stay server actions.

## D-036 Editor dependencies — Accepted
`immer@11.1.21` (patches for undo/redo) and `zustand@5.0.15` (editor store), both pinned exactly. Immer published 11.1.22–11.2.7 in a burst on 2026-10-20/21; we stay on the last release that is at least two weeks old and move up deliberately.

## D-037 Editor commands — Accepted
- Every change is a typed command (`lib/editor/commands.ts`) applied with Immer's `produceWithPatches`.
- The store's document always validates and is normalized:
  - values are parsed with the schema of the field they replace;
  - the block, style or settings object is then validated whole;
  - a failing command changes nothing and returns a reason (`invalid`, `limit`, `noop` or `not_found`).
- Moves never merge a block into another band:
  - a block alone in its section moves the whole section;
  - a block in a shared section moves within it, and at the edge it leaves into a new section that copies the band's style;
  - joining another section is a drag-and-drop gesture (M2b).
- Removing a section's last block removes the section. Duplicating a block that is alone in its section duplicates the section.
- Copied sections never carry the original's anchor, because anchors must stay unique.
- The palette inserts a block in a new default section after the selected section, never after trailing footer sections (D-017). A Footer always goes last.

## D-038 Undo history — Accepted
- **Entries:** one per command, holding Immer patches, inverse patches and the selection before and after. Undo and redo apply patches and never re-run commands, so ids a command generated survive redo.
- **Coalescing:** consecutive edits with the same key (block + field path, or settings path) within 1000 ms of each other join one entry. Blurring the field, undo and redo end the run. Up to 200 entries are kept.
- **Not in history:** selection, hover and viewport. Undo restores the selection recorded with the entry if it still exists.

## D-039 Canvas protocol and patching — Accepted
- **Isolation:** the canvas is `<iframe sandbox="allow-scripts" srcdoc>`. Its origin is opaque, so page scripts can never reach the editor's cookies or DOM. Its document is `renderPage(doc, { mode: 'preview' })` plus a bundled runtime (`lib/editor/canvas/runtime.ts`, ≤ 8 KB) that carries a per-load channel id.
- **Patching:**
  - The parent keeps the HTML it last sent for each block. The cache is keyed on the block object, the settings object, the section anchors, the block's section and its first-section and first-block position.
  - Once per animation frame it sends only what changed: CSS, JS, `lang`, the body skeleton (sections with one slot per block) and changed blocks.
  - The runtime moves unchanged block elements into the new skeleton, so FAQ items stay open across reorders. Moving an element resets its scroll, so the runtime saves and restores scroll offsets for moved and replaced blocks alike.
  - A `<details>` counts as user-toggled only when its open state differs from its markup, so changing "Open the first question" in the inspector still shows.
- **Snippets:** after a patch the runtime runs the page's snippets again. Snippets are idempotent per root (`data-lp-ready`), so only new roots initialize; the block recipe now says so.
- **Untrusted messages:** every message from the iframe is untrusted. The parent checks `event.source`, the source tag, the channel and a Zod schema, and acts only on ids that exist in the document. Links never navigate the canvas.


## D-040 Inspector generated from the Zod schemas — Accepted
- **Generation:** `describeFields` builds each block's inspector from its Zod schema with Zod 4 introspection (`type`, `def`, `meta()`). Controls come from metadata or shape:
  - `control: 'text' | 'rich' | 'image' | 'color'` picks the control;
  - a union discriminated by `kind` over url/section/default is a link;
  - enums and literal unions are choices;
  - arrays of objects are repeaters, whose maximum comes from `maxItems`.
- **Coverage:** an unknown construct throws, and a registry-wide test runs the walker on every block. A new block therefore gets a full inspector or fails `pnpm test`.
- **Labels:** humanized keys plus an override table (`lib/editor/inspector/labels.ts`), so schemas stay free of UI copy.
- **Validation:** fields validate on every keystroke against their own schema. An invalid value (an emptied required headline) shows an error and is not committed; blur restores the last valid value.
- **New values:** new list items and newly enabled optional groups copy the block's own sample from `defaultProps` when there is one. Otherwise they are seeded from the schema, with `[REPLACE: …]` for required text, so nothing invents content.
- **Contrast:** the theme panel shows WCAG contrast for each color pair (`lib/schema/contrast.ts`). It only hints; M5 adds validation and auto-adjust.

## D-041 AGENTS.md stays committed — Accepted
`next dev` writes AGENTS.md (Next.js's agent rules: read `node_modules/next/dist/docs/` before using an API). Removing it only brings the file back as an uncommitted change, so it stays committed; CLAUDE.md remains the project's own guide (M0/M1 review m-12).

## D-042 Editor sessions outlive the editor — Accepted
- **Why:** Next.js reuses a page's server payload on browser back/forward, so a remounted editor started from the first load's document and revision. The next save then conflicted, and "Keep my version" would have overwritten newer work (M2a final review, C1). Unsaved changes also lost their retries and their leave warning when the editor unmounted (I2).
- **Rule:** `lib/editor/session.ts` keeps one session (store and autosave) per page for the life of the tab. Opening the editor reuses the tab's session when it holds unsaved changes or a revision at least as new as the server payload; otherwise a new session starts from the payload. Server rendering uses a throwaway session.
- **Listening:** the session itself handles `pagehide`, `visibilitychange`, `blur`, `online` and `beforeunload`, so it keeps saving and warning after the editor unmounts.
- **Leaving:** the Pages link waits up to 3 s for the save. When the draft still isn't saved (offline, failed or conflicting), it asks "Leave without saving?"; the changes stay in the tab either way.
- **Cost:** sessions, with their undo history, stay in memory until the tab closes or reloads, one per page opened in the tab.

## D-043 Drag and drop: drop targets and moves — Accepted
- **Targets:** a drop lands `between` sections (a new section at that index, never after the trailing footer sections) or `into` a section, before one of its blocks. Indices refer to the document before the drop.
- **Inserting** (`insertBlockAt`): `between` makes a new default section; `into` joins the section. A Footer always goes last, wherever it was dropped (D-017).
- **Moving** (`moveBlockTo`):
  - A block alone in its section moves with the section (its id, style and anchor kept), or joins the target section; its emptied section disappears with its anchor.
  - A block in a shared section leaves into a new section that copies its band's style (not the anchor), reorders within its own section, or joins another section.
  - Dropping a block where it already is changes nothing (`noop`). Footer blocks are not draggable, and nothing joins a footer section.
- **Zones** (`lib/editor/dnd/geometry.ts`, from the cached rects): the top and bottom quarter of a section's height drop `between` sections; the middle half drops `into` it, before the first visible block whose midpoint lies below the pointer. Above the first section or below the last, the drop goes to the first or last position; a pointer between two section rects goes to the nearer boundary.
- **Marker:** `between` is a full-width line at the section boundary; `into` is inset 16 px and sits at the gap between blocks.
- **Limits:** 30 blocks per section, 60 sections, 200 blocks (`LIMITS`).
- **Starting a drag** (`lib/editor/dnd/controller.ts`): mouse and pen drags start after 4 px of movement; touch drags after a 250 ms long-press, and moving 10 px first is a scroll. Palette rows drag from the button with a mouse or pen, and from the grip with any pointer, so a tap still adds and the palette still scrolls on touch. A selected block drags from the toolbar's "Drag to move" grip, which footer blocks don't have.
- **While dragging** (`components/editor/dnd/drag-context.tsx`):
  - A shield covers the iframe, so every pointer event stays in the editor; window listeners follow the pointer.
  - Every key is swallowed (editor shortcuts never fire mid-drag), Escape cancels, and so do window blur and pointercancel.
  - The target is recomputed on every move and every new rects message. Near the canvas's top or bottom edge the editor asks the iframe to scroll (at most 20 px a frame), and the iframe always answers with rects.
- **Dropping:** a drop commits on the editor's pointerup only (D-034); a release outside the canvas cancels; the click that ends a palette drag is swallowed. Screen readers hear "Dragging <Label>. Press Escape to cancel.", "Drag cancelled." or the command's own announcement.
- **No-op edits:** a command that produces no patches fails with `noop` "Nothing changed", so it never records an undo step (M2a review M1).

