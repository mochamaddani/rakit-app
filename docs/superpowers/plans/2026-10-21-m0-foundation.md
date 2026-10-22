# M0 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Next.js 16 app with a strict toolchain, CI, a local Supabase database whose every table is protected by RLS, and working owner-only email/password authentication.

**Architecture:** Next.js App Router at the repo root (no `src/`), TypeScript strict, Tailwind + shadcn for the editor UI only. Supabase (local stack via the CLI) provides Postgres, Auth and Storage. `proxy.ts` refreshes the session and applies a pure, default-deny routing decision. Server code re-checks auth with `requireUser()`. RLS policies call `public.is_workspace_member()`, so adding multi-user later only changes that one function.

**Tech Stack:** Node 24, pnpm 12.14.0, Next.js 16.4.2, React 19, TypeScript 5.x, Tailwind 4, shadcn CLI 4.22.1, Zod 4.6.7, Vitest 5.0.5, Playwright 1.64.1, Supabase CLI 2.121.0, `@supabase/supabase-js` 2.118.0, `@supabase/ssr` 0.12.7.

**Spec:** `docs/PRD.md` (§3, §4, §7, §8 Security, §10 M0, §12), with decisions in `docs/PLAN.md` and `docs/DECISIONS.md` (D-002…D-006, D-026, D-027).

## Global Constraints

- Node `>=24` (`.nvmrc` = `24`); `"packageManager": "pnpm@12.14.0"`; dependency build scripts are allowed only through `allowBuilds` in `pnpm-workspace.yaml`.
- TypeScript `strict: true`, plus `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`.
- `.env.example` lists exactly: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_BASE_DOMAIN`, `ANTHROPIC_API_KEY`, `AI_MODEL`, `VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID` (plus the e2e-only `E2E_OWNER_EMAIL`, `E2E_OWNER_PASSWORD`).
- No page-builder, DnD or carousel framework in `package.json` (banned list in `docs/PLAN.md` §7).
- Every table in `public` has RLS enabled. Access is scoped by `workspace_id` through `public.is_workspace_member(uuid)`.
- Auth applies to every editor route and API, by default-deny: only `/login`, `/auth`, `/p`, `/api/public` are public. Every server action and route handler calls `requireUser()`.
- Secrets only in env. The service-role/secret key is never imported by code that can reach the browser.
- Next.js 16 conventions: `proxy.ts` (not `middleware.ts`), and `await cookies()`.
- Public sign-ups are disabled. The owner is created with `pnpm owner:create`.
- Commits are small, in conventional style (`feat:`, `fix:`, `test:`, `chore:`, `docs:`, `ci:`).

## Review Focus

Failure modes this milestone implies. Each one is pinned by the named test in its owning task.

1. **Someone other than the owner registers with the public key.** Expect: sign-up refused. Test: `public sign-up is disabled` (Task 5).
2. **A forged or tampered session cookie.** Expect: treated as signed out and sent to `/login`. Test: `a tampered session cookie is rejected` (Task 5).
3. **A future migration adds a table without RLS.** Expect: the DB test suite fails. Test: `every public table has RLS enabled` (Task 3).
4. **An anonymous `fetch` to an API route gets an HTML redirect instead of a 401.** Expect: JSON 401. Tests: `answers anonymous API requests with unauthorized` (Task 4) and `API routes answer 401 instead of redirecting` (Task 5).
5. **The `next` parameter used as an open redirect** (`//evil`, `https://evil`, `/\evil`). Expect: falls back to `/dashboard`. Tests: the `safeNextPath` table (Task 4) and `sign-in returns to a safe next path but never off-site` (Task 5).

## Prerequisites (owner actions)

- [ ] Approve making Node 24 the nvm default (`nvm alias default 24`), so every new shell, including Claude Code's, uses it.
- [ ] Start Docker Desktop before Task 3.

---

### Task 1: Scaffold the app, toolchain and repo docs

