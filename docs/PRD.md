# PRD: LaunchPad — Static Landing Page Builder for Ad Testing

> Hand this file to Claude Code. Start by reading it fully, then enter plan mode and propose a milestone plan before writing code. Save the final plan as `docs/PLAN.md` and keep this file as `docs/PRD.md`.
>
> **Revision 2 changes:** (1) the builder engine is built **from scratch**: no GrapesJS or any other page-builder framework; (2) the output is **one self-contained static `.html` file** that I can download; (3) a new **Special Components** category, starting with a **Product Carousel**.
>
> **Revision 3 changes:** an **AI Assistant** powered by the Claude API: (1) a step-by-step **wizard** that suggests product niches, themes/colors, and copy; (2) an **HTML Import** that converts one uploaded `.html` file into an editable page, with strict **JavaScript guardrails**. See 5.4, 6.11, 6.12.

## 1. Problem

I test products with Google Ads and Meta Ads. Each test needs a fast, disposable landing page. Today I build them by hand as static HTML with an embedded form from an external service (the form is not built by us). It is slow to create, hard to keep organized across many tests, and hard to duplicate/modify.

## 2. Goal

A web app where I can:
1. Build a landing page by drag-and-drop from a library of conversion-focused blocks, using a **custom-built editor engine**.
2. Export it as **one self-contained static `.html` file** (inline CSS, tiny inline JS, no framework runtime) and **download it with one click**, so I can upload it to any hosting. Hosting from the app itself (URL or custom domain) is an optional convenience, not the core.
3. Embed an external form (iframe or script snippet) and wire tracking (Meta Pixel, Google tag, GA4, GTM) with UTM/click-ID passthrough.
4. Use **special components** (e.g., Product Carousel) that go beyond plain content blocks.
5. Manage many pages/tests in one dashboard: duplicate, archive, version.
6. Use an **AI wizard** to go from a product idea to a ready draft page: niche and angle, theme and colors, title, subtitle, about-product copy, and page structure.
7. **Import an existing static `.html` file** and turn it into an editable page, with guardrails that neutralize risky JavaScript.

**Primary success metric:** go from "new product idea" to a downloaded, tracked landing page in **under 15 minutes**, by duplicating a template and swapping content.

**Non-goals (v1):** building our own form backend, payments/checkout, multi-user teams/billing, a full CMS, an open-ended chat agent that can do anything in the app (the AI is a guided wizard plus an importer, see 6.11 and 6.12), AI image generation, multi-page sites (one page = one HTML file).

## 3. Users

- Single primary user (me, the owner). Auth required, but v1 is single-tenant. Design the schema with a `workspace_id` so multi-user can be added later without a rewrite.

## 4. Tech Stack (decided)

| Concern | Choice | Notes |
|---|---|---|
| Framework | Next.js (App Router, latest stable), TypeScript strict | Frontend + backend (route handlers / server actions) |
| Hosting | Vercel | Runs the editor app (and optional hosted pages) |
| Database / Auth / Storage | **Supabase** (Postgres, Auth, Storage, RLS) | Preferred over Firebase: relational data (pages, versions) and SQL fit better. If you disagree, explain why in the plan before proceeding |
| Styling (editor UI only) | Tailwind + shadcn/ui | Not used in exported pages |
| **Builder engine** | **Custom, from scratch** | **Do not use GrapesJS, Craft.js, Puck, Builder.io, Webstudio, or any page-builder framework.** See 5.2 |
| Drag and drop | Custom, built on native Pointer Events | Keyboard-accessible reordering too. Small generic helpers are fine; no DnD framework unless you justify it in the plan and I approve |
| State | Zustand (+ Immer patches for undo/redo) | |
| Validation | Zod | Shared schemas between editor, API, renderer |
| Testing | Vitest (unit, renderer snapshots), Playwright (e2e: build → export → open file) | |
| **AI** | **Claude API** via the official Anthropic TypeScript SDK, called **server-side only** | Model ID comes from the `AI_MODEL` env var (never hardcoded). Structured output via tool use / JSON schema generated from the Zod schemas. Note: Claude Code is the tool used to *build* this app; the app itself calls the Claude API |
| HTML import parsing | `parse5` (or `linkedom`) for parsing, `postcss` for CSS, a strict allowlist sanitizer (own code, optionally `sanitize-html` as a base) | Parsing only. Uploaded HTML is never executed |

