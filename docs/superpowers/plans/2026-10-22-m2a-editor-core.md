# M2a Editor Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A working custom editor without drag and drop. The dashboard creates, opens, renames and deletes pages. The editor has three panes: a block palette, a sandboxed live canvas with a selection overlay, and an inspector generated from the block schemas. Every change is an undoable command, and the draft autosaves with conflict detection.

**Architecture:**
- Editor logic is pure TypeScript in `lib/editor` and is unit-tested in Node. It covers commands applied as Immer patches, undo history, a Zustand vanilla store, the autosave scheduler, canvas sync planning and inspector field descriptors. React code in `components/editor` only binds this logic to the DOM.
- The canvas is an `<iframe sandbox="allow-scripts" srcdoc>` rendered with `renderPage(doc, { mode: 'preview' })` plus a small bundled runtime.
  - The parent sends per-block HTML patches, computed from a render cache keyed on Immer's structural sharing.
  - The iframe reports block geometry, hovers, clicks and shortcut keys.
  - Every message is channel-scoped and Zod-validated.
- Drafts save through `PUT /api/pages/[pageId]/draft`, which checks a `draft_revision` counter and answers 409 on a conflict. Dashboard mutations are server actions.

**Tech Stack:** Next.js 16.4.2 (App Router), React 19.3, TypeScript 5 (strict), Zustand 5.0.15, Immer 11.1.21, Zod 4.6.7, Supabase (Postgres + RLS, `@supabase/ssr` 0.12.7), shadcn/ui 4 (Base UI), lucide-react, esbuild 0.28.2, Vitest 5.0.5 (+ happy-dom 21.0.4), Playwright 1.64.1, pgTAP.

**Spec:**
- `docs/PRD.md` §5.2, §6.1–6.2, §8, §10 (M2) and §11 AC8.
- `docs/PLAN.md` §2.3 and §2.10, §3 (R1, R2, R6) and §5 (M2).
- `docs/DECISIONS.md`.

This plan covers **M2a**: state, canvas and inspector. **M2b** gets its own plan once this one lands and the spike findings (Task 1) are in. It covers drag and drop, inline editing, uploads and the full M2 exit journey; see "After M2a" at the end.

## Before Task 1

- Start Docker Desktop. `docker info` must succeed before `pnpm db:start`.
- Run `pnpm db:start`. `.env.local` from M0 must hold the local Supabase values.
- Create the branch with `git switch -c feat/m2a-editor-core`.
- Link this plan from `docs/PLAN.md`:
  - §5 M2: link this plan and note "M2b plan: written after M2a".
  - §10: add a row "M2a Editor core" with status "In progress", and a row "M2b Direct manipulation" with "Written after M2a".
- Commit: `docs: add M2a editor core plan`.

## Global Constraints

- **Node 24 on every command.** The Bash tool's shells start on Node 20. Prefix every `pnpm`/`node` command with `export PATH="$HOME/.nvm/versions/node/v24.22.1/bin:$PATH";`.
- **Next.js 16** has breaking changes. Read the relevant guide in `node_modules/next/dist/docs/` before using an API.
  - Session refresh lives in `proxy.ts`.
  - Route handler `params` and page `params` are Promises.
  - Type route handler context with the global `RouteContext<'/path/[param]'>`, and page props with `PageProps<'/path/[param]'>`.
- **Auth on every entry point.**
  - Every server action and every page that reads data calls `requireUser()` first.
  - Every route handler calls `getApiUser()` and returns `unauthorizedResponse()` when it gets `null` (Task 3).
  - New routes are protected by default. The only change to `PUBLIC_PATH_PREFIXES` is removing `/p` (Task 3).
- **Secrets:** the service-role key is used only in `tests/e2e/**` and `scripts/**`, never in `app/`, `components/` or `lib/`.
- **Canvas isolation (PLAN §2.4, §2.10; R6):**
  - The iframe attribute is exactly `sandbox="allow-scripts"`. Never add `allow-same-origin`, `allow-top-navigation`, `allow-popups` or `allow-forms`.
  - The parent posts to the iframe with target origin `'*'`, because an opaque origin cannot be named. It accepts a message only when all of these hold:
    - `event.source === iframe.contentWindow`;
    - `data.source === 'launchpad-canvas'`;
    - the channel id matches;
    - the Zod schema passes.
  - It acts only on ids that exist in the current document.
  - The preview never loads third-party code.
- **Renderer purity is unchanged.** There is no `Date`, `Math.random`, `Intl` or I/O in `lib/renderer` or `lib/blocks`. `lib/editor` may use time only through an injected `now()`.
- **The editor's document is always schema-valid and normalized.** A command whose result would fail validation changes nothing and returns a reason.
- **Exact numbers:**
  - Viewports: mobile 390, tablet 768 and desktop 1280 CSS px. Mobile is the default.
  - Autosave: debounce 800 ms; max wait 5000 ms; keepalive only for bodies ≤ 60,000 bytes; retry delays 2, 4, 8, 16 and 30 s, then 30 s.
  - Draft body cap: 4 MiB (4,194,304 bytes).
  - History: coalescing window 1000 ms; 200 entries.
  - Canvas runtime: ≤ 8192 bytes minified.
- **Dependencies:** add only `immer@11.1.21` and `zustand@5.0.15`, pinned exactly (D-036). shadcn components come from `pnpm exec shadcn add <names> -y -o`, followed by `pnpm format`. The `-o` overwrite of `components/ui/button.tsx` changes formatting only. The dependency-policy test must stay green: no page-builder, DnD or carousel frameworks.
- **Tests:**
  - Unit tests sit next to the code as `*.test.ts`. React UI is tested with Playwright in `tests/e2e/app/`; there is no React Testing Library.
  - App e2e tests share one owner account. They run with `workers: 1`, and each spec resets the owner's pages.
  - Update snapshots with `pnpm exec vitest run <file> --update` (the flag goes after the file).
- **Editor UI copy** is English and uses sentence case. The user-visible strings that tests rely on are fixed in each task's "UI contract".
- **Commits** are small conventional commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`, `ci:`). Each message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Run `pnpm format` before committing.

## Review Focus

These are the inputs and conditions the spec implies but feature tests would not naturally hit, most likely first. Each one is pinned by the named test.

1. **The same page open in two tabs or on two devices.**
   - Expected: the later save never silently overwrites the earlier one. The editor shows a conflict banner offering "Reload latest" or "Keep my version".
   - Tests: `answers 409 with the current revision when the base is stale` (Task 4); `a save from another tab raises a conflict; keeping mine overwrites it` (Task 14).
2. **Leaving within the 800 ms debounce window** (closing the tab, reloading, the back link).
   - Expected: on `pagehide` or `visibilitychange: hidden` the save is flushed with `keepalive` when the body fits. The browser's leave warning appears while changes are unsaved.
   - Tests: `flush while unloading sends keepalive without waiting for the debounce` (Task 10); `warns before leaving with unsaved changes` (Task 14).
3. **The network drops mid-edit** (Wi-Fi switch, phone hotspot, server restart).
   - Expected: no edit is lost. The status shows "Offline — retrying". Retries back off at 2, 4, 8, 16 and 30 s and fire at once on `online`.
   - Tests: `network errors retry with backoff and recover` and `retry() saves immediately` (Task 10).
4. **Undo and redo across structural edits** that create, split, duplicate or remove sections.
   - Expected: every intermediate document validates, and undo restores each one exactly, including ids and section styles.
   - Tests: `every command keeps the document valid and its inverse restores it` (Task 8); `undoes and redoes every command type back to the exact documents` (Task 9).
5. **Hostile content and forged messages around the canvas.** This covers block text with markup, links in the canvas, and (from M4 on) scripts inside the iframe posting fake `select` or `key` messages.
   - Expected: text renders inert; links never navigate the frame; messages from anything but the current iframe and channel, or failing the schema, are ignored.
   - Tests: `rejects messages that are malformed or out of bounds` (Task 11); `clicking a link selects its block without navigating` (Task 12); `forged canvas messages are ignored` (Task 13).

## Deferred minors from the M0/M1 review

These are listed in the memory note `m0-m1-deferred-minors`.

- **Folded in:**
  - m-7: anon cannot execute `is_workspace_member` (Task 2).
  - m-8: drop `/p` from the public prefixes (Task 3).
  - m-9: 401 helper before the first route handler (Task 3).
  - m-10: specific sign-in errors (Task 3).
  - m-11: CI runs `next build` and the app e2e suite (Task 17).
  - m-12: README, the AGENTS.md ruling and the PLAN §7 `@tailwindcss/turbopack` fix (Task 17).
- **Still deferred:**
  - m-3, m-4 and m-5 go to M4 carousel polish.
  - m-6 (composite FK and cross-workspace pgTAP gaps) goes to M3.

---

### Task 1: Canvas and drag spike (throwaway)

PLAN §2.3 promised this spike before the real engine is built. It checks the parts of the design every later canvas task relies on:
- rects reported by an opaque-origin iframe keep a parent overlay in step;
- a drag shield keeps pointer events in the parent;
- hit-testing on cached rects plus parent-driven auto-scroll holds up.

**Files:**
- Create: `spikes/canvas-dnd/index.html`, `spikes/canvas-dnd/measure.ts`, `spikes/canvas-dnd/README.md`
- Modify: `docs/DECISIONS.md` (append D-034)

**Interfaces:**
- Consumes: Playwright's library API (`import { chromium } from '@playwright/test'`) in `measure.ts`. Nothing from the app.
- Produces: measured findings in D-034. Nothing in `app/`, `components/` or `lib/` may import from `spikes/`. M2b deletes the folder once its real drag engine passes e2e.

`index.html`:
- **Layout:**
  - A left palette with two items.
  - A centre `<iframe sandbox="allow-scripts">`. Its `srcdoc` is built from a template string: 40 blocks, 120–420 px tall, in alternating colors.
  - An absolutely positioned overlay layer above the iframe, and a transparent shield `div`.
- **Iframe script (inline in the srcdoc):**
  - It posts `{ type: 'rects', seq, scrollY, blocks: [{ id, top, height }] }` on load, on scroll (rAF-throttled) and on resize. `seq` echoes the last `scrollBy` it handled.
  - It handles `{ type: 'scrollBy', dy, seq }`.
  - It counts the pointer events it receives and reports the count on `{ type: 'stats' }`.
- **Parent behaviour:**
  - **Selection:** a click in the frame selects the block under it. The parent draws that block's outline and moves it on every `rects`.
  - **Drag start:** `pointerdown` on a palette item calls `setPointerCapture`. The drag starts after 4 px of movement with a mouse, or after a 250 ms press with touch.
  - **Hit-testing:** while dragging, the shield covers the iframe. The drop index is the first block whose vertical midpoint lies below the pointer, read from cached rects. An insertion line is drawn at that boundary.
  - **Auto-scroll:** within 48 px of the canvas top or bottom edge, an rAF loop sends `scrollBy`. Its speed grows with proximity, up to 20 px per frame.
  - **End and cancel:** `pointerup` records the drop index. Escape cancels the drag. Palette items have `touch-action: none`.
- It exposes `window.__spike = { rectLatencies: number[], drops: number[], pointerEventsInFrame: number }` for `measure.ts`.

`measure.ts` (`pnpm exec tsx spikes/canvas-dnd/measure.ts`) opens `index.html` over `file://` in Chromium and prints one `PASS`/`FAIL` line per check with numbers:
1. **Rect round-trip:** 20 × `scrollBy(300)`. Reports the median and p95 time from send to the matching `rects`.
2. **Mouse drag:** palette item → middle of the canvas in 20 steps. The drop index equals the one computed from the rects, and the iframe saw 0 pointer events during the drag.
3. **Auto-scroll:** hold 10 px above the canvas bottom for 1000 ms. The iframe's `scrollY` grows by ≥ 500 px, and the insertion line stays within 2 px of a block boundary.
4. **Touch** (a context with `hasTouch: true`): a CDP `Input.dispatchTouchEvent` long-press of 300 ms, then a move. The drag starts and the parent page does not scroll.
5. **Isolation:** `iframe.contentDocument` is `null` from the parent, and incoming messages have `event.origin === 'null'`.

The script exits 1 if any check fails.

- [ ] **Step 1: Build `index.html` and `measure.ts`.** Keep them to about 400 lines in total. Spike-quality code is fine, but `measure.ts` must pass `pnpm lint` and `pnpm typecheck`.
- [ ] **Step 2: Run the measurements.**
  - Run: `pnpm exec tsx spikes/canvas-dnd/measure.ts`
  - Expected: five `PASS` lines; rect round-trip median ≤ 33 ms (two frames).
- [ ] **Step 3: Write `README.md` and D-034.**
  - `README.md` explains how to open `index.html` by double-clicking it and what to try by hand: mouse drag, touch drag in device mode, and auto-scroll.
  - Append to `docs/DECISIONS.md`, filling in the measured numbers and anything surprising:

```markdown
## D-034 Canvas overlay and drag design, validated by a spike — Accepted
`spikes/canvas-dnd/` (deleted in M2b) put a parent overlay over an `<iframe sandbox="allow-scripts" srcdoc>` that reports block rects by `postMessage`, with a transparent shield over the iframe during drags.
Measured in headless Chromium: rect round-trip median __ ms (p95 __ ms); mouse drag kept every pointer event in the parent; auto-scroll moved __ px/s with the insertion line within __ px of a block boundary; touch long-press (250 ms) started a drag without scrolling the page.
Consequences: … (for example, the overlay redraws on every rects message; the drag engine in M2b reuses the cached rects and asks the iframe to scroll).
```

- [ ] **Step 4: Gate.** Stop and report to the human before Task 11 if any of these happens:
  - the median exceeds 50 ms;
  - the shield lets pointer events reach the iframe;
  - the insertion line drifts during auto-scroll.

  Tasks 11–14 assume this design holds.
- [ ] **Step 5: Commit.**

```bash
git add spikes/canvas-dnd docs/DECISIONS.md
git commit -m "chore(spike): canvas overlay and shield drag across a sandboxed iframe"
```

---

### Task 2: Draft revision column and RPC lockdown

**Files:**
- Create: `supabase/migrations/<timestamp>_editor_drafts.sql` (generate it with `pnpm supabase migration new editor_drafts`), `supabase/tests/rls_editor.test.sql`
- Modify: `lib/supabase/database.types.ts` (regenerated), `docs/DECISIONS.md` (append D-035)