**Files:**
- Create: `.nvmrc`, `.prettierrc.json`, `.prettierignore`, `.env.example`, `CLAUDE.md`
- Create (scaffolder): `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`, `next-env.d.ts`, `.gitignore`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `app/favicon.ico`, `public/*`
- Modify: `package.json`, `tsconfig.json`, `eslint.config.mjs`, `.gitignore`, `app/layout.tsx`, `app/page.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: scripts `dev`, `build`, `start`, `lint`, `typecheck`, `format`, `format:check`; path alias `@/*` → repo root.

- [ ] **Step 1: Activate Node 24 and pnpm 12**

```bash
source ~/.nvm/nvm.sh && nvm install 24 && nvm alias default 24 && node -v
npm install -g pnpm@12.14.0 && pnpm -v
```
Expected: `v24.…` and `12.14.0`.

- [ ] **Step 2: Initialize git and commit the planning docs**

```bash
git init -b main
git add docs
git commit -m "docs: add PRD, milestone plan, decisions log and M0/M1 plans"
```

- [ ] **Step 3: Scaffold Next.js into the repo root**

```bash
pnpm create next-app@16.4.2 . --ts --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-pnpm --no-react-compiler --no-cache-components --no-agents-md --disable-git --yes
```
Expected: "Success! Created rakit-app". `pnpm-workspace.yaml` exists with `allowBuilds` (`sharp: false`, `unrs-resolver: false`). `docs/` is on the scaffolder's list of pre-existing files it accepts. If it still refuses, scaffold into `$TMPDIR/lp-scaffold` with the same flags and move every file (including dotfiles) into the repo root.

- [ ] **Step 4: Verify the untouched scaffold**

Run: `pnpm build && pnpm lint`
Expected: "✓ Compiled successfully", and both exit 0.

- [ ] **Step 5: Apply project settings**

- `.nvmrc`: `24`
- `package.json`: add `"packageManager": "pnpm@12.14.0"`, `"engines": { "node": ">=24" }`, and the scripts `"lint": "eslint ."`, `"typecheck": "tsc --noEmit"`, `"format": "prettier --write ."`, `"format:check": "prettier --check ."` (keep `dev`, `build`, `start`).
- `tsconfig.json` `compilerOptions`: add `"noUncheckedIndexedAccess": true`, `"noImplicitOverride": true`, `"noFallthroughCasesInSwitch": true`.
- `pnpm add -D prettier@3.9.10 eslint-config-prettier@10.1.8`.
- `.prettierrc.json`: `{ "singleQuote": true, "semi": true, "printWidth": 100, "trailingComma": "all" }`.
- `.prettierignore`: `pnpm-lock.yaml`, `.next`, `out`, `test-results`, `playwright-report`, `supabase/.temp`, `**/*.generated.ts`, `lib/supabase/database.types.ts`.
- `eslint.config.mjs`: `import prettier from 'eslint-config-prettier/flat';` and append `prettier` as the last config entry.
- `.gitignore`: append `!.env.example`, `/out`, `/test-results`, `/playwright-report`. The scaffold ignores `.env*`; the exception keeps the example committed.
- `app/layout.tsx`: `metadata = { title: 'LaunchPad', description: 'Landing pages for ad tests' }`, `<html lang="en">`.
- `app/page.tsx`: a server component returning `<main><h1>LaunchPad</h1></main>`. Task 5 turns `/` into a redirect.
- Run `pnpm format`.

- [ ] **Step 6: Write `.env.example`**

```bash
# Supabase. Local values: `pnpm supabase status -o env` (API_URL, PUBLISHABLE_KEY or ANON_KEY, SECRET_KEY or SERVICE_ROLE_KEY)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
# Publishable key (sb_publishable_…) or legacy anon key
NEXT_PUBLIC_SUPABASE_ANON_KEY=
# Secret key (sb_secret_…) or legacy service_role key. Server and scripts only; never expose to the browser.
SUPABASE_SERVICE_ROLE_KEY=

# Domain that serves hosted pages (optional hosting, M7). Must NOT be the editor's domain.
APP_BASE_DOMAIN=

# Claude API for the AI wizard and HTML import (M5/M6). Server-side only.
ANTHROPIC_API_KEY=
AI_MODEL=claude-opus-5-5

# Optional hosting only (M7)
VERCEL_API_TOKEN=
VERCEL_PROJECT_ID=
VERCEL_TEAM_ID=

# Local end-to-end tests (Playwright app project)
E2E_OWNER_EMAIL=owner@launchpad.test
E2E_OWNER_PASSWORD=correct-horse-battery-1
```

- [ ] **Step 7: Write `CLAUDE.md`**

````markdown
# LaunchPad (repo: rakit-app)

Landing-page builder for ad tests: a custom editor produces a PageDocument (JSON); a pure renderer turns it into one self-contained `.html` file.
Spec: `docs/PRD.md` · Plan: `docs/PLAN.md` · Decisions: `docs/DECISIONS.md` · Task plans: `docs/superpowers/plans/`.

## Commands
- `pnpm dev` / `pnpm build` / `pnpm start`
- `pnpm lint` · `pnpm typecheck` · `pnpm format` · `pnpm test` (Vitest: unit, snapshots, policy checks)
- `pnpm db:start` / `pnpm db:stop` / `pnpm db:reset` / `pnpm db:test` (pgTAP RLS tests) / `pnpm db:types`
- `pnpm test:e2e:app` (Playwright against the running app; needs `pnpm db:start` and `.env.local`)
- `pnpm owner:create --email <email> --password <password>`

## Local setup
1. Node 24 (`.nvmrc`) and pnpm 12. Run `pnpm install`.
2. Start Docker Desktop, then `pnpm db:start`.
3. Copy `.env.example` to `.env.local`; fill the Supabase values from `pnpm supabase status -o env`.
4. `pnpm owner:create --email … --password …`, then `pnpm dev`.

## Rules
- No page-builder, drag-and-drop or carousel frameworks (enforced by `tests/unit/dependency-policy.test.ts`; list in `docs/PLAN.md` §7).
- Next.js 16: session refresh lives in `proxy.ts`. Every server action / route handler still calls `requireUser()`.
- New routes are protected by default; public prefixes live in `lib/auth/routing.ts`.
- Every new table: enable RLS, write policies with `public.is_workspace_member(workspace_id)`, add pgTAP tests under `supabase/tests/`.
- Secrets only in env. Never import the service-role key in code that can reach the browser.
- Unit tests sit next to the code as `*.test.ts`; e2e tests live in `tests/e2e/{renderer,app}`.
- Small conventional commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`, `ci:`).
````

