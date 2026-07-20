# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**PropertyOS** (package name `propertyos`) is a property-accounting platform for short-term/long-term rental operators. It tracks properties, units, reservations, extra-income lines, expenses, and produces per-property and portfolio financial reports (revenue, taxes, channel commissions, net income). The product recently pivoted from a previous product ("postscrypt"/"locklet"); see `TODO.md` for the remaining rename/setup checklist and stray references to purge (`rg -i "locklet|postscrypt" --type ts`).

## Monorepo layout

Bun workspaces (`apps/*`, `packages/*`). Package manager is **bun** (`bun.lock`, dev scripts run TypeScript directly with `bun`).

- `apps/server` — Fastify + PostgreSQL API (the core; run on `bun`, no build step in dev). Owns the DB, auth, S3/media, email, push, cron. Serves both operator (`/admin`, platform auth) and tenant portal (`/tenant/*`) routes.
- `apps/admin` — Vite + React 19 + React Router SPA. The primary operator UI (properties, income, expenses, reports, support, users). Uses TanStack Query + Zustand + shadcn/Radix + Tailwind v4.
- `apps/tenant` — Vite + React 19 + React Router SPA. Tenant portal (invite accept, auth, active/past leases). Shares UI primitives via `@/packages/app-ui`; talks to the same server on `VITE_API_URL`.
- `apps/web` — Next.js 16 marketing/legal site (home, privacy, terms, unsubscribe, contact). Not the app UI.
- `apps/proxy` — thin Fastify proxy for Datadog RUM ingestion from the admin SPA (and tenant when RUM is configured).
- `packages/shared` — `@/packages/shared`: TypeScript types + pure utilities shared between server and clients. **This is the API contract** — request/response body types, enums, and calculation helpers live here and are imported by both sides.
- `packages/app-ui` — `@/packages/app-ui`: shared React UI for admin + tenant (theme, auth shells, API client factory, lease cards, form primitives). Prefer extracting here when **both** apps need the same component.
- `lambda/s3-notification`, `scripts/`, `docker/` — infra glue (MinIO/S3 webhooks, Debian/Datadog setup, per-app Dockerfiles including `docker/Dockerfile.tenant`).

`apps/mobile` is referenced in scripts/TODO but not currently present.

## Commands

Install: `bun install` (root).

Run one app in dev (from repo root):

- `bun run dev:server` · `dev:admin` · `dev:tenant` · `dev:web` · `dev:proxy`

Or run inside the app dir directly (more reliable): `cd apps/server && bun run dev`. Equivalent `build:*`, `start:*`, `lint:*` scripts exist per app at the root.

Per-app essentials:

- Server: `bun run dev` (nodemon + bun), `bun run build` (`tsc` → `tsc-alias` → copies `templates/`), `bun test` (uses `bun test`), `bun run lint`.
- Admin: `bun run dev` (Vite), `bun run build` (`tsc -b && vite build`), `bun run lint`.
- Tenant: `bun run dev` (Vite on port **5174**), `bun run build` (`tsc -b && vite build`), `bun run lint`. Copy `apps/tenant/.env.example` → `apps/tenant/.env` and set `VITE_API_URL` (typically `http://localhost:3001`).
- Web: `bun run dev`/`build` (Next).

Run a single server test: `cd apps/server && bun test src/db/pg-errors.test.ts` (tests are colocated `*.test.ts` files, run by `bun test`).

`bun run logaway` strips stray `console.log` calls from server/admin/web (config in `.logawayrc.json`).

Docker: `docker compose up` builds/runs server (3001), web (3000), admin (3002), tenant (3003 → container preview 4174), proxy (8082). Each app that needs runtime env reads `apps/<app>/.env` (tenant build args: `VITE_API_URL`, optional Datadog RUM — see `docker-compose.yml` `tenant` service and `apps/tenant/.env.example`).

## Server architecture