## 5. Core Architecture

**Key principle: the page is data, HTML is a pure function of that data.**

```
Editor (React)  ──edits──▶  PageDocument (JSON, Zod-validated)
                                   │
          renderPage(doc, {mode}) → one HTML string   ← pure function, no React in output
                                   │
        ┌──────────────────────────┼───────────────────────────┐
  Live preview               Export / Download            (Optional) Publish
  (sandboxed iframe,         single .html file            store snapshot, serve
   mode: "preview")          (mode: "export")             from Next.js route
```

### 5.1 Document model
- **PageDocument**: `{ version, settings, sections[] }`, where each section contains an ordered list of blocks. A block has `id`, `type`, `props` (typed per block), and optional `style` overrides. `settings` holds SEO, tracking, theme, form config, and export options.
- Include a `schemaVersion` and a migration function so old saved documents keep working as blocks evolve.

### 5.2 Builder engine (from scratch)
Build these pieces ourselves, as separate, testable modules:
- **Block registry**: each block type registers `{ type, category, schema (Zod), defaultProps, render(props, ctx) → { html, css, js? }, Inspector (React), icon }`. Categories: `content`, `conversion`, `special`.
- **Canvas**: renders the document in a sandboxed iframe through the *same* renderer as export (preview == production). Selection overlay, hover outline, drop indicators, and inline text editing are drawn by an overlay layer that talks to the iframe via `postMessage`.
- **Drag and drop**: drag from the palette onto the canvas, reorder within the canvas, and move between sections. Pointer-based with auto-scroll near edges, a clear insertion marker, and touch support. Keyboard alternative (select block → move up/down).
- **Inspector**: form UI generated from each block's schema plus custom controls (color, image picker, repeater lists with drag reorder, link with UTM option).
- **Commands + history**: every change is a command applied to the document via Immer, giving undo/redo and autosave for free.
- **Renderer**: `renderPage(doc, { mode })` pure function, no DOM access, runs on the server and in the browser, deterministic output (snapshot-testable).

### 5.3 Single-file export pipeline
The exported file is **one `.html` file**:
- Semantic HTML, a single inline `<style>` containing **only the CSS used by blocks present on the page** (no utility-framework bundle), and a single inline `<script>` containing **only the snippets required** (carousel, countdown, sticky CTA, UTM passthrough, form events). Minified. No JS at all if no block needs it.
- External requests are limited to: tracking tags (Meta, Google, GTM), the embedded form, optional video embeds, and images in "Hosted" mode.
- **Images**, chosen in the export dialog:
  - **Portable (default):** every image is compressed (WebP, sensible max width) and inlined as a data URI, so the file works anywhere offline. Show the final size and **warn above ~1 MB**, suggesting Hosted mode.
  - **Hosted:** images stay as absolute URLs on the CDN (Supabase Storage public URLs) for a lighter HTML file.
- **Fonts:** default to a system font stack. Optional embedded subsetted WOFF2 as a data URI. No Google Fonts requests by default.
- Export is a **Download** button (file name = page slug). A "copy HTML" button is also provided.
- Optional (secondary): **Publish** stores the same HTML as an immutable version and serves it from Next.js at `/p/[slug]` or a custom domain (see 6.8).