- [ ] **Step 8: Verify**

Run: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm build`
Expected: all exit 0.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 16 app with strict TypeScript, Tailwind, ESLint and Prettier"
```

---

### Task 2: Unit-test harness, dependency policy guard and CI

**Files:**
- Create: `vitest.config.ts`, `scripts/policy/banned-deps.ts`, `tests/unit/dependency-policy.test.ts`, `.github/workflows/ci.yml`
- Modify: `package.json`

**Interfaces:**
- Consumes: Task 1 scripts.
- Produces: `pnpm test` / `pnpm test:watch`. `BANNED_DEPENDENCIES: readonly string[]` (exact names or `prefix*` globs) and `findBannedDependencies(pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }): string[]` (sorted, unique) in `scripts/policy/banned-deps.ts`. CI job `checks`.

- [ ] **Step 1: Install Vitest and configure it**

`pnpm add -D vitest@5.0.5`. Add scripts `"test": "vitest run"`, `"test:watch": "vitest"`. Then create `vitest.config.ts`:

```ts
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [{ find: /^@\//, replacement: fileURLToPath(new URL('./', import.meta.url)) }],
  },
  test: {
    environment: 'node',
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['node_modules/**', '.next/**', 'tests/e2e/**', 'out/**'],
  },
});
```

- [ ] **Step 2: Write the failing test**

`tests/unit/dependency-policy.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { findBannedDependencies } from '@/scripts/policy/banned-deps';

describe('dependency policy (PRD AC3: no page-builder, DnD or carousel frameworks)', () => {
  it('flags banned packages, including scoped families and prefixes', () => {
    expect(
      findBannedDependencies({
        dependencies: { grapesjs: '1', react: '19', '@dnd-kit/core': '6', 'grapesjs-preset-webpage': '1' },
        devDependencies: { '@builder.io/sdk': '1', 'embla-carousel-react': '8', zod: '4' },
      }),
    ).toEqual(['@builder.io/sdk', '@dnd-kit/core', 'embla-carousel-react', 'grapesjs', 'grapesjs-preset-webpage']);
  });

  it('package.json contains no banned dependency', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(findBannedDependencies(pkg)).toEqual([]);
  });
});
```

- [ ] **Step 3: Run it to make sure it fails**

Run: `pnpm test tests/unit/dependency-policy.test.ts`
Expected: FAIL, because `@/scripts/policy/banned-deps` cannot be resolved.

- [ ] **Step 4: Implement `findBannedDependencies` in `scripts/policy/banned-deps.ts`**

`BANNED_DEPENDENCIES` is exactly the banned list in `docs/PLAN.md` §7. A trailing `*` means prefix match (`@dnd-kit/*`, `grapesjs*`, `react-dnd*`, `embla-carousel*`, `@atlaskit/pragmatic-drag-and-drop*`); every other entry must match exactly. The function checks the names in `dependencies` and `devDependencies` and returns them sorted and de-duplicated.

- [ ] **Step 5: Run it to make sure it passes**

Run: `pnpm test`
Expected: PASS (2 tests).

- [ ] **Step 6: Add the CI workflow**

`.github/workflows/ci.yml`:

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm format:check
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
```

- [ ] **Step 7: Verify locally**

Run: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test`
Expected: all exit 0.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "test: add Vitest, dependency policy guard and CI checks"
```

---

### Task 3: Local Supabase, core schema with RLS and pgTAP tests

**Files:**
- Create: `supabase/config.toml` (via `supabase init`), `supabase/migrations/<timestamp>_core_schema.sql`, `supabase/tests/rls_core.test.sql`, `lib/supabase/database.types.ts` (generated), `.env.local` (not committed)
- Modify: `package.json`, `pnpm-workspace.yaml`, `.github/workflows/ci.yml`, `CLAUDE.md` (only if commands changed)

**Interfaces:**
- Consumes: Task 2 CI file.
- Produces (SQL):
  - `public.workspaces(id uuid pk, name text, owner_id uuid → auth.users, created_at)`
  - `public.pages(id, workspace_id, name, slug, status, tags text[], current_draft jsonb, schema_version int, latest_version_id uuid null, created_at, updated_at)`, unique `(workspace_id, slug)`
  - `public.page_versions(id, page_id, document jsonb, html_path text, export_settings jsonb, byte_size int, html_sha256 text, kind text, note text, created_at)`, immutable
  - `public.templates(id, workspace_id uuid null, name, document jsonb, thumbnail_url text null, created_at, updated_at)`
  - `public.assets(id, workspace_id, path text unique, mime text, width int null, height int null, size int, created_at)`
  - `public.is_workspace_member(ws uuid) returns boolean`
  - Trigger `on_auth_user_created` → one workspace per new user.
- Produces (TS): `Database` type exported from `lib/supabase/database.types.ts`.
- Produces scripts: `db:start`, `db:stop`, `db:reset`, `db:test`, `db:types`.

- [ ] **Step 1: Install the Supabase CLI as a dev dependency**

Add `supabase: true` under `allowBuilds` in `pnpm-workspace.yaml` (its postinstall downloads the binary), then:
```bash
pnpm add -D supabase@2.121.0 && pnpm supabase --version
```
Expected: `2.121.0`.

- [ ] **Step 2: Initialize the project and disable sign-ups**

`pnpm supabase init` (decline the VS Code/IntelliJ settings). In `supabase/config.toml`, set `enable_signup = false` under `[auth]`, and also under `[auth.email]` if that key exists. Add the scripts `"db:start": "supabase start"`, `"db:stop": "supabase stop"`, `"db:reset": "supabase db reset"`, `"db:test": "supabase test db"`, `"db:types": "supabase gen types typescript --local > lib/supabase/database.types.ts"`.

- [ ] **Step 3: Start the local stack and write `.env.local`**

With Docker Desktop running: `pnpm db:start`, then `pnpm supabase status -o env`. Write `.env.local` from `.env.example`: `NEXT_PUBLIC_SUPABASE_URL` = `API_URL`; `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `PUBLISHABLE_KEY` (or `ANON_KEY` if absent); `SUPABASE_SERVICE_ROLE_KEY` = `SECRET_KEY` (or `SERVICE_ROLE_KEY`).