**Interfaces:**
- Produces:
  - `pages.draft_revision int not null default 0 check (draft_revision >= 0)`.
  - The generated `Database['public']['Tables']['pages']['Row']['draft_revision']: number`.
  - `public.is_workspace_member(uuid)` is executable only by `authenticated` (and Supabase's service roles), not by `anon` or `public`.

- [ ] **Step 1: Write the failing pgTAP test** `supabase/tests/rls_editor.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('33333333-3333-3333-3333-333333333333', 'c@launchpad.test'),
  ('44444444-4444-4444-4444-444444444444', 'd@launchpad.test');
create temp table ws as select owner_id, id from public.workspaces;
grant select on ws to authenticated;

select has_column('public', 'pages', 'draft_revision', 'pages has a draft revision counter');
select col_default_is('public', 'pages', 'draft_revision', '0', 'new pages start at revision 0');

set local role authenticated;
set local request.jwt.claims to '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
insert into public.pages (workspace_id, name, slug, current_draft, schema_version)
  select id, 'C page', 'c-page', '{"schemaVersion":1}'::jsonb, 1 from ws
  where owner_id = '33333333-3333-3333-3333-333333333333';

select results_eq(
  $$ update public.pages set current_draft = '{"schemaVersion":1,"sections":[]}', draft_revision = 1
     where slug = 'c-page' and draft_revision = 0 returning draft_revision $$,
  $$ values (1) $$, 'a save with the current revision bumps it');
select is_empty(
  $$ update public.pages set draft_revision = 1 where slug = 'c-page' and draft_revision = 0 returning 1 $$,
  'a save with a stale revision matches no row');
select throws_ok($$ update public.pages set draft_revision = -1 where slug = 'c-page' $$, '23514', null,
  'revisions cannot go negative');

set local request.jwt.claims to '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';
select is_empty($$ update public.pages set draft_revision = 2 where slug = 'c-page' returning 1 $$,
  'another user cannot bump the revision');
select lives_ok($$ select public.is_workspace_member(gen_random_uuid()) $$,
  'signed-in users can still evaluate the membership helper');

reset role;
set local role anon;
select throws_ok($$ select public.is_workspace_member(gen_random_uuid()) $$, '42501', null,
  'anon cannot call is_workspace_member through /rpc');

reset role;
select * from finish();
rollback;
```

- [ ] **Step 2: Run it and make sure it fails.**
  - Run: `pnpm db:test`
  - Expected: FAIL in `rls_editor.test.sql` (no column `draft_revision`).
- [ ] **Step 3: Write the migration.**

```sql
-- Draft saves use optimistic concurrency on a counter (docs/DECISIONS.md D-035).
alter table public.pages
  add column draft_revision int not null default 0 check (draft_revision >= 0);

-- RLS policies evaluate the helper as `authenticated`; anon must not reach it through /rpc (M0/M1 review m-7).
revoke execute on function public.is_workspace_member(uuid) from public, anon;
grant execute on function public.is_workspace_member(uuid) to authenticated;
```

- [ ] **Step 4: Apply it and make sure every DB test passes.**
  - Run: `pnpm db:reset && pnpm db:test`
  - Expected: PASS for `rls_core.test.sql` (24) and `rls_editor.test.sql` (8).
- [ ] **Step 5: Regenerate the types.**
  - Run: `pnpm db:types && pnpm typecheck`
  - Expected: the `pages` Row type now has `draft_revision: number`, and typecheck passes.
- [ ] **Step 6: Append D-035** to `docs/DECISIONS.md`:

```markdown
## D-035 Draft saves: a route handler and a revision counter — Proposed (deviates from Plan §5 M2)
- The editor saves with `PUT /api/pages/[pageId]/draft` and a JSON body `{ document, baseRevision }`.
- This is a route handler, not a server action, for two reasons:
  - Next.js runs server actions one at a time per client, so a slow save would block dashboard actions.
  - An unload flush needs `fetch(…, { keepalive: true })`, which only a plain HTTP endpoint can receive.
- The server validates the document with `safeParseDocument`, rejects bodies over 4 MiB (Vercel caps requests at 4.5 MB) and stores the parsed document.
- Optimistic concurrency uses an integer, `pages.draft_revision`, instead of `updated_at`. Renames and status changes also bump `updated_at`, and they must not make the next draft save conflict. An integer also avoids carrying microsecond timestamps through JavaScript.
- The update matches `id` and `draft_revision = baseRevision`, and sets `baseRevision + 1`. When no row matches, the answer is 409 with the current revision, or 404 when the page is gone.
- Dashboard mutations (create, rename, delete) stay server actions.
```

- [ ] **Step 7: Commit.**

```bash
git add supabase lib/supabase/database.types.ts docs/DECISIONS.md
git commit -m "feat(db): draft revision counter; anon cannot call is_workspace_member"
```

---

### Task 3: API auth helper, `/p` prefix and sign-in errors

**Files:**
- Create: `lib/auth/require-user.test.ts`, `app/login/messages.ts`, `app/login/messages.test.ts`
- Modify: `lib/auth/require-user.ts`, `lib/auth/routing.ts`, `lib/auth/routing.test.ts`, `app/login/actions.ts`

**Interfaces:**
- Produces:
  - In `lib/auth/require-user.ts`:
    - `interface SessionUser { userId: string; email: string | null }`.
    - `requireUser(): Promise<SessionUser>`: same behaviour as before (redirects to `/login`).
    - `getApiUser(): Promise<SessionUser | null>`: for route handlers; never redirects.
    - `unauthorizedResponse(): Response`: status 401, body `{ error: 'unauthorized' }` (the same body `lib/supabase/proxy.ts` sends).
  - `PUBLIC_PATH_PREFIXES = ['/login', '/auth', '/api/public'] as const`.
  - `signInErrorMessage(error: { code?: string; status?: number }): string` in `app/login/messages.ts`.

- [ ] **Step 1: Write the failing tests.**

`lib/auth/require-user.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getClaims } = vi.hoisted(() => ({ getClaims: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({ auth: { getClaims } }),
}));

import { getApiUser, unauthorizedResponse } from '@/lib/auth/require-user';

describe('getApiUser', () => {
  beforeEach(() => getClaims.mockReset());
  it('returns the user from verified claims', async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: 'u1', email: 'a@b.test' } } });
    await expect(getApiUser()).resolves.toEqual({ userId: 'u1', email: 'a@b.test' });
  });
  it('returns null without a session instead of redirecting', async () => {
    getClaims.mockResolvedValue({ data: null });
    await expect(getApiUser()).resolves.toBeNull();
  });
});

it('unauthorizedResponse answers 401 with the same body as the proxy', async () => {
  const res = unauthorizedResponse();
  expect(res.status).toBe(401);
  await expect(res.json()).resolves.toEqual({ error: 'unauthorized' });
});
```

`app/login/messages.test.ts`:

```ts
import { expect, it } from 'vitest';
import { signInErrorMessage } from './messages';

it.each([
  [{ code: 'invalid_credentials', status: 400 }, 'Wrong email or password.'],
  [{ code: 'over_request_rate_limit', status: 429 }, 'Too many sign-in attempts. Wait a minute and try again.'],
  [{ status: 429 }, 'Too many sign-in attempts. Wait a minute and try again.'],
  [{ code: 'email_not_confirmed', status: 400 }, 'This account’s email address is not confirmed yet.'],
  [{ status: 0 }, 'Sign-in is unavailable right now. Check your connection and try again.'],
  [{ status: 503 }, 'Sign-in is unavailable right now. Check your connection and try again.'],
  [{}, 'Sign-in is unavailable right now. Check your connection and try again.'],
  [{ code: 'something_new', status: 400 }, 'Could not sign in. Try again.'],
])('%j → %s', (error, message) => expect(signInErrorMessage(error)).toBe(message));
```

In `lib/auth/routing.test.ts`:
- Change `['/p/my-page', true]` to `['/p/my-page', false]`.
- Change the `lets anyone through public paths` case to use `/api/public/beacon`.
- Add:

```ts
it('protects /p until hosted pages exist on their own domain (D-022)', () => {
  expect(decideAuthRoute({ pathname: '/p/offer', search: '', isAuthenticated: false })).toEqual({
    kind: 'redirect',
    location: '/login?next=%2Fp%2Foffer',
  });
});
```

- [ ] **Step 2: Run the tests and make sure they fail.**
  - Run: `pnpm exec vitest run lib/auth app/login`
  - Expected: FAIL (`getApiUser`, `unauthorizedResponse` and `./messages` are missing; `/p` is still public).
- [ ] **Step 3: Implement.**
  - `require-user.ts`: one private `readSessionUser()` (it calls `getClaims()` exactly as today) is shared by `requireUser` and `getApiUser`.
  - `signInErrorMessage` rules:
    - `status === 429` or a code starting with `over_` → rate-limit text;
    - `status` undefined, `0` or `>= 500` → unavailable text;
    - `invalid_credentials` → wrong-password text;
    - `email_not_confirmed` → its text;
    - anything else → "Could not sign in. Try again."
  - In `app/login/actions.ts`, replace the fixed message with `signInErrorMessage(error)`.
- [ ] **Step 4: Run the tests and make sure they pass.**
  - Run: `pnpm test`
  - Expected: PASS.
- [ ] **Step 5: Commit.**

```bash
git add lib/auth app/login
git commit -m "fix(auth): 401 helper for route handlers, protect /p until hosting, specific sign-in errors"
```

---

### Task 4: Page helpers: slugs, empty document and the draft-save core

**Files:**
- Create: `lib/pages/slug.ts`, `lib/pages/slug.test.ts`, `lib/pages/draft.ts`, `lib/pages/draft.test.ts`
- Modify: `lib/schema/document.ts`, `lib/schema/document.test.ts`

**Interfaces:**
- Consumes: `safeParseDocument`, `PageDocument`, `CURRENT_SCHEMA_VERSION`, `DocumentIssue`.
- Produces:
  - In `lib/pages/slug.ts`:
    - `SLUG_MAX_LENGTH = 80`.
    - `slugify(name: string): string`.
    - `uniqueSlug(base: string, taken: ReadonlySet<string>): string`.
    - The output always matches the DB check: `^[a-z0-9]+(-[a-z0-9]+)*$` and ≤ 80 characters.
  - `createEmptyDocument(): PageDocument` in `lib/schema/document.ts`. It is `parseDocument({ schemaVersion: CURRENT_SCHEMA_VERSION, sections: [] })`.
  - In `lib/pages/draft.ts`:
    - `MAX_DRAFT_BYTES = 4 * 1024 * 1024`.
    - The storage seam and result union:

```ts
export interface DraftStore {
  /** Writes when the stored revision equals baseRevision; null when no row matched. */
  update(pageId: string, doc: PageDocument, baseRevision: number): Promise<{ revision: number; updatedAt: string } | null>;
  /** The current revision, or null when the page does not exist or is not visible to the caller. */
  currentRevision(pageId: string): Promise<number | null>;
}
export type SaveDraftResult =
  | { status: 200; body: { revision: number; updatedAt: string } }
  | { status: 404; body: { error: 'not_found' } }
  | { status: 409; body: { error: 'conflict'; revision: number } }
  | { status: 413; body: { error: 'too_large'; maxBytes: number } }
  | { status: 422; body: { error: 'invalid'; issues: DocumentIssue[] } };
export function saveDraft(store: DraftStore, input: { pageId: string; rawBody: string }): Promise<SaveDraftResult>;
```

`saveDraft` runs these checks in order:
1. A `pageId` that is not a UUID (`z.uuid()`) → 404.
2. UTF-8 byte length (`TextEncoder`) of `rawBody` > `MAX_DRAFT_BYTES` → 413.
3. A body that is not JSON → 422, with `[{ path: '', message: 'The request body is not JSON' }]`.
4. A body failing `{ document: unknown, baseRevision: int ≥ 0 }` → 422.
5. A document failing `safeParseDocument` → 422, with at most 20 issues.
6. `store.update(pageId, parsedDoc, baseRevision)`. On a hit → 200. On a miss, `currentRevision` decides: `null` → 404, otherwise 409.

- [ ] **Step 1: Write the failing tests.**

`lib/pages/slug.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SLUG_MAX_LENGTH, slugify, uniqueSlug } from './slug';

const DB_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

describe('slugify', () => {
  it.each([
    ['Botol Minum Anti Bocor!', 'botol-minum-anti-bocor'],
    ['  Café déjà vu  ', 'cafe-deja-vu'],
    ['Promo 12.12 — Meta', 'promo-12-12-meta'],
    ['日本語', 'page'],
    ['!!!', 'page'],
    ['', 'page'],
  ])('%j → %s', (name, slug) => expect(slugify(name)).toBe(slug));
  it('stays within 80 characters without a trailing dash', () => {
    const slug = slugify(`${'a'.repeat(79)} b`);
    expect(slug.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH);
    expect(slug).toMatch(DB_SLUG);
  });
});

describe('uniqueSlug', () => {
  it('returns the base when it is free, else the first free -n suffix', () => {
    expect(uniqueSlug('test', new Set())).toBe('test');
    expect(uniqueSlug('test', new Set(['test', 'test-2']))).toBe('test-3');
  });
  it('shortens long bases so the suffix still fits', () => {
    const base = 'a'.repeat(80);
    const slug = uniqueSlug(base, new Set([base]));
    expect(slug).toBe(`${'a'.repeat(78)}-2`);
    expect(slug).toMatch(DB_SLUG);
  });
});
```

`lib/pages/draft.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { PageDocument } from '@/lib/schema/document';
import { MAX_DRAFT_BYTES, saveDraft, type DraftStore } from './draft';

const PAGE = '7b0c7a52-3c1e-4c8e-9a43-2f1d2b6f0e11';
const body = (document: unknown, baseRevision: unknown = 0) => JSON.stringify({ document, baseRevision });
const EMPTY = { schemaVersion: 1, sections: [] };

function memoryStore(revisions: Record<string, number>) {
  const rows = new Map(Object.entries(revisions).map(([id, revision]) => [id, { revision, doc: null as PageDocument | null }]));
  const store: DraftStore = {
    async update(id, doc, base) {
      const row = rows.get(id);
      if (!row || row.revision !== base) return null;
      row.revision = base + 1;
      row.doc = doc;
      return { revision: row.revision, updatedAt: '2026-10-22T10:00:00.123456+00:00' };
    },
    async currentRevision(id) {
      return rows.get(id)?.revision ?? null;
    },
  };
  return { store, rows };
}

describe('saveDraft', () => {
  it('saves a valid document and returns the next revision', async () => {
    const { store } = memoryStore({ [PAGE]: 0 });
    expect(await saveDraft(store, { pageId: PAGE, rawBody: body(EMPTY) })).toEqual({
      status: 200,
      body: { revision: 1, updatedAt: '2026-10-22T10:00:00.123456+00:00' },
    });
  });
  it('stores the parsed document with defaults filled in', async () => {
    const { store, rows } = memoryStore({ [PAGE]: 0 });
    const raw = { schemaVersion: 1, sections: [{ id: 's1', blocks: [] }] };
    await saveDraft(store, { pageId: PAGE, rawBody: body(raw) });
    expect(rows.get(PAGE)!.doc!.sections[0]!.style).toEqual({ tone: 'base', padY: 'md', width: 'normal' });
  });
  it('answers 409 with the current revision when the base is stale', async () => {
    const { store } = memoryStore({ [PAGE]: 3 });
    expect(await saveDraft(store, { pageId: PAGE, rawBody: body(EMPTY, 2) })).toEqual({
      status: 409,
      body: { error: 'conflict', revision: 3 },
    });
  });
  it('answers 404 for an unknown or malformed page id', async () => {
    const { store } = memoryStore({});
    expect((await saveDraft(store, { pageId: PAGE, rawBody: body(EMPTY) })).status).toBe(404);
    expect((await saveDraft(store, { pageId: 'not-a-uuid', rawBody: body(EMPTY) })).status).toBe(404);
  });
  it('answers 422 with issue paths for an invalid document', async () => {
    const { store } = memoryStore({ [PAGE]: 0 });
    const dup = { schemaVersion: 1, sections: [{ id: 's1', blocks: [
      { id: 'b1', type: 'faq', props: {} }, { id: 'b1', type: 'faq', props: {} },
    ] }] };
    const result = await saveDraft(store, { pageId: PAGE, rawBody: body(dup) });
    expect(result.status).toBe(422);
    expect(result.status === 422 && result.body.issues[0]!.path).toBe('sections.0.blocks.1.id');
  });
  it('answers 422 for a body that is not JSON or lacks a valid baseRevision', async () => {
    const { store } = memoryStore({ [PAGE]: 0 });
    expect((await saveDraft(store, { pageId: PAGE, rawBody: '{nope' })).status).toBe(422);
    expect((await saveDraft(store, { pageId: PAGE, rawBody: body(EMPTY, -1) })).status).toBe(422);
    expect((await saveDraft(store, { pageId: PAGE, rawBody: JSON.stringify({ document: EMPTY }) })).status).toBe(422);
  });
  it('answers 413 above 4 MiB, counting UTF-8 bytes rather than characters', async () => {
    const { store } = memoryStore({ [PAGE]: 0 });
    const rawBody = `"${'é'.repeat(MAX_DRAFT_BYTES / 2 + 1)}"`;
    expect(rawBody.length).toBeLessThan(MAX_DRAFT_BYTES);
    expect(await saveDraft(store, { pageId: PAGE, rawBody })).toEqual({
      status: 413,
      body: { error: 'too_large', maxBytes: MAX_DRAFT_BYTES },
    });
  });
  it('reports at most 20 issues', async () => {
    const { store } = memoryStore({ [PAGE]: 0 });
    const sections = Array.from({ length: 30 }, () => ({ id: 'same', blocks: [] }));
    const result = await saveDraft(store, { pageId: PAGE, rawBody: body({ schemaVersion: 1, sections }) });
    expect(result.status === 422 && result.body.issues.length).toBe(20);
  });
});
```

Add to `lib/schema/document.test.ts`:

```ts
it('createEmptyDocument is a valid document with no sections and ad-page defaults', () => {
  const doc = createEmptyDocument();
  expect(doc.sections).toEqual([]);
  expect(doc.settings.lang).toBe('id');
  expect(doc.settings.seo.noindex).toBe(true);
  expect(parseDocument(doc)).toEqual(doc);
});
```

- [ ] **Step 2: Run the tests and make sure they fail.**
  - Run: `pnpm exec vitest run lib/pages lib/schema/document.test.ts`
  - Expected: FAIL (modules and functions are missing).
- [ ] **Step 3: Implement.**
  - `slugify`: `normalize('NFKD')`, strip `̀-ͯ`, lowercase, replace runs of `[^a-z0-9]` with `-`, trim dashes, cut to 80 characters and trim a trailing dash. An empty result becomes `'page'`.
  - `uniqueSlug`: suffixes `-2`, `-3`, … After cutting the base to `80 - suffix.length`, trim its trailing dashes.
- [ ] **Step 4: Run the tests and make sure they pass.**
  - Run: `pnpm exec vitest run lib/pages lib/schema/document.test.ts`
  - Expected: PASS.
- [ ] **Step 5: Commit.**

```bash
git add lib/pages lib/schema/document.ts lib/schema/document.test.ts
git commit -m "feat(pages): slugs, empty document and the draft-save core with revision checks"
```

---

### Task 5: Dashboard

**Files:**
- Create:
  - `app/(editor)/dashboard/layout.tsx`, `app/(editor)/dashboard/actions.ts`, `app/(editor)/dashboard/new-page-dialog.tsx`, `app/(editor)/dashboard/page-actions.tsx`
  - `lib/pages/queries.ts`, `lib/pages/format.ts`, `lib/pages/format.test.ts`
  - `app/(editor)/editor/[pageId]/page.tsx` (a stub; Task 13 replaces it)
  - `tests/e2e/app/helpers.ts`, `tests/e2e/app/dashboard.spec.ts`
- Modify: `app/(editor)/layout.tsx`, `app/(editor)/dashboard/page.tsx`, `tests/e2e/app/auth.spec.ts`, `playwright.config.ts`
- Add with shadcn: `pnpm exec shadcn add dialog alert-dialog dropdown-menu badge -y -o`, then `pnpm format`

**Interfaces:**
- Consumes: `requireUser()` (Task 3); `slugify`, `uniqueSlug` and `createEmptyDocument` (Task 4); `draft_revision` (Task 2).
- Produces:
  - `lib/pages/queries.ts` starts with `import 'server-only'` and uses `type Supabase = SupabaseClient<Database>`:

```ts
export type PageStatus = 'draft' | 'exported' | 'live' | 'archived';
export interface PageSummary { id: string; name: string; slug: string; status: PageStatus; updatedAt: string }
export function listPages(supabase: Supabase): Promise<PageSummary[]>; // newest updated_at first
export interface EditorPageRecord { id: string; name: string; currentDraft: unknown; draftRevision: number }
export function getPageForEditor(supabase: Supabase, pageId: string): Promise<EditorPageRecord | null>;
export function getWorkspaceId(supabase: Supabase): Promise<string>; // throws when the user has none
```

  - Server actions in `app/(editor)/dashboard/actions.ts`:
    - `export type ActionState = { error: string | null; done?: boolean }`.
    - `createPage(prev: ActionState, formData: FormData)`: field `name`. Redirects to `/editor/<id>`.
    - `renamePage(prev, formData)`: fields `pageId` and `name`. Returns `{ error: null, done: true }`.
    - `deletePage(prev, formData)`: field `pageId`.
    - Each calls `await requireUser()` first, validates with Zod (`z.uuid()`, `name: z.string().trim().min(1).max(120)`) and calls `revalidatePath('/dashboard')`.
    - `createPage` details:
      - It reads taken slugs with `.like('slug', `${base}%`)` and inserts `{ workspace_id, name, slug, current_draft: createEmptyDocument(), schema_version: CURRENT_SCHEMA_VERSION }`.
      - On a `23505` unique violation it re-reads and retries up to 3 times.
      - The slug never changes on rename. Slugs are export file names; M3 makes them editable.
  - `formatEdited(updatedAt: string, now: Date): string` in `lib/pages/format.ts`. Use `Intl.RelativeTimeFormat('en', { numeric: 'auto' })` (editor UI, not renderer):
    - under 1 minute → `'just now'`;
    - under 1 hour → minutes;
    - under 1 day → hours;
    - under 7 days → days;
    - otherwise `toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })`.

    The dashboard is a server component, so the text renders once and never hydrates differently.
  - E2E helpers in `tests/e2e/app/helpers.ts`:

```ts
export const OWNER: { email: string; password: string }; // from E2E_OWNER_EMAIL / E2E_OWNER_PASSWORD with the current defaults
export const EMPTY_DOC = { schemaVersion: 1, sections: [] };
export function adminClient(): SupabaseClient; // service role, persistSession false
export function ensureOwner(): Promise<void>; // createUser, ignoring "already registered"
export function ownerWorkspaceId(): Promise<string>; // cached per worker
export function resetOwnerPages(): Promise<void>; // delete every page in the owner's workspace
export function seedPage(input: { name: string; document: unknown; slug?: string }): Promise<string>; // inserts raw JSON; slug defaults to `seed-<8 hex>`
export function signIn(page: Page, next?: string): Promise<void>; // fills the form, waits until the URL leaves /login
```

  - The `/editor/[pageId]` stub calls `requireUser()`. It answers `notFound()` for an id that is not a UUID or a page that is missing, and otherwise renders `<main><h1>{name}</h1></main>`.

**UI contract:**
- **Layouts:** `app/(editor)/layout.tsx` keeps `await requireUser()` and renders `<div className="flex min-h-full flex-1 flex-col">{children}</div>`. The current header (the "LaunchPad" wordmark and the "Sign out" button) and the `p-4` content wrapper move into `app/(editor)/dashboard/layout.tsx`, so the editor can use the whole window.
- **Dashboard:** heading "Your pages". The empty state is the text "No pages yet." and a "New page" button.
- **New page:** a dialog titled "New page" with field "Name" (default value "Untitled page") and button "Create page".
- **Page rows:** each page is a `listitem` containing:
  - a link with the page name, to `/editor/<id>`;
  - a status badge ("Draft", "Exported", "Live" or "Archived");
  - `Edited <formatEdited>`;
  - a menu button named `Actions for <name>`, with items "Rename" and "Delete".
- **Rename:** a dialog titled "Rename page" with field "Name" and button "Save". It closes when the action returns `done`.
- **Delete:** an alert dialog titled `Delete “<name>”?` with the text "This deletes the page and its draft. It can't be undone." and the buttons "Cancel" and "Delete page".
- **Validation message:** "Enter a name (1–120 characters)."

- [ ] **Step 1: Write the failing tests.**

`lib/pages/format.test.ts`:

```ts
import { expect, it } from 'vitest';
import { formatEdited } from './format';

const now = new Date('2026-10-22T12:00:00Z');
it.each([
  ['2026-10-22T11:59:30Z', 'just now'],
  ['2026-10-22T11:55:00Z', '5 minutes ago'],
  ['2026-10-22T09:00:00Z', '3 hours ago'],
  ['2026-10-20T12:00:00Z', '2 days ago'],
  ['2026-10-03T08:00:00Z', 'Oct 3, 2026'],
])('%s → %s', (iso, text) => expect(formatEdited(iso, now)).toBe(text));
```

`tests/e2e/app/dashboard.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { adminClient, EMPTY_DOC, ensureOwner, resetOwnerPages, seedPage, signIn } from './helpers';

test.beforeAll(ensureOwner);
test.beforeEach(async ({ page }) => {
  await resetOwnerPages();
  await signIn(page);
});

async function createPage(page: import('@playwright/test').Page, name: string) {
  await page.getByRole('button', { name: 'New page' }).click();
  await page.getByLabel('Name').fill(name);
  await page.getByRole('button', { name: 'Create page' }).click();
  await expect(page).toHaveURL(/\/editor\/[0-9a-f-]{36}$/, { timeout: 20_000 });
}

test('creates a blank page and opens it in the editor', async ({ page }) => {
  await createPage(page, 'Botol test');
  await expect(page.getByRole('heading', { name: 'Botol test' })).toBeVisible();
});

test('two pages with the same name get distinct slugs', async ({ page }) => {
  await createPage(page, 'Botol test');
  await page.goto('/dashboard');
  await createPage(page, 'Botol test');
  const { data } = await adminClient().from('pages').select('slug').eq('name', 'Botol test');
  expect(data!.map((row) => row.slug).sort()).toEqual(['botol-test', 'botol-test-2']);
});

test('lists pages newest first with status and last edited', async ({ page }) => {
  await seedPage({ name: 'Older', document: EMPTY_DOC });
  await seedPage({ name: 'Newer', document: EMPTY_DOC });
  await page.reload();
  const items = page.getByRole('listitem');
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toContainText('Newer');
  await expect(items.nth(0)).toContainText('Draft');
  await expect(items.nth(0)).toContainText('Edited just now');
  await expect(items.nth(1)).toContainText('Older');
});

test('renames a page', async ({ page }) => {
  await seedPage({ name: 'Old name', document: EMPTY_DOC });
  await page.reload();
  await page.getByRole('button', { name: 'Actions for Old name' }).click();
  await page.getByRole('menuitem', { name: 'Rename' }).click();
  await page.getByLabel('Name').fill('New name');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('link', { name: 'New name' })).toBeVisible();
});

test('deletes a page only after confirmation', async ({ page }) => {
  await seedPage({ name: 'Doomed', document: EMPTY_DOC });
  await page.reload();
  for (const confirm of [false, true]) {
    await page.getByRole('button', { name: 'Actions for Doomed' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await expect(page.getByRole('alertdialog')).toContainText('Delete “Doomed”?');
    await page.getByRole('button', { name: confirm ? 'Delete page' : 'Cancel' }).click();
    await expect(page.getByRole('link', { name: 'Doomed' })).toHaveCount(confirm ? 0 : 1);
  }
  await expect(page.getByText('No pages yet.')).toBeVisible();
});

test('unknown or malformed page ids show the not-found page', async ({ page }) => {
  for (const id of [crypto.randomUUID(), 'not-a-uuid']) {
    const response = await page.goto(`/editor/${id}`);
    expect(response?.status()).toBe(404);
  }
});
```

Update `tests/e2e/app/auth.spec.ts`:
- Import `OWNER`, `ensureOwner`, `resetOwnerPages` and `signIn` from `./helpers`, and delete the local copies.
- The test asserting "No pages yet." calls `await resetOwnerPages()` first.
- Keep every existing assertion.

Update `playwright.config.ts`: `workers: withApp ? 1 : undefined`, with the comment `// app tests share one owner account and reset its pages`.

- [ ] **Step 2: Run the tests and make sure they fail.**
  - Run: `pnpm exec vitest run lib/pages/format.test.ts && pnpm test:e2e:app`
  - Expected: FAIL (`format.ts` is missing; there is no "New page" button).
- [ ] **Step 3: Implement** `queries.ts`, `format.ts`, the actions, the dialogs (client components using `useActionState`), the layouts and the editor stub, following the UI contract.
- [ ] **Step 4: Run the tests and make sure they pass.**
  - Run: `pnpm test && pnpm test:e2e:app`
  - Expected: PASS. The first editor load in dev can take about 10 s; the 20 s timeouts cover it.
- [ ] **Step 5: Commit.**

```bash
git add app components/ui lib/pages tests/e2e/app playwright.config.ts package.json pnpm-lock.yaml
git commit -m "feat(dashboard): list, create, rename and delete pages"
```

---

### Task 6: Draft save endpoint

**Files:**
- Create: `app/api/pages/[pageId]/draft/route.ts`, `app/api/pages/[pageId]/draft/route.test.ts`, `lib/pages/draft-store.ts`, `tests/e2e/app/draft-api.spec.ts`

**Interfaces:**
- Consumes: `getApiUser` and `unauthorizedResponse` (Task 3); `saveDraft`, `DraftStore` and `MAX_DRAFT_BYTES` (Task 4).
- Produces:
  - `PUT /api/pages/[pageId]/draft`. The request is `application/json` `{ document: unknown, baseRevision: number }`. Responses:
    - 200 `{ revision, updatedAt }`;
    - 401 `{ error: 'unauthorized' }`;
    - 403 `{ error: 'forbidden' }`;
    - 404 `{ error: 'not_found' }`;
    - 409 `{ error: 'conflict', revision }`;
    - 413 `{ error: 'too_large', maxBytes }`;
    - 415 `{ error: 'unsupported_media_type' }`;
    - 422 `{ error: 'invalid', issues }`.
  - `createSupabaseDraftStore(supabase: SupabaseClient<Database>): DraftStore` in `lib/pages/draft-store.ts` (server-only):
    - `update` runs `.update({ current_draft, schema_version, draft_revision: base + 1 }).eq('id', id).eq('draft_revision', base).select('draft_revision, updated_at').maybeSingle()`.
    - `currentRevision` runs `.select('draft_revision').eq('id', id).maybeSingle()`.
    - Both throw on a Supabase error.

The handler checks, in this order:
1. `getApiUser()`.
2. The `content-type` media type must be `application/json`; otherwise 415.
3. When an `Origin` header is present, it must equal `new URL(request.url).origin`; otherwise 403.
4. `content-length` > `MAX_DRAFT_BYTES` → 413, before reading the body.
5. `await request.text()`.
6. `saveDraft(createSupabaseDraftStore(supabase), { pageId, rawBody })`.
7. Respond with `Response.json(result.body, { status: result.status })`.

- [ ] **Step 1: Write the failing tests.**

`app/api/pages/[pageId]/draft/route.test.ts`:

```ts
import { beforeEach, expect, it, vi } from 'vitest';

const { getApiUser } = vi.hoisted(() => ({ getApiUser: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/require-user', () => ({
  getApiUser,
  unauthorizedResponse: () => Response.json({ error: 'unauthorized' }, { status: 401 }),
}));
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => {
    throw new Error('no database in unit tests');
  },
}));

import { PUT } from './route';

const ctx = { params: Promise.resolve({ pageId: '7b0c7a52-3c1e-4c8e-9a43-2f1d2b6f0e11' }) } as never;
const put = (init: RequestInit) =>
  PUT(new Request('http://localhost:3000/api/pages/x/draft', { method: 'PUT', ...init }), ctx);

beforeEach(() => getApiUser.mockResolvedValue({ userId: 'u1', email: null }));

it('answers 401 without a session, before touching the database', async () => {
  getApiUser.mockResolvedValue(null);
  expect((await put({ headers: { 'content-type': 'application/json' }, body: '{}' })).status).toBe(401);
});
it('answers 415 for anything but JSON', async () => {
  expect((await put({ headers: { 'content-type': 'text/plain' }, body: '{}' })).status).toBe(415);
});
it('answers 403 for a cross-origin request', async () => {
  const res = await put({ headers: { 'content-type': 'application/json', origin: 'https://evil.example' }, body: '{}' });
  expect(res.status).toBe(403);
});
it('answers 413 from content-length before reading the body', async () => {
  const res = await put({ headers: { 'content-type': 'application/json', 'content-length': String(5 * 1024 * 1024) }, body: '{}' });
  expect(res.status).toBe(413);
});
```

`tests/e2e/app/draft-api.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { adminClient, EMPTY_DOC, ensureOwner, resetOwnerPages, seedPage, signIn } from './helpers';

test.beforeAll(ensureOwner);
test.beforeEach(async ({ page }) => {
  await resetOwnerPages();
  await signIn(page);
});

test('saves with the current revision and rejects a stale one', async ({ page }) => {
  const id = await seedPage({ name: 'Api', document: EMPTY_DOC });
  const url = `/api/pages/${id}/draft`;
  const first = await page.request.put(url, { data: { document: EMPTY_DOC, baseRevision: 0 } });
  expect(first.status()).toBe(200);
  expect(await first.json()).toMatchObject({ revision: 1 });
  const stale = await page.request.put(url, { data: { document: EMPTY_DOC, baseRevision: 0 } });
  expect(stale.status()).toBe(409);
  expect(await stale.json()).toEqual({ error: 'conflict', revision: 1 });
});

test('stores the normalized document', async ({ page }) => {
  const id = await seedPage({ name: 'Api', document: EMPTY_DOC });
  await page.request.put(`/api/pages/${id}/draft`, { data: { document: EMPTY_DOC, baseRevision: 0 } });
  const { data } = await adminClient().from('pages').select('current_draft, draft_revision').eq('id', id).single();
  expect(data).toMatchObject({ draft_revision: 1, current_draft: { settings: { lang: 'id', seo: { noindex: true } } } });
});

test('rejects invalid documents, wrong content types, foreign origins and oversized bodies', async ({ page }) => {
  const id = await seedPage({ name: 'Api', document: EMPTY_DOC });
  const url = `/api/pages/${id}/draft`;
  const invalid = await page.request.put(url, { data: { document: { schemaVersion: 1, sections: 'x' }, baseRevision: 0 } });
  expect(invalid.status()).toBe(422);
  expect((await invalid.json()).issues[0].path).toBe('sections');
  expect((await page.request.put(url, { headers: { 'content-type': 'text/plain' }, data: '{}' })).status()).toBe(415);
  expect((await page.request.put(url, { headers: { origin: 'https://evil.example' }, data: { document: EMPTY_DOC, baseRevision: 0 } })).status()).toBe(403);
  const huge = 'x'.repeat(4 * 1024 * 1024 + 1);
  expect((await page.request.put(url, { data: { document: huge, baseRevision: 0 } })).status()).toBe(413);
});

test('unknown pages answer 404 and anonymous requests 401', async ({ page, playwright, baseURL }) => {
  const missing = await page.request.put(`/api/pages/${crypto.randomUUID()}/draft`, { data: { document: EMPTY_DOC, baseRevision: 0 } });
  expect(missing.status()).toBe(404);
  const anon = await playwright.request.newContext({ baseURL });
  expect((await anon.put(`/api/pages/${crypto.randomUUID()}/draft`, { data: {} })).status()).toBe(401);
  await anon.dispose();
});
```

- [ ] **Step 2: Run the tests and make sure they fail.**
  - Run: `pnpm exec vitest run "app/api" && pnpm test:e2e:app`
  - Expected: FAIL (`./route` is missing; e2e PUTs answer 404 or 405).
- [ ] **Step 3: Implement** `route.ts` and `draft-store.ts`.
- [ ] **Step 4: Run the tests and make sure they pass.**
  - Run: `pnpm test && pnpm test:e2e:app`
  - Expected: PASS.
- [ ] **Step 5: Commit.**

```bash
git add app/api lib/pages/draft-store.ts tests/e2e/app/draft-api.spec.ts
git commit -m "feat(api): draft save endpoint with revision conflicts, size cap and origin check"
```

---

### Task 7: Block-level renderer API

The canvas needs one block's markup at a time and the body skeleton with a placeholder for each block. Both must come from the renderer itself, so the preview cannot drift from the export.

**Files:**
- Modify: `lib/renderer/page.ts`, `lib/renderer/index.ts`, `lib/renderer/page.test.ts`

**Interfaces:**
- Produces (in `page.ts`, re-exported from `lib/renderer/index.ts`):

```ts
export function createRenderEnv(doc: PageDocument, mode: RenderMode): RenderEnv;
export interface BlockAt { sectionId: string; sectionIndex: number; indexInSection: number }
/** One block's wrapper and content exactly as renderPage emits them; null for an unregistered type. */
export function renderBlock(env: RenderEnv, block: BlockInstance, at: BlockAt): SafeHtml | null;
export type BlockRenderer = (block: BlockInstance, at: BlockAt) => SafeHtml | null;
/** `<main>…</main>` plus the trailing footer sections; a null block renders nothing. */
export function renderBody(doc: PageDocument, env: RenderEnv, renderOne: BlockRenderer): SafeHtml;
/** Index of the first trailing section made only of footer-landmark blocks (D-017); sections.length when none. */
export function footerStart(doc: PageDocument): number;
```

`renderPage` keeps its signature, stats, warnings and output, byte for byte. It is rewritten in terms of these functions. It collects stats and pushes the unknown-type warning inside the `BlockRenderer` it passes to `renderBody`.

- [ ] **Step 1: Write the failing tests.** Add to `lib/renderer/page.test.ts`:

```ts
import { exampleDocument } from '@/tests/fixtures/example-document';
import { createRenderEnv, footerStart, renderBlock, renderBody } from '@/lib/renderer/page';
import { html } from '@/lib/renderer/html';

describe('block-level API', () => {
  const example = parseDocument(exampleDocument);
  it('renderBlock returns exactly the markup renderPage emits for each block', () => {
    for (const mode of ['export', 'preview'] as const) {
      const page = renderPage(example, { mode }).html;
      const env = createRenderEnv(example, mode);
      example.sections.forEach((section, sectionIndex) =>
        section.blocks.forEach((block, indexInSection) => {
          const markup = renderBlock(env, block, { sectionId: section.id, sectionIndex, indexInSection });
          expect(page).toContain(markup!.value);
        }),
      );
    }
  });
  it('renderBody with slots keeps every block in order and the footer after </main>', () => {
    const env = createRenderEnv(example, 'preview');
    const body = renderBody(example, env, (block) => html`<div data-lp-slot="${block.id}"></div>`).value;
    const ids = example.sections.flatMap((s) => s.blocks.map((b) => b.id));
    expect([...body.matchAll(/data-lp-slot="([^"]+)"/g)].map((m) => m[1])).toEqual(ids);
    expect(body.startsWith('<main>')).toBe(true);
    expect(body.indexOf('</main>')).toBeLessThan(body.indexOf(`data-lp-slot="${ids.at(-1)}"`));
  });
  it('footerStart finds only trailing footer-only sections', () => {
    const s = (id: string, type: string, props: unknown = {}) => ({ id, blocks: [{ id: `b${id}`, type, props }] });
    const hero = { headline: 'Hi' };
    expect(footerStart(parseDocument({ schemaVersion: 1, sections: [s('1', 'hero', hero), s('2', 'footer')] }))).toBe(1);
    expect(footerStart(parseDocument({ schemaVersion: 1, sections: [s('1', 'footer'), s('2', 'hero', hero)] }))).toBe(2);
    expect(footerStart(parseDocument({ schemaVersion: 1, sections: [] }))).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests and make sure they fail.**
  - Run: `pnpm exec vitest run lib/renderer/page.test.ts`
  - Expected: FAIL (the exports are missing).
- [ ] **Step 3: Refactor `page.ts`.** Do not touch any block's render code.
- [ ] **Step 4: Run the tests and make sure they pass.**
  - Run: `pnpm test`
  - Expected: PASS, with the existing `__snapshots__/*.html` files unchanged. Do not pass `--update`: a snapshot diff means the refactor changed the output.
- [ ] **Step 5: Commit.**

```bash
git add lib/renderer
git commit -m "refactor(renderer): expose block-level rendering and the body skeleton for the editor"
```

---

### Task 8: Editor commands

**Files:**
- Create: `lib/editor/structure.ts`, `lib/editor/structure.test.ts`, `lib/editor/schema-path.ts`, `lib/editor/schema-path.test.ts`, `lib/editor/commands.ts`, `lib/editor/commands.test.ts`, `lib/editor/test-fixtures.ts`
- Modify: `package.json`/`pnpm-lock.yaml` (`pnpm add immer@11.1.21 --save-exact`), `lib/schema/document.ts` (export `SECTION_ANCHOR_PATTERN`, the existing `ANCHOR` regex), `docs/DECISIONS.md` (D-036, D-037)

**Interfaces:**
- Consumes: `footerStart` (Task 7); `PageDocumentSchema`, `LIMITS`, `SECTION_ANCHOR_PATTERN`, `BlockStyleSchema`, `SectionStyleSchema`, `PageSettingsSchema`, `getBlockDefinition` and `IdFactory`.
- Produces:
  - `lib/editor/structure.ts`:

```ts
export type Selection = { kind: 'block'; blockId: string } | { kind: 'section'; sectionId: string } | { kind: 'page' };
export type PropPath = readonly (string | number)[];
export type Direction = 'up' | 'down';
export interface BlockLocation { sectionIndex: number; blockIndex: number }
export function findBlock(doc: PageDocument, blockId: string): BlockLocation | null;
export function findSection(doc: PageDocument, sectionId: string): number; // -1 when missing
export function canMoveBlock(doc: PageDocument, blockId: string, direction: Direction): boolean;
export function canMoveSection(doc: PageDocument, sectionId: string, direction: Direction): boolean;
export function getAtPath(value: unknown, path: PropPath): unknown;
/** Deep copy in which every object with a string `id` gets newId(). */
export function withFreshIds<T>(value: T, newId: IdFactory): T;
export function selectionExists(doc: PageDocument, selection: Selection | null): boolean;
export function blockTypeLabel(type: string): string; // the registry label, or the type itself
```

  - `lib/editor/schema-path.ts`: `schemaAt(root: z.ZodType, path: PropPath, current: unknown): z.ZodType | null`. It returns the field schema as declared, wrappers included. It walks object shapes and array elements, and unwraps optional, default and prefault on the way down. For a union discriminated by `kind`, it picks the option whose literal matches `getAtPath(current, prefix).kind`. It returns `null` when the path leaves the schema.
  - `lib/editor/commands.ts` (calls Immer's `enablePatches()` once at module scope):

```ts
export type EditorCommand =
  | { type: 'addBlock'; blockType: string }
  | { type: 'moveBlock'; blockId: string; direction: Direction }
  | { type: 'duplicateBlock'; blockId: string }
  | { type: 'removeBlock'; blockId: string }
  | { type: 'setBlockProp'; blockId: string; path: PropPath; value: unknown } // undefined deletes an optional key
  | { type: 'setBlockStyle'; blockId: string; path: PropPath; value: unknown }
  | { type: 'moveSection'; sectionId: string; direction: Direction }
  | { type: 'duplicateSection'; sectionId: string }
  | { type: 'removeSection'; sectionId: string }
  | { type: 'setSectionStyle'; sectionId: string; path: PropPath; value: unknown }
  | { type: 'setSectionAnchor'; sectionId: string; anchor: string | undefined }
  | { type: 'setSetting'; path: PropPath; value: unknown }
  | { type: 'listInsert'; blockId: string; path: PropPath; index: number; item: unknown }
  | { type: 'listMove'; blockId: string; path: PropPath; from: number; to: number }
  | { type: 'listRemove'; blockId: string; path: PropPath; index: number }
  | { type: 'listDuplicate'; blockId: string; path: PropPath; index: number };
export interface CommandDeps { newId: IdFactory }
export interface CommandFailure { ok: false; code: 'not_found' | 'noop' | 'limit' | 'invalid'; reason: string }
export interface CommandSuccess {
  ok: true; doc: PageDocument; patches: Patch[]; inversePatches: Patch[];
  label: string; selection: Selection | null; announcement: string;
}
export type CommandResult = CommandSuccess | CommandFailure;
export function applyCommand(doc: PageDocument, command: EditorCommand, selection: Selection | null, deps: CommandDeps): CommandResult;
```

Rules (D-037):
- **Values are normalized before storing.**
  - `setBlockProp`, `setBlockStyle`, `setSectionStyle` and `setSetting` parse `value` with `schemaAt(…)` and store the parse output.
  - `undefined` deletes the key, and only when the declared schema is optional.
  - A path whose parent value is missing → `invalid`. For example, `['secondaryCta', 'label']` while `secondaryCta` is absent; optional groups are added whole.
  - `listInsert` parses `item` with the array's element schema.
  - A failed parse → `invalid`, with the first issue's message.
  - Afterwards the whole block props, style or settings object is validated again. A Zod `too_big` issue on an array becomes `limit` ("This list holds at most N items").
- **Limits:**
  - More than `LIMITS.sections` sections, `LIMITS.blocksPerSection` blocks in a section or `LIMITS.totalBlocks` blocks → `limit`.
  - An unknown id → `not_found`.
  - A move past the edge → `noop`.
  - Bad list indices → `invalid`.
- **`addBlock`:**
  - It generates the new section id first, then the block id, then the item ids of `defaultProps(newId)`.
  - The new section has `SectionStyleSchema.parse({})`, and the block has `BlockStyleSchema.parse({})`.
  - Position: a footer goes at the very end. Any other block goes after the selected block's or section's section, clamped to `footerStart(doc)`; with no selection (or `page`), it goes at `footerStart(doc)`.
  - It selects the new block.
- **`moveBlock`:**
  - A block alone in its section moves the whole section (swap).
  - In a shared section the block swaps with its neighbour.
  - At the section's edge, the block leaves into a new section placed directly before (up) or after (down) it. The new section copies the band's style but not its anchor.
- **`duplicateBlock`:** a block alone in its section → the section is duplicated (new section id and block id), placed right after it, and the copy is selected. In a shared section → a copy with a new block id goes right after the original, and the copy is selected. Item ids inside the copied block are kept, because they only need to be unique within their list.
- **`removeBlock`:**
  - An emptied section is removed.
  - Selection moves to the next block in reading order, else the previous one, else `null`.
  - `removeSection` selects the next section, else the previous one, else `null`.
- **`duplicateSection`** gives the copy a new section id and each block in it a new block id, keeping item ids. It places the copy after the original and selects it.
- **`setSectionAnchor`:** the anchor must match `SECTION_ANCHOR_PATTERN` and be unique; `undefined` removes it.
- **`listDuplicate`** inserts `withFreshIds(item)` at `index + 1`. `listMove` moves `from` to `to` (splice semantics).
- **Selection** is unchanged for every other command.
- **Labels and announcements:**

| Command | `label` | `announcement` |
|---|---|---|
| addBlock | `Add <Label>` | `Added <Label>` |
| moveBlock (whole section) | `Move <Label> up/down` | `Moved <Label> up/down, now section <i> of <n>` |
| moveBlock (within section) | same | `Moved <Label> up/down, now block <i> of <n> in its section` |
| moveBlock (leaves section) | same | `Moved <Label> up/down into its own section` |
| duplicateBlock / removeBlock | `Duplicate <Label>` / `Delete <Label>` | `Duplicated <Label>` / `Deleted <Label>` |
| setBlockProp / setBlockStyle | `Edit <Label>` / `Edit <Label> style` | `''` |
| moveSection | `Move section up/down` | `Moved section up/down, now <i> of <n>` |
| duplicateSection / removeSection | `Duplicate section` / `Delete section` | `Duplicated section` / `Deleted section` |
| setSectionStyle / setSectionAnchor / setSetting | `Edit section style` / `Edit section anchor` / `Edit page settings` | `''` |
| listInsert / listMove / listRemove / listDuplicate | `Add item` / `Move item` / `Delete item` / `Duplicate item` | `Added item <i>` / `Moved item to position <i>` / `Deleted item` / `Duplicated item <i>` |

Here `<Label>` is `blockTypeLabel(type)` and positions are 1-based.

`lib/editor/test-fixtures.ts` (test-only helpers, reused by later tasks):

```ts
/** s1[b1 hero] · s2(tone muted)[b2 benefits, b3 faq] · s3[b4 product-carousel, items i6–i8] · s4[b5 footer] */
export function editorDoc(): PageDocument; // parseDocument of defaultProps(sequentialIds('i')), in block order
export const deps = (): CommandDeps => ({ newId: sequentialIds('n') });
export const order = (doc: PageDocument) => doc.sections.map((s) => `${s.id}:${s.blocks.map((b) => b.id).join(',')}`);
/** One valid command of every type, applicable in sequence to editorDoc() with deps(). */
export function everyCommand(): EditorCommand[];
```

`everyCommand()` returns, in this order:
1. `addBlock testimonials`
2. `moveBlock b4 up`
3. `duplicateBlock b1`
4. `removeBlock b3`
5. `setBlockProp b1 ['headline'] 'Botol **anti bocor**'`
6. `setBlockStyle b1 ['hideOn'] 'desktop'`
7. `moveSection s2 down`
8. `duplicateSection s2`
9. `removeSection s4`
10. `setSectionStyle s3 ['tone'] 'dark'`
11. `setSectionAnchor s3 'pesan'`
12. `setSetting ['theme','colors','primary'] '#0F766E'`
13. `listInsert b4 ['items'] 0 { id: 'x1', title: 'Botol baru' }`
14. `listMove b4 ['items'] 0→2`
15. `listDuplicate b4 ['items'] 1`
16. `listRemove b4 ['items'] 0`

- [ ] **Step 1: Write the failing tests.**

`lib/editor/schema-path.test.ts`:

```ts
import { expect, it } from 'vitest';
import { HeroPropsSchema } from '@/lib/blocks/hero/schema';
import { ProductCarouselPropsSchema } from '@/lib/blocks/special/product-carousel/schema';
import { ImageSchema } from '@/lib/schema/primitives';
import { schemaAt } from './schema-path';

it('resolves fields through objects, arrays, wrappers and kind unions', () => {
  expect(schemaAt(HeroPropsSchema, ['headline'], {})!.safeParse('').success).toBe(false);
  expect((schemaAt(HeroPropsSchema, ['image'], {}) as { unwrap(): unknown }).unwrap()).toBe(ImageSchema);
  const current = { items: [{ cta: { label: '', link: { kind: 'url', url: '' } } }] };
  const url = schemaAt(ProductCarouselPropsSchema, ['items', 0, 'cta', 'link', 'url'], current)!;
  expect(url.safeParse('https://x.test').success).toBe(true);
  expect(schemaAt(ProductCarouselPropsSchema, ['items', 0, 'nope'], current)).toBeNull();
  expect(schemaAt(ProductCarouselPropsSchema, ['slidesPerView', 'mobile'], {})!.parse(undefined)).toBe(1.3);
});
```

`lib/editor/commands.test.ts`:

```ts
import { applyPatches } from 'immer';
import { describe, expect, it } from 'vitest';
import { PageDocumentSchema, parseDocument } from '@/lib/schema/document';
import { applyCommand, type CommandSuccess, type EditorCommand } from './commands';
import { deps, editorDoc, everyCommand, order } from './test-fixtures';

const run = (command: EditorCommand, doc = editorDoc(), selection: Parameters<typeof applyCommand>[2] = null) =>
  applyCommand(doc, command, selection, deps());
const ok = (result: ReturnType<typeof run>) => {
  if (!result.ok) throw new Error(result.reason);
  return result;
};

describe('addBlock', () => {
  it('inserts a new default section before trailing footers and selects the block', () => {
    const r = ok(run({ type: 'addBlock', blockType: 'hero' }));
    expect(order(r.doc)).toEqual(['s1:b1', 's2:b2,b3', 's3:b4', 'n1:n2', 's4:b5']);
    expect(r.doc.sections[3]!.style).toEqual({ tone: 'base', padY: 'md', width: 'normal' });
    expect(r.selection).toEqual({ kind: 'block', blockId: 'n2' });
    expect(r.announcement).toBe('Added Hero');
  });
  it('inserts after the selected block’s section, and footers always go last', () => {
    expect(order(ok(run({ type: 'addBlock', blockType: 'faq' }, editorDoc(), { kind: 'block', blockId: 'b2' })).doc))
      .toEqual(['s1:b1', 's2:b2,b3', 'n1:n2', 's3:b4', 's4:b5']);
    expect(order(ok(run({ type: 'addBlock', blockType: 'footer' }, editorDoc(), { kind: 'block', blockId: 'b1' })).doc).at(-1))
      .toBe('n1:n2');
  });
  it('refuses a 61st section', () => {
    const many = parseDocument({ schemaVersion: 1, sections: Array.from({ length: 60 }, (_, i) => ({ id: `x${i}`, blocks: [] })) });
    expect(run({ type: 'addBlock', blockType: 'faq' }, many)).toMatchObject({ ok: false, code: 'limit' });
  });
});

describe('moveBlock', () => {
  it('moves a block that is alone in its section together with the section', () => {
    const r = ok(run({ type: 'moveBlock', blockId: 'b4', direction: 'up' }));
    expect(order(r.doc)).toEqual(['s1:b1', 's3:b4', 's2:b2,b3', 's4:b5']);
    expect(r.announcement).toBe('Moved Product Carousel up, now section 2 of 4');
  });
  it('is a noop at the page edges', () => {
    expect(run({ type: 'moveBlock', blockId: 'b1', direction: 'up' })).toMatchObject({ ok: false, code: 'noop' });
    expect(run({ type: 'moveBlock', blockId: 'b5', direction: 'down' })).toMatchObject({ ok: false, code: 'noop' });
  });
  it('swaps neighbours inside a shared section', () => {
    const r = ok(run({ type: 'moveBlock', blockId: 'b3', direction: 'up' }));
    expect(order(r.doc)).toEqual(['s1:b1', 's2:b3,b2', 's3:b4', 's4:b5']);
    expect(r.announcement).toBe('Moved FAQ up, now block 1 of 2 in its section');
  });
  it('leaves a shared section at its edge into a new section with the same style', () => {
    const up = ok(run({ type: 'moveBlock', blockId: 'b2', direction: 'up' }));
    expect(order(up.doc)).toEqual(['s1:b1', 'n1:b2', 's2:b3', 's3:b4', 's4:b5']);
    expect(up.doc.sections[1]!.style.tone).toBe('muted');
    expect(up.announcement).toBe('Moved Benefits up into its own section');
    expect(order(ok(run({ type: 'moveBlock', blockId: 'b3', direction: 'down' })).doc))
      .toEqual(['s1:b1', 's2:b2', 'n1:b3', 's3:b4', 's4:b5']);
  });
});

describe('duplicate and remove', () => {
  it('duplicates a lone block as a section and a shared block in place', () => {
    const lone = ok(run({ type: 'duplicateBlock', blockId: 'b1' }));
    expect(order(lone.doc)).toEqual(['s1:b1', 'n1:n2', 's2:b2,b3', 's3:b4', 's4:b5']);
    expect(lone.doc.sections[1]!.blocks[0]!.props).toEqual(lone.doc.sections[0]!.blocks[0]!.props);
    const shared = ok(run({ type: 'duplicateBlock', blockId: 'b2' }));
    expect(order(shared.doc)).toEqual(['s1:b1', 's2:b2,n1,b3', 's3:b4', 's4:b5']);
    expect(shared.selection).toEqual({ kind: 'block', blockId: 'n1' });
  });
  it('removes emptied sections and selects the next block, else the previous one', () => {
    const first = ok(run({ type: 'removeBlock', blockId: 'b1' }));
    expect(order(first.doc)).toEqual(['s2:b2,b3', 's3:b4', 's4:b5']);
    expect(first.selection).toEqual({ kind: 'block', blockId: 'b2' });
    expect(ok(run({ type: 'removeBlock', blockId: 'b5' })).selection).toEqual({ kind: 'block', blockId: 'b4' });
  });
});

describe('props, styles, anchors and settings', () => {
  it('sets nested and list paths and deletes optional keys', () => {
    const doc = ok(run({ type: 'setBlockProp', blockId: 'b1', path: ['primaryCta', 'label'], value: 'Pesan' })).doc;
    expect(doc.sections[0]!.blocks[0]!.props).toMatchObject({ primaryCta: { label: 'Pesan' } });
    const noImage = ok(run({ type: 'setBlockProp', blockId: 'b1', path: ['image'], value: undefined })).doc;
    expect('image' in noImage.sections[0]!.blocks[0]!.props).toBe(false);
    const title = ok(run({ type: 'setBlockProp', blockId: 'b4', path: ['items', 1, 'title'], value: 'Botol' })).doc;
    expect((title.sections[2]!.blocks[0]!.props as { items: { title: string }[] }).items[1]!.title).toBe('Botol');
  });
  it('rejects invalid values and leaves the document untouched', () => {
    const doc = editorDoc();
    expect(run({ type: 'setBlockProp', blockId: 'b1', path: ['headline'], value: '' }, doc)).toMatchObject({ ok: false, code: 'invalid' });
    expect(run({ type: 'setBlockProp', blockId: 'b1', path: ['secondaryCta', 'label'], value: 'x' }, doc)).toMatchObject({ ok: false, code: 'invalid' });
    expect(run({ type: 'setBlockStyle', blockId: 'b1', path: ['hideOn'], value: 'tablet' }, doc)).toMatchObject({ ok: false });
    expect(run({ type: 'setSectionStyle', sectionId: 's2', path: ['tone'], value: 'neon' }, doc)).toMatchObject({ ok: false });
    expect(run({ type: 'setSetting', path: ['theme', 'colors', 'primary'], value: 'blue' }, doc)).toMatchObject({ ok: false });
    expect(doc).toEqual(editorDoc());
  });
  it('normalizes inserted items with schema defaults', () => {
    const r = ok(run({ type: 'listInsert', blockId: 'b4', path: ['items'], index: 0, item: { id: 'x1', title: 'Baru' } }));
    expect((r.doc.sections[2]!.blocks[0]!.props as { items: unknown[] }).items[0]).toMatchObject({
      id: 'x1', title: 'Baru', description: '', badge: '', showDiscount: false, image: { src: '', alt: '' },
      cta: { label: '', link: { kind: 'default' } },
    });
  });
  it('validates anchors: pattern, reserved prefixes and uniqueness', () => {
    expect(ok(run({ type: 'setSectionAnchor', sectionId: 's3', anchor: 'pesan' })).doc.sections[2]!.anchor).toBe('pesan');
    for (const bad of ['b-x', 'Pesan', '9x'])
      expect(run({ type: 'setSectionAnchor', sectionId: 's3', anchor: bad })).toMatchObject({ ok: false, code: 'invalid' });
    const taken = ok(run({ type: 'setSectionAnchor', sectionId: 's1', anchor: 'pesan' })).doc;
    expect(run({ type: 'setSectionAnchor', sectionId: 's3', anchor: 'pesan' }, taken)).toMatchObject({ ok: false });
  });
});

describe('lists', () => {
  const ids = (r: CommandSuccess) => (r.doc.sections[2]!.blocks[0]!.props as { items: { id: string }[] }).items.map((i) => i.id);
  it('moves, duplicates and removes items', () => {
    expect(ids(ok(run({ type: 'listMove', blockId: 'b4', path: ['items'], from: 2, to: 0 })))).toEqual(['i8', 'i6', 'i7']);
    expect(ids(ok(run({ type: 'listDuplicate', blockId: 'b4', path: ['items'], index: 0 })))).toEqual(['i6', 'n1', 'i7', 'i8']);
    expect(ids(ok(run({ type: 'listRemove', blockId: 'b4', path: ['items'], index: 1 })))).toEqual(['i6', 'i8']);
  });
  it('rejects out-of-range indices and lists at their maximum', () => {
    expect(run({ type: 'listMove', blockId: 'b4', path: ['items'], from: 0, to: 9 })).toMatchObject({ ok: false, code: 'invalid' });
    const full = parseDocument({ schemaVersion: 1, sections: [{ id: 's1', blocks: [{ id: 'f', type: 'faq', props: {
      items: Array.from({ length: 30 }, (_, i) => ({ id: `q${i}`, question: 'Q?', answer: 'A.' })) } }] }] });
    expect(run({ type: 'listInsert', blockId: 'f', path: ['items'], index: 0, item: { id: 'q99', question: 'Q?', answer: 'A.' } }, full))
      .toMatchObject({ ok: false, code: 'limit' });
  });
});

it('every command keeps the document valid and its inverse restores it', () => {
  let doc = editorDoc();
  const d = deps();
  let selection: Parameters<typeof applyCommand>[2] = null;
  for (const command of everyCommand()) {
    const result = applyCommand(doc, command, selection, d);
    if (!result.ok) throw new Error(`${command.type}: ${result.reason}`);
    expect(PageDocumentSchema.safeParse(result.doc).success, command.type).toBe(true);
    expect(applyPatches(result.doc, result.inversePatches), command.type).toEqual(doc);
    expect(applyPatches(doc, result.patches), command.type).toEqual(result.doc);
    doc = result.doc;
    selection = result.selection;
  }
});

it('never mutates the input document', () => {
  const doc = editorDoc();
  const before = structuredClone(doc);
  for (const command of everyCommand()) applyCommand(doc, command, null, deps());
  expect(doc).toEqual(before);
});
```

`lib/editor/structure.test.ts` covers:
- `findBlock` and `findSection` (hits and misses);
- `canMoveBlock`/`canMoveSection` at the edges (`b1` up false; `b2` up true because it splits; `b5` down false);
- `getAtPath` through arrays;
- `withFreshIds` re-ids nested objects and leaves the input untouched;
- `selectionExists`;
- `blockTypeLabel('product-carousel') === 'Product Carousel'`.

- [ ] **Step 2: Run the tests and make sure they fail.**
  - Run: `pnpm exec vitest run lib/editor`
  - Expected: FAIL (modules are missing).
- [ ] **Step 3: Install and implement.**
  - Run `pnpm add immer@11.1.21 --save-exact`, then implement `structure.ts`, `schema-path.ts`, `commands.ts` and `test-fixtures.ts`.
  - Append to `docs/DECISIONS.md`:

```markdown
## D-036 Editor dependencies — Accepted
`immer@11.1.21` (patches for undo/redo), pinned exactly. Immer published 11.1.22–11.2.7 in a burst on 2026-10-20/21; we stay on the last release that is at least two weeks old and move up deliberately.

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
- The palette inserts a block in a new default section after the selected section, never after trailing footer sections (D-017). A Footer always goes last.
```

- [ ] **Step 4: Run the tests and make sure they pass.**
  - Run: `pnpm test && pnpm typecheck`
  - Expected: PASS.
- [ ] **Step 5: Commit.**

```bash
git add lib/editor lib/schema/document.ts package.json pnpm-lock.yaml docs/DECISIONS.md
git commit -m "feat(editor): typed commands with Immer patches, validity checks and move rules"
```

---

### Task 9: History and the editor store

**Files:**
- Create: `lib/editor/history.ts`, `lib/editor/history.test.ts`, `lib/editor/store.ts`, `lib/editor/store.test.ts`
- Modify: `package.json`/`pnpm-lock.yaml` (`pnpm add zustand@5.0.15 --save-exact`), `docs/DECISIONS.md` (add zustand to D-036; append D-038)

**Interfaces:**
- Consumes: `applyCommand`, `EditorCommand`, `CommandResult` and `Selection` (Task 8).
- Produces:

```ts
// lib/editor/history.ts
export const HISTORY_LIMIT = 200;
export const COALESCE_MS = 1000;
export interface HistoryEntry {
  label: string; patches: Patch[]; inversePatches: Patch[]; at: number;
  coalesceKey?: string; selectionBefore: Selection | null; selectionAfter: Selection | null;
}
export interface History { past: HistoryEntry[]; future: HistoryEntry[] }
export const emptyHistory: History;
/** Clears `future`; merges into the last entry when the keys match and entry.at - last.at <= COALESCE_MS; caps past at HISTORY_LIMIT. */
export function record(history: History, entry: HistoryEntry): History;
/** The last entry stops accepting merges (field blur). */
export function breakCoalescing(history: History): History;
export function undo(history: History, doc: PageDocument): { history: History; doc: PageDocument; selection: Selection | null } | null;
export function redo(history: History, doc: PageDocument): { history: History; doc: PageDocument; selection: Selection | null } | null;

// lib/editor/store.ts
export type Viewport = 'mobile' | 'tablet' | 'desktop';
export const VIEWPORT_WIDTHS: Record<Viewport, number> = { mobile: 390, tablet: 768, desktop: 1280 };
export interface EditorState {
  readonly pageId: string;
  doc: PageDocument;
  /** +1 on every document change: dispatch, undo, redo. */
  version: number;
  selection: Selection | null;
  history: History;
  viewport: Viewport;
  /** Text for the aria-live region; the latest command's announcement. */
  announcement: string;
  /** A visible notice for `limit` failures; cleared by the next successful command. */
  notice: string | null;
}
export interface EditorActions {
  dispatch(command: EditorCommand, options?: { coalesceKey?: string }): CommandResult;
  undo(): boolean;
  redo(): boolean;
  select(selection: Selection | null): void;
  setViewport(viewport: Viewport): void;
  endCoalescing(): void;
}
export type EditorStore = StoreApi<EditorState & EditorActions>;
export function createEditorStore(init: { pageId: string; doc: PageDocument }, deps?: { newId?: IdFactory; now?: () => number }): EditorStore;
```

The store uses `createStore` from `zustand/vanilla`, so it runs in Node tests and React reads it with `useStore`.

**History details:**
- **Merging:** a merged entry concatenates `patches` (earlier first) and `inversePatches` (later first), and takes the later `at` and `selectionAfter`. When both entries hold exactly one `replace` patch on the same path, keep the later patch and the earlier inverse patch. Typing then stays at two patches.
- **Undo** applies `inversePatches` with `applyPatches` and restores `selectionBefore` when `selectionExists`, else `null`. **Redo** applies `patches` and restores `selectionAfter` the same way.
- **Rejected commands** do not touch `version` or `history`. A `limit` failure sets `notice` and `announcement` to its reason.
- **Time:** the store calls `now()` exactly once per successful dispatch, for the entry's `at`. The tests feed it a list of times.

- [ ] **Step 1: Write the failing tests.**

`lib/editor/store.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { sequentialIds } from '@/lib/schema/ids';
import { createEditorStore } from './store';
import { editorDoc, everyCommand } from './test-fixtures';

function setup(times: number[] = []) {
  let i = 0;
  return createEditorStore({ pageId: 'p1', doc: editorDoc() }, { newId: sequentialIds('n'), now: () => times[i++] ?? 0 });
}
const headline = (text: string) => ({ type: 'setBlockProp' as const, blockId: 'b1', path: ['headline'], value: text });

describe('editor store', () => {
  it('applies a command, bumps the version, records history and selects', () => {
    const store = setup();
    const result = store.getState().dispatch({ type: 'addBlock', blockType: 'faq' });
    expect(result.ok).toBe(true);
    expect(store.getState().version).toBe(1);
    expect(store.getState().history.past.map((e) => e.label)).toEqual(['Add FAQ']);
    expect(store.getState().selection).toEqual({ kind: 'block', blockId: 'n2' });
    expect(store.getState().announcement).toBe('Added FAQ');
  });
  it('a rejected command changes nothing', () => {
    const store = setup();
    const before = store.getState();
    expect(store.getState().dispatch(headline('')).ok).toBe(false);
    expect(store.getState().doc).toBe(before.doc);
    expect(store.getState().version).toBe(0);
    expect(store.getState().history.past).toHaveLength(0);
  });
  it('undoes and redoes every command type back to the exact documents', () => {
    const store = setup();
    const snapshots = [store.getState().doc];
    for (const command of everyCommand()) {
      expect(store.getState().dispatch(command).ok, command.type).toBe(true);
      snapshots.push(store.getState().doc);
    }
    for (let i = snapshots.length - 2; i >= 0; i--) {
      expect(store.getState().undo()).toBe(true);
      expect(store.getState().doc).toEqual(snapshots[i]);
    }
    expect(store.getState().undo()).toBe(false);
    for (let i = 1; i < snapshots.length; i++) {
      expect(store.getState().redo()).toBe(true);
      expect(store.getState().doc).toEqual(snapshots[i]);
    }
    expect(store.getState().redo()).toBe(false);
  });
  it('coalesces typing in one field within 1000 ms into one undo step', () => {
    const store = setup([0, 300, 600, 900]);
    for (const text of ['B', 'Bo', 'Bot', 'Boto']) store.getState().dispatch(headline(text), { coalesceKey: 'b1:headline' });
    expect(store.getState().history.past).toHaveLength(1);
    store.getState().undo();
    expect(store.getState().doc).toEqual(editorDoc());
  });
  it('starts a new step after a pause, a blur, or another field', () => {
    const store = setup([0, 1500, 1600, 1700]);
    store.getState().dispatch(headline('A'), { coalesceKey: 'b1:headline' });
    store.getState().dispatch(headline('AB'), { coalesceKey: 'b1:headline' }); // pause > 1000 ms
    store.getState().endCoalescing();
    store.getState().dispatch(headline('ABC'), { coalesceKey: 'b1:headline' }); // after blur
    store.getState().dispatch({ type: 'setBlockProp', blockId: 'b1', path: ['eyebrow'], value: 'X' }, { coalesceKey: 'b1:eyebrow' });
    expect(store.getState().history.past).toHaveLength(4);
  });
  it('a new command clears the redo stack', () => {
    const store = setup();
    store.getState().dispatch(headline('A'));
    store.getState().undo();
    store.getState().dispatch(headline('B'));
    expect(store.getState().redo()).toBe(false);
  });
  it('keeps 200 entries', () => {
    const store = setup();
    for (let i = 0; i < 205; i++) store.getState().dispatch(headline(`v${i}`));
    expect(store.getState().history.past).toHaveLength(200);
  });
  it('restores the selection recorded with the entry, or clears it when gone', () => {
    const store = setup();
    store.getState().select({ kind: 'block', blockId: 'b2' });
    store.getState().dispatch({ type: 'removeBlock', blockId: 'b2' });
    expect(store.getState().selection).toEqual({ kind: 'block', blockId: 'b3' });
    store.getState().undo();
    expect(store.getState().selection).toEqual({ kind: 'block', blockId: 'b2' });
    store.getState().redo();
    store.getState().select({ kind: 'block', blockId: 'b3' });
    store.getState().dispatch({ type: 'addBlock', blockType: 'faq' });
    store.getState().undo();
    expect(store.getState().selection).toEqual({ kind: 'block', blockId: 'b3' });
  });
  it('selection and viewport changes are not history and do not bump the version', () => {
    const store = setup();
    store.getState().select({ kind: 'page' });
    store.getState().setViewport('desktop');
    expect(store.getState().version).toBe(0);
    expect(store.getState().history.past).toHaveLength(0);
  });
});
```

`lib/editor/history.test.ts` covers `record` (clearing `future`, the merge rule including the single-`replace` compaction, different keys never merging, the cap) and `undo`/`redo` returning `null` at the ends.

- [ ] **Step 2: Run the tests and make sure they fail.**
  - Run: `pnpm exec vitest run lib/editor/history.test.ts lib/editor/store.test.ts`
  - Expected: FAIL.
- [ ] **Step 3: Install and implement.**
  - Run `pnpm add zustand@5.0.15 --save-exact`, then implement `history.ts` and `store.ts`.
  - Add "`zustand@5.0.15` (editor store)" to D-036.
  - Append to `docs/DECISIONS.md`:

```markdown
## D-038 Undo history — Accepted
- **Entries:** one per command, holding Immer patches, inverse patches and the selection before and after. Undo and redo apply patches and never re-run commands, so ids a command generated survive redo.
- **Coalescing:** consecutive edits with the same key (block + field path, or settings path) within 1000 ms of each other join one entry. Blurring the field ends the run. Up to 200 entries are kept.
- **Not in history:** selection, hover and viewport. Undo restores the selection recorded with the entry if it still exists.
```

- [ ] **Step 4: Run the tests and make sure they pass.**
  - Run: `pnpm test && pnpm typecheck`
  - Expected: PASS.
- [ ] **Step 5: Commit.**

```bash
git add lib/editor package.json pnpm-lock.yaml docs/DECISIONS.md
git commit -m "feat(editor): undo history with typing coalescing and a Zustand store"
```

---

### Task 10: Autosave controller

**Files:**
- Create: `lib/editor/autosave.ts`, `lib/editor/autosave.test.ts`, `lib/editor/draft-sender.ts`, `lib/editor/draft-sender.test.ts`

**Interfaces:**
- Consumes: the `PUT /api/pages/[pageId]/draft` contract (Task 6) and `PageDocument`.
- Produces:

```ts
// lib/editor/autosave.ts
export type SaveStatus = 'saved' | 'dirty' | 'saving' | 'offline' | 'error' | 'conflict';
export interface AutosaveState {
  status: SaveStatus; revision: number; savedVersion: number;
  error: string | null; conflictRevision: number | null;
}
export interface SaveRequest { doc: PageDocument; baseRevision: number; keepalive: boolean }
export type SaveResponse =
  | { kind: 'ok'; revision: number }
  | { kind: 'conflict'; revision: number }
  | { kind: 'rejected'; status: number; message: string } // 4xx other than 409
  | { kind: 'network' }; // fetch threw, or 5xx
export interface AutosaveOptions {
  initialRevision: number;
  getSnapshot(): { doc: PageDocument; version: number };
  send(request: SaveRequest): Promise<SaveResponse>;
  debounceMs?: number; // 800
  maxWaitMs?: number; // 5000
  retryDelaysMs?: readonly number[]; // [2000, 4000, 8000, 16000, 30000]; the last value repeats
  now?(): number;
}
export interface Autosave {
  readonly store: StoreApi<AutosaveState>;
  changed(version: number): void;
  /** Saves now when unsaved changes exist; resolves after the in-flight save settles. */
  flush(options?: { unloading?: boolean }): Promise<void>;
  /** After a conflict: saves the local document over the server copy. */
  overwrite(): Promise<void>;
  retry(): void;
  dispose(): void;
}
export function createAutosave(options: AutosaveOptions): Autosave;

// lib/editor/draft-sender.ts
export const KEEPALIVE_MAX_BYTES = 60_000;
export function createDraftSender(pageId: string, fetchImpl?: typeof fetch): (request: SaveRequest) => Promise<SaveResponse>;
```

**Status flow:**
- **Changes:** `changed(v)` sets `dirty` and schedules a save 800 ms after the last change. If the first unsaved change is 5000 ms old, the save starts at once.
- **One request at a time:** changes made while `saving` are saved after it settles.
- **`ok`:** `revision` is updated and `savedVersion` becomes the version that was sent. The status is `saved` if nothing changed since, else `dirty` with a new debounce.
- **`conflict`:** status `conflict` with `conflictRevision`. Autosave stops until `overwrite()`, which saves with base `conflictRevision`.
- **`network`:** status `offline`. Retries follow the delays; `retry()` saves at once. A success resets the backoff.
- **`rejected`:** status `error` with `message`. There is no automatic retry until the next `changed` or `retry()`.
- **`flush`** cancels the debounce. `unloading: true` sets `keepalive` on the request.

`createDraftSender` sends `PUT /api/pages/${pageId}/draft` with `content-type: application/json` and the body `{ document, baseRevision }`. It sets `keepalive` only when requested and the body is ≤ 60,000 UTF-8 bytes. Response mapping:
- 200 → `ok`;
- 409 → `conflict`;
- other 4xx → `rejected`, with these messages:
  - 401: `You were signed out. Sign in again in another tab, then retry.`
  - 404: `This page no longer exists.`
  - 413: `This page is too large to save (over 4 MB). Remove pasted image data.`
  - 422: `The page has invalid content: <first issue path>: <message>`
  - 403 and others: `The server refused the save (HTTP <status>).`
- 5xx or a thrown error → `network`.

- [ ] **Step 1: Write the failing tests.**

`lib/editor/autosave.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyDocument } from '@/lib/schema/document';
import { createAutosave, type SaveRequest, type SaveResponse } from './autosave';