### 5.4 AI layer (Claude API)
- **Workflow, not a free-roaming agent.** Each AI feature is a fixed, server-orchestrated sequence of Claude calls with structured output. The model cannot call arbitrary tools, write files, access the network, or publish anything. This keeps it predictable, cheap, and testable.
- **The model never produces HTML or JS that we insert as-is.** It returns JSON (PageDocument fragments, theme tokens, copy fields, node mappings) validated by Zod. The renderer escapes all text. On validation failure: retry up to 2 times with the validation errors fed back, then show a friendly error.
- **The block catalog in prompts is generated from the block registry** (type, description, schema), so every new block (including special components) is automatically usable by the AI.
- Stream responses to the UI where useful. Use prompt caching for the stable prompt prefix (system prompt + block catalog) to reduce cost and latency.
- **Cost and abuse control:** log every run in `ai_runs` (feature, tokens in/out, latency, status; do not store raw uploaded HTML in logs), per-workspace daily limits, rate limiting, input size caps. If the API key is missing or the API fails, AI features show a clear disabled/error state and the rest of the app keeps working.
- **Privacy notice in the UI:** product details and uploaded HTML are sent to the Claude API for processing.
- Applying AI output to a page is **one undoable command** in the editor history.
- **Evals:** golden fixtures per feature, checked automatically for schema validity, contrast, compliance lint, and prompt-injection resistance (see 8).

## 6. Features

### 6.1 Dashboard
- List pages with: name, status (draft/exported/live/archived), last edited, last exported, tags (e.g., product, channel: `google`/`meta`).
- Actions: new (blank / from template), **duplicate**, archive, delete, open editor, **download HTML**.
- Search and filter by tag/status.

### 6.2 Editor
- 3-pane layout: block palette (left), canvas (center), inspector (right).
- Responsive preview toggle: mobile (default, since most ad traffic is mobile) / tablet / desktop.
- Drag to add, reorder, duplicate, delete blocks. Undo/redo. Autosave of draft.
- Inline text editing on canvas, plus inspector editing for props.
- Image upload to Supabase Storage with automatic resize/compression on upload.
- Save current page as a reusable template; "save block as preset".

### 6.3 Standard block library (v1)
Hero (headline, subheadline, CTA, image/video), Benefits/Features grid, Social proof / testimonials, Logos strip, Product showcase / gallery, Pricing / offer box, Countdown timer, FAQ accordion (native `<details>`), Image + text, Video embed (lazy), Sticky mobile CTA bar, Footer (Privacy / Terms / Disclaimer links), **Form Embed**, **Custom HTML** (raw, for anything else), Spacer/Divider.

### 6.4 Special Components (new category)

Special components are richer, interactive blocks with their own data structure and a small amount of vanilla JS. They live in the block registry under `category: "special"` and must follow the same rules as every block: Zod schema, pure renderer, inspector, snapshot tests, and **no third-party runtime library** in the exported file.

#### 6.4.1 Product Carousel (first special component)

A horizontally scrolling set of product cards, designed for ad traffic on mobile.

**Content (repeater, each item draggable to reorder; duplicate/delete per item):**
- Image (upload or URL), alt text (required prompt), title, short description (optional)
- Price, compare-at price (strikethrough, auto-computed discount % badge optional)
- Badge text (e.g., "Best Seller", "-30%"), rating (0–5, optional) with review count (optional)
- CTA label and link (per item), with option "use page default CTA / scroll to form"
- Bulk add: paste multiple rows (CSV/TSV: title, price, compare-at, image URL, link) to create items quickly

**Layout & behavior options:**
- Slides per view per breakpoint (mobile default ~1.3 to hint at scrolling, tablet 2–3, desktop 3–4), gap, card style (border/shadow/radius from theme)
- Image aspect ratio (1:1, 4:5, 16:9), fit (cover/contain)
- Navigation: arrows (hidden on touch by default), pagination dots, or none
- Autoplay (off by default; interval, pause on hover/touch, respects `prefers-reduced-motion`), loop on/off
- Section heading and subheading above the carousel

**Implementation requirements:**
- Built on **CSS scroll-snap** (`overflow-x: auto; scroll-snap-type: x mandatory`) so it works and swipes natively **even with JS disabled**. A tiny vanilla JS snippet (target ≤ 1.5 KB minified) only adds arrows, dots, autoplay, and active-slide state.
- Supports multiple carousels on one page without conflicts (scoped by block id).
- Accessibility: `role="region"` with `aria-roledescription="carousel"`, labelled slides, keyboard operable (arrows, Home/End), focus-visible styles, visible controls have accessible names.
- Performance: first visible images `fetchpriority`/eager when the carousel is above the fold, others `loading="lazy"`, explicit width/height and aspect-ratio to prevent layout shift.
- Tracking: each card CTA gets UTM/click-ID passthrough and fires a configurable event (e.g., Meta `ViewContent`/`AddToCart`-style custom event name, GA4 `select_item`) with item title and price as parameters. Define the exact event mapping in `docs/DECISIONS.md`.
- Optional: emit `Product`/`ItemList` JSON-LD for items (toggle, off by default for ad pages).
- Export in Portable mode must inline all item images; show per-block size contribution in the export summary so I can see which images are heavy.

