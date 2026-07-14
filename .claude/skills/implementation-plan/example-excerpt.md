# Example excerpt — tenant email campaigns

Reference: `docs/TENANT_EMAIL_CAMPAIGN_PHASES.md`. Below are the patterns worth copying, not
the full doc.

## Opening + related code

```markdown
# Tenant Mass Email Campaigns — Implementation Phases

Roadmap for async mass email notifications from property owners and platform admins to
primary and secondary lease tenants. Uses **Redis + BullMQ** for job execution, **Postgres**
as source of truth, **AWS SES** for delivery, and **SSE** for live completion status.

**Related code today**

- SES send: `apps/server/src/ses/ses.ts`
- SSE hub: `apps/server/src/services/notification-stream-hub.ts`
- Permissions: `apps/admin/src/hooks/use-property-permissions.ts`
```

## Goals vs non-goals

Split **what we ship** from **what we defer**. Non-goals prevent "while we're here" scope.

```markdown
## Goals

- Submit returns immediately (**202 Accepted**); never block HTTP until all emails send.
- Live progress via **SSE** to the sender's admin session.

## Non-goals (initial release)

- Scheduled sends
- Saved templates / drafts
- Manager or accountant send access
```

## Guiding principles (numbered, with rationale)

```markdown
1. **Postgres is source of truth** — campaigns survive Redis restarts; jobs rebuild from `queued` rows.
2. **Worker before UI** — prove the send pipeline via API/script before exposing the tab.
```

## Phase block (repeat per phase)

```markdown
### Phase 1 — Backend pipeline (worker + admin API only)

**Goal:** End-to-end send via API/script, not the property tab.

- [ ] `POST` campaign endpoint (owner + admin auth, idempotency, **202**)
- [ ] Transaction: insert campaign + recipient rows, then enqueue BullMQ jobs
- [ ] Worker: send via SES, update recipient row, bump campaign aggregates

**Exit criteria:** API never awaits all sends; verify with 2–3 test leases via script/Postman;
DB + SES (sandbox) correct.
```

## Hardening as concern → action table

```markdown
| Concern       | Action                                                                   |
| ------------- | ------------------------------------------------------------------------ |
| Idempotency   | `Idempotency-Key` header + DB unique on `(property_id, idempotency_key)` |
| HTML safety   | Server-side sanitize; max body size                                      |
| Observability | Structured logs per campaign/job; alert on high failure rate             |
```

## What not to do + sequencing summary

```markdown
## What not to do

- Do **not** loop `await sendEmail()` for all tenants in the HTTP handler
- Do **not** use fire-and-forget without DB persistence (restarts lose jobs)

## Safest sequencing summary

1. **DB + resolver before Redis jobs** — re-enqueue from `queued` rows if needed
2. **Worker before UI** — prove send path without exposing compose
3. **Feature flag** — ship code dark; enable per environment
```

## Phase ordering for this feature type

```
Phase 0: Redis, migration, shared types, resolver tests, feature flag
    ↓
Phase 1: POST 202, worker, SES — no UI
    ↓
Phase 2: SSE events + GET fallback
    ↓
Phase 3: Communications tab MVP
    ↓
Phase 4: Rate limits, idempotency, load test
    ↓
Phase 5: Templates, scheduling, filters
```

When the feature is **not** async, drop worker phases and merge Phase 2 into UI or API as
appropriate — but keep Foundation before UI and Hardening before launch.
