# M4b-1 Duplicate Page + Categorized Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The owner can duplicate a page from the dashboard, start a page from a built-in or saved template, browse templates by category (Herbal & health, Fashion, Beauty & skincare, …), and save any page as a template with a category.

**Architecture:**
- **Built-in templates live in code** (`lib/templates/builtin/`), one module per template, each a raw PageDocument validated by tests against the current schema. They are never seeded into the database (D-055).
- **Saved templates** are rows in the existing `templates` table, which gains `category` and `description` columns. The category list is code (`lib/templates/categories.ts`); the database only checks the slug shape, so adding a category needs no migration. An unknown category shows as "Other".
- **One insert path for pages:** `insertPage()` in `lib/pages/insert.ts` owns the unique-slug retry loop that `createPage` has today; blank pages, template pages and duplicates all use it.
- **Template preview** renders the document in preview mode on the server (no vendor tags, custom code or form embeds, D-047/D-048) and shows it in an `<iframe sandbox="" srcdoc>`: no scripts, opaque origin.
- **UI:** `/dashboard/templates` is a gallery with category filter chips (`?category=<id>`); the dashboard header links to it; the row menu gains Duplicate and Save as template.

**Tech Stack:** Next.js 16.4.2, React 19.3, TypeScript 5 (strict), Supabase (Postgres 17, pgTAP), Zod 4.6.7, Vitest 5.0.5, Playwright 1.64.1. No new dependencies.

**Spec:**
- `docs/PRD.md` §6.1 (dashboard actions: new from template, duplicate), §6.2 ("Save current page as a reusable template"), §7 (`templates` table), §11 AC1, AC7.
- `docs/PLAN.md` §5 M4 (first bullet: duplicate page; templates, built-in seeds plus "save as template").
- Owner request (2026-10-26): only duplicate page and templating from M4b for now; templates are categorized, for example fashion and herbal.
- Out of scope here (rest of M4b): block presets, tags/search/status filter/archive, the M3 export and data minors, the AC1–AC9 acceptance review.

## Before Task 1

- Docker Desktop running, `pnpm db:start`.
- `git switch -c feat/m4b-duplicate-templates`.
- Link this plan from `docs/PLAN.md` (header plan list, §5 M4, §10 row "M4b-1 Duplicate + templates — In progress"). Commit `docs: add M4b duplicate and templates plan`.

## Global Constraints

- **Node 24 on every command:** prefix with `export PATH="$HOME/.nvm/versions/node/v24.22.1/bin:$PATH";`.
- **Server actions** call `requireUser()` first and run as the signed-in user (RLS scopes every query). Never the service-role key.
- **Built-in templates** never invent social proof: testimonial names and quotes, ratings, sales counts and prices are `[REPLACE: …]` or absent. No health claims of curing or treating anything (herbal). No tracking ids, phone numbers, external URLs, form embed code or Custom HTML. Every image `src` is `''` (renders the placeholder) with an alt that says what to put there. Page language `id`; copy in Indonesian.
- **CTAs in built-ins** link `{ kind: 'default' }`, and `settings.defaultCta` points at the template's order section, so changing the order target is one setting.
- **Categories** (id → label, in this order): `herbal` Herbal & health · `fashion` Fashion · `beauty` Beauty & skincare · `food` Food & drink · `home` Home & living · `gadget` Gadgets & electronics · `digital` Courses & digital · `other` Other.
- **Limits:** template name 1–120 characters, description 0–300, category matches `^[a-z][a-z0-9-]{0,30}$`.
- **Duplicates:** name `<name> (copy)` cut to 120 characters, slug base `<slug>-copy` cut to 80 and made unique, same draft and tags, status `draft`, no versions; the editor opens on the copy.
- **Exported or preview HTML never runs on the editor origin** (D-022, D-049): the preview iframe is `sandbox=""` with `srcdoc`.

## Review Focus

