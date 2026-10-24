# LaunchPad — Milestone Plan

**Status:** proposed for owner review · 2026-10-21
**Spec:** [`docs/PRD.md`](PRD.md) · **Decisions:** [`docs/DECISIONS.md`](DECISIONS.md) (D-xxx below)
**Detailed task plans:** [M0 Foundation](superpowers/plans/2026-10-21-m0-foundation.md) · [M1 Renderer](superpowers/plans/2026-10-21-m1-renderer.md) · [M2a Editor core](superpowers/plans/2026-10-22-m2a-editor-core.md) · [M2b Direct manipulation](superpowers/plans/2026-10-22-m2b-direct-manipulation.md) · [M3 Export + tracking](superpowers/plans/2026-10-24-m3-export-tracking.md). Plans for M4–M7 are written when each milestone starts, because each one depends on interfaces the previous milestone settles.

---

## 1. Approach

1. **Renderer first.** The page is data, and `renderPage(doc, { mode })` is a pure, deterministic function that runs in Node and in the browser. Preview, export and hosting all use it, so the most important contract is proven in M1 before any editor UI exists.
2. **Everything is built in-house** (PRD §5.2): registry, canvas, overlay, drag and drop, inspector, history. A test keeps page-builder, DnD and carousel frameworks out of `package.json` (§7).
3. **Milestones close only on green gates.** Each one has exit criteria, all of them tests except where marked as a manual check. Commits are small, and the test is written before the code.
4. **Safe by construction.** All exported markup goes through an escaping template tag. Untrusted HTML (Custom HTML, imports) only runs in opaque-origin sandboxes, never on the editor origin.

## 2. Where I'd change or sharpen the PRD

The PRD asked me to challenge decisions that look wrong. My verdict on each, with reasons:

1. **Supabase vs. Firebase: keep Supabase** (D-001). The data is relational, documents fit JSONB, RLS covers workspace scoping, and AI cost caps become one atomic SQL function.
2. **Portable images by default: keep, with three adjustments.**
   - (a) Images are resized to WebP variants (1600 px and 800 px wide) at upload, so export just inlines bytes that are already small (D-007, D-008).
   - (b) `loading="lazy"` saves nothing for inlined images, because their bytes are already in the HTML. Only the size budget protects LCP, so the export summary shows per-block bytes and warns at 1 MB / 3 MB.
   - (c) Portable is also the cheaper default. With Hosted mode, ad traffic downloads images from Supabase Storage, which counts against your egress quota. With Portable, your static host serves them.
3. **Custom drag and drop: keep it custom, and design it so dragging never crosses into the iframe.**
   - The overlay lives in the editor page, layered over the canvas iframe. The iframe only reports block geometry (rects) by `postMessage`.
   - During a drag, a transparent shield covers the iframe so every pointer event stays in the parent. Hit-testing runs against the cached rects, and auto-scroll asks the iframe to scroll.
   - Keyboard reordering (Alt+↑/↓) goes through the same command bus.
   - M2 opens with a throwaway spike of this design before building the real engine.
4. **Hosted pages must not use the editor's origin** (D-022). PRD §6.8 serves `/p/[slug]` from the app. Exported pages run third-party scripts and optional Custom HTML, and Supabase's session cookies are readable by JavaScript on the editor origin. A compromised form embed could take over the account. Pages are served from a separate domain (`APP_BASE_DOMAIN`), path-based by default.
5. **Version HTML goes in Storage, not in a Postgres `text` column** (D-006). A few hundred Portable exports would fill a free-plan database. The table keeps path, size and hash.
6. **Export runs in the browser** (D-007). This avoids Vercel's 4.5 MB function body limit and needs no server compute.
7. **Platform changes since the PRD was written:**
   - Next.js 16 renamed `middleware.ts` to `proxy.ts` (D-003).
   - Supabase now issues publishable/secret keys and recommends `auth.getClaims()` (D-004).
   - pnpm 12 blocks dependency build scripts unless they are allowlisted (D-002).
8. **Public sign-ups must be off** (D-005). With the public key, anyone could otherwise register and use AI quota and storage.
9. **Node 24 is required** (D-002). The machine runs Node 20, which is end-of-life and below the minimum several dependencies need.
10. **Preview is production minus third-party code.** The editor preview never loads pixels, GTM or form scripts, so they cannot fire events from the editor or run there. Snippet-type form embeds show a placeholder in preview, with an explicit "preview form" toggle (M3).

## 3. Key risks

