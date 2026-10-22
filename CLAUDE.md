# LaunchPad (repo: rakit-app)

Landing-page builder for ad tests: a custom editor produces a PageDocument (JSON); a pure renderer turns it into one self-contained `.html` file.
Spec: `docs/PRD.md` · Plan: `docs/PLAN.md` · Decisions: `docs/DECISIONS.md` · Task plans: `docs/superpowers/plans/`.

## Commands

- `pnpm dev` / `pnpm build` / `pnpm start`
- `pnpm lint` · `pnpm typecheck` · `pnpm format` · `pnpm test` (Vitest: unit, snapshots, policy checks)
- Update snapshots: `pnpm exec vitest run <file> --update`. Put the flag after the file: `-u` takes an optional value and swallows the next argument.
- `pnpm db:start` / `pnpm db:stop` / `pnpm db:reset` / `pnpm db:test` (pgTAP RLS tests) / `pnpm db:types`
- `pnpm test:e2e` (Playwright: exported pages opened via `file://`; carousel with JS on/off, touch, keyboard)
- `pnpm test:e2e:app` (Playwright against the running app; needs `pnpm db:start` and `.env.local`)
- `pnpm owner:create --email <email> --password <password>`
- `pnpm env:local [--force]` (writes `.env.local` from `.env.example` and the running local Supabase stack)
- `pnpm assets` / `pnpm assets:check` (compile block `styles.css` / `snippet.js`, and bundle `lib/**/*.bundle.ts` such as the canvas runtime, into committed `*.generated.ts`; run `pnpm format` first)
- `pnpm render [doc.json] [--out f] [--mode export|preview] [--no-minify]` (no argument: renders the example to `out/example.html`)

## Local setup

1. Node 24 (`.nvmrc`) and pnpm 12. Run `pnpm install`.
2. Start Docker Desktop, then `pnpm db:start`.
3. `pnpm env:local` (copies `.env.example` to `.env.local` and fills the Supabase values from `pnpm supabase status`).
4. `pnpm owner:create --email … --password …`, then `pnpm dev`.

## Rules

- No page-builder, drag-and-drop or carousel frameworks (enforced by `tests/unit/dependency-policy.test.ts`; list in `docs/PLAN.md` §7).
- Next.js 16: session refresh lives in `proxy.ts`. Every server action still calls `requireUser()`.
- Route handlers call `getApiUser()` and return `unauthorizedResponse()` when it is null.
- New routes are protected by default; public prefixes live in `lib/auth/routing.ts`.
- Every new table: enable RLS, write policies with `public.is_workspace_member(workspace_id)`, add pgTAP tests under `supabase/tests/`.
- Secrets only in env. Never import the service-role key in code that can reach the browser.
- Unit tests sit next to the code as `*.test.ts`; e2e tests live in `tests/e2e/{renderer,app}`.
- Editor logic lives in `lib/editor` (pure, unit-tested); `components/editor` only binds it to React.
- The canvas iframe is `sandbox="allow-scripts"` only, and every message from it is untrusted (D-039).
- App e2e tests run serially against the one owner account and reset its pages.
- Small conventional commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`, `ci:`).

## How to add a block

1. Create `lib/blocks/<type>/` (interactive components go in `lib/blocks/special/<type>/`):
   - `schema.ts`: Zod props. Use `text()` / `rich()` for every user-visible string; every list item has an `id`; nested objects with defaulted fields use `.prefault({})`.
   - `render.ts`: build markup only with the `html` tag. Text via `ctx.text` / `ctx.rich`, links via `ctx.resolveLink` or `renderCta`, images via `renderImage`, inner ids via `ctx.domId`. No Date/Math.random/Intl.
   - `styles.css`: classes prefixed `lp-<type>`; mobile-first; breakpoints 640px / 1024px; per-instance options arrive as CSS custom properties. An element that paints its own background (a card) resets the tone variables it uses, including `--lp-fg`, which the focus ring uses (D-033).
   - Optional `snippet.js`: vanilla ES2017, no globals, query only inside each `[data-lp-<type>]` root, idempotent (`data-lp-ready`), honor `prefers-reduced-motion`. Gate it with `isNeeded(props)`. In the editor canvas a snippet may run again after DOM patches, so top-level code must only initialize roots that lack `data-lp-ready`.
   - `index.ts`: `defineBlock({ type, category, label, description, icon, schema, defaultProps, css, snippet?, render })`. Defaults must never invent social proof; use `[REPLACE: …]`.
   - `<type>.test.ts`: schema edge cases, "renders valid HTML with only required fields", behavior assertions, and an `.html` file snapshot.
2. Run `pnpm assets` and commit the generated `*.generated.ts` files.
3. Add one line to `BLOCKS` in `lib/blocks/registry.ts`.
4. Run `pnpm test`. The registry-wide tests (valid defaults, hostile input, valid HTML) cover the new block automatically.