- **Entry `apps/server/src/server.ts`**: builds the Fastify instance, registers CORS/helmet/rate-limit and the JWT plugin, then registers each route module explicitly (see the `*Routes` imports). On startup it calls `initializeDatabase()` (tests the pool, runs migrations), starts the notification stream hub and the refresh-token cleanup cron, then listens. Adding a feature = new route module registered here.
- **Database**: raw `pg` `Pool` (`db/pool.ts`), no ORM. Each table has a data-access module in `db/` (e.g. `properties.ts`, `property-reservations.ts`) exporting query functions. `db/mappers.ts` converts snake_case rows to camelCase domain objects.
- **Migrations** (`db/migrations.ts`): a single ordered `migrations[]` array of `{ version, name, up, down }` objects run automatically on server startup inside one transaction. **There are no `.sql` migration files and no external migration CLI** — to change the schema, append a new object with the next `version` number (currently up to 33) and both `up`/`down`. Enum changes must use `ALTER TYPE ... ADD VALUE IF NOT EXISTS` (Postgres can't drop enum values; `down` is a no-op for those). `apps/server/scripts/seed-mock-property-data.sql` is dev seed data, not a migration.
- **Auth** (`auth/`): `@fastify/jwt`. `jwt.ts` decorates the instance with `authenticate` and `requireAdmin` preHandlers and provides access/refresh token helpers (refresh tokens are hashed and stored in `refresh_tokens`). `google.ts`/`apple.ts` handle social sign-in. Route-level property authorization lives in `routes/admin/property-route-access.ts`; roles are `owner | manager | accountant`.
- **Errors**: DB/constraint errors are translated to client responses via `db/pg-errors.ts`, `db/postgres-constraint-messages.ts`, and `routes/admin/reply-from-database-error.ts` — reuse these rather than hand-writing error mapping.
- **Financial math**: authoritative income/tax/commission calculations are shared with clients through `packages/shared` (`property-income-utils.ts`, etc.) so server and admin compute identical numbers. Migration 25 shows the same formula reimplemented in PL/pgSQL for backfills. Money columns are `NUMERIC(12,2)`; rates are `NUMERIC(6,5)`. Per-property tax rates live in `property_tax_rates` and are snapshotted onto each reservation/income line as a `tax_breakdown` JSONB array.
- **Other subsystems**: `s3/` (presigned uploads, MinIO/S3, MediaConvert), `ses/` (email; `FROM_EMAIL` in `ses/ses.ts`), `push/` (Expo push), `services/notification-stream-hub.ts` (SSE at `/notifications/stream`, exempt from rate-limiting), `services/discord-webhook.ts` (support alerts).

## Admin client architecture

- **Data layer**: `lib/api-client.ts` is the single typed HTTP client — all request/response types come from `@/packages/shared`. Server state is TanStack Query; query keys are centralized in `lib/query-keys.ts` and cache invalidation helpers live in `lib/invalidate-property-*-caches.ts`. Auth/session state is Zustand (`stores/auth-store.ts`, `lib/clear-app-session.ts`).
- **Structure**: routed pages in `pages/`, feature UI in `components/`, reusable logic in `hooks/`, pure helpers in `lib/`. Uses the React Compiler (Babel plugin) — do not hand-add `useMemo`/`useCallback` purely for referential stability.
- Path alias `@/` maps to `apps/admin/src`; `@/packages/shared` resolves to the shared package (see root `tsconfig.base.json`).

## Tenant client architecture

- **Data layer**: `lib/api-client.ts` wraps `@/packages/app-ui` `createApiClient` against `VITE_API_URL`; request/response types from `@/packages/shared` (`/tenant/*` contract). Auth session is tenant JWT audience only — never reuse platform/admin tokens.
- **Structure**: routed pages under `src/`, shared shells/primitives from `@/packages/app-ui`, app-specific UI in local components. React Compiler (Babel plugin) — same rule as admin: no hand-`useMemo`/`useCallback` for referential stability alone.
- Path alias `@/` maps to `apps/tenant/src`; `@/packages/shared` and `@/packages/app-ui` resolve via Vite aliases to the packages under `packages/`.
- **Local run**: start the server (`bun run dev:server`), then `bun run dev:tenant` (or `cd apps/tenant && bun run dev`). Open `http://localhost:5174`. Docker serves the built preview at `http://localhost:3003`.
- **Roadmap**: post-launch enhancements are phased in `docs/TENANT_PORTAL_ENHANCEMENTS_PHASES.md` (parent portal plan: `docs/TENANT_PORTAL_PHASES.md`).

## Working expectations

The maintainer wants every feature and design decision held to **current industry standards**. Treat this as a standing instruction, not a per-request one:

- **Always surface the standard approach**, even when the maintainer proposes something different. If a request would lead to a non-idiomatic, harder-to-maintain, or slower solution, implement nothing silently — first note the conventional/modern alternative and why it's better (readability, maintainability, performance), then proceed with their call. Optimize the final outcome, not just literal compliance.
- Frame trade-offs concretely (e.g. "this works, but the standard React 19 pattern is X, which avoids re-renders / is easier to test"). A short recommendation beats an exhaustive survey — give your pick, not a menu.
- Favor the established patterns already in this repo (typed shared contracts, TanStack Query + centralized query keys, `packages/shared` for cross-cutting logic, strict TS) over one-off solutions. New code should read like the best existing code here.
- Keep suggestions grounded in the versions actually in use (React 19 + React Compiler, Next 16, Fastify 5, Tailwind v4, TanStack Query v5, Zod v4) — don't recommend deprecated or outdated practices.
- Readability and maintainability win ties; reach for added complexity or micro-optimizations only when there's a real, demonstrable payoff.

## Conventions

- **TypeScript is strict** across the repo (`tsconfig.base.json`: `strict`, `noUnusedLocals/Parameters`, `noUncheckedIndexedAccess`, `noImplicitReturns`). Expect index access to be `T | undefined`.
- Interfaces are prefixed `I` (`IProperty`), type aliases `T` (`TAddPropertyMemberResponse`) — match the surrounding style.
- DB is snake_case; TS domain objects are camelCase (bridged in `db/mappers.ts`).
- Prettier: 100 col, 2 spaces, semicolons, `es5` trailing commas, always-parens arrows. ESLint uses `simple-import-sort` + `perfectionist` (imports and object keys are sorted) — run `lint` before finishing.
- **DRY** is enforced (`.cursor/rules/no-code-repetition.mdc`): extract shared logic into utilities/hooks/components/shared types rather than duplicating; put anything both server and client need in `packages/shared`.
- **Forms** (admin + tenant): use **react-hook-form + Zod** — see `.cursor/rules/react-hook-form.mdc`. No `useState`-per-field submit forms.
- **Plan mode** (`.cursor/rules/plan-mode-confirmation.mdc`): when in plan mode, stay read-only and get explicit approval before edits, migrations, or schema changes.