| # | Risk | Impact | Mitigation | Where |
|---|---|---|---|---|
| R1 | The custom editor engine (DnD across the iframe boundary, inline editing, overlay) takes longer than planned | Delays v1 | Design from §2.3; a throwaway spike first; geometry and hit-testing live in the parent; message protocol validated with Zod; Playwright drag/reorder/undo tests | M2 |
| R2 | Live preview gets janky with 30+ blocks or 20+ carousel items | Editor feels slow | Per-block render cache keyed on Immer's structural sharing; patch only the changed block's DOM in the iframe; debounce typing; perf test with a 40-block fixture | M2 |
| R3 | Portable files miss Lighthouse ≥ 90 / LCP < 2.5 s | AC2 fails on image-heavy pages | Pre-sized WebP variants, size budget warnings, per-block size report, Hosted mode; Lighthouse CI on the example export | M3, M7 |
| R4 | Tracking can't be verified against Meta/Google in tests | Silent attribution bugs | Playwright stubs `fbq`/`gtag`/`dataLayer` and asserts the exact calls; manual check with Meta Pixel Helper / Tag Assistant before the first live test | M3 |
| R5 | Form providers differ in submit signals; some emit none | `Lead` not fired | Presets per provider; the UI states clearly when a provider has no signal; thank-you redirect option | M3 |
| R6 | Untrusted HTML (Custom HTML, imports) reaches the editor origin | Account takeover | Opaque-origin sandboxed iframes (`allow-scripts` without `allow-same-origin`); the parent treats every iframe message as untrusted (schema-validated, scoped to the current edit); parse-only importer; canary e2e test | M2, M4, M6 |
| R7 | AI output breaks policy or schema; costs run away | Ad rejections, bills | Structured outputs plus our own Zod validation and compliance linter, 2 retries, `[REPLACE: …]` placeholders, atomic daily caps, `ai_runs` logging | M5 |
| R8 | Determinism drift (Intl, clock, random ids, esbuild version) | Snapshot churn; export hashes not comparable | No Intl/Date/random in the renderer (a test enforces it); IDs come from the document; esbuild version pinned | M1 |
| R9 | Auth misconfiguration (open sign-ups, a route missing auth) | Data exposure | Default-deny routing (`decideAuthRoute`); `requireUser()` in every server action; generic pgTAP test that every table has RLS; sign-up-disabled e2e test | M0 |
| R10 | Scope: M0–M7 is a large program | v1 slips | v1 = M0–M4, per the PRD; M2 may be split into two plans; nothing from M5+ starts before the M4 acceptance review | All |

## 4. Architecture at a glance

```
lib/schema      Zod: ids, primitives (Link, Image, Cta, styles), theme, settings,
                PageDocument (built from the registry), migrations
lib/blocks      registry + one folder per block: schema.ts, render.ts, styles.css,
                [snippet.js], *.generated.ts, index.ts, *.test.ts
lib/renderer    html`` tag + escaping, sanitizeUrl, inline markup, price format, i18n,
                render context, fragments (image, CTA, icons, stars), theme CSS,
                CSS/JS collectors, renderPage
lib/export      (M3) image inlining, size report, sha256, file assembly
lib/tracking    (M3) Meta/gtag/GTM snippet generators, event dispatcher, UTM passthrough
lib/ai          (M5) Claude client, structured output + retry, block catalog, wizard steps,
                compliance linter, contrast validator, run logging, limits
lib/import      (M6) quarantine, parse5 parse, sanitizer, script classifier, scoped CSS,
                mapper, no-AI fallback, report
lib/supabase    server/browser clients, session refresh; generated database types
lib/auth        routing rules (default-deny), safe redirects, requireUser
components/editor  canvas (iframe host, overlay), dnd, inspector, palette, toolbar   (M2)
scripts/        build-assets (esbuild → *.generated.ts), render CLI, create-owner, policy
supabase/       migrations, pgTAP tests, config.toml
tests/          e2e (renderer, app), fixtures, helpers, repo-level unit tests
```

**Core contracts** (set in M1):
- `renderPage(doc: PageDocument, { mode: 'preview' | 'export', minify? }) → { html, bytes, cssBytes, jsBytes, blocks: BlockStat[], warnings }`
- `defineBlock({ type, category, label, description, icon, schema, defaultProps(newId), css, snippet?, landmark?, render(props, ctx) → SafeHtml })`
- `PageDocument = { schemaVersion: 1, settings: PageSettings, sections: Section[] }`. A section is `{ id, anchor?, style, blocks: BlockInstance[] }`; a block instance is `{ id, type, props, style }`.

## 5. Milestones

