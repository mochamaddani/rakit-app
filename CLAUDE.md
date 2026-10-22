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