#### 6.4.2 Extensibility
Adding another special component later must only require a new registry entry (schema, renderer, inspector, optional snippet). Candidate next components (not in v1): before/after slider, comparison table, review wall, stock/scarcity bar, floating WhatsApp/contact button, video testimonial carousel, sticky offer bar with timer.

### 6.5 Form Embed block (critical)
- Accepts: (a) iframe URL, (b) full script/embed snippet pasted as-is, (c) provider presets later (Tally, Typeform, Jotform, Google Forms, etc.).
- Handles responsive sizing and lazy loading.
- **Conversion tracking:** support (1) redirect to a thank-you page/URL after submit when the provider supports it, (2) `postMessage` listener for providers that emit submit events, firing `Lead` (Meta) and `generate_lead` (GA4/Google Ads) events. Document the limitation clearly in the UI when a provider offers neither.
- Option to have CTA buttons anchor-scroll to the form.

### 6.6 Page settings
- SEO: title, description, OG image, favicon (inlined as data URI in the export), `noindex` toggle (default ON for ad pages).
- Tracking: Meta Pixel ID, Google tag / Google Ads conversion ID + label, GA4 ID, GTM container ID, custom head/body snippets. Fire PageView automatically; allow event config on CTA clicks.
- **UTM / click ID passthrough:** persist `utm_*`, `gclid`, `fbclid`, `wbraid`, `gbraid` and append them to outbound CTA links (including carousel CTAs) and to the embedded form URL (as query params or hidden fields when supported).
- Theme: brand colors, font stack, border radius, button style. Global theme applies to all blocks.
- Cookie/consent banner block (simple, optional).

### 6.7 Export and download (core)
- Export dialog: image mode (Portable / Hosted), minify on/off, include/exclude tracking (useful for a clean test build), final size estimate with warnings.
- Downloads `<slug>.html`. The file must open correctly by double-clicking it (`file://`) and when uploaded to any static host.
- Pre-export checklist (warnings, not blockers): missing privacy link, missing title/description, no form, tracking IDs absent, large images, missing alt text, file size above budget.
- Each export is recorded (timestamp, settings, size, hash of HTML) so I can tell which version went into which ad test.

### 6.8 Versioning and optional hosting
- Every export/publish creates an immutable version snapshot. Rollback to any version in one click.
- Draft and exported versions are separate; unexported edits are clearly indicated.
- **Optional hosting (lower priority, after core export works):** serve the stored HTML at `/p/[slug]` and via custom domains (Next.js middleware maps `Host` → page; Vercel Domains API for adding/verifying domains; show DNS records in the UI). CDN-cached, invalidated on republish.

### 6.9 Ad-platform compliance helpers
- Footer preset with Privacy Policy, Terms, Contact, and a configurable disclaimer, because ad platforms review these.
- Pre-export checklist described in 6.7.

### 6.10 Analytics (lightweight, v1.5)
- Optional first-party beacon for views and CTA clicks (only applies to hosted pages, since a downloaded file has no backend). Main analytics remain Meta/Google.

### 6.11 AI Wizard (new page from a product idea)

Entry point: **New page → Create with AI wizard**. A multi-step wizard. Every step shows AI suggestions as selectable cards, everything stays manually editable, steps can be skipped or revisited, and any card or field can be regenerated individually. Wizard progress is saved, so closing the tab does not lose it.

1. **Product brief.** Product name, one-line description, price/offer (optional), target country, page language (Indonesian and English first), traffic channel (Google / Meta / both), optional notes.
   - *"I don't have a product yet" path:* AI suggests 5–8 **product niche ideas** (audience, angle, why it might convert). These are brainstorming suggestions, **not market research**: the AI must not state demand, volume, or competition numbers unless I provide data, and the UI labels them as such.
