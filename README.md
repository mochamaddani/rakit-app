# Rakit

A landing-page builder for ad tests. A custom editor produces a page document (JSON), and a pure
renderer turns it into one self-contained `.html` file to download and upload to any hosting.

## Quick start

1. Node 24 (`.nvmrc`) and pnpm 12. Run `pnpm install`.
2. Start Docker Desktop, then `pnpm db:start`.
3. `pnpm env:local` (copies `.env.example` to `.env.local` and fills the Supabase values from `pnpm supabase status`).
4. `pnpm owner:create --email … --password …`, then `pnpm dev` and open <http://localhost:3000>.

## More

- [`CLAUDE.md`](CLAUDE.md): commands, project rules and how to add a block.
- [`docs/PRD.md`](docs/PRD.md): the product spec.
- [`docs/PLAN.md`](docs/PLAN.md): milestones, risks and dependencies.
- [`docs/DECISIONS.md`](docs/DECISIONS.md): architecture decisions.