- [ ] **Step 4: Write the failing RLS test**

`supabase/tests/rls_core.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- Fixtures: two users; the trigger must give each one a workspace.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@launchpad.test'),
  ('22222222-2222-2222-2222-222222222222', 'b@launchpad.test');

select is_empty(
  $$ select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity $$,
  'every public table has RLS enabled');

select results_eq(
  $$ select count(*)::int from public.workspaces
     where owner_id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222') $$,
  $$ values (2) $$,
  'a workspace is created for each new user');

create temp table ws as select owner_id, id from public.workspaces;
grant select on ws to authenticated;

-- As user A
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select lives_ok(
  $$ insert into public.pages (workspace_id, name, slug, current_draft, schema_version)
     select id, 'A page', 'a-page', '{"schemaVersion":1}'::jsonb, 1 from ws
     where owner_id = '11111111-1111-1111-1111-111111111111' $$,
  'A can create a page in their workspace');
select results_eq($$ select count(*)::int from public.pages $$, $$ values (1) $$, 'A sees their page');
select lives_ok(
  $$ insert into public.page_versions (page_id, document, html_path, byte_size, html_sha256, kind)
     select id, current_draft, 'v/a-page/1.html', 10, repeat('0', 64), 'export' from public.pages where slug = 'a-page' $$,
  'A can record a version of their page');
select lives_ok(
  $$ insert into public.assets (workspace_id, path, mime, size)
     select id, id::text || '/a.webp', 'image/webp', 100 from ws
     where owner_id = '11111111-1111-1111-1111-111111111111' $$,
  'A can register an asset');
select lives_ok(
  $$ insert into public.templates (workspace_id, name, document)
     select id, 'A template', '{}'::jsonb from ws
     where owner_id = '11111111-1111-1111-1111-111111111111' $$,
  'A can save a template');
select throws_ok(
  $$ insert into public.pages (workspace_id, name, slug, current_draft, schema_version)
     select id, 'X', 'x', '{}'::jsonb, 1 from ws
     where owner_id = '22222222-2222-2222-2222-222222222222' $$,
  '42501', null, 'A cannot create a page in B''s workspace');
select throws_ok(
  $$ insert into public.pages (workspace_id, name, slug, current_draft, schema_version)
     select id, 'Bad', 'Bad Slug', '{}'::jsonb, 1 from ws
     where owner_id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null, 'slugs must be lowercase kebab-case');

-- As user B
set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select is_empty($$ select 1 from public.pages $$, 'B cannot see A''s pages');
select is_empty($$ select 1 from public.page_versions $$, 'B cannot see A''s versions');
select is_empty($$ select 1 from public.assets $$, 'B cannot see A''s assets');
select is_empty($$ select 1 from public.templates where workspace_id is not null $$, 'B cannot see A''s templates');
select is_empty($$ update public.pages set name = 'hacked' returning 1 $$, 'B cannot update A''s pages');
select is_empty($$ delete from public.pages returning 1 $$, 'B cannot delete A''s pages');
select results_eq($$ select count(*)::int from public.workspaces $$, $$ values (1) $$, 'B sees only their own workspace');
select is(
  public.is_workspace_member((select id from ws where owner_id = '11111111-1111-1111-1111-111111111111')),
  false, 'is_workspace_member is false for someone else''s workspace');

-- Back to A
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select throws_ok($$ update public.page_versions set note = 'changed' $$, '42501', null,
  'versions cannot be updated through the API (no UPDATE privilege)');
select lives_ok($$ update public.pages set name = 'Renamed' where slug = 'a-page' $$, 'A can update their page');
select is((select name from public.pages where slug = 'a-page'), 'Renamed', 'the update is applied');

-- Built-in templates (workspace_id is null) are shared and read-only
reset role;
insert into public.templates (workspace_id, name, document) values (null, 'Built-in', '{}'::jsonb);
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select results_eq($$ select count(*)::int from public.templates where workspace_id is null $$, $$ values (1) $$,
  'built-in templates are visible');
select is_empty($$ update public.templates set name = 'x' where workspace_id is null returning 1 $$,
  'built-in templates are read-only');

-- Anonymous role has no table privileges at all
reset role;
set local role anon;
select throws_ok($$ select 1 from public.pages $$, '42501', null, 'anon cannot read pages');

-- Versions are immutable even for privileged roles
reset role;
select throws_ok($$ update public.page_versions set note = 'x' $$, 'P0001', 'page_versions are immutable',
  'page_versions reject updates even from privileged roles');

select * from finish();
rollback;
```