### M0 — Foundation · [detailed plan](superpowers/plans/2026-10-21-m0-foundation.md)
- **Scope:** Node 24 + pnpm 12 toolchain; Next.js 16 scaffold (TypeScript strict, Tailwind, ESLint, Prettier, shadcn); Vitest; dependency-policy guard; CI (lint, typecheck, unit, DB tests); local Supabase; core migration (`workspaces`, `pages`, `page_versions`, `templates`, `assets`) with RLS through `is_workspace_member()`; pgTAP RLS tests; Supabase clients; `proxy.ts` session refresh; default-deny routing; login/logout; protected `(editor)` layout; owner bootstrap script; Playwright auth e2e; `CLAUDE.md`; `.env.example`.
- **Exit:** `pnpm lint && pnpm typecheck && pnpm test` green; `pnpm db:test` green, including "every public table has RLS enabled"; `pnpm test:e2e:app` green (redirects, login/logout, tampered cookie, sign-up disabled, no open redirect).

### M1 — Renderer first · [detailed plan](superpowers/plans/2026-10-21-m1-renderer.md)
- **Scope:** schema primitives/theme/settings; HTML safety utilities; asset pipeline (esbuild → committed generated modules); block contract and render context; Hero, Benefits, Testimonials, FAQ, Footer; Product Carousel (static markup, then the snippet, ≤ 1.5 KB); registry and document schema with unique-ID validation; migrations; `renderPage` with CSS/JS collectors, preview mode, landmarks, stats; example document; `pnpm render` CLI; registry-wide XSS/validity tests; Playwright carousel e2e (JS on, JS off, touch, keyboard, two carousels, no overflow at 360 px).
- **Exit:** all unit and snapshot tests green; html-validate clean on every block and the full example; carousel snippet ≤ 1536 bytes; `pnpm render` writes `out/example.html`, which opens via `file://` with no external requests; `pnpm test:e2e` green.

### M2 — Editor engine MVP (custom) · [M2a plan](superpowers/plans/2026-10-22-m2a-editor-core.md) · [M2b plan](superpowers/plans/2026-10-22-m2b-direct-manipulation.md)
Split into two plans: **M2a** (state, canvas, inspector; [detailed plan](superpowers/plans/2026-10-22-m2a-editor-core.md)) and **M2b** (DnD, inline editing, uploads; [detailed plan](superpowers/plans/2026-10-22-m2b-direct-manipulation.md)).
- Dashboard: list, create blank, open, delete, rename; page CRUD server actions with `requireUser()`. Draft saves use a revision counter (D-035).
- Editor state: Zustand store, Immer `produceWithPatches`, a command bus, undo/redo stacks, coalesced typing, selection; autosave (debounced ~800 ms, flushed on blur/unload, conflict warning).
- Canvas: sandboxed iframe (`sandbox="allow-scripts"`, opaque origin) rendered with `renderPage(mode:'preview')`; a preview runtime reports geometry and applies per-block patches; Zod-validated message protocol; per-block render cache.
- Overlay (hover, selection, block toolbar: move, duplicate, delete) and the custom pointer DnD engine (palette → canvas, reorder, cross-section, auto-scroll, drag shield, touch, keyboard, aria-live announcements). Starts with the spike from §2.3.
- Inspector generated from the Zod schemas, plus controls: color (with contrast hint), image (upload/URL), link (URL, section, default; UTM option), rich-text field, repeater with drag reorder (carousel items), number/enum/toggle. Palette from the registry; responsive toggle (390/768/1280).
- Inline text editing in the iframe (`data-lp-field` markers in preview mode only), serialized back to the inline markup.
- Uploads (D-008): Storage bucket and RLS migration, sharp processing route, `assets` rows.
- **Exit (e2e):** create page → add Hero/Carousel by drag → edit inline and in the inspector → reorder items and blocks → undo/redo every step → reload, and the draft persists; 40-block perf fixture stays interactive.

### M3 — Export + tracking · [detailed plan](superpowers/plans/2026-10-24-m3-export-tracking.md)
- Settings additions (SEO: OG image, favicon; tracking IDs validated by format; custom head/body snippets; default CTA target); tracking generators and an event dispatcher with `event_id` (D-019, D-021); UTM/click-ID passthrough to CTAs and form URLs.
- Form Embed block (iframe/snippet/presets, lazy, responsive, submit detection, thank-you redirect; D-020).
- Export pipeline in the browser (D-007): Portable/Hosted images, minify toggle, tracking toggle, size report per block, sha256, Download `<slug>.html`, Copy HTML.
- Pre-export checklist (PRD §6.7, plus `[REPLACE:]` placeholders and Custom HTML scripts); versions in Storage (D-006) with list and one-click rollback; status updates (draft/exported).
- **Exit (e2e):** build → export → open via `file://` with stubbed vendor scripts → assert PageView, CTA event, `Lead` on a simulated provider message, UTM/gclid appended to CTA and form URLs; version recorded with hash; rollback restores the draft.

