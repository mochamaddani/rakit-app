# Decisions Log

Assumptions and decisions made while planning and building Rakit (named LaunchPad in the PRD; see D-025). "PRD" means `docs/PRD.md`; "Plan" means `docs/PLAN.md`.

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

## D-006 Version HTML lives in Storage, not in `page_versions.html` — Accepted (deviates from PRD §7)
`page_versions` keeps `html_path` (private bucket `page-versions`), `byte_size` and `html_sha256`. A Portable export is 0.3–3 MB, and base64 compresses poorly, so a few hundred exports would fill the free plan's 500 MB database and bloat backups. Storage is cheaper, and downloads come straight from it. Revisit if you prefer the HTML in Postgres; that is a single-column migration.

## D-007 Export runs in the browser — Accepted (M3)
`renderPage` runs on both server and browser. Portable mode inlines image variants that were already resized to WebP at upload (D-008), so export needs no server-side re-encoding. The browser assembles the file, downloads it as a Blob, uploads the same bytes to `page-versions`, and inserts the `page_versions` row under RLS. This avoids Vercel's 4.5 MB function response limit and server compute, and the download is immediate. Images on third-party hosts that block CORS stay as URLs, with a checklist warning.

## D-008 Upload pipeline — Accepted (M2b; details in D-045)
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
**M1** covers the scroll-snap layout, cards (image, title, description, price, compare-at price, discount badge, badge, rating and review count, CTA), arrows, dots, loop, keyboard, accessibility, eager/lazy images and per-instance layout. **M4** adds autoplay, bulk paste, tracking events and the JSON-LD toggle (PRD §10); done in M4a, see D-054. M4 fields arrive with Zod defaults, so M1 documents still parse.

## D-019 Tracking event mapping (PRD Q3) — Accepted (M3; carousel M4)
| Trigger | Meta Pixel | GA4 | Google Ads |
|---|---|---|---|
| Page load | `PageView` | `page_view` (sent by `gtag('config')`) | — |
| Carousel card CTA | `ViewContent` `{content_ids:[itemId], content_name, content_type:'product', value: price, currency}` | `select_item` `{item_list_id: blockId, item_list_name: heading, items:[{item_id, item_name, price, index}]}` | — |
| Other CTA (hero, pricing, sticky) | none by default; per CTA `Lead`, `Contact` or `InitiateCheckout` | `generate_lead`, `contact`, `begin_checkout` | `conversion` for `Lead` |
| Form submit (when detectable) | `Lead` | `generate_lead` | `conversion` `{send_to: 'AW-…/label'}` |

GTM receives the GA4 names: `dataLayer.push({ event: 'generate_lead', event_id, … })`. Google Ads fires `conversion` (`transaction_id` = the event id) on every `Lead` when a lead conversion label is set. The carousel row is live since M4a (D-054): a carousel can also fire `AddToCart` (GA4 `add_to_cart`, with `value` and `currency`) or nothing. Revised in M3 (D-047).

The carousel default is `ViewContent`, not `AddToCart`: a card click shows interest in a product, and there is no cart, so `AddToCart` would feed the ad algorithm a misleading signal. The event is configurable per carousel.

## D-020 Form providers (PRD Q1) — Accepted (M3)
Every form can be added as pasted embed code or as an iframe URL. **The owner uses Storelink** (an in-page widget; see D-048), so it is the first preset. Tally (submit message) and Google Forms (no signal) are presets too; Typeform and Jotform wait until the owner uses them. Anything else is "other" and reports no submits; the inspector and the checklist say so.

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
The product is "Rakit" in the UI, like the repo and package (`rakit-app`). The PRD calls it "LaunchPad"; the owner renamed it on 2026-10-24, and the PRD keeps its original wording. Internal identifiers keep the old name: the canvas message tag `launchpad-canvas` and the `@launchpad.test` test accounts.

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
- **Isolation:** the canvas is `<iframe sandbox="allow-scripts" srcdoc>`. Its origin is opaque, so page scripts can never reach the editor's cookies or DOM. Its document is `renderPage(doc, { mode: 'preview' })` plus a bundled runtime (`lib/editor/canvas/runtime.ts`, ≤ 8 KB; 10 KB since D-044) that carries a per-load channel id.
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