- [ ] **Step 5: Run it to make sure it fails**

Run: `pnpm db:test`
Expected: FAIL. The relations `public.workspaces` and others do not exist yet.

- [ ] **Step 6: Write the migration**

`pnpm supabase migration new core_schema`, then fill the file:
- **Tables** as listed under Interfaces, using these exact columns and constraints:
  - Primary keys: `uuid primary key default gen_random_uuid()`.
  - `workspaces`: `name` 1–80 chars; `owner_id` FK to `auth.users` with `on delete cascade`.
  - `pages`: `name` 1–120 chars; `slug` matches `^[a-z0-9]+(-[a-z0-9]+)*$` and is ≤ 80 chars; `status` default `'draft'`, checked against `('draft','exported','live','archived')`; `tags` default `'{}'`; `schema_version >= 1`; `created_at`/`updated_at` default `now()`.
  - `page_versions`: `html_sha256` matches `^[0-9a-f]{64}$`; `kind` in `('export','publish')`; `export_settings` default `'{}'`; `byte_size >= 0`.
  - `assets`: `mime` matches `^image/`; `size >= 0`.
  - Foreign keys use `on delete cascade` to the parent row; `pages.latest_version_id` → `page_versions(id)` uses `on delete set null`, added after both tables exist.
- **Indexes**: `workspaces(owner_id)`, `pages(workspace_id, updated_at desc)`, `pages using gin (tags)`, `page_versions(page_id, created_at desc)`, `assets(workspace_id)`, `templates(workspace_id)`.
- **Functions**, all with `set search_path = ''`:
  - `is_workspace_member(ws uuid)`: `language sql stable security definer`; returns `exists(select 1 from public.workspaces w where w.id = ws and w.owner_id = (select auth.uid()))`.
  - `set_updated_at()`: trigger, `before update` on `pages` and `templates`.
  - `reject_update()`: raises `'% are immutable', tg_table_name`; `before update` trigger on `page_versions`.
  - `handle_new_user()`: `security definer`; inserts `('My workspace', new.id)` into `public.workspaces`; trigger `on_auth_user_created` `after insert on auth.users`.
- **Privileges**: Supabase's default privileges grant everything to `anon` and `authenticated`, so first `revoke all` on the five tables `from anon, authenticated`. Then grant to `authenticated` exactly:
  - `select` on `workspaces`;
  - `select, insert, update, delete` on `pages`, `templates`, `assets`;
  - `select, insert` on `page_versions` (so an UPDATE attempt fails with 42501).
- **RLS**: `enable row level security` on all five tables, then these policies, all `to authenticated`:
  - `workspaces`: select `using (owner_id = (select auth.uid()))`.
  - `pages`: `for all`, with `using` and `with check` both `public.is_workspace_member(workspace_id)`.
  - `page_versions`: select and insert where `exists (select 1 from public.pages p where p.id = page_id and public.is_workspace_member(p.workspace_id))`.
  - `templates`: select `using (workspace_id is null or public.is_workspace_member(workspace_id))`. Insert, update and delete only where `workspace_id is not null and public.is_workspace_member(workspace_id)`; this applies to `using` and to `with check`.
  - `assets`: `for all` with `public.is_workspace_member(workspace_id)`.

- [ ] **Step 7: Apply it and run the tests**

Run: `pnpm db:reset && pnpm db:test`
Expected: PASS, `rls_core.test.sql .. ok`, all 24 tests.

- [ ] **Step 8: Generate the database types**

Run: `pnpm db:types && pnpm typecheck`
Expected: `lib/supabase/database.types.ts` exports `Database`, and the typecheck exits 0.

- [ ] **Step 9: Add the CI database job**

Append to `.github/workflows/ci.yml`:

```yaml
  db:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm db:start
      - run: pnpm db:test
```

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(db): core schema with workspace-scoped RLS, pgTAP tests and generated types"
```

---

### Task 4: Env validation, auth routing rules, Supabase clients and `proxy.ts`

**Files:**
- Create: `lib/env.ts`, `lib/env.test.ts`, `lib/auth/routing.ts`, `lib/auth/routing.test.ts`, `lib/supabase/server.ts`, `lib/supabase/client.ts`, `lib/supabase/proxy.ts`, `proxy.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `Database` from `lib/supabase/database.types.ts` (Task 3).
- Produces:
  - `class EnvError extends Error`; `interface PublicEnv { supabaseUrl: string; supabaseAnonKey: string }`
  - `readPublicEnv(source: Record<string, string | undefined>): PublicEnv`. Throws `EnvError` naming every missing or invalid variable.
  - `publicEnv(): PublicEnv`. Calls `readPublicEnv` with **literal** `process.env.NEXT_PUBLIC_SUPABASE_URL` / `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY` reads, because Next.js only inlines literal reads into client bundles.
  - `PUBLIC_PATH_PREFIXES = ['/login', '/auth', '/p', '/api/public'] as const`
  - `isPublicPath(pathname: string): boolean`. Matches on path-segment boundaries.
  - `safeNextPath(next: string | null | undefined, fallback?: string): string`. `fallback` defaults to `'/dashboard'`.
  - `type AuthDecision = { kind: 'continue' } | { kind: 'redirect'; location: string } | { kind: 'unauthorized' }`
  - `decideAuthRoute(input: { pathname: string; search: string; isAuthenticated: boolean }): AuthDecision`
  - `createSupabaseServerClient(): Promise<SupabaseClient<Database>>` (`lib/supabase/server.ts`, starts with `import 'server-only'`)
  - `createSupabaseBrowserClient(): SupabaseClient<Database>` (`lib/supabase/client.ts`)
  - `updateSession(request: NextRequest): Promise<NextResponse>` (`lib/supabase/proxy.ts`)
  - `proxy(request: NextRequest)` and `config.matcher` (`proxy.ts`)