let version = 0;
let sends: SaveRequest[] = [];
let respond: (req: SaveRequest) => Promise<SaveResponse>;
const doc = createEmptyDocument();
const make = () =>
  createAutosave({
    initialRevision: 4,
    getSnapshot: () => ({ doc, version }),
    send: (req) => { sends.push(req); return respond(req); },
  });
const edit = (a: ReturnType<typeof make>) => a.changed(++version);
const status = (a: ReturnType<typeof make>) => a.store.getState().status;

beforeEach(() => {
  vi.useFakeTimers();
  version = 0;
  sends = [];
  respond = async (req) => ({ kind: 'ok', revision: req.baseRevision + 1 });
});
afterEach(() => vi.useRealTimers());

describe('autosave', () => {
  it('debounces 800 ms after the last change', async () => {
    const a = make();
    edit(a);
    await vi.advanceTimersByTimeAsync(500);
    edit(a);
    await vi.advanceTimersByTimeAsync(799);
    expect(sends).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(sends).toHaveLength(1);
    expect(sends[0]!.baseRevision).toBe(4);
    expect(a.store.getState()).toMatchObject({ status: 'saved', revision: 5, savedVersion: 2 });
  });
  it('saves at most every 5 s during continuous typing', async () => {
    const a = make();
    for (let t = 0; t < 5200; t += 200) { edit(a); await vi.advanceTimersByTimeAsync(200); }
    expect(sends.length).toBeGreaterThanOrEqual(1);
  });
  it('keeps one request in flight and saves later changes afterwards', async () => {
    let release!: () => void;
    respond = (req) => new Promise((r) => { release = () => r({ kind: 'ok', revision: req.baseRevision + 1 }); });
    const a = make();
    edit(a);
    await vi.advanceTimersByTimeAsync(800);
    expect(status(a)).toBe('saving');
    edit(a);
    await vi.advanceTimersByTimeAsync(2000);
    expect(sends).toHaveLength(1);
    release();
    await vi.advanceTimersByTimeAsync(800);
    expect(sends).toHaveLength(2);
    expect(sends[1]!.baseRevision).toBe(5);
  });
  it('stops on a conflict until overwrite() saves on top of the server revision', async () => {
    respond = async () => ({ kind: 'conflict', revision: 9 });
    const a = make();
    edit(a);
    await vi.advanceTimersByTimeAsync(800);
    expect(a.store.getState()).toMatchObject({ status: 'conflict', conflictRevision: 9 });
    edit(a);
    await vi.advanceTimersByTimeAsync(5000);
    expect(sends).toHaveLength(1);
    respond = async (req) => ({ kind: 'ok', revision: req.baseRevision + 1 });
    await a.overwrite();
    expect(sends[1]!.baseRevision).toBe(9);
    expect(a.store.getState()).toMatchObject({ status: 'saved', revision: 10 });
  });
  it('network errors retry with backoff and recover', async () => {
    respond = async () => ({ kind: 'network' });
    const a = make();
    edit(a);
    await vi.advanceTimersByTimeAsync(800);
    expect(status(a)).toBe('offline');
    await vi.advanceTimersByTimeAsync(2000);
    expect(sends).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(4000);
    expect(sends).toHaveLength(3);
    respond = async (req) => ({ kind: 'ok', revision: req.baseRevision + 1 });
    await vi.advanceTimersByTimeAsync(8000);
    expect(status(a)).toBe('saved');
  });
  it('retry() saves immediately', async () => {
    respond = async () => ({ kind: 'network' });
    const a = make();
    edit(a);
    await vi.advanceTimersByTimeAsync(800);
    respond = async (req) => ({ kind: 'ok', revision: req.baseRevision + 1 });
    a.retry();
    await vi.advanceTimersByTimeAsync(0);
    expect(status(a)).toBe('saved');
  });
  it('a rejected save shows its message and waits for the next change', async () => {
    respond = async () => ({ kind: 'rejected', status: 413, message: 'too large' });
    const a = make();
    edit(a);
    await vi.advanceTimersByTimeAsync(800);
    expect(a.store.getState()).toMatchObject({ status: 'error', error: 'too large' });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(sends).toHaveLength(1);
  });
  it('flush while unloading sends keepalive without waiting for the debounce', async () => {
    const a = make();
    edit(a);
    await a.flush({ unloading: true });
    expect(sends).toHaveLength(1);
    expect(sends[0]!.keepalive).toBe(true);
  });
  it('flush is a no-op when everything is saved', async () => {
    const a = make();
    await a.flush();
    expect(sends).toHaveLength(0);
  });
  it('dispose cancels pending saves', async () => {
    const a = make();
    edit(a);
    a.dispose();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(sends).toHaveLength(0);
  });
});
```

`lib/editor/draft-sender.test.ts` uses a `vi.fn()` fetch and checks:
- the URL, method, header and JSON body;
- `keepalive` is true only when requested and the body is ≤ 60,000 bytes (a 70,000-character document stays `false`);
- each status maps to the response kind and message listed above, and a thrown fetch maps to `network`.

- [ ] **Step 2: Run the tests and make sure they fail.**
  - Run: `pnpm exec vitest run lib/editor/autosave.test.ts lib/editor/draft-sender.test.ts`
  - Expected: FAIL.
- [ ] **Step 3: Implement both modules.** The state lives in a `zustand/vanilla` store, and timers are the global `setTimeout`/`clearTimeout`, which fake timers replace.
- [ ] **Step 4: Run the tests and make sure they pass.**
  - Run: `pnpm test`
  - Expected: PASS.
- [ ] **Step 5: Commit.**

```bash
git add lib/editor
git commit -m "feat(editor): autosave with debounce, max wait, retries, conflicts and unload flush"
```

---

### Task 11: Canvas protocol, render cache and sync planning

**Files:**
- Create: `lib/editor/canvas/constants.ts`, `lib/editor/canvas/protocol.ts`, `lib/editor/canvas/protocol.test.ts`, `lib/editor/canvas/render-cache.ts`, `lib/editor/canvas/render-cache.test.ts`, `lib/editor/canvas/sync.ts`, `lib/editor/canvas/sync.test.ts`

**Interfaces:**
- Consumes: `createRenderEnv`, `renderBlock`, `renderBody` and `BlockAt` (Task 7); `collectCss` and `collectJs` (M1).
- Produces:

```ts
// lib/editor/canvas/constants.ts — no imports from zod, so the iframe runtime can share it
export const CANVAS_SOURCE = 'launchpad-canvas';
export const CHANNEL_PATTERN = /^[a-z0-9]{10}$/; // createId() format
export interface KeyInput { key: string; mod: boolean; shift: boolean; alt: boolean }
/** Keys the iframe forwards to the editor: mod+z/y/d, Delete, Backspace, Escape, alt+ArrowUp/ArrowDown. */
export function isForwardedShortcut(input: KeyInput): boolean;
export interface CanvasRect { id: string; top: number; left: number; width: number; height: number }