2. **Niche and angle.** 3–5 angle cards: target audience, main pain point, core promise, likely objections, tone of voice. Pick one or edit.
3. **Theme and colors.** 3 palette options matched to the niche: primary, accent, background, text, button style, border radius, font stack (from an allowlisted set of system font stacks). **Contrast is validated by code (WCAG AA)**; failing palettes are auto-adjusted or rejected, never shown as-is. Live mini-preview and manual color override.
4. **Copy.** Headline (3 variants), subheadline, about-product section, benefits (3–6), CTA label, FAQ (4–6), optional urgency line. Pick per field, regenerate per field, tone selector.
5. **Structure.** AI proposes which blocks to use and in what order from the registry (e.g., Hero → Benefits → Product Carousel → About → FAQ → Form Embed → Footer) with a one-line reason each. I can toggle and reorder blocks.
6. **Review and create.** Summary of choices, then create a **draft page** and open it in the editor. Images are left as placeholders for me to upload; tracking IDs and the form embed are left as a checklist.

**Copy guardrails (enforced by prompt, a rule-based linter, and validation):**
- The AI must **not invent** testimonials, reviews, ratings, customer counts, statistics, awards, "as seen on" logos, certifications, or before/after claims.
- No health, financial, income, or guarantee claims. No copy that implies knowledge of personal attributes (e.g., "Are you struggling with your diabetes?"), which Meta and Google restrict.
- No fake urgency or scarcity (countdowns, "only 3 left") unless I confirm it is real.
- When the AI lacks facts, it inserts a highlighted `[REPLACE: ...]` placeholder instead of guessing. The pre-export checklist warns while any placeholder remains.
- The UI states that final responsibility for ad-policy compliance stays with me.

### 6.12 HTML Import (convert an uploaded `.html` into an editable page)

**Input:** exactly **one `.html`/`.htm` file** (no zip, no folders). Limits: max 5 MB (configurable), must decode as text (UTF-8 or declared charset), content-type sniffing rejects binaries, node-count cap, rate limited, authenticated users only.

**Pipeline (each stage is its own testable module):**
1. **Quarantine.** Store the original untouched in a private bucket. It is never served and never rendered raw. Record its sha256.
2. **Parse, never execute.** Parse server-side with a spec-compliant parser. No headless browser with JS enabled, no `eval`, and **no network access from the importer in v1** (it does not fetch URLs found in the file).
3. **Sanitize (default-deny).** Remove or neutralize everything not on the allowlist, as listed in the guardrails below.
4. **Script review.** Classify every script and show the result in the Import Report (guardrails below).
5. **Segment and map.** The AI maps sanitized sections to blocks in the registry (Hero, Benefits, FAQ, Testimonials, Product Carousel, Form Embed, Footer, ...) and infers theme tokens from the CSS. Sections that cannot be mapped become a **Custom HTML (sanitized)** block with CSS **scoped to the block** (selector prefixing via a CSS parser) so imported styles do not leak into other blocks. This preserves visual fidelity.
6. **Assets.** Inline base64 images are extracted into Storage (compressed). External image URLs are kept as URLs in v1.
7. **Fidelity check.** Side-by-side view: original (rendered in a sandboxed iframe with **JS disabled** and a strict CSP) vs the imported page, plus fidelity notes. Warn if the page depends on JS to render (empty SPA shell), because the import will be partial.
8. **Result.** A **new draft page** (never overwrites an existing page) and an **Import Report**: blocks created, items converted to settings, scripts removed, items flagged, sections kept as Custom HTML.

**JavaScript guardrails (default policy: scripts do not survive import):**