- [ ] **Step 1: Install dependencies**

`pnpm add zod@4.6.7 @supabase/supabase-js@2.118.0 @supabase/ssr@0.12.7 server-only@0.0.1`

- [ ] **Step 2: Write the failing tests**

`lib/env.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { EnvError, readPublicEnv } from '@/lib/env';

describe('readPublicEnv', () => {
  it('returns typed values when both variables are set', () => {
    expect(
      readPublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_0123456789abcdef',
      }),
    ).toEqual({ supabaseUrl: 'http://127.0.0.1:54321', supabaseAnonKey: 'sb_publishable_0123456789abcdef' });
  });

  it('throws an EnvError naming every missing variable', () => {
    expect(() => readPublicEnv({})).toThrow(EnvError);
    expect(() => readPublicEnv({})).toThrow(/NEXT_PUBLIC_SUPABASE_URL.*NEXT_PUBLIC_SUPABASE_ANON_KEY/s);
  });

  it('rejects a Supabase URL that is not a URL', () => {
    expect(() =>
      readPublicEnv({ NEXT_PUBLIC_SUPABASE_URL: 'localhost', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_0123456789abcdef' }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });
});
```

`lib/auth/routing.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { decideAuthRoute, isPublicPath, safeNextPath } from '@/lib/auth/routing';

describe('isPublicPath', () => {
  it.each([
    ['/login', true], ['/login/', true], ['/auth/callback', true], ['/p/my-page', true], ['/api/public/beacon', true],
    ['/loginx', false], ['/pages', false], ['/', false], ['/dashboard', false], ['/editor/abc', false], ['/api/pages', false],
  ])('%s → %s', (path, expected) => expect(isPublicPath(path)).toBe(expected));
});

describe('safeNextPath', () => {
  it.each([
    ['/editor/abc?tab=seo', '/editor/abc?tab=seo'],
    [null, '/dashboard'], [undefined, '/dashboard'], ['', '/dashboard'],
    ['https://evil.example', '/dashboard'], ['//evil.example', '/dashboard'], ['/\\evil.example', '/dashboard'],
    ['javascript:alert(1)', '/dashboard'], ['dashboard', '/dashboard'], ['/login', '/dashboard'], ['/login?next=/x', '/dashboard'],
  ])('%j → %s', (next, expected) => expect(safeNextPath(next)).toBe(expected));
});

describe('decideAuthRoute', () => {
  it('lets anyone through public paths', () => {
    expect(decideAuthRoute({ pathname: '/p/offer', search: '', isAuthenticated: false })).toEqual({ kind: 'continue' });
  });
  it('redirects anonymous page requests to /login with the full return path', () => {
    expect(decideAuthRoute({ pathname: '/editor/abc', search: '?x=1', isAuthenticated: false })).toEqual({
      kind: 'redirect',
      location: '/login?next=%2Feditor%2Fabc%3Fx%3D1',
    });
  });
  it('answers anonymous API requests with unauthorized', () => {
    expect(decideAuthRoute({ pathname: '/api/pages', search: '', isAuthenticated: false })).toEqual({ kind: 'unauthorized' });
  });
  it('sends signed-in users away from /login to /dashboard', () => {
    expect(decideAuthRoute({ pathname: '/login', search: '', isAuthenticated: true })).toEqual({ kind: 'redirect', location: '/dashboard' });
  });
  it('lets signed-in users through protected paths', () => {
    expect(decideAuthRoute({ pathname: '/dashboard', search: '', isAuthenticated: true })).toEqual({ kind: 'continue' });
  });
});
```

- [ ] **Step 3: Run them to make sure they fail**

Run: `pnpm test lib/env.test.ts lib/auth/routing.test.ts`
Expected: FAIL. Neither module exists.

- [ ] **Step 4: Implement `lib/env.ts` and `lib/auth/routing.ts`**