1. **A saved template whose document no longer parses** (older schema, hand-edited row): "Use template" and Preview say "This template can't be used" instead of crashing; the page is not created. → Task 3 unit test on `loadTemplateDocument`, Task 5 action returns the error.
2. **Duplicating a page whose slug is already near 80 characters, or whose copy slug is taken** (`teh-copy` exists): the copy gets `teh-copy-2`, and a 78-character slug stays ≤ 80. → Task 2 test on `copySlugBase`.
3. **A `?category=` value that isn't a known category** (`?category=<script>`, `?category=nope`): the gallery shows all templates with no chip selected. → Task 3 test on `filterTemplates` / `parseCategory`.
4. **Deleting or editing a built-in template id through a forged form post**: the action refuses (`builtin` refs are read-only) and RLS refuses null-workspace rows anyway. → Task 5 e2e-adjacent check in `parseTemplateRef` tests and the pgTAP read-only test that exists.
5. **A saved template carrying tracking ids or custom code** previewed in the gallery: the preview contains no vendor tags or custom code. → Task 4 unit test on `templatePreviewHtml`.

---

### Task 1: Template categories and description in the database

**Files:**
- Create: `supabase/migrations/20261026090000_template_categories.sql`
- Create: `supabase/tests/rls_templates.test.sql`
- Modify: `lib/supabase/database.types.ts` (regenerated)

- [ ] **Step 1: Write the pgTAP test** `rls_templates.test.sql` (pattern of `rls_versions.test.sql`): two users; A inserts a template with `category = 'herbal'` and a description → ok; default category is `'other'` and description `''`; `category = 'Herbal'`, `'<b>'` and a 32-character category throw `23514`; a 301-character description throws `23514`; A updates its category to `'fashion'`; B sees none of A's rows; nobody can set a category on a null-workspace row.
- [ ] **Step 2:** `pnpm db:test` → FAIL (column missing).
- [ ] **Step 3: Migration:**
  ```sql
  alter table public.templates
    add column category text not null default 'other'
      check (category ~ '^[a-z][a-z0-9-]{0,30}$'),
    add column description text not null default ''
      check (char_length(description) <= 300);
  create index templates_workspace_category_idx on public.templates (workspace_id, category);
  ```
  Comment at the top: built-ins live in code (D-055); rows with a null `workspace_id` stay possible but unused.
- [ ] **Step 4:** `pnpm db:reset && pnpm db:test` → PASS; `pnpm db:types`, then `pnpm format`.
- [ ] **Step 5: Commit** `feat(db): template category and description`.

### Task 2: One insert path for pages, and duplicate

**Files:**
- Create: `lib/pages/insert.ts`, `lib/pages/copy.ts`, `lib/pages/copy.test.ts`
- Modify: `app/(editor)/dashboard/actions.ts` (`createPage` uses `insertPage`; add `duplicatePage`)
- Modify: `app/(editor)/dashboard/page-actions.tsx` (menu item "Duplicate")

**Interfaces:**
- Produces: `insertPage(supabase, input: { name: string; slugBase: string; document: unknown; tags?: string[] }): Promise<{ ok: true; id: string } | { ok: false }>` (server-only; three attempts on `23505`, as `createPage` does today).
- Produces: `copyName(name: string): string` and `copySlugBase(slug: string): string` (pure).
- Produces: server action `duplicatePage(_prev: ActionState, formData: FormData): Promise<ActionState>` (field `pageId`; redirects to `/editor/<newId>`).

- [ ] **Step 1: Failing tests** in `copy.test.ts`:
  - `copyName('Teh')` → `'Teh (copy)'`; a 120-character name → length 120, ends with `' (copy)'`, trimmed before the suffix.
  - `copySlugBase('teh')` → `'teh-copy'`; a 78-character slug → ≤ 80 characters, ends `-copy`, no trailing or double dash, matches `^[a-z0-9]+(-[a-z0-9]+)*$`.
  - `uniqueSlug(copySlugBase('teh'), new Set(['teh-copy']))` → `'teh-copy-2'` (existing helper; pins the combination). If `uniqueSlug` can exceed 80 on a cut base, fix it there and add that case to `slug.test.ts`.