| Found in the file | Handling |
|---|---|
| Known tracking snippets (Meta Pixel, Google tag/gtag, GA4, GTM; more later) | Detected by pattern, IDs extracted, converted into Page Settings → Tracking. Original script removed |
| Known form-provider embeds (allowlisted domains) | Converted into the Form Embed block |
| Recognizable UI scripts (slider/carousel, accordion, countdown) | Script dropped. The AI maps the pattern to the native block (Product Carousel, FAQ, Countdown) if it recognizes it, otherwise static HTML fallback |
| Unknown inline or external scripts | **Removed by default**, listed in the report with a code preview. Per script, I may choose **"Keep as sandboxed Custom HTML"** with an explicit red warning. Never executes in the editor origin, appears in the export only with explicit opt-in, and is flagged in the pre-export checklist |
| High-risk patterns (obfuscated/packed code, `eval`/`atob` chains, `document.write` loaders, redirects to unknown domains, miner or keylogger signatures) | **Always removed**, cannot be kept in v1, flagged "high risk" |
| Inline handlers (`on*=`), `javascript:` URLs, `<meta http-equiv="refresh">`, `<base>`, `<object>`, `<embed>`, `<applet>`, `srcdoc`, SVG scripts/handlers, `<iframe>` not on the allowlist | Removed or neutralized |
| CSS risks (`@import` of external sheets, `expression()`, `behavior`, `url(javascript:)`) | Removed |
| `data:` URIs that are not images | Removed |
| Forms posting to unknown actions | Flagged. Converted to a Form Embed placeholder or made non-functional, with a notice |
| External stylesheets and web fonts | Not fetched in v1. Flagged, and the report warns that styling may differ. Fonts fall back to the system stack |

**AI safety for import (prompt injection):**
- Uploaded content is **untrusted data**. It is passed to the model inside clearly delimited data blocks, as a compact, sanitized structure summary (node IDs, tags, text excerpts, class hints). **Scripts are never sent.**
- The model returns a **mapping by node ID** plus theme guesses. The real text, links, and image URLs are extracted by **deterministic code** from the sanitized DOM. Any URL in the model output that does not exist in the DOM is rejected.
- The model has no side-effect tools. Output is Zod-validated.
- Hidden elements (`display:none`, off-screen, zero-size text) are dropped and flagged.
- Required test fixtures: pages containing text like "ignore previous instructions", hidden instruction text, and a canary script. None may change behavior or execute.

**No-AI fallback:** if the API key is missing or the API fails, a deterministic heuristic splits the sanitized body into top-level sections, each stored as a Custom HTML (sanitized) block with scoped CSS, so import still works, just with less structure.

## 7. Data Model (Supabase / Postgres)

Use migrations in `supabase/migrations`. Enable RLS on every table, scoped by `workspace_id`.

- `workspaces` (id, name, owner_id)
- `pages` (id, workspace_id, name, slug, status, tags text[], current_draft jsonb, schema_version, latest_version_id, created_at, updated_at)
- `page_versions` (id, page_id, document jsonb, html text, export_settings jsonb, byte_size int, html_sha256 text, kind ('export'|'publish'), created_at, note)
- `templates` (id, workspace_id nullable for built-ins, name, document jsonb, thumbnail_url)
- `assets` (id, workspace_id, path, mime, width, height, size, created_at)
- `domains` (id, workspace_id, hostname, verified, vercel_status) — optional hosting
- `page_events` (id, page_id, type, ts, referrer, utm jsonb) — v1.5, hosted only
- `ai_runs` (id, workspace_id, page_id nullable, feature ('wizard'|'import'), step, model, tokens_in, tokens_out, latency_ms, status, error, created_at) — no raw uploaded HTML or full prompts stored
- `wizard_sessions` (id, workspace_id, state jsonb, page_id nullable, updated_at)
- `imports` (id, workspace_id, original_filename, original_path (private bucket), sha256, byte_size, report jsonb, resulting_page_id, created_at)

## 8. Performance and Quality Requirements