// lib/editor/canvas/protocol.ts
export type CanvasEvent =
  | { type: 'ready' }
  | { type: 'rects'; rev: number; scrollY: number; viewportWidth: number; viewportHeight: number; docHeight: number; sections: CanvasRect[]; blocks: CanvasRect[] }
  | { type: 'hover'; blockId: string | null }
  | { type: 'select'; target: { kind: 'block'; blockId: string } | { kind: 'section'; sectionId: string } }
  | { type: 'key'; input: KeyInput }
  | { type: 'synced'; rev: number }
  | { type: 'error'; message: string };
/** Zod-validates one message from the iframe (it must carry `source: CANVAS_SOURCE` and this channel); null when invalid. */
export function parseCanvasEvent(data: unknown, channel: string): CanvasEvent | null;
export interface SyncPayload { css?: string; js?: string; lang?: string; skeleton?: string; blocks: { id: string; html: string }[] }
export type CanvasCommand =
  | ({ type: 'sync'; rev: number } & SyncPayload)
  | { type: 'scrollTo'; blockId: string }
  | { type: 'hello' };
/** Adds `source` and `channel`, ready for postMessage. */
export function envelope(channel: string, command: CanvasCommand): Record<string, unknown>;

// lib/editor/canvas/render-cache.ts
export interface BlockHtmlCache { get(env: RenderEnv, block: BlockInstance, at: BlockAt): string | null }
export function createBlockHtmlCache(): BlockHtmlCache;