### M4 — Production workflow (completes v1)
- Duplicate page; templates (built-in seeds plus "save as template"); block presets; tags, search, status filter, archive.
- Remaining blocks: Logos strip, Product showcase/gallery, Pricing/offer box, Countdown, Image + text, Video embed (lazy facade; also usable as Hero media), Sticky mobile CTA, Custom HTML (sanitized, scripts sandboxed in preview, opt-in in export), Spacer/Divider, cookie banner.
- Carousel polish: bulk paste (CSV/TSV), autoplay (pause on hover/touch/focus, respects reduced motion), per-carousel tracking event, JSON-LD toggle.
- **Exit:** the acceptance review for AC1–AC9 (§6), including a timed manual run of AC1 (template → edit → download in < 15 minutes).

### M5 — AI foundation + Wizard (v1.1)
- AI service: server-only client, model from `AI_MODEL` (default `claude-opus-5-5`), structured outputs + Zod validation + 2 retries, prompt caching of system prompt and block catalog, streaming where useful, refusal fallbacks, typed error handling, a disabled state when the key is missing (D-024).
- `ai_runs`, `wizard_sessions` migrations; per-workspace rate limit and daily cost cap (atomic SQL), shown in the UI.
- Block catalog generated from the registry; wizard steps 1–6 with per-card/per-field regenerate; applying the result is one undoable command.
- WCAG AA contrast validator with auto-adjust; rule-based compliance linter (id/en); `[REPLACE: …]` placeholders.
- Evals: golden fixtures (schema validity, contrast, lint, injection), run offline in CI from recorded responses; live runs are opt-in.

### M6 — HTML Import (v1.1)
Private quarantine bucket, upload limits and sniffing, parse5 parse (never execute), default-deny sanitizer, script classifier (tracking → settings, form embeds → Form Embed, UI scripts → native blocks, unknown → removed or explicitly kept sandboxed, high-risk → always removed), scoped CSS (postcss selector prefixing), base64 image extraction, AI mapping by node ID (URLs must exist in the DOM), no-AI fallback, side-by-side fidelity view (no-script sandbox plus injected CSP), Import Report, canary-script and prompt-injection tests.

### M7 — Polish + optional hosting
Full Playwright journeys (template → export; wizard → export; import → edit → export); Lighthouse CI (mobile, Performance ≥ 90) and axe checks on example exports; optional hosting on the separate domain (host routing in `proxy.ts`, Vercel Domains API, DNS records UI, CDN caching with purge on republish); first-party beacon (`page_events`); security review.

## 6. Acceptance-criteria traceability

| AC | Proven by | Milestone |
|---|---|---|
| 1 Template → edit → download < 15 min | e2e journey plus a timed manual run | M4 (M3 download) |
| 2 `file://` + static host, self-contained, mobile perf | `file://` e2e (M1, M3); Lighthouse CI | M1, M3, M7 |
| 3 No page-builder framework | `tests/unit/dependency-policy.test.ts`; §7 list | M0 |
| 4 Carousel 8+ items, native swipe, no-JS, arrows/dots/autoplay, keyboard | carousel e2e (M1); autoplay e2e (M4) | M1, M4 |
| 5 Carousel CTAs carry UTM/click IDs and fire events | export e2e with stubs | M3, M4 |
| 6 Form renders; PageView + Lead | export e2e with simulated provider message | M3 |
| 7 Duplicate, re-export, rollback, traceable exports | e2e + `page_versions` (hash, size, time) | M3, M4 |
| 8 Undo/redo for all actions incl. item reorder | editor e2e; command-history unit tests | M2, M4 |
| 9 RLS on all tables | pgTAP "every public table has RLS enabled" + per-table tests | M0 → every migration |
| 10–15 AI wizard and import | evals, unit tests, canary/injection e2e, limits tests | M5, M6 |

## 7. Dependencies