- Exported page: Lighthouse mobile Performance ≥ 90 on a typical template; LCP < 2.5 s on 4G. Total inline JS ≤ ~10 KB minified for a page using all snippets; **zero framework JS**.
- HTML file size budget: warn above 1 MB (Portable mode), hard-warn above 3 MB.
- Images: WebP, responsive sizing, lazy-load below the fold, explicit width/height to avoid layout shift.
- Output must be valid, deterministic HTML (same document → same bytes) so snapshot tests are stable.
- Security: auth on all editor routes and APIs; RLS enforced; the preview iframe is sandboxed; Custom HTML is allowed only for the authenticated owner and is never executed in the editor origin. Validate all inputs with Zod. Escape all user text in the renderer (no raw interpolation except in the Custom HTML block). Secrets only in env vars.
- Accessibility basics: semantic HTML, contrast checks in the theme picker, alt-text prompts, keyboard-operable carousel.
- Editor must stay responsive with 30+ blocks and carousels with 20+ items.
- **AI and import security:** the Claude API key lives only in server env vars. Uploaded HTML is never rendered in the editor origin; the only place it is shown is a sandboxed iframe with JS disabled and a strict CSP. A canary-script e2e test must prove no uploaded script ever executes. All AI output is schema-validated and escaped. Rate limits and per-workspace cost caps are enforced server-side.
- **AI quality gates (automated):** generated palettes pass WCAG AA contrast, generated copy passes the compliance linter, and documents produced by AI always validate against the PageDocument schema.

## 9. Suggested Project Structure

```
/app
  /(editor)/dashboard, /editor/[pageId]
  /api/...            (export, upload, versions; optional: domains, beacon)
  /p/[slug]/route.ts  (optional hosted serving)
/middleware.ts        (optional host → page resolution)
/lib
  /schema             (Zod: PageDocument, settings, migrations)
  /blocks             (registry + one folder per block: schema.ts, render.ts, Inspector.tsx, snippet.ts)
    /special/product-carousel
  /renderer           (renderPage, CSS collector, JS snippet collector, minifier)
  /export             (image inlining/compression, size report, file assembly)
  /ai                 (Claude client, structured-output helpers, prompts, block-catalog generator, wizard steps, compliance linter, contrast validator, run logging, limits)
  /import             (quarantine, parser, sanitizer, script classifier, scoped-CSS, mapper, no-AI fallback, report)
  /supabase           (clients, queries)
  /tracking           (snippet generators, UTM passthrough)
/components/editor
  /canvas             (iframe host, overlay, selection)
  /dnd                (custom pointer-based drag and drop)
  /inspector, /palette, /toolbar
/supabase/migrations
/tests
```

Adding a new block (standard or special) must require touching only its own folder plus one line in the registry.

## 10. Milestones

**M0 — Foundation:** repo, Next.js + TS + Tailwind + shadcn, Supabase wiring, auth, RLS migrations, CI (lint, typecheck, tests).

**M1 — Renderer first:** PageDocument schema + migrations, block registry, `renderPage`, CSS/JS collectors, 5 core blocks (Hero, Benefits, Testimonials, FAQ, Footer) **and the Product Carousel** (it proves the special-component + inline-snippet pipeline early). Snapshot tests. A CLI/script that renders a hardcoded document to a single `.html` file I can open locally. *No editor UI yet.*

**M2 — Editor engine MVP (custom):** dashboard, 3-pane editor, canvas iframe + overlay, custom drag/reorder/delete, inspector (including repeater for carousel items), responsive preview, command history with undo/redo, autosave, image upload.

**M3 — Export + tracking:** export dialog, single-file assembly (Portable/Hosted images), download button, size report, page settings (SEO, Meta Pixel, Google tag, GA4, GTM), UTM/click-ID passthrough, Form Embed block, pre-export checklist, versions and rollback.

**M4 — Production workflow:** duplicate page, templates, tags/filter, remaining blocks (countdown, sticky CTA, Custom HTML, cookie banner), carousel polish (bulk add, autoplay, tracking events, JSON-LD toggle).

**M5 — AI foundation + Wizard:** AI service layer (Claude client, structured outputs with retry, `ai_runs` logging, rate limits and cost caps, graceful disabled state), block-catalog generator from the registry, wizard UI steps 1–6, contrast validator, compliance linter, evals.

**M6 — HTML Import:** upload and quarantine, parser, sanitizer, script classifier and review UI, tracking/form conversion, scoped Custom HTML block, no-AI fallback, AI mapping, side-by-side fidelity view, Import Report, security tests (canary script, prompt-injection fixtures).