- [ ] **Step 2:** `pnpm exec vitest run lib/pages/copy.test.ts` → FAIL.
- [ ] **Step 3:** implement `copy.ts`, `insert.ts`; switch `createPage` to `insertPage` (behavior unchanged); add `duplicatePage`: read `name, slug, current_draft, tags` by id (`GONE` when missing), `insertPage` with `copyName`/`copySlugBase`, `revalidatePath('/dashboard')`, redirect.
- [ ] **Step 4:** menu item "Duplicate" calls `duplicatePage` inside `startTransition` (a menu can't hold an inline error); a failed result opens an alert dialog "Couldn't duplicate “<name>”" with the error.
- [ ] **Step 5:** `pnpm test lib/pages && pnpm typecheck && pnpm lint` → PASS. Commit `feat(dashboard): duplicate a page`.

### Task 3: Template catalog and built-in templates

**Files:**
- Create: `lib/templates/categories.ts`, `lib/templates/catalog.ts`, `lib/templates/catalog.test.ts`
- Create: `lib/templates/builtin/parts.ts` (shared helpers), one module per built-in, `lib/templates/builtin/index.ts`, `lib/templates/builtin/builtin.test.ts`

**Interfaces:**
- Produces (`categories.ts`): `TEMPLATE_CATEGORIES: readonly { id: TemplateCategory; label: string }[]` (the order in Global Constraints); `type TemplateCategory`; `TemplateCategorySchema` (z.enum); `parseCategory(value: unknown): TemplateCategory | null`; `categoryLabel(id: string): string` ("Other" for unknown).
- Produces (`builtin/index.ts`): `BUILTIN_TEMPLATES: readonly BuiltinTemplate[]` with `interface BuiltinTemplate { id: string; name: string; category: TemplateCategory; description: string; document(): unknown }`.
- Produces (`catalog.ts`):
  - `type TemplateRef = { kind: 'builtin'; id: string } | { kind: 'saved'; id: string }`; `parseTemplateRef(value: unknown): TemplateRef | null` (a UUID → saved; a known built-in id → builtin; else null). Form values: built-in ids as-is, saved ids as UUIDs.
  - `interface TemplateSummary { ref: string; kind: 'builtin' | 'saved'; name: string; category: string; description: string; sectionCount: number; colors: { primary: string; accent: string; surface: string } }`; `builtinSummaries(): TemplateSummary[]`; `summarizeDocument(raw: unknown): Pick<TemplateSummary, 'sectionCount' | 'colors'>` (falls back to `DEFAULT_THEME` colors and 0 sections for an unparsable document).
  - `filterTemplates(list: TemplateSummary[], category: TemplateCategory | null): TemplateSummary[]` (null → all).
  - `loadTemplateDocument(raw: unknown): { ok: true; doc: PageDocument } | { ok: false }` (wraps `safeParseDocument`).

- [ ] **Step 1: Failing tests** in `catalog.test.ts`: category order and labels exactly as Global Constraints; `parseCategory('herbal')` → `'herbal'`, `parseCategory('nope' | '<script>' | undefined)` → null; `categoryLabel('nope')` → `'Other'`; `parseTemplateRef` for a UUID, a built-in id, `'builtin:x'`, `''` and `'../x'`; `filterTemplates` by category and with null; `loadTemplateDocument({ schemaVersion: 99 })` → `{ ok: false }`; `summarizeDocument` on a built-in returns its theme colors and section count.
- [ ] **Step 2: Failing tests** in `builtin.test.ts`, for every built-in (`describe.each`):
  - ids unique and match `^[a-z][a-z0-9-]{0,40}$`; names 1–120; descriptions ≤ 300; category known; every category except `other` has at least one built-in.
  - `parseDocument(document())` succeeds; export and preview renders pass `validateHtml` with no warnings from `renderPage`.
  - `settings.lang === 'id'`; `settings.tracking` empty; `settings.defaultCta.kind === 'section'` and points at an existing section; no `custom-html` block; every `form-embed` has empty `code` and `url`.
  - `JSON.stringify(document())` contains no `http`, `wa.me`, `@` email shapes or digit runs ≥ 8 (phone numbers).
  - every image found by `findImages` has `src === ''` and a non-empty alt; every testimonial item's `name` and `quote` contain `[REPLACE:`; no testimonial or carousel item has `rating` or `reviewCount`.
  - herbal copy contains none of `menyembuhkan`, `mengobati`, `obat` (case-insensitive).
- [ ] **Step 3:** `pnpm exec vitest run lib/templates` → FAIL.
- [ ] **Step 4: Implement** `categories.ts`, `catalog.ts`, `parts.ts` (helpers such as `orderCta(label)`, `section(id, style, blocks)`, `footer(brand)`, placeholder image `img(alt)`), and the built-ins (Indonesian copy, distinct themes and layouts; prices as `[REPLACE: …]` text in offer descriptions, never numbers):

  | id | name | category | sections (in order) |
  |---|---|---|---|
  | `teh-herbal` | Teh herbal | herbal | Hero (split) · Benefits · Image + text (cara seduh) · Testimonials · Pricing (paket) · FAQ · Form embed (order) · Footer · Sticky CTA |
  | `koleksi-fashion` | Koleksi fashion | fashion | Hero · Product carousel (4 items) · Benefits (bahan, ukuran) · Gallery · Testimonials · FAQ (ukuran, retur) · Form embed · Footer · Sticky CTA |
  | `serum-skincare` | Serum skincare | beauty | Hero (split) · Image + text (kandungan) · Benefits · Testimonials · Pricing · FAQ · Form embed · Footer |
  | `camilan-kekinian` | Camilan kekinian | food | Hero · Gallery (varian rasa) · Benefits · Pricing (paket hemat) · Testimonials · FAQ · Form embed · Footer · Sticky CTA |
  | `perabot-rumah` | Perabot rumah | home | Hero (split) · Image + text (cara pakai) · Benefits · Gallery · Testimonials · FAQ · Form embed · Footer |
  | `aksesori-gadget` | Aksesori gadget | gadget | Hero (split) · Benefits (spesifikasi) · Product carousel (varian) · Pricing · FAQ (garansi) · Form embed · Footer |
  | `kelas-online` | Kelas online | digital | Hero · Benefits (yang dipelajari) · Image + text (mentor) · Pricing · Testimonials · FAQ · Form embed (pendaftaran) · Footer |
  | `produk-umum` | Halaman produk sederhana | other | Hero · Benefits · Testimonials · FAQ · Form embed · Footer |

- [ ] **Step 5:** `pnpm exec vitest run lib/templates` → PASS. Commit `feat(templates): categories and eight built-in templates`.

### Task 4: Template queries and preview HTML

**Files:**
- Create: `lib/templates/queries.ts` (server-only), `lib/templates/preview.ts`, `lib/templates/preview.test.ts`

**Interfaces:**
- Consumes: Task 3 catalog.
- Produces: `listTemplates(supabase): Promise<TemplateSummary[]>` (saved first, newest update first, then built-ins in registry order); `getTemplateDocument(supabase, ref: TemplateRef): Promise<unknown | null>` (null when the saved row is missing or not readable).
- Produces: `templatePreviewHtml(raw: unknown): string | null` (pure; `renderPage(doc, { mode: 'preview' }).html`, null when the document doesn't parse).

- [ ] **Step 1: Failing tests** in `preview.test.ts`: a built-in previews to valid HTML; a document with tracking ids, a Custom HTML block (`<script>window.x=1</script>`, scripts enabled) and a form embed snippet previews without `fbq(`, `gtag(`, `window.x=1` or the snippet; `{ schemaVersion: 99 }` → null.
- [ ] **Step 2:** run → FAIL. **Step 3:** implement both files. **Step 4:** run → PASS, `pnpm typecheck`.
- [ ] **Step 5: Commit** `feat(templates): list templates and render previews`.

### Task 5: Template actions and the gallery

**Files:**
- Create: `app/(editor)/dashboard/templates/page.tsx`, `templates/actions.ts`, `templates/template-card.tsx`, `templates/use-template-dialog.tsx`, `templates/preview-dialog.tsx`, `templates/template-actions.tsx` (saved-template menu: Edit, Delete)
- Create: `app/(editor)/dashboard/save-template-dialog.tsx`
- Modify: `app/(editor)/dashboard/page.tsx` (header link "Templates"), `page-actions.tsx` (menu item "Save as template")
- Test: `tests/e2e/app/templates.spec.ts`; `tests/e2e/app/helpers.ts` (`resetOwnerTemplates()`)

**Interfaces (server actions in `templates/actions.ts`, each `requireUser()` first):**
- `createPageFromTemplate(_prev, formData)`: fields `templateId`, `name`; parses the ref, loads the document, `loadTemplateDocument` (failure → `"This template can't be used."`), `insertPage` with `slugify(name)`, redirect to the editor.
- `saveAsTemplate(_prev, formData)`: fields `pageId`, `name`, `category`, `description`; reads the page's `current_draft`, refuses a draft that doesn't parse, inserts the row in the user's workspace; `revalidatePath('/dashboard/templates')`; returns `{ error: null, done: true }`.
- `updateTemplate(_prev, formData)`: `templateId` (saved refs only; built-ins → `"Built-in templates can't be changed."`), `name`, `category`, `description`.
- `deleteTemplate(_prev, formData)`: `templateId` (saved only).
- `previewTemplate(templateId: string): Promise<{ ok: true; html: string } | { ok: false; error: string }>`.

**UI:**
- Gallery heading "Templates", a "Back to pages" link, chips "All" + each category that has at least one template (links `?category=<id>`, the active one `aria-current="page"`), then cards grouped under a heading per category (filtered: one group). Card: three theme-color swatches, name, description, "<n> sections", badge "Saved" for saved ones, buttons "Use template" and "Preview", and for saved ones a menu "Actions for <name>" (Edit, Delete with confirmation "Delete template “<name>”?").
- "Use template" dialog: title "New page from <name>", Name field (defaults to the template name), button "Create page".
- Preview dialog: title "<name>", `<iframe title="Template preview" sandbox="" srcdoc>` at 390 px wide with a toggle for 1280 px; error text on failure.
- "Save as template" dialog (dashboard row menu): Name (defaults to the page name), Category select (default `other`), Description (textarea, max 300), button "Save template"; on success it closes and shows nothing else.

- [ ] **Step 1: Failing e2e** `templates.spec.ts` (`beforeEach`: `resetOwnerPages`, `resetOwnerTemplates`, `signIn`):
  - `duplicates a page and opens the copy`: seed "Teh" (slug `teh`, HERO doc, tags `['tes']`); Actions → Duplicate → URL `/editor/<other id>`; the stored copy has name `Teh (copy)`, slug `teh-copy`, tags `['tes']`, the same draft; duplicating "Teh" again gives `teh-copy-2`.
  - `filters built-in templates by category`: `/dashboard/templates`; chip "Herbal & health" → card "Teh herbal" visible, "Koleksi fashion" hidden; chip "All" → both visible; `?category=nope` → both visible.
  - `creates a page from a built-in template`: "Use template" on "Koleksi fashion", name "Kaos tes" → editor; the canvas lists blocks starting `hero`, `product-carousel`.
  - `previews a template in a script-less sandbox`: Preview on "Teh herbal" → iframe `sandbox` attribute is `''`, frame contains the hero headline.
  - `saves a page as a template, uses it, edits and deletes it`: seed a page; row Actions → Save as template, name "Template tes", category "Fashion" → gallery chip "Fashion" shows "Template tes" with "Saved"; Use template → editor with the seeded headline; Edit → category "Beauty & skincare" → it moves under that chip; Delete → confirm → gone.
- [ ] **Step 2:** `pnpm test:e2e:app tests/e2e/app/templates.spec.ts` → FAIL.
- [ ] **Step 3:** implement actions, gallery and dialogs (shadcn components already in `components/ui`; Base UI `Select` if present, else a native `<select>` styled like `Input`).
- [ ] **Step 4:** e2e → PASS; full `pnpm test:e2e:app tests/e2e/app/dashboard.spec.ts` still passes; `pnpm typecheck && pnpm lint`.
- [ ] **Step 5: Commit** `feat(templates): gallery, use, preview and save as template`.

### Task 6: Decisions, docs and full verification

**Files:** `docs/DECISIONS.md`, `docs/PLAN.md`, `lib/templates/teh-kumis-kucing.ts` (header comment), `CLAUDE.md` (one line under Rules: built-in template rules).

- [ ] **Step 1:** D-055 Templates (code built-ins, categories in code with a slug-shaped DB check, preview sandbox, built-in content rules, Teh Kumis Kucing stays a `page:create` seed: it carries the owner's ids, contacts and uploaded images, so the owner saves the created page as a template instead). D-056 Duplicate (name, slug, what is and isn't copied, opens the editor).
- [ ] **Step 2:** PLAN §5 M4 and §10: M4b-1 done; the remaining M4b items listed as next.
- [ ] **Step 3:** `pnpm format && pnpm lint && pnpm typecheck && pnpm test && pnpm db:test && pnpm test:e2e:app` → all PASS.
- [ ] **Step 4: Commit** `docs: M4b duplicate and template decisions`.