## D-044 Inline editing in the canvas — Accepted
- **Markers:** in preview mode the renderer marks every element whose whole content is a text or rich field with `data-lp-field="<path>"`, plus `data-lp-rich` for rich fields (`ctx.field(path, kind)`; CTA labels through `renderCta`). Export output never carries them, and a registry-wide test checks every marker against its block's schema.
- **Editing:** a double-click on a marked element makes it `contenteditable` (`plaintext-only` for text fields, `true` for rich ones).
  - Bold and italic come from the browser's Mod+B and Mod+I. Existing highlights and links survive editing; new links and highlights are added in the inspector.
  - Paste and drop insert plain text only.
- **While editing:** the runtime sends the field as a node list, at most once per frame. The editor checks the block and the field path against the schema, serializes the nodes (rich fields: canonical inline markup, D-009; text fields: plain text) and dispatches one `setBlockProp` with the inspector's coalescing key, so a typing run is one undo step. Patches for the edited block wait until editing ends, so the caret never jumps.
- **Keys:** Escape ends editing. Enter ends it in a text field and inserts a line break in a rich one. Mod+Z and Mod+Y end editing, then undo or redo. Mod+D and Mod+U do nothing. Every other key, Backspace and Delete included, stays in the field. In a `<summary>` the runtime inserts Space itself, because the browser would toggle the answer instead.
- **Ending:** focus leaving the field, the window losing focus, or the keys above end editing. The editor then re-renders the block from the document, which also restores a field whose last edit could not be stored (an emptied required field, text over its limit); a notice names the field and the reason.
- **Budget:** the canvas runtime may grow to 10 KB minified (from 8 KB, D-039).

## D-045 Uploads — Accepted (refines D-008)
- **Buckets:**
  - `uploads` (private) holds originals at `<workspaceId>/<uuid>.<ext>`: JPEG, PNG, WebP, GIF or AVIF, at most 10 MiB.
  - `assets` (public) holds the WebP variants at `<workspaceId>/<assetId>-1600.webp` and `-800.webp`.
- **Policies:** on `storage.objects`, members of the workspace named by the first folder (`public.workspace_from_path(name)` with `is_workspace_member`) may insert, read and delete in both buckets. Anyone may download from `assets` through its public URLs. Server code uses the signed-in user's session, never the service role.
- **Processing** (`POST /api/assets`): `sharp` reads at most 40 megapixels, applies EXIF orientation, keeps the first frame of an animation and drops metadata, then writes WebP at 1600 and 800 px wide (never enlarged, quality 80). The `assets` row records `<workspaceId>/<assetId>` with the 1600 variant's size and dimensions. The original is deleted whatever the outcome.
- **Unsupported:** HEIC (iOS converts photos to JPEG when a page asks only for these types), SVG, and anything sharp can't decode.