**M7 — Polish and optional hosting:** Playwright e2e (build → export → open the file → assert tracking and carousel behavior; wizard → export; import → edit → export), performance and accessibility audit, optional hosting at `/p/[slug]` + custom domains, lightweight analytics.

**Later / ideas:** more special components (see 6.4.2), in-editor AI actions per block (rewrite, shorten, translate), AI-suggested A/B variants, multi-language, multi-user workspaces, form provider presets, Shopify/product-feed import for the carousel, product URL reader for the wizard (needs an SSRF-safe fetcher).

## 11. Acceptance Criteria (v1 = M0–M4)

1. I can create a page from a template, edit text/images/colors, and **download a single `.html` file** in under 15 minutes.
2. The downloaded file opens correctly via `file://` and on any static host, is self-contained in Portable mode, and meets the performance targets on mobile.
3. The editor engine contains **no GrapesJS or other page-builder framework** (verify via dependency list in the plan).
4. A Product Carousel with at least 8 items swipes natively on mobile, works with JS disabled (scroll-snap), has arrows/dots/autoplay options when JS is on, and is keyboard accessible.
5. Carousel CTAs carry UTM and click-ID params and fire the configured tracking events.
6. An embedded external form renders correctly, and the page fires PageView plus Lead (where the provider allows) to Meta Pixel and Google tag.
7. I can duplicate a page, re-export, and roll back to a previous version. Each export is traceable (timestamp, size, hash).
8. Undo/redo works for all editor actions, including carousel item reorder.
9. All tables are protected by RLS.

**v1.1 criteria (M5–M6, AI features):**

10. The wizard takes me from a product brief to a valid draft page in about 5 minutes. Every step is editable and regenerable, and applying the result is one undo step.
11. Generated palettes pass WCAG AA. Generated copy contains no fabricated testimonials, ratings, or statistics; unknown facts appear as highlighted `[REPLACE: ...]` placeholders.
12. Uploading one `.html` file creates a new editable draft. Known pixel/tag snippets become tracking settings, known form embeds become a Form Embed block, and all other scripts are removed and listed in the Import Report.
13. A canary script in an uploaded file never executes anywhere in the app, and prompt-injection fixtures have no effect on the output.
14. With no API key or a failing API, the wizard shows a clear disabled/error state and HTML import still works through the no-AI fallback.
15. Per-workspace rate limits and daily cost caps are enforced and visible in the UI.

## 12. How Claude Code Should Work

- Begin in plan mode. Read this PRD, then post your plan, key risks, and any questions **before** coding. Challenge decisions that look wrong (e.g., Supabase vs Firebase, Portable image mode defaults, custom DnD complexity) with a short rationale. The "no page-builder framework" rule is firm.
- Work milestone by milestone. Finish and test one before the next. Small commits with clear messages.
- Write tests alongside code, especially for the renderer, the snippet collectors, the carousel, and tracking generators.
- Create a `CLAUDE.md` at the repo root documenting commands, architecture, conventions, and the "how to add a new block" recipe; keep it updated.
- Never hardcode secrets. Provide `.env.example` listing: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_BASE_DOMAIN`, `ANTHROPIC_API_KEY`, `AI_MODEL`, and (optional hosting only) `VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID`.
- When a requirement is ambiguous, pick the simplest option that keeps v1 shippable, note the assumption in `docs/DECISIONS.md`, and continue.

## 13. Open Questions (answer in plan, or ask me)

1. Which external form providers do I use most? (affects submit-event tracking presets)
2. Should the carousel's product data stay manual in v1 (repeater + bulk paste), with Shopify/CSV import later? (assumed yes)
3. Which events should carousel clicks fire for Meta and Google? (propose a default mapping in the plan)
4. If I later want hosted pages: subdomain-per-page or path-based as the default?
5. Is server-side conversion tracking (Meta Conversions API / Google Ads offline conversions) needed later? If yes, keep the form-event design extensible.
6. Which wizard languages first? (assumed Indonesian and English)
7. Import limits: is 5 MB OK, and should an unknown script ever be keepable? (assumed: only with explicit opt-in, sandboxed; high-risk scripts never)
8. Should the wizard read a product URL to prefill details? (assumed later, because it needs an SSRF-safe fetcher)