- `readPublicEnv` validates with a Zod object: `NEXT_PUBLIC_SUPABASE_URL: z.url()`, `NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20)`. On failure it throws `EnvError('Missing or invalid environment variables: <names, comma-separated>. Copy .env.example to .env.local.')`.
- `safeNextPath` accepts only values that start with a single `/`, contain no `\` and no ASCII control characters, and whose path is not `/login` (exactly, or followed by `?` or `/`). Anything else returns the fallback.
- `decideAuthRoute`, in order:
  1. Signed-in user on `/login` → redirect to `/dashboard`.
  2. Public path → continue.
  3. Signed-in user → continue.
  4. `/api/` path → `unauthorized`.
  5. Otherwise → redirect to `/login?next=` + `encodeURIComponent(pathname + search)`.

- [ ] **Step 5: Run them to make sure they pass**

Run: `pnpm test`
Expected: PASS (all unit tests).

- [ ] **Step 6: Implement the Supabase clients, `updateSession` and `proxy.ts`**

- Follow the current Supabase guide for Next.js 16 (https://supabase.com/docs/guides/auth/server-side/nextjs), using `@supabase/ssr` `createServerClient` / `createBrowserClient` with `cookies.getAll` / `cookies.setAll` (apply the cache headers it passes).
- `createSupabaseServerClient` uses `await cookies()`. Its `setAll` sits in a try/catch, because Server Components cannot set cookies; the proxy refreshes them instead.
- `updateSession`:
  1. Calls `supabase.auth.getClaims()`.
  2. Computes `decideAuthRoute({ pathname, search, isAuthenticated: Boolean(data?.claims) })`.
  3. Returns `NextResponse.redirect`, `NextResponse.json({ error: 'unauthorized' }, { status: 401 })`, or the pass-through response. Refreshed cookies are copied onto redirects too.
- `proxy.ts`: `export async function proxy(request: NextRequest) { return updateSession(request); }` with `export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'] }`.

- [ ] **Step 7: Verify**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: all exit 0. The build output lists `ƒ Proxy`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(auth): default-deny routing rules, Supabase clients and proxy session refresh"
```

---

### Task 5: Login, logout, protected layout, owner bootstrap and auth e2e

**Files:**
- Create (shadcn): `components.json`, `components/ui/button.tsx`, `components/ui/input.tsx`, `components/ui/label.tsx`, `components/ui/card.tsx`, `lib/utils.ts`
- Create: `lib/auth/require-user.ts`, `app/login/page.tsx`, `app/login/login-form.tsx`, `app/login/actions.ts`, `app/(editor)/layout.tsx`, `app/(editor)/dashboard/page.tsx`, `app/(editor)/actions.ts`, `scripts/create-owner.ts`, `scripts/create-owner.test.ts`, `playwright.config.ts`, `tests/e2e/app/auth.spec.ts`
- Modify: `app/page.tsx`, `app/globals.css` (shadcn), `package.json`, `CLAUDE.md`

**Interfaces:**
- Consumes: `createSupabaseServerClient`, `safeNextPath` (Task 4); `Database` (Task 3).
- Produces:
  - `requireUser(): Promise<{ userId: string; email: string | null }>`. Uses `getClaims()` and redirects to `/login` when there are no claims. Every later server action and route handler calls it first.
  - `type SignInState = { error: string | null }`
  - `signIn(prev: SignInState, formData: FormData): Promise<SignInState>`. Validates `email`, `password` and `next` with Zod; on success it redirects to `safeNextPath(next)`. Error copy: `'Wrong email or password.'` (bad credentials), `'Enter your email and password.'` (invalid input).
  - `signOut(): Promise<void>`. Signs out, then redirects to `/login`.
  - `parseOwnerArgs(argv: string[]): { email: string; password: string }`. Throws if the email is invalid or the password is shorter than 12 characters.
  - Scripts: `owner:create` (`tsx scripts/create-owner.ts`) and `test:e2e:app` (`PW_APP=1 playwright test --project=app`).
  - UI contract the e2e relies on:
    - `/login` has labelled `Email` and `Password` inputs, a hidden `next` input, a `Sign in` button, and errors in an element with `role="alert"`.
    - `/dashboard` shows the heading `Your pages`, the empty-state text `No pages yet.`, and a `Sign out` button.

- [ ] **Step 1: Add the UI kit and test tooling**

```bash
pnpm dlx shadcn@4.22.1 init --defaults --yes
pnpm dlx shadcn@4.22.1 add button input label card --yes
pnpm add -D @playwright/test@1.64.1 tsx@4.23.15
pnpm exec playwright install chromium
```

- [ ] **Step 2: Write the failing unit test for the owner script**

`scripts/create-owner.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseOwnerArgs } from '@/scripts/create-owner';