**Expected direct dependencies** (anything else needs a note in DECISIONS):
- **Runtime:** `next`, `react`, `react-dom`, `@supabase/supabase-js`, `@supabase/ssr`, `zod`, `server-only`; the shadcn/ui output (`@base-ui/react`, `class-variance-authority`, `cn`, `shadcn` (CSS), `lucide-react`, `tw-animate-css`; D-031); `zustand@5.0.15`, `immer@11.1.21` (exact pins, M2a), `sharp` (M2b); `@anthropic-ai/sdk` (M5); `parse5`, `postcss`, `postcss-selector-parser` (M6).
- **Dev:** `typescript`, `eslint`, `eslint-config-next`, `eslint-config-prettier`, `prettier`, `tailwindcss`, `@tailwindcss/turbopack`, `vitest`, `happy-dom`, `@playwright/test`, `tsx`, `esbuild`, `html-validate`, `supabase` (CLI), `@types/*`; `@axe-core/playwright`, `lighthouse` (M7).

**Banned** (enforced by test):
- **Page builders:** `grapesjs*`, `@grapesjs/*`, `@craftjs/*`, `@measured/puck`, `@puckeditor/*`, `@builder.io/*`, `@webstudio-is/*`.
- **DnD:** `@dnd-kit/*`, `react-dnd*`, `react-beautiful-dnd`, `@hello-pangea/dnd`, `sortablejs`, `react-sortablejs`, `dragula`, `react-dragula`, `interactjs`, `@atlaskit/pragmatic-drag-and-drop*`, `react-grid-layout`.
- **Carousels:** `swiper`, `keen-slider`, `embla-carousel*`, `slick-carousel`, `react-slick`, `flickity`, `@glidejs/glide`, `@splidejs/*`.

Base UI primitives (dialogs, popovers) are UI building blocks, not builders or DnD, so they are allowed.

**Exported pages have zero runtime dependencies.** Their only external requests are tracking tags, the form embed, optional video embeds, and images in Hosted mode.

## 8. PRD open questions: defaults in effect

| Q | Default (decision) | What would change it |
|---|---|---|
| 1 Form providers | Generic iframe/snippet + Tally, Typeform, Jotform, Google Forms presets (D-020) | **Tell me which providers you use**, especially local COD order-form services; M3 presets those first |
| 2 Manual carousel data | Yes: repeater + bulk paste (D-023) | — |
| 3 Carousel events | Meta `ViewContent`, GA4 `select_item`; configurable (D-019) | If your campaigns optimize for a different event |
| 4 Hosted URL scheme | Path-based on a separate domain (D-022) | Need for per-page subdomains (wildcard DNS) |
| 5 Server-side conversions | Later; every event gets an `event_id` now (D-021) | — |
| 6 Wizard languages | Indonesian + English | — |
| 7 Import limits | 5 MB; unknown scripts opt-in, sandboxed; high-risk never | — |
| 8 Product URL reader | Later (needs an SSRF-safe fetcher) | — |

## 9. What I need from you

- [ ] **Before M0:** OK to install Node 24 with nvm and make it the default (`nvm install 24 && nvm alias default 24`). Your other projects would also default to Node 24 (`nvm use 20` switches back per shell).
- [ ] **During M0:** start Docker Desktop. Local Supabase and the database tests need it.
- [ ] **By M2:** a GitHub repo, if you want CI to run (no `gh` CLI or remote yet), and a hosted Supabase project plus a Vercel project for deployment (env vars per `.env.example`, sign-ups disabled in the Supabase dashboard).
- [ ] **By M3:** which form providers you use; your Meta Pixel / GA4 / Google Ads / GTM IDs for a manual end-to-end check.
- [ ] **By M5:** an Anthropic API key in the server env.
- [ ] **By M7 (optional):** a domain for hosted pages, separate from the editor's.

## 10. Plan documents

| Milestone | Plan | Status |
|---|---|---|
| M0 Foundation | [`superpowers/plans/2026-10-21-m0-foundation.md`](superpowers/plans/2026-10-21-m0-foundation.md) | Ready for review |
| M1 Renderer | [`superpowers/plans/2026-10-21-m1-renderer.md`](superpowers/plans/2026-10-21-m1-renderer.md) | Ready for review |
| M2a Editor core | [`superpowers/plans/2026-10-22-m2a-editor-core.md`](superpowers/plans/2026-10-22-m2a-editor-core.md) | Done |
| M2b Direct manipulation | [`superpowers/plans/2026-10-22-m2b-direct-manipulation.md`](superpowers/plans/2026-10-22-m2b-direct-manipulation.md) | Done |
| M3 Export + tracking | [`superpowers/plans/2026-10-24-m3-export-tracking.md`](superpowers/plans/2026-10-24-m3-export-tracking.md) | In progress |
| M4–M7 | Written at the start of each milestone | — |