## D-049 Versions: storage, recording and rollback — Accepted (M3)
- **Storage:** each export's HTML goes to the private `page-versions` bucket (20 MiB per object, `text/html` only) at `<workspaceId>/<pageId>/<versionId>.html`. Members of the workspace may insert, read and delete there; nobody may update, so a stored export never changes (D-006).
- **Recording:** the browser uploads the file, then calls `record_page_version` (security invoker, so RLS applies). In one transaction it inserts the `page_versions` row (`kind 'export'`, hash, size, export settings and the draft revision the export was built from) and points the page at it. A `draft` page becomes `exported`; `live` and `archived` pages keep their status. A trigger rejects any `html_path` other than the row's own `<workspace>/<page>/<version>.html`.
- **Own versions only:** `pages (latest_version_id, id)` references `page_versions (id, page_id)`, so a page can only point at one of its own versions (M0/M1 review m-6).
- **Saved draft first:** opening the export dialog flushes autosave. While the draft can't be saved (offline, a conflict, a rejected save) the dialog says why and offers "Try again"; Download and Copy stay disabled. A recorded version therefore always matches a draft revision the server holds, and the top bar can say "Exported · up to date" (saved, and the revision equals the latest export's) or "Exported · changes since".
- **Order:** Download (a Blob link, so the HTML never opens on the editor origin, D-022) or Copy happens first; then the same bytes are uploaded and recorded. A failed record removes the upload and offers "Retry", which records the same build under a new version id. Each Download or Copy records one version.
- **File name:** the dialog edits the page slug (`<slug>.html`), unique per workspace.
- **Rollback:** Versions lists the newest 50 exports (local time, size, image mode, hash prefix). "Restore" loads the stored document, runs it through `safeParseDocument` (so older documents migrate) and dispatches `restoreDocument`, which replaces the whole document as one undo step; autosave saves it like any edit. A stored document that no longer validates shows "This version can't be restored: …" and changes nothing. "Download" saves the stored file again.
- **Dashboard:** each page shows "Edited …" and, once exported, "· Exported …"; its menu downloads the latest export. Deleting a page removes its stored exports first (a storage error doesn't block the delete). Dates render in UTC on the server and in the viewer's time zone after hydration.

## D-047 Tracking in exported pages — Accepted (M3)
- **Export only.** Vendor tags, the custom head/body code and the page runtime appear only in `mode: 'export'`; the editor preview never runs third-party code (Plan §2.10). The export dialog's "Include tracking" switch (`renderPage(…, { tracking: false })`) drops vendor tags and custom code but keeps the runtime's passthrough.
- **Head order:** charset, viewport, title, description, robots, `og:title`, `og:description`, `og:type`, `og:image` (absolute http(s) only), favicon link, `<style>`, then Meta base code (`fbq('init')` and `PageView` with an event id computed in the browser), one `gtag.js` loader (the GA4 id, else the Ads id) with a `config` per id, the GTM snippet, and the custom head code. `<body>` starts with the GTM and Meta `<noscript>` fallbacks; the custom body code comes after the footer and before the page script.
- **Page runtime** (`lib/tracking/snippet.js`, ≤ 2304 bytes minified since M4a, no globals): one dispatcher for `lp:track` DOM events (`{ name, params, ga? }`) and clicks on `[data-lp-event]`, whose JSON `data-lp-params` go to Meta and `data-lp-ga` (else the same params) to gtag and GTM. Each event gets an id (`<ms base36>-<8 random base36>`, `crypto.getRandomValues`) shared by `fbq('track', name, params, { eventID })`, `gtag('event', gaName, { …params, event_id })`, the GTM push (with `data-lp-gtm` on `<body>`) and the Ads conversion (with `data-lp-conversion`). Blocks fire events by dispatching `lp:track`.
- **Passthrough:** every `utm_*` key plus `gclid`, `fbclid`, `wbraid`, `gbraid` (at most 20 keys, values ≤ 500 characters) is read from the URL, merged over `sessionStorage['lp-params']`, and appended to `a[data-lp-cta]` web links and `iframe[data-lp-pass]` sources that don't already have that key. The hash and other parameters stay as typed; `#…`, `tel:` and `mailto:` links are untouched.
- **When it ships:** with vendor ids (and tracking on), a CTA to a web URL, a CTA event or a passthrough iframe. A page whose CTAs only jump within the page still ships no JavaScript.

## D-048 Form Embed — Accepted (M3)
- **Modes:** pasted embed code (`mode: 'snippet'`, the default, up to 20,000 characters, emitted verbatim in export only) or an iframe (`mode: 'iframe'`: an absolute http(s) URL, a height of 200–4000 px, lazy below the fold, `data-lp-pass` so UTM and click ids reach it). An empty or unsafe form address renders "Form address missing" in the page language.
- **Preview** shows a placeholder ("Form · <provider>", "Shows in the exported page") and never the iframe or the code; the Form Embed snippet is `exportOnly`. Plan §2.10 mentioned a "preview form" toggle; it is dropped. Nested iframes inherit the canvas sandbox (no `allow-same-origin`, `allow-forms` or `allow-popups`), so a provider form there can't keep state or submit and would look broken. The form is tested in the exported file.
- **Providers** (`lib/blocks/form-embed/providers.ts`), detected from the iframe URL's host or a URL in the code:
  - **Storelink** (`storelink.id`, `gabung.id`), `conversions: 'self'`. Read from its loader and widget bundle on 2026-10-24: the loader requires `<script id="evf-widget-script">`, inserts `div#evf-embed-widget` before it and loads a ~627 KB Nuxt widget into the page itself (no iframe). The widget fires its own Meta Pixel `trackSingle` events for the pixels and events configured in Storelink (on the form, and `Purchase` with the order value on success) plus Conversions API, GTM, TikTok and Snack Video, reusing `window.fbq` when the page has it. It reads `fbclid` and the page URL itself. After an order it navigates the page to the store's `/success` or `/payment` page, or opens WhatsApp. So this page fires no `Lead` for it (no double count), passes nothing into it, ignores the thank-you URL, and holds at most one Storelink form (fixed ids). Owner: use the same Meta Pixel ID in Storelink as on the page, and don't add PageView there.
  - **Tally** (`tally.so`), `conversions: 'message'`: a string message containing `Tally.FormSubmitted` from `https://tally.so`. Share links `/r/<id>` become `/embed/<id>?transparentBackground=1`.
  - **Google Forms** (`docs.google.com/forms`), `conversions: 'none'`; `embedded=true` is added.
- **Submit detection** (snippet ≤ 1024 bytes, shipped only when a form's provider posts messages): a message counts only when its `source` is an iframe inside that form's root, its origin is the provider's and its data matches; then `lp:track` `Lead` once per form, and, with a thank-you URL (http(s)), `location.assign` after 500 ms.
- **Performance (M7):** measure a Storelink page in the Lighthouse work; if mobile Performance drops below 90, load the code when the form section nears the viewport.

## D-046 Export images — Accepted (M3)
- **Portable** (the default) inlines block images as `data:` URIs. An uploaded asset's `-1600.webp` URL is swapped for its `-800.webp` variant: 800 px covers a 400 CSS px slot at 2× on the phones ad traffic lands on, and keeps a typical page under the 1 MB warning; 1600 px roughly triples the file. Each URL is fetched once (`mode: 'cors'`, no credentials); PNG, JPEG, WebP, GIF and AVIF are inlined.
- **Failures stay links.** An image the browser can't fetch (a host without CORS, a 404) or that isn't one of those types keeps its URL, and the checklist counts it ("… couldn't be inlined and stay links"). The export never fails on an image.
- **Hosted** leaves block images as URLs (Supabase Storage public URLs for uploads).
- **Favicon:** in both modes it is drawn into a 64×64 PNG on a canvas and inlined (PRD §6.6); one that can't be read is dropped and counted.
- **Social image** (`og:image`) is never inlined: crawlers need an absolute URL.
- The document is never changed by export; the export copy is built with `structuredClone`.

## D-050 Remaining blocks (M4a) — Accepted
- **Library:** Spacer/Divider, Image + text, Logos strip, Gallery (product showcase), Pricing/offer, Countdown (D-051), Video (D-052), Sticky CTA bar, Cookie banner and Custom HTML (D-053). A new palette group, **Utility**, holds Spacer, Cookie banner and Custom HTML.
- **Conditional fields:** `when(schema, key, values)` marks a field the inspector shows only while a sibling has one of `values` (Form Embed's iframe and code fields, a countdown's end message, autoplay seconds). Hidden values are kept. Labels may be scoped by parent key (`'video.url'`).
- **One high-priority image** (refines D-016): only the first block of the first section that has an image gets `fetchpriority="high"`, on its first image, and only in export (M0/M1 review m-5).
- **Floating blocks:** the Sticky CTA bar and the Cookie banner are ordinary blocks; their stylesheets fix them to the viewport, collapse their own band with `:has()` and pad the page bottom so the bar never covers the footer. The cookie banner sits above the bar when both exist. The canvas measures a block by its content when its wrapper has no height.
- **Cookie banner:** a notice, not a consent gate. Tracking loads either way; pages aimed at EU or UK visitors need a consent manager in the custom head code. It shows until dismissed (remembered in `localStorage`) and never without JavaScript.
- **Defaults never invent proof:** Logos and Pricing default to `[REPLACE: …]` names and no prices.

## D-051 Countdown to a fixed deadline — Accepted (M4a)
- **No evergreen timer:** a timer that restarts for every visitor states an urgency that isn't real, which Meta and Google ad policies treat as misleading. The deadline is a wall-clock time (`YYYY-MM-DDTHH:MM`, impossible dates rejected) in WIB, WITA, WIT or UTC, so it is the same moment for every visitor.
- **Pure renderer:** `countdownEndMs` converts it with civil-date arithmetic (no `Date`); the snippet (≤ 1024 bytes) reads the clock in the browser, rounds the remaining seconds up (so it reads 00:00 exactly at the deadline) and ticks on whole seconds.
- **The end:** the block shows its message (or "Promo telah berakhir") or hides itself, already at load. In the canvas it never hides. Without a deadline it renders nothing in export, and the checklist warns about an ended or unset countdown.

## D-052 Video facade — Accepted (M4a)
- **URLs:** YouTube (`watch?v=`, `youtu.be`, `/shorts/`, `/embed/`, `/live/`, `m.` and `nocookie` hosts) and Vimeo (`vimeo.com/<id>`, `player.vimeo.com/video/<id>`); anything else shows "Video address missing".
- **Facade:** a link to the video (it works without JavaScript) with a poster and a play button in a ratio box. The snippet (export only, ≤ 768 bytes) swaps in `youtube-nocookie.com` or Vimeo with `dnt=1` on click, so no player request happens before the visitor asks.
- **Poster:** the video's own poster image (inlined in Portable mode), else the hero image when the video is the Hero's media, else YouTube's thumbnail URL (never inlined), else a dark box (Vimeo).
- **Hero media:** Hero takes an optional video; Hero and Video share one snippet, which ships once. The facade CSS lives in base CSS (still ≤ 4 KB).

## D-053 Custom HTML and the canvas channel — Accepted (M4a)
- **Sanitizer** (`lib/sanitize/html.ts`, parse5 8.0.1, moved forward from M6): parses and never executes; keeps listed tags and attributes; removes scripts, frames, forms, SVG/MathML, `on*` handlers, unsafe URLs, `data-lp-*` and ids starting `b-`/`s-`; keeps `<style>` minus `@import`, external `url()` and `expression()`.
- **Export:** sanitized code, or the code verbatim when the owner turns on "Run scripts in the exported page". The checklist names each block that runs scripts, and each block that loses parts with scripts off, with what it loses (iframe, form, script, event handlers, unsafe links); a removed iframe points to the Video block. The CSS cleaner works chunk by chunk between `;`, `{` and `}`, so it stays linear on a 40 KB data URI.
- **Canvas:** the code never enters the canvas document. It renders in a nested `<iframe sandbox="allow-scripts" srcdoc>`, a second opaque origin that can't read the canvas DOM or its channel id; the frame reports its height (clamped 20–4000 px) and takes no pointer events, so a click selects the block.
- **Channel hardening** (closes M2a review M4 and M2b review M3/M13):
  - An inline edit counts only for the selected block or the block whose edit session the editor already accepted.
  - An edit carries at most 2000 nodes, link labels included.
  - The runtime acts only on messages from its parent window; the editor only on messages from the current iframe.
  - A second `load` means the canvas navigated: the editor builds a new frame and channel, and sends nothing but the greeting until ready.
  - More than 3 error rebuilds in 10 s stop rebuilding and say so.
- **No flash after Escape:** the editor never sends patches for the block being edited, so a sync in flight can't show an older value when editing ends; `editEnd` resends the block from the document.

## D-054 Product Carousel, M4 — Accepted (M4a)
- **Autoplay** (off by default, 2–15 s per card): exported pages only, never with reduced motion. It skips its turn while the carousel is hovered, focused (except its pause button), off-screen or in a hidden tab, and wraps to the first card. A swipe, click, scroll or key in the carousel pauses it; the pause button (WCAG 2.2.2) then reads "Play" and starts it again. With reduced motion and in the canvas the button is hidden.
- **Fixes:** two fast clicks advance two cards; there is one dot per scroll position (5 dots for 8 cards at 4 per view); an empty track isn't focusable (M0/M1 review m-3, m-4).
- **Card events** (D-019): `ViewContent` by default, `AddToCart` or none. Card buttons carry `data-lp-event`, `data-lp-params` (Meta) and `data-lp-ga` (GA4/GTM), only on pages with tracking ids, so a page with nobody to send to ships no runtime.
- **JSON-LD** (off by default): an `ItemList` of `Product` with name, absolute image and `Offer` price, in export only. No ratings: review markup must come from real reviews, and the owner's ratings are self-reported.
- **Bulk paste:** "Paste rows" takes spreadsheet rows (title, price, compare-at price, image URL, link), tab-, comma- or semicolon-separated with CSV quoting and an optional header. Prices parse by the page currency (`Rp149.000`, `Rp 1.250.000,00`, `1,234.50`); a cell with anything but a currency sign, digits and separators (`149rb`, `250 g`) is an error, never a guess. Bad rows are named by row number and skipped, rows past the 50-card limit are reported, and the paste is one undo step (`listInsertMany`).
- **Budgets:** carousel snippet ≤ 2048 bytes (from 1536), page runtime ≤ 2304 (from 2048). A page using every snippet ships ≤ 10,240 bytes of inline JS (the example: 6,342).