describe('parseOwnerArgs', () => {
  it('reads --email and --password', () => {
    expect(parseOwnerArgs(['--email', 'me@example.com', '--password', 'long-enough-pass'])).toEqual({
      email: 'me@example.com',
      password: 'long-enough-pass',
    });
  });
  it('rejects a short password and a bad email', () => {
    expect(() => parseOwnerArgs(['--email', 'me@example.com', '--password', 'short'])).toThrow(/12 characters/);
    expect(() => parseOwnerArgs(['--email', 'nope', '--password', 'long-enough-pass'])).toThrow(/email/);
  });
});
```

- [ ] **Step 3: Write the failing e2e spec and Playwright config**

`playwright.config.ts`:
- Call `process.loadEnvFile('.env.local')` inside try/catch.
- `testDir: 'tests/e2e'`, `forbidOnly: !!process.env.CI`, `retries: process.env.CI ? 1 : 0`.
- When `process.env.PW_APP === '1'`, add project `{ name: 'app', testDir: 'tests/e2e/app', use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:3000' } }` and `webServer: { command: 'pnpm dev', url: 'http://localhost:3000/login', reuseExistingServer: !process.env.CI, timeout: 120_000 }`.

`tests/e2e/app/auth.spec.ts`:

```ts
import { expect, test, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const email = process.env.E2E_OWNER_EMAIL ?? 'owner@launchpad.test';
const password = process.env.E2E_OWNER_PASSWORD ?? 'correct-horse-battery-1';

test.beforeAll(async () => {
  const admin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error && !/already/i.test(error.message)) throw error;
});

async function signIn(page: Page, next?: string) {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : '/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

test('anonymous visitors are sent to /login with a return path', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL('/login?next=%2Fdashboard');
});

test('the owner signs in and lands on the dashboard', async ({ page }) => {
  await signIn(page);
  await expect(page).toHaveURL('/dashboard');
  await expect(page.getByRole('heading', { name: 'Your pages' })).toBeVisible();
  await expect(page.getByText('No pages yet.')).toBeVisible();
});

test('a wrong password shows an error and stays on /login', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('definitely-wrong-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toHaveText('Wrong email or password.');
  await expect(page).toHaveURL(/\/login/);
});

test('sign-in returns to a safe next path but never off-site', async ({ page }) => {
  await signIn(page, 'https://evil.example/phish');
  await expect(page).toHaveURL('/dashboard');
});

test('signing out protects the dashboard again', async ({ page }) => {
  await signIn(page);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL('/login');
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login\?next=/);
});

test('a tampered session cookie is rejected', async ({ page, context }) => {
  await signIn(page);
  await expect(page).toHaveURL('/dashboard');
  const authCookies = (await context.cookies()).filter((c) => /^sb-.+-auth-token/.test(c.name));
  expect(authCookies.length).toBeGreaterThan(0);
  await context.addCookies(authCookies.map((c) => ({ ...c, value: 'tampered' })));
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login\?next=/);
});

test('API routes answer 401 instead of redirecting', async ({ request }) => {
  const res = await request.get('/api/pages', { maxRedirects: 0 });
  expect(res.status()).toBe(401);
  expect(await res.json()).toEqual({ error: 'unauthorized' });
});

test('public sign-up is disabled', async () => {
  const anon = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { error } = await anon.auth.signUp({ email: `intruder-${Date.now()}@launchpad.test`, password: 'whatever-123456' });
  expect(error?.message).toMatch(/signups not allowed/i);
});
```

- [ ] **Step 4: Run them to make sure they fail**

Run: `pnpm test scripts/create-owner.test.ts`
Expected: FAIL (module not found).

Run `pnpm supabase status` and, if the stack is not running, `pnpm db:start`. Then run `pnpm test:e2e:app`.
Expected: FAIL. `/login` returns 404, and the owner-dependent tests fail.

- [ ] **Step 5: Implement auth UI, server actions, layout and owner script**

- `app/login/page.tsx`: a server component that reads `searchParams.next` and renders `<LoginForm next={next} />` inside a shadcn `Card` titled "Sign in to LaunchPad".
- `app/login/login-form.tsx` (`'use client'`): `useActionState(signIn, { error: null })`; `Label`/`Input` pairs with `htmlFor` ids `email` and `password`; a hidden `next` input; `<p role="alert">` only when there is an error.
- `app/login/actions.ts` (`'use server'`): `signIn` as specified, using `createSupabaseServerClient().auth.signInWithPassword`.
- `app/(editor)/layout.tsx`: `await requireUser()`, then a minimal shell (top bar with "LaunchPad" and a sign-out form posting to `signOut`).
- `app/(editor)/dashboard/page.tsx`: `<h1>Your pages</h1>` plus `<p>No pages yet.</p>` (M2 replaces it).
- `app/(editor)/actions.ts`: `signOut`.
- `app/page.tsx`: `redirect('/dashboard')`.
- `scripts/create-owner.ts`:
  - Exports `parseOwnerArgs` (`node:util` `parseArgs`, Zod `z.email()`).
  - Its `main` only runs when the file is executed directly (`import.meta.url === pathToFileURL(process.argv[1]).href`).
  - `main` calls `process.loadEnvFile('.env.local')` in try/catch and builds its own `createClient(url, SUPABASE_SERVICE_ROLE_KEY)`. It must not import `lib/supabase/server.ts`, because `server-only` throws outside Next.
  - It calls `auth.admin.createUser({ email, password, email_confirm: true })` and prints `Owner created: <email>`, or `Owner already exists: <email>` when the error says the user is already registered.

- [ ] **Step 6: Run the tests to make sure they pass**

Run: `pnpm test`
Expected: PASS.

Run: `pnpm test:e2e:app`
Expected: PASS (8 tests).

- [ ] **Step 7: Full milestone gate**

Run: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm db:test && pnpm test:e2e:app && pnpm build`
Expected: every command exits 0. Manual check: `pnpm owner:create --email <you> --password <12+ chars>`, `pnpm dev`, then sign in at http://localhost:3000. You land on "Your pages".

- [ ] **Step 8: Update `CLAUDE.md` and commit**

Confirm that the CLAUDE.md commands match `package.json` (add `test:e2e:app` and `owner:create` if they are missing), then:

```bash
git add -A
git commit -m "feat(auth): owner login/logout, protected editor layout, owner bootstrap and auth e2e"
```
