---
name: implementation-plan
description: >-
  Create phased implementation plans for new features and solutions — goals, non-goals,
  guiding principles, architecture, data/API sketches, and sequenced rollout phases with
  exit criteria. Use when the user asks for an implementation plan, phased rollout, feature
  roadmap, solution design doc, technical spec, or "how should we build X" planning.
---

# Implementation plan authoring

Produce a **phased implementation plan** markdown doc — the same shape as
`docs/TENANT_EMAIL_CAMPAIGN_PHASES.md`. Plans are read by humans and agents before coding;
they prioritize **safe sequencing**, **explicit scope**, and **verifiable exit criteria**.

## Output location

Write to `docs/<FEATURE>_PHASES.md` unless the user names a path. Use `SCREAMING_SNAKE`
for the filename stem (e.g. `TENANT_EMAIL_CAMPAIGN_PHASES.md`).

## Workflow

### 1. Discover before writing

Read the codebase enough to anchor the plan in **this repo**, not generic advice.

- Search for related routes, services, hooks, shared types, migrations, workers, SSE, permissions.
- List **Related code today** as concrete file paths (with one-line purpose each).
- Note existing patterns to reuse (auth, error mapping, query keys, cron, feature flags).
- Identify gaps (e.g. Redis not in compose, no worker process yet).

Do not invent file paths. If unsure, search first.

### 2. Clarify scope (only when blocked)

Ask the user only when a decision materially changes phases:

- Who can use the feature (roles / permissions)?
- Sync vs async? Real-time updates needed?
- v1 non-goals the user might expect (scheduling, drafts, admin-only, etc.)?

If the user gave enough context, infer sensible defaults and state them explicitly in
**Non-goals** and **Guiding principles**.

### 3. Draft the document

Follow the template in [template.md](template.md). Section order is fixed — do not skip
sections; use "N/A" or "TBD" with a one-line reason when a section does not apply.

### 4. Phase the rollout correctly

Default sequence (adapt names, never the order logic):

| Order | Phase                | User-facing?         | Purpose                                                |
| ----- | -------------------- | -------------------- | ------------------------------------------------------ |
| 0     | Foundation           | No                   | DB, shared types, infra, flags, pure utilities + tests |
| 1     | Backend pipeline     | No (API/script only) | End-to-end core path without UI                        |
| 2     | Real-time / progress | No full UI           | SSE, webhooks, polling fallback — prove push path      |
| 3     | UI MVP               | Yes                  | First shippable surface; wire to proven backend        |
| 4     | Hardening            | —                    | Rate limits, idempotency, observability, load test     |
| 5+    | Enhancements         | —                    | Post-launch; explicitly deferred from v1               |

**Rules:**

- **Worker / async job before UI** when work is slow or out-of-band.
- **DB + contracts before queue jobs** — jobs rebuild from persisted `queued` rows.
- **Push/stream before full tab** when live progress matters.
- **Feature flag** when shipping dark until production-ready.
- Each phase: **Goal**, checkbox tasks, **Exit criteria** (testable, not vague).
- Optional sub-phases (e.g. `Phase 1b — dry-run`) only when they unblock QA without UI.

### 5. Write anti-patterns and sequencing

Always end with:

- **What not to do** — 4–8 concrete mistakes (repo-specific, not generic "write bad code").
- **Safest sequencing summary** — 3–7 numbered ordering rules distilled from phases.

### 6. Present to the user

After writing the file, give a short summary: phase count, where UI starts, and the top 2–3
sequencing rules. Offer to adjust scope or start Phase 0 — do not implement unless asked.

## Quality bar

| Check              | Requirement                                                        |
| ------------------ | ------------------------------------------------------------------ |
| Goals              | User-visible outcomes + technical bar (e.g. 202, SSE, idempotency) |
| Non-goals          | Explicit v1 cuts — prevents scope creep                            |
| Guiding principles | Numbered; each states _why_ (source of truth, fail-safe, etc.)     |
| Architecture       | ASCII or mermaid flow; name real systems (Postgres, BullMQ, SES…)  |
| Sketches           | Tables for schema, API, shared types — not full DDL                |
| Phases             | Every phase has Goal + tasks + Exit criteria                       |
| Hardening          | Table: Concern → Action                                            |
| Related code       | Real paths only                                                    |

## PropertyOS repo defaults

When planning features in this monorepo, prefer:

- **Contracts** in `packages/shared`; server + admin import the same types.
- **Migrations** appended to `apps/server/src/db/migrations.ts` (no `.sql` files).
- **Admin data** via `lib/api-client.ts`, TanStack Query, `lib/query-keys.ts`.
- **Auth** mirrored server (`property-route-access`) and client (`use-property-permissions`).
- **SSE** via `notification-stream-hub` + `notification-stream-handlers.ts` when live updates apply.
- **Feature flags** as env vars gating API, worker, and UI together.
- **Bun** for scripts/tests; **no default exports** in new admin code.

Mention these only when relevant — do not boilerplate every plan.

## Additional resources

- Full markdown template: [template.md](template.md)
- Annotated example (tenant email campaigns): [example-excerpt.md](example-excerpt.md)