// lib/editor/canvas/sync.ts
export interface CanvasState { css: string; js: string; lang: string; skeleton: string; blocks: ReadonlyMap<string, string> }
export function canvasState(doc: PageDocument, cache: BlockHtmlCache): CanvasState;
export function diffCanvas(prev: CanvasState, next: CanvasState): SyncPayload | null; // null when nothing changed
```

**Schema limits:**
- ids use `IdSchema`; the channel uses `CHANNEL_PATTERN`; `rev` is an integer from 0 to 2³¹;
- coordinates are finite, within ±1e7;
- `sections` ≤ 60 and `blocks` ≤ 200 entries;
- `key` is at most 16 characters; `message` at most 500 characters;
- unknown keys are stripped.

**Cache key:** the `BlockInstance` object (WeakMap), plus:
- `env.settings` by identity;
- a section-anchor key derived once per `RenderEnv` (WeakMap);
- `sectionIndex === 0`;
- `sectionIndex === 0 && indexInSection === 0`.

**`canvasState`:**
- `css` is `collectCss(doc, { mode: 'preview', minify: false })` and `js` is `collectJs(doc, { minify: false })`.
- `skeleton` is `renderBody(doc, env, block => html\`<div data-lp-slot="${block.id}"></div>\`)` with unknown types omitted.
- `blocks` maps each block id to its cached HTML.

- [ ] **Step 1: Write the failing tests.**

`lib/editor/canvas/protocol.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CANVAS_SOURCE, isForwardedShortcut } from './constants';
import { parseCanvasEvent } from './protocol';

const CH = 'abcdefghij';
const msg = (body: Record<string, unknown>) => ({ source: CANVAS_SOURCE, channel: CH, ...body });
const rect = { id: 'b1', top: 0, left: 0, width: 390, height: 200 };

describe('parseCanvasEvent', () => {
  it('accepts each valid event', () => {
    expect(parseCanvasEvent(msg({ type: 'ready' }), CH)).toEqual({ type: 'ready' });
    expect(parseCanvasEvent(msg({ type: 'select', target: { kind: 'block', blockId: 'b1' } }), CH))
      .toEqual({ type: 'select', target: { kind: 'block', blockId: 'b1' } });
    expect(parseCanvasEvent(msg({ type: 'rects', rev: 3, scrollY: 0, viewportWidth: 390, viewportHeight: 800,
      docHeight: 4000, sections: [rect], blocks: [rect] }), CH)?.type).toBe('rects');
    expect(parseCanvasEvent(msg({ type: 'key', input: { key: 'z', mod: true, shift: false, alt: false } }), CH)?.type).toBe('key');
  });
  it('rejects messages that are malformed or out of bounds', () => {
    for (const bad of [
      null, 'ready', [], {},
      { ...msg({ type: 'ready' }), source: 'other' },
      { ...msg({ type: 'ready' }), channel: 'zzzzzzzzzz' },
      msg({ type: 'navigate', url: 'https://evil.example' }),
      msg({ type: 'select', target: { kind: 'block', blockId: 'b-1"><x' } }),
      msg({ type: 'rects', rev: 1, scrollY: Number.POSITIVE_INFINITY, viewportWidth: 1, viewportHeight: 1, docHeight: 1, sections: [], blocks: [] }),
      msg({ type: 'rects', rev: 1, scrollY: 0, viewportWidth: 1, viewportHeight: 1, docHeight: 1, sections: [], blocks: Array(201).fill(rect) }),
      msg({ type: 'error', message: 'x'.repeat(501) }),
    ]) expect(parseCanvasEvent(bad, CH)).toBeNull();
  });
});

it('forwards only editor shortcuts', () => {
  const k = (key: string, mod = false, shift = false, alt = false) => isForwardedShortcut({ key, mod, shift, alt });
  expect([k('z', true), k('Z', true, true), k('y', true), k('d', true), k('Delete'), k('Backspace'), k('Escape'),
    k('ArrowUp', false, false, true), k('ArrowDown', false, false, true)]).toEqual(Array(9).fill(true));
  expect([k('z'), k('ArrowLeft'), k('ArrowUp'), k('Home'), k('a', true), k('Enter')]).toEqual(Array(6).fill(false));
});
```

`lib/editor/canvas/render-cache.test.ts`:

```ts
import { afterEach, expect, it, vi } from 'vitest';
import { hero } from '@/lib/blocks/hero';
import { createRenderEnv, renderBlock } from '@/lib/renderer/page';
import { produce } from 'immer';
import { editorDoc } from '../test-fixtures';
import { createBlockHtmlCache } from './render-cache';

afterEach(() => vi.restoreAllMocks());
const at0 = { sectionId: 's1', sectionIndex: 0, indexInSection: 0 };

it('returns renderBlock output and reuses it for the same block object', () => {
  const doc = editorDoc();
  const env = createRenderEnv(doc, 'preview');
  const block = doc.sections[0]!.blocks[0]!;
  const cache = createBlockHtmlCache();
  const spy = vi.spyOn(hero, 'render');
  expect(cache.get(env, block, at0)).toBe(renderBlock(env, block, at0)!.value);
  spy.mockClear();
  cache.get(createRenderEnv(doc, 'preview'), block, at0);
  expect(spy).not.toHaveBeenCalled();
});

it('re-renders when the block, the settings, the anchors or first-section status change', () => {
  const doc = editorDoc();
  const cache = createBlockHtmlCache();
  const block = doc.sections[0]!.blocks[0]!;
  cache.get(createRenderEnv(doc, 'preview'), block, at0);
  const spy = vi.spyOn(hero, 'render');
  const edited = produce(doc, (d) => { (d.sections[0]!.blocks[0]!.props as { headline: string }).headline = 'X'; });
  cache.get(createRenderEnv(edited, 'preview'), edited.sections[0]!.blocks[0]!, at0);
  const themed = produce(doc, (d) => { d.settings.theme.colors.primary = '#000000'; });
  cache.get(createRenderEnv(themed, 'preview'), block, at0);
  const anchored = produce(doc, (d) => { d.sections[2]!.anchor = 'pesan'; });
  cache.get(createRenderEnv(anchored, 'preview'), block, at0);
  cache.get(createRenderEnv(doc, 'preview'), block, { sectionId: 's1', sectionIndex: 1, indexInSection: 0 });
  expect(spy).toHaveBeenCalledTimes(4);
});
```

`lib/editor/canvas/sync.test.ts`:

```ts
import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../commands';
import { deps, editorDoc } from '../test-fixtures';
import { createBlockHtmlCache } from './render-cache';
import { canvasState, diffCanvas } from './sync';

const cache = createBlockHtmlCache();
const state = (doc: ReturnType<typeof editorDoc>) => canvasState(doc, cache);
const apply = (doc: ReturnType<typeof editorDoc>, command: Parameters<typeof applyCommand>[1]) => {
  const r = applyCommand(doc, command, null, deps());
  if (!r.ok) throw new Error(r.reason);
  return r.doc;
};

describe('diffCanvas', () => {
  const base = editorDoc();
  it('is null when nothing changed', () => expect(diffCanvas(state(base), state(base))).toBeNull());
  it('sends only the edited block for a prop change', () => {
    const next = apply(base, { type: 'setBlockProp', blockId: 'b2', path: ['heading'], value: 'Kenapa kami' });
    const payload = diffCanvas(state(base), state(next))!;
    expect(payload.blocks.map((b) => b.id)).toEqual(['b2']);
    expect(payload).not.toHaveProperty('skeleton');
    expect(payload).not.toHaveProperty('css');
  });
  it('sends a new skeleton but no block markup for a move outside the first section', () => {
    const next = apply(base, { type: 'moveBlock', blockId: 'b4', direction: 'up' });
    const payload = diffCanvas(state(base), state(next))!;
    expect(payload.skeleton).toContain('data-lp-slot="b4"');
    expect(payload.blocks).toEqual([]);
  });
  it('re-sends only blocks whose markup depends on their new position', () => {
    // The hero leaves the first section: its h1 becomes an h2 and its image turns lazy.
    // Benefits and FAQ enter it, but their markup does not depend on position.
    const next = apply(base, { type: 'moveSection', sectionId: 's2', direction: 'up' });
    expect(diffCanvas(state(base), state(next))!.blocks.map((b) => b.id)).toEqual(['b1']);
  });
  it('sends css and js when the first carousel arrives', () => {
    const noCarousel = apply(base, { type: 'removeBlock', blockId: 'b4' });
    const payload = diffCanvas(state(noCarousel), state(base))!;
    expect(payload.css).toContain('.lp-carousel');
    expect(payload.js).toContain('data-lp-carousel');
  });
  it('a theme change sends css only, because block markup does not depend on colors', () => {
    const next = produce(base, (d) => { d.settings.theme.colors.primary = '#0F766E'; });
    const payload = diffCanvas(state(base), state(next))!;
    expect(payload.css).toContain('#0F766E');
    expect(payload.blocks).toEqual([]);
    expect(payload).not.toHaveProperty('skeleton');
  });
  it('a language change sends lang and the blocks whose built-in strings changed', () => {
    const next = produce(base, (d) => { d.settings.lang = 'en'; });
    const payload = diffCanvas(state(base), state(next))!;
    expect(payload.lang).toBe('en');
    expect(payload.blocks.map((b) => b.id)).toContain('b4');
  });
});
```

- [ ] **Step 2: Run the tests and make sure they fail.**
  - Run: `pnpm exec vitest run lib/editor/canvas`
  - Expected: FAIL.
- [ ] **Step 3: Implement the four modules.** `constants.ts` must not import `zod` or anything that does: Task 12's bundle size test catches a violation.
- [ ] **Step 4: Run the tests and make sure they pass.**
  - Run: `pnpm test`
  - Expected: PASS.
- [ ] **Step 5: Commit.**

```bash
git add lib/editor/canvas
git commit -m "feat(canvas): validated message protocol, per-block render cache and sync diffing"
```

---

### Task 12: Preview runtime and srcdoc

**Files:**
- Create: `lib/editor/canvas/runtime.ts`, `lib/editor/canvas/runtime.test.ts`, `lib/editor/canvas/preview-runtime.bundle.ts`, `lib/editor/canvas/preview-runtime.generated.ts` (generated), `lib/editor/canvas/srcdoc.ts`, `lib/editor/canvas/srcdoc.test.ts`
- Modify: `scripts/build-assets.ts`, `scripts/build-assets.test.ts`, `CLAUDE.md`, `docs/DECISIONS.md` (append D-039)

**Interfaces:**
- Consumes: `constants.ts` (types and `isForwardedShortcut`) and `canvasState` (Task 11); `renderPage` and `escapeInlineScript`.
- Produces:
  - **`scripts/build-assets.ts`** also compiles `lib/**/*.bundle.ts`:
    - It runs `esbuild.build({ entryPoints: [file], bundle: true, write: false, format: 'iife', platform: 'browser', target: 'es2020', legalComments: 'none', minify })` twice, minified and not.
    - It writes `<name>.generated.ts` next to the entry (`preview-runtime.bundle.ts` → `preview-runtime.generated.ts`) with the same `{ min, src }` module shape.
  - `lib/editor/canvas/runtime.ts`:

```ts
export interface RuntimeOptions {
  win: Window;
  channel: string;
  post(message: Record<string, unknown>): void; // the bundle passes m => win.parent.postMessage(m, '*')
  isFromParent(event: MessageEvent): boolean; // the bundle passes e => e.source === win.parent
  runScript(code: string): void; // the bundle inserts a fresh <script> element before the runtime's own
}
export function startPreviewRuntime(options: RuntimeOptions): () => void; // returns dispose
```

  - **`preview-runtime.bundle.ts`** reads `document.currentScript.dataset.lpChannel` and starts the runtime with the real dependencies. It stays ≤ 8192 bytes minified.
  - `lib/editor/canvas/srcdoc.ts`: `buildSrcdoc(doc: PageDocument, channel: string): string`. It returns `renderPage(doc, { mode: 'preview' }).html` with `<script data-lp-channel="<channel>">…runtime.min…</script>` inserted directly before the closing `</body></html>`. It throws for a channel that does not match `CHANNEL_PATTERN`.

**Runtime behaviour:**
- **Start:** post `ready`, then `rects`. Post `ready` again on every `hello`.
- **Rects** (rAF-throttled) come from `getBoundingClientRect()` of every `[data-lp-section]` and `[data-lp-block]`, in viewport coordinates. They are sent on window scroll (passive), on resize, through a `ResizeObserver` on `document.body` (when one exists), on `load` (capture, for images), on `toggle` (capture, for `<details>`) and after each sync.
- **Pointer:**
  - `pointerover` posts `hover` with the closest `[data-lp-block]` id, only when it changes. Leaving the document posts `hover: null`.
  - `click` (capture) calls `preventDefault()` when the target is inside `a[href]`, so the frame never navigates. It does not stop propagation, so carousel buttons and `<summary>` still work.
  - The click then posts `select` for the closest block, else the closest section.
- **Keys:** `keydown` (capture) matching `isForwardedShortcut` calls `preventDefault()` and posts `key`. Arrow keys without Alt are left alone for the carousel.
- **`sync`** is applied synchronously inside the message handler; only the rects report waits for the next animation frame.
  1. `css` replaces the text of the `<style>` in `<head>`; `lang` sets `document.documentElement.lang`.
  2. **`skeleton`:**
     - Parse it into a `<template>`. Fill each `[data-lp-slot]` with the block's new HTML when the message carries it, else move in the existing `[data-lp-block="<id>"]` element.
     - Remove every body child that is not a `<script>`, and insert the filled fragment before the first `<script>`.
  3. **Blocks only:** with no skeleton, replace each listed block element.
  4. **Replaced blocks** keep two kinds of state from the old element:
     - non-zero `scrollLeft`/`scrollTop`;
     - the `open` state of `<details>` the user toggled (mark them `data-lp-user-toggled` in a `toggle` listener).

     State matches by child-index path from the block root, only when the tag names match.
  5. **Scripts:** when the message carries `js`, or any block or skeleton changed, call `runScript(latestJs)` once. `latestJs` starts as the page script's text and is replaced by `js`. Snippets are idempotent per root, so only new roots initialize.
  6. Post `synced { rev }`, then `rects`.
  7. On any exception, post `error { message }`. The parent then reloads the frame.
- **`scrollTo`** calls `element.scrollIntoView({ block: 'start', behavior: 'smooth' })`.
- **Untrusted input:** ignore messages that fail `isFromParent`, carry the wrong `source` or channel, or have an unknown `type`. Block ids from messages must match `/^[A-Za-z0-9]{1,32}$/` before they reach a selector.

- [ ] **Step 1: Write the failing tests.**

`lib/editor/canvas/runtime.test.ts`:

```ts
// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyCommand } from '../commands';
import { deps, editorDoc } from '../test-fixtures';
import { CANVAS_SOURCE } from './constants';
import { createBlockHtmlCache } from './render-cache';
import { startPreviewRuntime } from './runtime';
import { canvasState, diffCanvas } from './sync';

const CH = 'abcdefghij';
const posts: Record<string, unknown>[] = [];
const scripts: string[] = [];
let dispose: () => void;

function load(doc = editorDoc()) {
  const s = canvasState(doc, createBlockHtmlCache());
  const body = s.skeleton.replace(/<div data-lp-slot="([^"]+)"><\/div>/g, (_, id: string) => s.blocks.get(id)!);
  document.head.innerHTML = `<style>${s.css}</style>`;
  document.body.innerHTML = `${body}<script>/*page*/</script>`;
  dispose = startPreviewRuntime({
    win: window, channel: CH, post: (m) => posts.push(m), isFromParent: () => true, runScript: (code) => scripts.push(code),
  });
  return s;
}
const send = (data: Record<string, unknown>) =>
  window.dispatchEvent(new MessageEvent('message', { data: { source: CANVAS_SOURCE, channel: CH, ...data } }));
const frame = () => new Promise((resolve) => setTimeout(resolve, 30));
const types = () => [...document.querySelectorAll('[data-lp-block]')].map((el) => el.getAttribute('data-lp-block'));

beforeEach(() => { posts.length = 0; scripts.length = 0; });
afterEach(() => dispose());

describe('preview runtime', () => {
  it('posts ready and rects on start, and ready again on hello', async () => {
    load();
    await frame();
    expect(posts.map((p) => p.type)).toEqual(expect.arrayContaining(['ready', 'rects']));
    send({ type: 'hello' });
    expect(posts.filter((p) => p.type === 'ready')).toHaveLength(2);
  });
  it('moves existing block elements into a new skeleton instead of re-creating them', async () => {
    const before = load();
    const carousel = document.querySelector('[data-lp-block="b4"]');
    const r = applyCommand(editorDoc(), { type: 'moveBlock', blockId: 'b4', direction: 'up' }, null, deps());
    if (!r.ok) throw new Error(r.reason);
    send({ type: 'sync', rev: 1, ...diffCanvas(before, canvasState(r.doc, createBlockHtmlCache()))! });
    await frame();
    expect(types()).toEqual(['b1', 'b4', 'b2', 'b3', 'b5']);
    expect(document.querySelector('[data-lp-block="b4"]')).toBe(carousel);
    expect(posts.some((p) => p.type === 'synced' && p.rev === 1)).toBe(true);
    expect(scripts).toHaveLength(1);
  });
  it('replaces only the changed block and keeps scroll offsets and user-opened details', async () => {
    load();
    const track = document.querySelector<HTMLElement>('[data-lp-block="b4"] .lp-carousel__track')!;
    track.scrollLeft = 120;
    const details = document.querySelector<HTMLDetailsElement>('[data-lp-block="b3"] details')!;
    details.open = true;
    details.dispatchEvent(new Event('toggle'));
    const hero = document.querySelector('[data-lp-block="b1"]');
    send({ type: 'sync', rev: 2, blocks: [
      { id: 'b4', html: document.querySelector('[data-lp-block="b4"]')!.outerHTML },
      { id: 'b3', html: document.querySelector('[data-lp-block="b3"]')!.outerHTML.replace(' open=""', '') },
    ] });
    await frame();
    expect(document.querySelector('[data-lp-block="b1"]')).toBe(hero);
    expect(document.querySelector<HTMLElement>('[data-lp-block="b4"] .lp-carousel__track')!.scrollLeft).toBe(120);
    expect(document.querySelector<HTMLDetailsElement>('[data-lp-block="b3"] details')!.open).toBe(true);
  });
  it('replaces the stylesheet text and the page language', () => {
    load();
    send({ type: 'sync', rev: 3, css: ':root{--lp-primary:#000000}', lang: 'en', blocks: [] });
    expect(document.querySelector('style')!.textContent).toBe(':root{--lp-primary:#000000}');
    expect(document.documentElement.lang).toBe('en');
  });
  it('clicking a link selects its block without navigating', () => {
    load();
    const link = document.querySelector<HTMLAnchorElement>('[data-lp-block="b1"] a[href]')!;
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(posts).toContainEqual(expect.objectContaining({ type: 'select', target: { kind: 'block', blockId: 'b1' } }));
  });
  it('clicking section padding selects the section', () => {
    load();
    document.querySelector('[data-lp-section="s2"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(posts).toContainEqual(expect.objectContaining({ type: 'select', target: { kind: 'section', sectionId: 's2' } }));
  });
  it('forwards editor shortcuts and leaves carousel arrow keys alone', () => {
    load();
    const undo = new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true, cancelable: true });
    document.body.dispatchEvent(undo);
    const left = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true });
    document.body.dispatchEvent(left);
    expect(undo.defaultPrevented).toBe(true);
    expect(left.defaultPrevented).toBe(false);
    expect(posts.filter((p) => p.type === 'key')).toEqual([
      expect.objectContaining({ input: { key: 'z', mod: true, shift: false, alt: false } }),
    ]);
  });
  it('ignores messages from another channel or with an unknown type', () => {
    load();
    window.dispatchEvent(new MessageEvent('message', { data: { source: CANVAS_SOURCE, channel: 'zzzzzzzzzz', type: 'hello' } }));
    send({ type: 'navigate', url: 'https://evil.example' });
    expect(posts.filter((p) => p.type === 'ready')).toHaveLength(1);
  });
  it('reports an error for a skeleton slot it cannot fill', async () => {
    load();
    send({ type: 'sync', rev: 4, skeleton: '<main><div data-lp-slot="ghost"></div></main>', blocks: [] });
    await frame();
    expect(posts).toContainEqual(expect.objectContaining({ type: 'error' }));
  });
});
```

`lib/editor/canvas/srcdoc.test.ts`:

```ts
import { expect, it } from 'vitest';
import { asset } from './preview-runtime.generated';
import { createBlockHtmlCache } from './render-cache';
import { buildSrcdoc } from './srcdoc';
import { canvasState } from './sync';
import { editorDoc } from '../test-fixtures';

it('injects the runtime with its channel right before </body>, after the page script', () => {
  const html = buildSrcdoc(editorDoc(), 'abcdefghij');
  expect(html.endsWith('</script></body></html>')).toBe(true);
  expect(html).toContain('<script data-lp-channel="abcdefghij">');
  expect(html.indexOf('<script>')).toBeLessThan(html.indexOf('data-lp-channel'));
});
it('its body equals the canvas state with every slot filled', () => {
  const doc = editorDoc();
  const s = canvasState(doc, createBlockHtmlCache());
  const filled = s.skeleton.replace(/<div data-lp-slot="([^"]+)"><\/div>/g, (_, id: string) => s.blocks.get(id)!);
  expect(buildSrcdoc(doc, 'abcdefghij')).toContain(`<body>${filled}<script>`);
});
it('rejects a malformed channel', () => expect(() => buildSrcdoc(editorDoc(), 'x"><b')).toThrow());
it('the runtime stays within 8 KB minified', () => expect(new TextEncoder().encode(asset.min).byteLength).toBeLessThanOrEqual(8192));
```

Add to `scripts/build-assets.test.ts`:

```ts
it('bundles *.bundle.ts entries with their imports into one IIFE', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'assets-'));
  mkdirSync(join(dir, 'lib/z'), { recursive: true });
  writeFileSync(join(dir, 'lib/z/helper.ts'), 'export const greet = (n: string): string => `hi ${n}`;\n');
  writeFileSync(join(dir, 'lib/z/thing.bundle.ts'), "import { greet } from './helper';\n(window as any).x = greet('a');\n");
  const out = (await buildAssets(dir)).find((o) => o.outputPath.endsWith(join('lib', 'z', 'thing.generated.ts')))!;
  expect(out.contents).toContain('hi ');
  expect(out.contents).not.toContain('import ');
  expect(out.contents).toMatch(/min: "\(\(\)=>\{/);
});
```

- [ ] **Step 2: Run the tests and make sure they fail.**
  - Run: `pnpm exec vitest run lib/editor/canvas scripts/build-assets.test.ts`
  - Expected: FAIL (the runtime, srcdoc and bundle support are missing).
- [ ] **Step 3: Implement.**
  - Write `runtime.ts`, `preview-runtime.bundle.ts`, `srcdoc.ts` and the build-assets extension. Then run `pnpm assets` to write `preview-runtime.generated.ts`.
  - In `CLAUDE.md`, in the block recipe's `snippet.js` bullet, add: "In the editor canvas a snippet may run again after DOM patches, so top-level code must only initialize roots that lack `data-lp-ready`."
  - Under Commands, note that `pnpm assets` also bundles `lib/**/*.bundle.ts`.
  - Append to `docs/DECISIONS.md`:

```markdown
## D-039 Canvas protocol and patching — Accepted
- **Isolation:** the canvas is `<iframe sandbox="allow-scripts" srcdoc>`. Its origin is opaque, so page scripts can never reach the editor's cookies or DOM. Its document is `renderPage(doc, { mode: 'preview' })` plus a bundled runtime (`lib/editor/canvas/runtime.ts`, ≤ 8 KB) that carries a per-load channel id.
- **Patching:**
  - The parent keeps the HTML it last sent for each block. The cache is keyed on the block object, the settings object, the section anchors and the first-section and first-block position.
  - Once per animation frame it sends only what changed: CSS, JS, `lang`, the body skeleton (sections with one slot per block) and changed blocks.
  - The runtime moves unchanged block elements into the new skeleton, so carousel scroll and opened FAQ items survive reorders.
  - Replaced blocks keep their scroll offsets and the `<details>` the user opened.
- **Snippets:** after a patch the runtime runs the page's snippets again. Snippets are idempotent per root (`data-lp-ready`), so only new roots initialize; the block recipe now says so.
- **Untrusted messages:** every message from the iframe is untrusted. The parent checks `event.source`, the source tag, the channel and a Zod schema, and acts only on ids that exist in the document. Links never navigate the canvas.
```

- [ ] **Step 4: Run the tests and make sure they pass.**
  - Run: `pnpm test && pnpm assets:check && pnpm lint`
  - Expected: PASS; assets are up to date.
- [ ] **Step 5: Commit.**

```bash
git add lib/editor/canvas scripts CLAUDE.md docs/DECISIONS.md
git commit -m "feat(canvas): iframe runtime that patches blocks in place and reports geometry"
```

---

### Task 13: Editor page, shell and canvas

**Files:**
- Create: `components/editor/editor.tsx`, `components/editor/editor-context.tsx`, `components/editor/top-bar.tsx`, `components/editor/draft-error.tsx`, `components/editor/canvas/canvas.tsx`, `components/editor/canvas/overlay.tsx`, `tests/e2e/app/editor-canvas.spec.ts`
- Modify: `app/(editor)/editor/[pageId]/page.tsx` (replace the stub), `tests/e2e/app/helpers.ts`

**Interfaces:**
- Consumes:
  - `createEditorStore`, `VIEWPORT_WIDTHS` and `Viewport` (Task 9);
  - `canvasState`, `diffCanvas`, `createBlockHtmlCache`, `parseCanvasEvent` and `envelope` (Task 11);
  - `buildSrcdoc` (Task 12);
  - `getPageForEditor` (Task 5);
  - `createId`.
- Produces:
  - `<Editor page={{ id: string; name: string }} initialDoc={PageDocument} initialRevision={number} />` (client component).
  - In `editor-context.tsx`:
    - `EditorProvider` (it creates the store once with `useState`);
    - `useEditor<T>(selector: (s: EditorState & EditorActions) => T): T` (Zustand `useStore`; use `useShallow` for object selectors);
    - `useEditorStore(): EditorStore`.
  - `<Canvas onKey?: (input: KeyInput) => void />`. Task 14 passes `onKey`.
  - In development only (`process.env.NODE_ENV !== 'production'`): `window.__lpCanvasMetrics = { syncLatencies: number[]; readyMs: number | null }`. A latency runs from the store change to the matching `synced`.
  - E2E helpers added to `tests/e2e/app/helpers.ts`:
    - `canvas(page): FrameLocator` (the iframe titled "Page preview");
    - `blockTypes(frame): Promise<string[]>` (the `data-lp-type` values in order);
    - `openEditor(page, pageId): Promise<FrameLocator>`, which waits until the frame shows `[data-lp-section]` or the empty state.

**Behaviour:**
- **Page (server component):**
  - It calls `await requireUser()`, checks the id with `z.uuid()` (otherwise `notFound()`), reads `getPageForEditor`, and calls `notFound()` when the page is missing.
  - It runs `safeParseDocument(currentDraft)`. A failure renders `<DraftError>`; success renders `<Editor>`.
- **Layout:** the editor fills the window with `h-dvh flex flex-col`:
  - a 48 px top bar;
  - a row with the palette slot (`w-60 border-r`, empty until Task 14), the canvas (`flex-1 min-w-0 bg-muted`) and the inspector slot (`w-[340px] border-l`, empty until Task 16).
- **Canvas frame:**
  - The frame is created on the client only: `useState<Frame | null>(null)`, then an effect that sets `{ channel: createId(), srcdoc, sent: canvasState(doc) }` when it is still `null`. This is safe under StrictMode.
  - The window `message` listener is attached before the iframe renders. It accepts a message only when `event.source === iframe.contentWindow` and `parseCanvasEvent` passes.
  - After the iframe's `load`, post `hello`.
  - On `ready`, mark the frame ready and flush pending changes.
- **Syncing:**
  - `store.subscribe` watches for `doc` changes and schedules one `requestAnimationFrame`.
  - That frame computes `next = canvasState(doc)` and `payload = diffCanvas(sent, next)`. When the payload is not null, it posts `sync` with `rev` + 1 and sets `sent = next`.
  - On `error`, or when no `ready` arrives within 5 s, rebuild the frame with a new channel.
- **Iframe events:**
  - `hover` and `select` act only when the id exists in the document. `select` calls `store.select`.
  - `rects` replaces the overlay state.
  - `key` calls `onKey`.
- **Selection scrolling:** when the selection changes and the selected block's rect is outside the iframe viewport, post `scrollTo`. Skip this when the canvas itself caused the selection.
- **Sizing:**
  - A `ResizeObserver` on the canvas pane gives `pane`. With 16 px padding, `deviceWidth = VIEWPORT_WIDTHS[viewport]` and `scale = min(1, (pane.width - 32) / deviceWidth)`.
  - The iframe is `deviceWidth` wide and `(pane.height - 32) / scale` tall, with `transform: scale(scale)` and `transform-origin: 0 0`. It sits in a wrapper `deviceWidth * scale` wide.
  - The overlay is unscaled and multiplies rect coordinates by `scale`, so toolbar buttons keep their size.

**UI contract:**
- **Top bar:**
  - a link "Pages" to `/dashboard`;
  - an `<h1>` with the page name;
  - a radio group named "Preview width" with radios "Mobile", "Tablet" and "Desktop" (default Mobile).
- **Canvas:** the iframe has `title="Page preview"` and `sandbox="allow-scripts"`.
- **Overlay:**
  - The hover outline `data-testid="canvas-hover"` (hidden for the selected block) and the selection outline `data-testid="canvas-selection"`.
  - The selection outline holds a chip with the block's label ("Hero"), or "Section" for a section, which gets a dashed outline.
  - Zero-size rects (blocks hidden at this width) draw nothing.
- **Empty document:** "This page is empty. Add a block from the panel on the left." centred over the canvas.
- **Draft error:** a heading "This draft can't be opened", the error's message, and a link "Back to pages".

- [ ] **Step 1: Write the failing e2e tests** `tests/e2e/app/editor-canvas.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { exampleDocument } from '@/tests/fixtures/example-document';
import { blockTypes, EMPTY_DOC, ensureOwner, openEditor, resetOwnerPages, seedPage, signIn } from './helpers';

const heroId = exampleDocument.sections[0]!.blocks[0]!.id;
test.beforeAll(ensureOwner);
test.beforeEach(async ({ page }) => {
  await resetOwnerPages();
  await signIn(page);
});

test('renders the draft in a sandboxed canvas the editor cannot reach into', async ({ page }) => {
  const frame = await openEditor(page, await seedPage({ name: 'Example', document: exampleDocument }));
  await expect(page.locator('iframe[title="Page preview"]')).toHaveAttribute('sandbox', 'allow-scripts');
  expect(await blockTypes(frame)).toEqual(exampleDocument.sections.flatMap((s) => s.blocks.map((b) => b.type)));
  expect(await page.evaluate(() => document.querySelector('iframe')!.contentDocument)).toBeNull();
});

test('clicking a block selects it; links in the canvas do not navigate', async ({ page }) => {
  const frame = await openEditor(page, await seedPage({ name: 'Example', document: exampleDocument }));
  await frame.locator(`[data-lp-block="${heroId}"] a[href]`).first().click();
  await expect(page.getByTestId('canvas-selection')).toContainText('Hero');
  expect(page.frames().find((f) => f !== page.mainFrame())!.url()).toBe('about:srcdoc');
});

test('the selection outline follows canvas scrolling', async ({ page }) => {
  const frame = await openEditor(page, await seedPage({ name: 'Example', document: exampleDocument }));
  await frame.locator(`[data-lp-block="${heroId}"] h1`).click();
  const outline = page.getByTestId('canvas-selection');
  const y0 = (await outline.boundingBox())!.y;
  await frame.locator('html').evaluate(() => window.scrollBy(0, 200));
  await expect.poll(async () => Math.round((await outline.boundingBox())!.y - (y0 - 200))).toBeLessThanOrEqual(3);
});

test('the viewport toggle changes the canvas width', async ({ page }) => {
  const frame = await openEditor(page, await seedPage({ name: 'Example', document: exampleDocument }));
  const width = () => frame.locator('html').evaluate(() => window.innerWidth);
  expect(await width()).toBe(390);
  await page.getByRole('radio', { name: 'Tablet' }).check();
  await expect.poll(width).toBe(768);
  await page.getByRole('radio', { name: 'Desktop' }).check();
  await expect.poll(width).toBe(1280);
  const box = (await page.locator('iframe[title="Page preview"]').boundingBox())!;
  expect(box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test('an empty page shows a hint', async ({ page }) => {
  await openEditor(page, await seedPage({ name: 'Empty', document: EMPTY_DOC }));
  await expect(page.getByText('This page is empty. Add a block from the panel on the left.')).toBeVisible();
});

test('an invalid stored draft shows an error instead of the editor', async ({ page }) => {
  const id = await seedPage({ name: 'Broken', document: { schemaVersion: 1, sections: 'x' } });
  await page.goto(`/editor/${id}`);
  await expect(page.getByRole('heading', { name: "This draft can't be opened" })).toBeVisible();
});

test('forged canvas messages are ignored', async ({ page }) => {
  await openEditor(page, await seedPage({ name: 'Example', document: exampleDocument }));
  await page.evaluate((blockId) => {
    window.postMessage({ source: 'launchpad-canvas', channel: 'aaaaaaaaaa', type: 'select', target: { kind: 'block', blockId } }, '*');
  }, heroId);
  await page.waitForTimeout(300);
  await expect(page.getByTestId('canvas-selection')).toHaveCount(0);
});
```

- [ ] **Step 2: Run the tests and make sure they fail.**
  - Run: `pnpm test:e2e:app`
  - Expected: FAIL; the stub page has no canvas.
- [ ] **Step 3: Implement** the page, `Editor`, the context, `TopBar`, `Canvas`, `Overlay` and `DraftError`, and add the helpers.
- [ ] **Step 4: Run the tests and make sure they pass.**
  - Run: `pnpm test:e2e:app && pnpm typecheck && pnpm lint`
  - Expected: PASS.
- [ ] **Step 5: Commit.**

```bash
git add app components/editor tests/e2e/app
git commit -m "feat(editor): three-pane shell with a sandboxed live canvas and selection overlay"
```

---

### Task 14: Palette, block toolbar, shortcuts and autosave

**Files:**
- Create: `components/editor/palette.tsx`, `components/editor/canvas/block-toolbar.tsx`, `components/editor/use-shortcuts.ts`, `components/editor/use-autosave.ts`, `components/editor/save-status.tsx`, `components/editor/save-banner.tsx`, `lib/editor/shortcuts.ts`, `lib/editor/shortcuts.test.ts`, `tests/e2e/app/editor-blocks.spec.ts`
- Modify: `components/editor/editor.tsx`, `components/editor/top-bar.tsx`, `components/editor/canvas/overlay.tsx`, `lib/blocks/registry.test.ts`, `tests/e2e/app/helpers.ts`

**Interfaces:**
- Consumes:
  - the store and `canMoveBlock`/`canMoveSection` (Tasks 8–9);
  - `createAutosave` and `createDraftSender` (Task 10);
  - `KeyInput` (Task 11);
  - `Canvas onKey` (Task 13).
- Produces:

```ts
// lib/editor/shortcuts.ts
export type EditorIntent = 'undo' | 'redo' | 'delete' | 'duplicate' | 'moveUp' | 'moveDown' | 'escape';
export function resolveShortcut(input: KeyInput, context: { editingText: boolean }): EditorIntent | null;
/** Maps an intent to the store: block → move/duplicate/remove block; section → the section commands; escape: block → its section → nothing. */
export function performIntent(store: EditorStore, intent: EditorIntent): void;
// components/editor/use-autosave.ts
export function useAutosave(store: EditorStore, pageId: string, initialRevision: number): Autosave;
```

  - E2E helpers: `addBlock(page, label)` clicks the palette button. `saveStatus(page)` returns the `save-status` locator.

**Shortcut rules:**
- `mod` = `metaKey || ctrlKey`.
- Mod+Z → `undo`; Mod+Shift+Z or Mod+Y → `redo`. These apply even while editing text, and call `preventDefault`: the store holds the source of truth.
- While editing text (focus in `input`, `textarea`, `select` or `[contenteditable]`), nothing else fires.
- Delete or Backspace → `delete`; Mod+D → `duplicate`; Alt+ArrowUp/ArrowDown → `moveUp`/`moveDown`; Escape → `escape`.
- The window `keydown` listener and `Canvas onKey` share one handler.

**Autosave wiring:**
- `changed(version)` runs on every store version change.
- `visibilitychange` (hidden) and `pagehide` → `flush({ unloading: true })`. Window `blur` → `flush()`. `online` → `retry()`.
- `beforeunload` calls `preventDefault()` while the status is not `saved`, unless the user chose "Reload latest".
- The "Pages" link awaits `flush()` (at most 3 s) before `router.push('/dashboard')`.

**UI contract:**
- **Palette:** `<nav aria-label="Blocks">` with headings "Content", "Conversion" and "Special". Each block is a button named by its `label`, with `title` set to its `description` and its icon from `DynamicIcon` (`lucide-react/dynamic`). Clicking one dispatches `addBlock`; the new block is selected and scrolled into view.
- **Block toolbar:** `role="toolbar"` named "Block actions", at the selected block's top-right (clamped inside the canvas). Buttons "Move up", "Move down", "Duplicate", "Delete" and "Edit section". The move buttons are disabled when `canMoveBlock` is false.
- **Section toolbar:** named "Section actions", with "Move up", "Move down", "Duplicate" and "Delete".
- **Top bar:**
  - "Undo" and "Redo" buttons, disabled at the ends. Their `title` is `Undo <label>` / `Redo <label>`.
  - The save status `data-testid="save-status"`:

    | `status` | Text |
    |---|---|
    | saved | Saved |
    | dirty | Unsaved changes |
    | saving | Saving… |
    | offline | Offline — retrying |
    | error | Not saved |
    | conflict | Conflict |

  - A "Page settings" button that selects `{ kind: 'page' }`.
- **Banners** (`role="alert"`, below the top bar):
  - Conflict: "This page was changed in another tab or window." with the buttons "Reload latest" and "Keep my version".
  - Error: the error message and a "Retry" button.
- **Live regions:** an `sr-only` live region `data-testid="announcer"` (`role="status"`, `aria-live="polite"`) shows `announcement`. When `notice` is set, it appears as a muted line in the top bar.

- [ ] **Step 1: Write the failing tests.**

`lib/editor/shortcuts.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { sequentialIds } from '@/lib/schema/ids';
import { performIntent, resolveShortcut } from './shortcuts';
import { createEditorStore } from './store';
import { editorDoc, order } from './test-fixtures';

const key = (k: string, m: Partial<{ mod: boolean; shift: boolean; alt: boolean }> = {}) =>
  ({ key: k, mod: false, shift: false, alt: false, ...m });

describe('resolveShortcut', () => {
  it.each([
    [key('z', { mod: true }), false, 'undo'],
    [key('z', { mod: true, shift: true }), false, 'redo'],
    [key('y', { mod: true }), true, 'redo'],
    [key('z', { mod: true }), true, 'undo'],
    [key('Delete'), false, 'delete'],
    [key('Backspace'), true, null],
    [key('d', { mod: true }), false, 'duplicate'],
    [key('ArrowUp', { alt: true }), false, 'moveUp'],
    [key('ArrowDown', { alt: true }), true, null],
    [key('Escape'), false, 'escape'],
    [key('ArrowUp'), false, null],
  ])('%j editing=%s → %s', (input, editingText, intent) => expect(resolveShortcut(input, { editingText })).toBe(intent));
});

it('performIntent drives block and section commands and escape walks up', () => {
  const store = createEditorStore({ pageId: 'p', doc: editorDoc() }, { newId: sequentialIds('n') });
  store.getState().select({ kind: 'block', blockId: 'b4' });
  performIntent(store, 'moveUp');
  expect(order(store.getState().doc)).toEqual(['s1:b1', 's3:b4', 's2:b2,b3', 's4:b5']);
  performIntent(store, 'escape');
  expect(store.getState().selection).toEqual({ kind: 'section', sectionId: 's3' });
  performIntent(store, 'moveDown');
  expect(order(store.getState().doc)[2]).toBe('s3:b4');
  performIntent(store, 'escape');
  expect(store.getState().selection).toBeNull();
  performIntent(store, 'undo');
  expect(order(store.getState().doc)[1]).toBe('s3:b4');
});
```

Add to `lib/blocks/registry.test.ts`:

```ts
import dynamicIconImports from 'lucide-react/dynamicIconImports';
it('every block icon is a lucide icon name', () => {
  for (const d of listBlockDefinitions()) expect(Object.keys(dynamicIconImports), d.type).toContain(d.icon);
});
```

`tests/e2e/app/editor-blocks.spec.ts`:

```ts
import { expect, test, type Page } from '@playwright/test';
import { addBlock, blockTypes, canvas, EMPTY_DOC, ensureOwner, openEditor, resetOwnerPages, saveStatus, seedPage, signIn } from './helpers';

test.beforeAll(ensureOwner);
test.beforeEach(async ({ page }) => {
  await resetOwnerPages();
  await signIn(page);
});
const fresh = async (page: Page) => openEditor(page, await seedPage({ name: 'Blocks', document: EMPTY_DOC }));

test('adds Hero and Product Carousel from the palette', async ({ page }) => {
  const frame = await fresh(page);
  await addBlock(page, 'Hero');
  await addBlock(page, 'Product Carousel');
  await expect.poll(() => blockTypes(frame)).toEqual(['hero', 'product-carousel']);
  await expect(frame.locator('h1')).toContainText('Your main promise in one line');
  await expect(frame.locator('.lp-card')).toHaveCount(3);
  await expect(page.getByTestId('canvas-selection')).toContainText('Product Carousel');
});

test('moves, duplicates and deletes with the toolbar and the keyboard; undo and redo walk every step', async ({ page }) => {
  const frame = await fresh(page);
  const steps: string[][] = [[]];
  const snap = async () => steps.push(await blockTypes(frame));
  for (const label of ['Hero', 'Benefits', 'FAQ']) { await addBlock(page, label); await snap(); }
  await page.getByRole('toolbar', { name: 'Block actions' }).getByRole('button', { name: 'Move up' }).click();
  await expect(page.getByTestId('announcer')).toHaveText('Moved FAQ up, now section 2 of 3');
  await snap();
  await page.keyboard.press('Alt+ArrowUp');
  await snap();
  await page.keyboard.press('ControlOrMeta+d');
  await snap();
  await page.keyboard.press('Delete');
  await snap();
  expect(steps.slice(4)).toEqual([
    ['hero', 'faq', 'benefits'], ['faq', 'hero', 'benefits'], ['faq', 'faq', 'hero', 'benefits'], ['faq', 'hero', 'benefits'],
  ]);
  for (let i = steps.length - 2; i >= 0; i--) {
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(() => blockTypes(frame)).toEqual(steps[i]);
  }
  for (let i = 1; i < steps.length; i++) {
    await page.keyboard.press('ControlOrMeta+Shift+z');
    await expect.poll(() => blockTypes(frame)).toEqual(steps[i]);
  }
});

test('autosave persists the draft across a reload', async ({ page }) => {
  await fresh(page);
  await addBlock(page, 'Hero');
  await addBlock(page, 'FAQ');
  await expect(saveStatus(page)).toHaveText('Saved');
  await page.reload();
  await expect.poll(() => blockTypes(canvas(page))).toEqual(['hero', 'faq']);
});

test('warns before leaving with unsaved changes', async ({ page }) => {
  await fresh(page);
  await addBlock(page, 'Hero');
  const dialog = page.waitForEvent('dialog');
  await page.close({ runBeforeUnload: true });
  const d = await dialog;
  expect(d.type()).toBe('beforeunload');
  await d.accept();
});

test('a save from another tab raises a conflict; keeping mine overwrites it', async ({ page, context }) => {
  const id = await seedPage({ name: 'Two tabs', document: EMPTY_DOC });
  const other = await context.newPage();
  await openEditor(page, id);
  await openEditor(other, id);
  await addBlock(page, 'Hero');
  await expect(saveStatus(page)).toHaveText('Saved');
  await addBlock(other, 'FAQ');
  // Not getByRole('alert'): Next.js also renders a route announcer with role="alert".
  await expect(other.getByText('This page was changed in another tab or window.')).toBeVisible();
  await other.getByRole('button', { name: 'Keep my version' }).click();
  await expect(saveStatus(other)).toHaveText('Saved');
  await page.reload();
  await expect.poll(() => blockTypes(canvas(page))).toEqual(['faq']);
});
```

- [ ] **Step 2: Run the tests and make sure they fail.**
  - Run: `pnpm exec vitest run lib/editor/shortcuts.test.ts lib/blocks/registry.test.ts && pnpm test:e2e:app`
  - Expected: FAIL.
- [ ] **Step 3: Implement** the shortcuts module, the palette, the toolbars, the autosave hook, the save status and banners, and the announcer.
- [ ] **Step 4: Run the tests and make sure they pass.**
  - Run: `pnpm test && pnpm test:e2e:app`
  - Expected: PASS.
- [ ] **Step 5: Commit.**

```bash
git add lib components/editor tests/e2e/app
git commit -m "feat(editor): palette, block toolbar, keyboard shortcuts and autosave with conflict banner"
```

---

### Task 15: Inspector logic: field descriptors, seeds, labels, contrast and UTM

**Files:**
- Create: `lib/editor/inspector/fields.ts`, `lib/editor/inspector/fields.test.ts`, `lib/editor/inspector/labels.ts`, `lib/editor/inspector/labels.test.ts`, `lib/schema/contrast.ts`, `lib/schema/contrast.test.ts`, `lib/editor/utm.ts`, `lib/editor/utm.test.ts`
- Modify: `lib/schema/primitives.ts` (append `.meta({ control: 'image' })` to `ImageSchema` and `.meta({ control: 'color' })` to `HexColorSchema`), `docs/DECISIONS.md` (append D-040)

**Interfaces:**
- Consumes: `PropPath`, `getAtPath` and `withFreshIds` (Task 8); `AnyBlockDefinition`; `IdFactory`.
- Produces:

```ts
// lib/editor/inspector/fields.ts
interface BaseSpec { key: string; label: string; optional: boolean; schema: z.ZodType /* unwrapped */ }
export interface TextSpec extends BaseSpec { kind: 'text'; min: number; max: number; multiline: boolean } // multiline when max > 160
export interface RichSpec extends BaseSpec { kind: 'rich'; min: number; max: number }
export interface NumberSpec extends BaseSpec { kind: 'number'; min: number | null; max: number | null; int: boolean }
export interface BooleanSpec extends BaseSpec { kind: 'boolean' }
export interface ChoiceSpec extends BaseSpec { kind: 'choice'; options: { value: string | number; label: string }[] }
export interface ColorSpec extends BaseSpec { kind: 'color' }
export interface LinkSpec extends BaseSpec { kind: 'link'; kinds: ('url' | 'section' | 'default')[] }
export interface ImageSpec extends BaseSpec { kind: 'image' }
export interface GroupSpec extends BaseSpec { kind: 'group'; fields: FieldSpec[] }
export interface ListSpec extends BaseSpec { kind: 'list'; item: GroupSpec; max: number }
export type FieldSpec = TextSpec | RichSpec | NumberSpec | BooleanSpec | ChoiceSpec | ColorSpec | LinkSpec | ImageSpec | GroupSpec | ListSpec;
/** Fields of an object schema (cached per schema); throws on a construct it does not know. */
export function describeFields(schema: z.ZodType): FieldSpec[];
/** Minimal valid value: required text → `[REPLACE: <label>]`, `id` → newId(), numbers → min ?? 0, first choice, links → `{ kind: 'default' }` when allowed. */
export function seedValue(schema: z.ZodType, newId: IdFactory, key?: string): unknown;
/**
 * A new list item (path ends in an index) or a newly enabled optional group.
 * Uses the block's own sample from defaultProps, with fresh ids, else seedValue.
 * For a list item the sample is the first item of that list in defaultProps; for a group, the value at the same path.
 */
export function initialValueAt(definition: AnyBlockDefinition, path: PropPath, schema: z.ZodType, newId: IdFactory): unknown;
/** The first non-empty text/rich field of the item (markup stripped), else `Item <n>`. */
export function listItemSummary(item: unknown, spec: ListSpec, index: number): string;
/** The first issue of schema.safeParse(value), in plain words; null when valid. */
export function fieldError(spec: FieldSpec, value: unknown): string | null;

// lib/editor/inspector/labels.ts
export function fieldLabel(key: string): string;
export function optionLabel(key: string, value: string | number): string;

// lib/schema/contrast.ts
export function contrastRatio(foreground: string, background: string): number; // WCAG 2.x relative luminance
export const AA_TEXT_RATIO = 4.5;
export const THEME_CONTRAST_PAIRS: readonly (readonly [fg: keyof Theme['colors'], bg: keyof Theme['colors']])[];
// [['onPrimary','primary'], ['onAccent','accent'], ['text','background'], ['mutedText','background'], ['text','surface'], ['onDark','dark']]

// lib/editor/utm.ts
export const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;
export type UtmKey = (typeof UTM_KEYS)[number];
/** null unless url is an absolute http(s) URL. */
export function readUtm(url: string): Partial<Record<UtmKey, string>> | null;
/** Sets non-empty values and removes empty ones; keeps other params and the hash; returns url unchanged when not http(s). */
export function writeUtm(url: string, values: Partial<Record<UtmKey, string>>): string;
```

**Walker rules:**
- Unwrap `optional` (which sets `optional: true`), `default` and `prefault`.
- **Strings:** `meta().control` `'text'` → text, `'rich'` → rich, `'color'` → color. A string with no control → text.
- **Numbers and booleans:** number → number, using `minValue`, `maxValue` and `isInt`; boolean → boolean.
- **Choices:** an enum, a union of literals, or an enum plus literals (the benefit icon: `IconNameSchema | 'none'`) → choice.
- **Links:** a union with `def.discriminator === 'kind'` whose option literals ⊆ {url, section, default} → link.
- **Objects:** an object with `control: 'image'` → image; any other object → group.
- **Lists:** an array of objects → list, with `max` read from `z.toJSONSchema(array).maxItems` (∞ when absent).
- **Skipped:** a key named `id`.

Labels are humanized camelCase keys ("Headline", "Compare at price") with these overrides:

| Key | Label |
|---|---|
| `primaryCta` | Primary button |
| `secondaryCta` | Secondary button |
| `cta` | Button |
| `trustLine` | Trust line |
| `alt` | Alt text |
| `src` | Image address |
| `newTab` | Open in a new tab |
| `compareAtPrice` | Compare-at price |
| `showDiscount` | Show discount badge |
| `slidesPerView` | Cards per view |
| `arrowsOnTouch` | Show arrows on touch screens |
| `aspectRatio` | Image shape |
| `openFirst` | Open the first question |
| `exclusive` | Only one answer open at a time |
| `hideOn` | Hide on |
| `spaceAbove` | Space above |
| `padY` | Vertical padding |
| `width` | Content width |
| `tone` | Background |
| `onPrimary` | Text on primary |
| `onAccent` | Text on accent |
| `onDark` | Text on dark |
| `mutedText` | Muted text |
| `surface` | Card background |
| `background` | Page background |
| `dark` | Dark background |
| `headingFont` | Heading font |
| `buttonShape` | Button shape |
| `seo` | Search engines |
| `noindex` | Hide from search engines |
| `defaultCta` | Default button target |
| `lang` | Language |

Option overrides:

| Key | Value → label |
|---|---|
| `lang` | `id` → Indonesian, `en` → English |
| `hideOn` | `none` → Never |
| `navigation` | `both` → Arrows and dots |
| `icon` | `none` → No icon |
| `tone` | `base` → Page, `primary` → Primary color |

Any other value is humanized (`neo-grotesque` → "Neo-grotesque"; `2` → "2").

`fieldError` messages:
- string `too_small` with minimum 1 → `Required`;
- string `too_big` → `At most <max> characters`;
- number `too_small`/`too_big` → `Minimum <min>` / `Maximum <max>`;
- the hex color pattern → `Use a color like #2563EB`;
- anything else → the Zod message.

- [ ] **Step 1: Write the failing tests.**

`lib/editor/inspector/fields.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { productCarousel } from '@/lib/blocks/special/product-carousel';
import { ProductItemSchema } from '@/lib/blocks/special/product-carousel/schema';
import { listBlockDefinitions } from '@/lib/blocks/registry';
import { HeroPropsSchema } from '@/lib/blocks/hero/schema';
import { BlockStyleSchema, SectionStyleSchema } from '@/lib/schema/primitives';
import { PageSettingsSchema } from '@/lib/schema/settings';
import { sequentialIds } from '@/lib/schema/ids';
import { describeFields, fieldError, initialValueAt, listItemSummary, seedValue, type FieldSpec, type ListSpec } from './fields';

const shape = (fields: FieldSpec[]): unknown[] =>
  fields.map((f) => (f.kind === 'group' || f.kind === 'list'
    ? [f.key, f.kind, shape(f.kind === 'list' ? f.item.fields : f.fields)]
    : [f.key, f.kind, f.optional]));

describe('describeFields', () => {
  it('describes the hero', () => {
    expect(shape(describeFields(HeroPropsSchema))).toEqual([
      ['eyebrow', 'text', false], ['headline', 'rich', false], ['subheadline', 'rich', false],
      ['primaryCta', 'group', [['label', 'text', false], ['link', 'link', false], ['variant', 'choice', false]]],
      ['secondaryCta', 'group', [['label', 'text', false], ['link', 'link', false], ['variant', 'choice', false]]],
      ['trustLine', 'text', false], ['image', 'image', true], ['layout', 'choice', false], ['align', 'choice', false],
    ]);
    const cta = describeFields(HeroPropsSchema).find((f) => f.key === 'primaryCta')!;
    expect(cta).toMatchObject({ label: 'Primary button', optional: true });
  });
  it('describes lists with their item fields and maximum', () => {
    const items = describeFields(productCarousel.schema).find((f) => f.key === 'items') as ListSpec;
    expect(items).toMatchObject({ kind: 'list', max: 50, label: 'Items' });
    expect(items.item.fields.map((f) => f.key)).not.toContain('id');
  });
  it('describes every registered block, the style schemas and the page settings without throwing', () => {
    for (const d of listBlockDefinitions()) expect(() => describeFields(d.schema), d.type).not.toThrow();
    for (const s of [BlockStyleSchema, SectionStyleSchema, PageSettingsSchema]) expect(() => describeFields(s)).not.toThrow();
  });
  it('turns enums, literal unions and enum+literal unions into choices with labels', () => {
    const settings = describeFields(PageSettingsSchema);
    expect(settings.find((f) => f.key === 'lang')).toMatchObject({ kind: 'choice', options: [{ value: 'id', label: 'Indonesian' }, { value: 'en', label: 'English' }] });
  });
});

describe('seeds and initial values', () => {
  it('seeds a valid product item with placeholders for required text', () => {
    const item = seedValue(ProductItemSchema, sequentialIds('n')) as { id: string; title: string };
    expect(ProductItemSchema.safeParse(item).success).toBe(true);
    expect(item).toMatchObject({ id: 'n1', title: '[REPLACE: Title]' });
  });
  it('a new list item copies the block’s sample with a fresh id', () => {
    const item = initialValueAt(productCarousel, ['items', 3], ProductItemSchema, sequentialIds('n')) as { id: string; title: string; cta: { label: string } };
    expect(item).toMatchObject({ title: 'Product 1', cta: { label: 'Buy now' } });
    expect(item.id).toMatch(/^n\d+$/);
  });
  it('summarizes list items by their first text', () => {
    const items = describeFields(productCarousel.schema).find((f) => f.key === 'items') as ListSpec;
    expect(listItemSummary({ title: '**Botol** biru' }, items, 0)).toBe('Botol biru');
    expect(listItemSummary({ title: '' }, items, 4)).toBe('Item 5');
  });
  it('explains invalid values in plain words', () => {
    const headline = describeFields(HeroPropsSchema).find((f) => f.key === 'headline')!;
    expect(fieldError(headline, '')).toBe('Required');
    expect(fieldError(headline, 'x'.repeat(201))).toBe('At most 200 characters');
    expect(fieldError(headline, 'ok')).toBeNull();
  });
});
```

`lib/schema/contrast.test.ts`:

```ts
import { expect, it } from 'vitest';
import { AA_TEXT_RATIO, THEME_CONTRAST_PAIRS, contrastRatio } from './contrast';
import { DEFAULT_THEME } from './theme';

it('computes WCAG contrast ratios', () => {
  expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 5);
  expect(contrastRatio('#767676', '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio('#777777', '#FFFFFF')).toBeLessThan(4.5);
  expect(contrastRatio('#FFFFFF', '#FDE047')).toBeCloseTo(1.32, 1);
  expect(contrastRatio('#2563EB', '#FFFFFF')).toBeCloseTo(contrastRatio('#FFFFFF', '#2563EB'), 10);
});
it('every default theme pair passes AA for body text', () => {
  for (const [fg, bg] of THEME_CONTRAST_PAIRS)
    expect(contrastRatio(DEFAULT_THEME.colors[fg], DEFAULT_THEME.colors[bg]), `${fg}/${bg}`).toBeGreaterThanOrEqual(AA_TEXT_RATIO);
});
```

`lib/editor/utm.test.ts`:

```ts
import { expect, it } from 'vitest';
import { readUtm, writeUtm } from './utm';

it('reads and writes UTM parameters, keeping everything else', () => {
  expect(writeUtm('https://wa.me/62812', { utm_source: 'meta' })).toBe('https://wa.me/62812?utm_source=meta');
  expect(readUtm('https://x.test/p?a=1&utm_medium=cpc#f')).toEqual({ utm_medium: 'cpc' });
  expect(writeUtm('https://x.test/p?a=1&utm_medium=cpc#f', { utm_medium: '', utm_campaign: 'oct' })).toBe('https://x.test/p?a=1&utm_campaign=oct#f');
});
it('leaves non-http links alone', () => {
  for (const url of ['mailto:a@b.test', '#order', '/thanks', '', 'tel:+62812']) {
    expect(readUtm(url)).toBeNull();
    expect(writeUtm(url, { utm_source: 'x' })).toBe(url);
  }
});
```

`lib/editor/inspector/labels.test.ts` checks:
- `fieldLabel('compareAtPrice') === 'Compare-at price'`, `fieldLabel('subheadline') === 'Subheadline'` and `fieldLabel('reviewCount') === 'Review count'`;
- `optionLabel('hideOn', 'none') === 'Never'`, `optionLabel('font', 'neo-grotesque') === 'Neo-grotesque'` and `optionLabel('columns', 3) === '3'`.

- [ ] **Step 2: Run the tests and make sure they fail.**
  - Run: `pnpm exec vitest run lib/editor/inspector lib/schema/contrast.test.ts lib/editor/utm.test.ts`
  - Expected: FAIL.
- [ ] **Step 3: Implement the modules and the two `.meta()` additions.** Then run the full suite: the registry-wide and snapshot tests must stay green, because metadata does not change parsing or rendering.
- [ ] **Step 4: Append D-040** to `docs/DECISIONS.md`:

```markdown
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
```

- [ ] **Step 5: Run the tests and make sure they pass.**
  - Run: `pnpm test`
  - Expected: PASS.
- [ ] **Step 6: Commit.**

```bash
git add lib/editor lib/schema docs/DECISIONS.md
git commit -m "feat(inspector): field descriptors from Zod schemas, seeds, labels, contrast and UTM helpers"
```

---

### Task 16: Inspector UI

**Files:**
- Create:
  - `components/editor/inspector/inspector.tsx`, `block-panel.tsx`, `section-panel.tsx`, `page-panel.tsx`, `field-list.tsx`, `use-field-draft.ts`
  - `components/editor/inspector/controls/`: `text-control.tsx`, `rich-control.tsx`, `number-control.tsx`, `boolean-control.tsx`, `choice-control.tsx`, `color-control.tsx`, `link-control.tsx`, `image-control.tsx`, `group-control.tsx`, `list-control.tsx`
  - `tests/e2e/app/editor-inspector.spec.ts`
- Modify: `components/editor/editor.tsx` (mount the inspector in the right pane)
- Add with shadcn: `pnpm exec shadcn add tabs textarea -y -o`, then `pnpm format`

**Interfaces:**
- Consumes: Task 15's functions; `dispatch`, `endCoalescing` and `select` from the store; `formatPrice`; `sanitizeUrl` (to warn about links and images the renderer would neutralize).
- Produces:

```ts
export interface FieldActions {
  set(path: PropPath, value: unknown): CommandResult; // the panel adds the coalesceKey `<target>:<path.join('.')>`
  endEdit(): void; // store.endCoalescing()
  listInsert(path: PropPath, index: number, item: unknown): CommandResult;
  listMove(path: PropPath, from: number, to: number): CommandResult;
  listRemove(path: PropPath, index: number): CommandResult;
  listDuplicate(path: PropPath, index: number): CommandResult;
}
export interface FieldContext { doc: PageDocument; definition: AnyBlockDefinition | null; idPrefix: string }
export function FieldList(props: { fields: FieldSpec[]; value: Record<string, unknown>; path: PropPath; actions: FieldActions; context: FieldContext }): JSX.Element;
/** Local draft for one control: follows `committed` when it changes from outside (undo, redo), keeps an invalid draft with its error while focused, and reverts to `committed` on blur. */
export function useFieldDraft<T>(committed: T, validate: (draft: T) => string | null): {
  draft: T; error: string | null; change(next: T, commit: (valid: T) => void): void; blur(): void;
};
```

**Panels:**
- **Selection `block`:**
  - Tabs "Content", "Style" and "Section".
  - Content: `describeFields(definition.schema)` with `set → setBlockProp`.
  - Style: `describeFields(BlockStyleSchema)` with `set → setBlockStyle`.
  - Section: the parent section's panel.
- **Selection `section`:** the section panel, with `describeFields(SectionStyleSchema)` and an "Anchor" text field (help: "Links to this section use #anchor. Lowercase letters, digits and dashes."), which calls `setSectionAnchor`. The command's failure reason is the field error.
- **Selection `page`:** the page panel, headed "Page settings":
  - generated fields for `lang`, `seo`, `defaultCta` (link control with kinds url and section; optional → "None") and `theme`;
  - a custom "Currency" select (IDR, USD, MYR, SGD, PHP) that sets `price` to `PRICE_FORMATS[code]`.
- **Nothing selected:** "Select a block on the canvas to edit it." and a "Page settings" button.

**Controls (`label` is the visible `<label>` bound to the input):**
- **text:** `<input>`, or `<textarea>` when `multiline`, with `maxLength={max}`. A counter `n/max` appears once 80 % of the limit is used.
- **rich:** a `<textarea>` with toolbar buttons "Bold", "Italic", "Highlight" and "Link":
  - Bold, Italic and Highlight wrap the selection in `**…**`, `*…*` or `==…==`.
  - Link wraps it as `[…](https://)` and selects `https://`.
  - Help text: "**bold**, *italic*, ==highlight==, [text](https://…)".
- **number:** `<input type="number">` with `step` 1 for integers, else `any`. Empty → `undefined` when optional, else `Required`. Price keys (`price`, `compareAtPrice`) show `formatPrice(value, settings.price)` underneath.
- **boolean:** a checkbox.
- **choice:** a native `<select>`. Optional fields add a first option "Default" (→ `undefined`).
- **color:** an `<input type="color">` named `<label> (picker)` and a text input named `<label>`, which take hex values.
  - In the page panel, each background key of `THEME_CONTRAST_PAIRS` shows `data-testid="contrast-<fg>-<bg>"` for each pair it belongs to.
  - The text reads `<ratio 1 decimal>:1 · AA` when ≥ 4.5, else `<ratio>:1 · too low for text`.
- **link:**
  - A "Link type" select (`url` "Web address", `section` "Section on this page", `default` "Page default button target").
  - For `url`: an "Address" input, "Open in a new tab", and a warning "This link will be disabled. Use https://, mailto:, tel: or #anchor." when `sanitizeUrl(url, 'link') === null`.
  - Also for `url`: a disclosure "UTM parameters" with inputs "Source", "Medium", "Campaign", "Content" and "Term" (`readUtm`/`writeUtm`), enabled only for http(s) URLs.
  - For `section`: a "Section" select whose options read `Section <n> · <first block label or 'Empty'>`, plus ` (#anchor)` when set.
- **image:**
  - an "Image address" input and an "Alt text" input;
  - a thumbnail `<img>` when `sanitizeUrl(src, 'image')` passes;
  - a hint "Describe the image for screen readers, or leave empty if it is decorative." when `src` is set and alt is empty;
  - a "Remove image" button when optional. Upload arrives in M2b.
- **group:** a `<fieldset>` with a `<legend>`. Optional groups show "Add <label>" (value from `initialValueAt`) or "Remove <label>".
- **list:**
  - An `<ol aria-label="<label>">`. Each `<li>` has a toggle button with its `listItemSummary` and `aria-expanded`, plus buttons "Move item up", "Move item down", "Duplicate item" and "Delete item". The expanded item shows its fields.
  - Below the list: "Add item" (value from `initialValueAt(definition, [...path, length])`), disabled at `max` and showing `<n> of <max>`.
  - Each list command's failure reason shows under the list.

Every keystroke commits through `set` when `fieldError` is null; blur calls `actions.endEdit()`.

- [ ] **Step 1: Write the failing e2e tests** `tests/e2e/app/editor-inspector.spec.ts`:

```ts
import { expect, test, type Page } from '@playwright/test';
import { svgPlaceholder } from '@/tests/fixtures/example-document';
import { addBlock, canvas, EMPTY_DOC, ensureOwner, openEditor, resetOwnerPages, saveStatus, seedPage, signIn } from './helpers';

test.beforeAll(ensureOwner);
test.beforeEach(async ({ page }) => {
  await resetOwnerPages();
  await signIn(page);
});
async function heroAndCarousel(page: Page) {
  const frame = await openEditor(page, await seedPage({ name: 'Inspector', document: EMPTY_DOC }));
  await addBlock(page, 'Hero');
  await addBlock(page, 'Product Carousel');
  return frame;
}
const selectBlock = (page: Page, type: string) => canvas(page).locator(`[data-lp-type="${type}"]`).first().click({ position: { x: 8, y: 8 } });

test('edits the hero headline and the canvas follows; rich toolbar adds bold', async ({ page }) => {
  const frame = await heroAndCarousel(page);
  await selectBlock(page, 'hero');
  const headline = page.getByLabel('Headline');
  await headline.fill('Botol anti bocor');
  await expect(frame.locator('h1')).toHaveText('Botol anti bocor');
  await headline.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(6, 10));
  await page.getByRole('button', { name: 'Bold' }).click();
  await expect(headline).toHaveValue('Botol **anti** bocor');
  await expect(frame.locator('h1 strong')).toHaveText('anti');
});

test('a required field cannot be emptied', async ({ page }) => {
  const frame = await heroAndCarousel(page);
  await selectBlock(page, 'hero');
  const headline = page.getByLabel('Headline');
  await headline.fill('');
  await expect(page.getByText('Required')).toBeVisible();
  await expect(frame.locator('h1')).toContainText('Your main promise');
  await page.getByLabel('Eyebrow').click();
  await expect(headline).toHaveValue('Your main promise in **one line**');
});

test('adds, reorders, duplicates and removes carousel items; undo restores each step', async ({ page }) => {
  const frame = await heroAndCarousel(page);
  const titles = () => frame.locator('.lp-card__title').allTextContents();
  const items = page.getByRole('list', { name: 'Items' }).getByRole('listitem');
  const start = await titles();
  await page.getByRole('button', { name: 'Add item' }).click();
  await expect.poll(titles).toHaveLength(4);
  await items.nth(3).getByRole('button', { name: 'Move item up' }).click();
  await items.nth(0).getByRole('button', { name: 'Duplicate item' }).click();
  await items.nth(1).getByRole('button', { name: 'Delete item' }).click();
  await expect.poll(titles).toHaveLength(4);
  for (let i = 0; i < 4; i++) await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(titles).toEqual(start);
});

test('a theme color change restyles the canvas and shows a contrast warning', async ({ page }) => {
  const frame = await heroAndCarousel(page);
  await page.getByRole('button', { name: 'Page settings' }).click();
  await page.getByLabel('Primary', { exact: true }).fill('#FDE047');
  await expect(page.getByTestId('contrast-onPrimary-primary')).toContainText('too low for text');
  await expect(frame.locator('.lp-hero .lp-btn--primary')).toHaveCSS('background-color', 'rgb(253, 224, 71)');
});

test('the hero button can target a section, and UTM parameters are appended to web links', async ({ page }) => {
  const frame = await heroAndCarousel(page);
  await selectBlock(page, 'hero');
  const cta = page.getByRole('group', { name: 'Primary button' });
  await cta.getByLabel('Link type').selectOption('section');
  await cta.getByLabel('Section').selectOption({ label: 'Section 2 · Product Carousel' });
  await expect(frame.locator('.lp-hero .lp-btn--primary')).toHaveAttribute('href', /^#s-[a-z0-9]{10}$/);
  await cta.getByLabel('Link type').selectOption('url');
  await cta.getByLabel('Address').fill('https://wa.me/62812');
  await cta.getByText('UTM parameters').click();
  await cta.getByLabel('Source').fill('meta');
  await expect(frame.locator('.lp-hero .lp-btn--primary')).toHaveAttribute('href', 'https://wa.me/62812?utm_source=meta');
});

test('block style hides a block on mobile only', async ({ page }) => {
  const frame = await heroAndCarousel(page);
  await selectBlock(page, 'hero');
  await page.getByRole('tab', { name: 'Style' }).click();
  await page.getByLabel('Hide on').selectOption('mobile');
  await expect(frame.locator('[data-lp-type="hero"]')).toBeHidden();
  await page.getByRole('radio', { name: 'Desktop' }).check();
  await expect(frame.locator('[data-lp-type="hero"]')).toBeVisible();
});

test('an item image from a URL appears in the canvas and asks for alt text', async ({ page }) => {
  const frame = await heroAndCarousel(page);
  const first = page.getByRole('list', { name: 'Items' }).getByRole('listitem').first();
  await first.getByRole('button', { expanded: false }).first().click();
  await first.getByLabel('Image address').fill(svgPlaceholder('Biru', '#1D4ED8'));
  await expect(first.getByText('Describe the image for screen readers')).toBeVisible();
  await expect(frame.locator('.lp-card__img').first()).toHaveAttribute('src', /^data:image\/svg\+xml/);
  await expect(saveStatus(page)).toHaveText('Saved');
});
```

- [ ] **Step 2: Run the tests and make sure they fail.**
  - Run: `pnpm test:e2e:app`
  - Expected: FAIL; the right pane is empty.
- [ ] **Step 3: Implement** the panels, the controls and `useFieldDraft`, following the UI contract.
- [ ] **Step 4: Run the tests and make sure they pass.**
  - Run: `pnpm test:e2e:app && pnpm typecheck && pnpm lint`
  - Expected: PASS.
- [ ] **Step 5: Commit.**

```bash
git add components tests/e2e/app package.json pnpm-lock.yaml
git commit -m "feat(inspector): generated block, section and page panels with list, link, image and color controls"
```

---

### Task 17: Exit journey, performance fixture, CI and docs

**Files:**
- Create: `tests/fixtures/perf-document.ts`, `tests/e2e/app/editor-journey.spec.ts`, `tests/e2e/app/editor-perf.spec.ts`, `scripts/write-env-local.ts`, `scripts/write-env-local.test.ts`
- Modify: `.github/workflows/ci.yml`, `package.json` (script `"env:local": "tsx scripts/write-env-local.ts"`), `CLAUDE.md`, `README.md`, `docs/PLAN.md`, `docs/DECISIONS.md` (append D-041)

**Interfaces:**
- Produces:
  - `perfDocument(): unknown`. This is raw JSON with exactly 40 blocks in 40 sections:
    - a hero first, then 12 × [benefits, testimonials, faq];
    - two product carousels with 20 items each, at block positions 10 and 30;
    - a footer last.

    Ids are deterministic and images are `svgPlaceholder(...)`.
  - `envFromStatus(status: Record<string, string>, example: string): string` in `scripts/write-env-local.ts`. It fills the `.env.example` lines:
    - `NEXT_PUBLIC_SUPABASE_URL` ← `API_URL`;
    - `NEXT_PUBLIC_SUPABASE_ANON_KEY` ← `PUBLISHABLE_KEY ?? ANON_KEY`;
    - `SUPABASE_SERVICE_ROLE_KEY` ← `SECRET_KEY ?? SERVICE_ROLE_KEY`.

    It keeps every other line and throws when a value is missing. `main()` runs `pnpm supabase status -o json` and writes `.env.local`. It refuses to overwrite an existing `.env.local` without `--force`.

- [ ] **Step 1: Write the failing tests.**

`scripts/write-env-local.test.ts`:

```ts
import { expect, it } from 'vitest';
import { envFromStatus } from './write-env-local';

const example = 'NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321\nNEXT_PUBLIC_SUPABASE_ANON_KEY=\nSUPABASE_SERVICE_ROLE_KEY=\nAI_MODEL=claude-opus-5-5\n';
it('fills the Supabase values and keeps the rest', () => {
  expect(envFromStatus({ API_URL: 'http://127.0.0.1:54321', PUBLISHABLE_KEY: 'sb_publishable_x', SECRET_KEY: 'sb_secret_y' }, example))
    .toBe('NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321\nNEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_x\nSUPABASE_SERVICE_ROLE_KEY=sb_secret_y\nAI_MODEL=claude-opus-5-5\n');
  expect(envFromStatus({ API_URL: 'u', ANON_KEY: 'a', SERVICE_ROLE_KEY: 's' }, example)).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY=a');
});
it('throws when a key is missing', () => expect(() => envFromStatus({ API_URL: 'u' }, example)).toThrow(/ANON_KEY/));
```

`tests/e2e/app/editor-journey.spec.ts` (the M2a exit criterion):

```ts
import { expect, test } from '@playwright/test';
import { addBlock, blockTypes, canvas, ensureOwner, resetOwnerPages, saveStatus, signIn } from './helpers';

test.beforeAll(ensureOwner);
test.beforeEach(async ({ page }) => {
  await resetOwnerPages();
  await signIn(page);
});

test('create → add Hero and Carousel → edit → reorder items and blocks → undo/redo all → reload keeps the draft', async ({ page }) => {
  test.setTimeout(120_000);
  await page.getByRole('button', { name: 'New page' }).click();
  await page.getByLabel('Name').fill('Journey');
  await page.getByRole('button', { name: 'Create page' }).click();
  await expect(page).toHaveURL(/\/editor\//, { timeout: 20_000 });
  const frame = canvas(page);
  // allTextContents() never waits, so polling an empty page stays fast.
  const state = async () => ({
    types: await blockTypes(frame),
    headlines: await frame.locator('h1, h2.lp-h1').allTextContents(),
    cards: await frame.locator('.lp-card__title').allTextContents(),
  });
  const steps = [await state()];
  const step = async () => steps.push(await state());

  await addBlock(page, 'Hero'); await step();
  await addBlock(page, 'Product Carousel'); await step();
  await canvas(page).locator('[data-lp-type="hero"]').click({ position: { x: 8, y: 8 } });
  await page.getByLabel('Headline').fill('Botol anti bocor'); await step();
  await canvas(page).locator('[data-lp-type="product-carousel"]').click({ position: { x: 8, y: 8 } });
  await page.getByRole('list', { name: 'Items' }).getByRole('listitem').nth(2).getByRole('button', { name: 'Move item up' }).click(); await step();
  await page.getByRole('toolbar', { name: 'Block actions' }).getByRole('button', { name: 'Move up' }).click(); await step();

  for (let i = steps.length - 2; i >= 0; i--) {
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect.poll(state).toEqual(steps[i]);
  }
  for (let i = 1; i < steps.length; i++) {
    await page.getByRole('button', { name: 'Redo' }).click();
    await expect.poll(state).toEqual(steps[i]);
  }
  await expect(saveStatus(page)).toHaveText('Saved');
  await page.reload();
  await expect.poll(state, { timeout: 20_000 }).toEqual(steps.at(-1));
});
```

`tests/e2e/app/editor-perf.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { perfDocument } from '@/tests/fixtures/perf-document';
import { ensureOwner, openEditor, resetOwnerPages, seedPage, signIn } from './helpers';

test.beforeAll(ensureOwner);
test.beforeEach(async ({ page }) => {
  await resetOwnerPages();
  await signIn(page);
});

test('a 40-block page with two 20-item carousels stays responsive while typing', async ({ page }) => {
  test.setTimeout(120_000);
  const frame = await openEditor(page, await seedPage({ name: 'Perf', document: perfDocument() }));
  await expect(frame.locator('[data-lp-block]')).toHaveCount(40, { timeout: 30_000 });
  const carousel = frame.locator('[data-lp-type="product-carousel"]').nth(1);
  await carousel.scrollIntoViewIfNeeded();
  await carousel.click({ position: { x: 8, y: 8 } });
  await expect(page.getByTestId('canvas-selection')).toContainText('Product Carousel');
  await page.evaluate(() => { (window as unknown as { __lpCanvasMetrics: { syncLatencies: number[] } }).__lpCanvasMetrics.syncLatencies = []; });
  const heading = page.getByLabel('Heading');
  await heading.click();
  await heading.press('End');
  const typed = ' tiga puluh karakter tambahan!';
  await heading.pressSequentially(typed, { delay: 25 });
  await expect(carousel.locator('h2')).toContainText(typed.trim(), { timeout: 1000 });
  const latencies = await page.evaluate(() => (window as unknown as { __lpCanvasMetrics: { syncLatencies: number[] } }).__lpCanvasMetrics.syncLatencies);
  const sorted = [...latencies].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)]!;
  expect(sorted.length).toBeGreaterThan(5);
  expect(p95).toBeLessThan(100);
  expect(sorted.at(-1)!).toBeLessThan(250);
});
```

- [ ] **Step 2: Run the tests and make sure they fail.**
  - Run: `pnpm exec vitest run scripts/write-env-local.test.ts && pnpm test:e2e:app`
  - Expected: FAIL (the module and the fixture are missing). The journey test may already pass. That is fine: it is the exit gate, not a red step.
- [ ] **Step 3: Implement** `perf-document.ts` and `write-env-local.ts`, and add the `env:local` script.
- [ ] **Step 4: Update CI** (`.github/workflows/ci.yml`).
  - At the end of the `checks` job, add a build with placeholder public env (not secret; `next build` only inlines them):

```yaml
      - run: pnpm build
        env:
          NEXT_PUBLIC_SUPABASE_URL: http://127.0.0.1:54321
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ci-placeholder-anon-key-not-a-secret
```

  - Add the job:

```yaml
  e2e-app:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm db:start
      - run: pnpm env:local
      - run: pnpm test:e2e:app
```

  Without a GitHub remote these jobs cannot run yet (PLAN §9). Say so in the final report.
- [ ] **Step 5: Update the docs.**
  - **`CLAUDE.md`:**
    - Add `pnpm env:local [--force]` under Commands.
    - Change Local setup step 3 to `pnpm env:local`.
    - Add these rules:
      - "Route handlers call `getApiUser()` and return `unauthorizedResponse()` when it is null."
      - "Editor logic lives in `lib/editor` (pure, unit-tested); `components/editor` only binds it to React."
      - "The canvas iframe is `sandbox="allow-scripts"` only, and every message from it is untrusted (D-039)."
      - "App e2e tests run serially against the one owner account and reset its pages."
  - **`README.md`:** replace the stock Next.js text with what LaunchPad is (two lines), quick start (setup steps 1–4 from `CLAUDE.md`) and pointers to `CLAUDE.md`, `docs/PRD.md`, `docs/PLAN.md` and `docs/DECISIONS.md` (m-12).
  - **`docs/PLAN.md`:**
    - §7: replace `@tailwindcss/postcss` with `@tailwindcss/turbopack`, and give the exact pins `zustand@5.0.15` and `immer@11.1.21`.
    - §10: set the M2a row to "Done" and the M2b row to "Next".
  - **`docs/DECISIONS.md`:**

```markdown
## D-041 AGENTS.md stays committed — Accepted
`next dev` writes AGENTS.md (Next.js's agent rules: read `node_modules/next/dist/docs/` before using an API). Removing it only brings the file back as an uncommitted change, so it stays committed; CLAUDE.md remains the project's own guide (M0/M1 review m-12).
```

- [ ] **Step 6: The full milestone gate.**
  - Run: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm assets:check && pnpm build && pnpm db:test && pnpm test:e2e && pnpm test:e2e:app`
  - Expected: every command exits 0. `editor-perf.spec.ts` reports p95 < 100 ms. The journey passes.
- [ ] **Step 7: Commit.**

```bash
git add tests scripts .github package.json CLAUDE.md README.md docs
git commit -m "test(e2e): M2a editor journey and 40-block performance budget; CI builds and runs app e2e"
```

---

## After M2a: what the M2b plan covers

M2b is written once this branch is merged, using D-034's numbers and the protocol in D-039:
1. **Drag and drop engine** (pointer events, cached-rect hit-testing, drag shield, auto-scroll, touch long-press, insertion marker, `aria-live` announcements):
   - palette → canvas;
   - reorder within and across sections, with new commands `insertBlockAt` and `moveBlockTo`;
   - deleting `spikes/`.
2. **Drag reorder in the list control** (carousel items) on the same engine.
3. **Inline text editing in the canvas:** `data-lp-field` markers in preview mode only, `contenteditable` limited to b/i/mark/a/br, serialized back to the inline markup (D-009), each edit one coalesced command.
4. **Uploads (D-008):** a Storage bucket and RLS migration with pgTAP tests, direct browser upload, a `sharp` route that writes WebP variants at 1600 and 800 px (quality 80) and an `assets` row, and an upload button in the image control.
5. **The full M2 exit e2e:** create page → add Hero/Carousel *by drag* → edit inline and in the inspector → reorder items and blocks by drag → undo/redo every step → reload keeps the draft.
