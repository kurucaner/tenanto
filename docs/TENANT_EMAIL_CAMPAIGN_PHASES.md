# Tenant Mass Email Campaigns — Implementation Phases

Roadmap for async mass email notifications from property owners and platform admins to primary and secondary lease tenants. Uses **Redis + BullMQ** for job execution, **Postgres** as source of truth, **AWS SES** for delivery, and **SSE** (existing notification stream) for live completion status to the sender.

**Related code today**

- SES send: `apps/server/src/ses/ses.ts`, `apps/server/src/ses/transactional-emails.ts`
- Single-tenant notify: `apps/server/src/services/lease-notifications.ts`
- SSE hub: `apps/server/src/services/notification-stream-hub.ts`
- Stream types: `packages/shared/src/notification-stream-types.ts`
- Admin stream client: `apps/admin/src/hooks/use-notification-stream.ts`, `apps/admin/src/lib/notification-stream-handlers.ts`
- Lease tenant data: `tenantEmail`, `secondaryTenants` on long stays; `getLeaseOccupancyNames` in `packages/shared`
- Permissions: `apps/admin/src/hooks/use-property-permissions.ts`
- Property tabs: `apps/admin/src/config/property-shell-tabs.ts`
- Cron pattern (reference): `apps/server/src/scheduler/refresh-token-cleanup-cron.ts`

---

## Goals

- Property owners and platform admins compose and send email to all primary + secondary tenants on **active leases**.
- New **Communications** tab on the property shell.
- Rich text editor for email body (HTML + plain-text fallback).
- Submit returns immediately (**202 Accepted**); never block HTTP until all emails send.
- Live progress and completion via **SSE** to the sender's admin session.
- Production-grade behavior: rate limits, retries, idempotency, audit, dedupe, HTML sanitization.

## Non-goals (initial release)

- Scheduled sends
- Saved templates / drafts
- Manager or accountant send access (unless explicitly added later)
- Marketing-style drip campaigns

---

## Guiding principles

1. **Postgres is source of truth** — campaigns and recipients survive Redis restarts; jobs can be rebuilt from `queued` rows.
2. **BullMQ executes, API accepts** — HTTP handler creates rows and enqueues; worker sends via SES.
3. **Worker before UI** — prove the send pipeline via API/script before exposing the Communications tab.
4. **SSE for UX, GET for fallback** — push progress on the existing notification stream; poll campaign detail on reconnect.
5. **No client-side send loop** — never await all SES calls in the request handler.

---

## Target architecture

```
Admin UI → POST .../tenant-email-campaigns  →  campaigns + recipients (queued)
                                                          ↓
                                                BullMQ enqueue (per recipient)
                                                          ↓
                                              Worker (rate-limited, retries)
                                                          ↓
                                                SES SendEmail (existing path)
                                                          ↓
                                    Update recipient + campaign aggregate counts
                                                          ↓
                              SSE tenant_email_campaign.updated → sender userId
                                                          ↓
Admin UI ← notification stream  ←  completed / completed_with_errors
```

### Permissions

New capability: **`canSendTenantNotifications`**

- Platform admin (`UserType.ADMIN`), **or**
- Property member with role **owner**

Not managers or accountants in v1. Mirror on server route access and hide the Communications tab when false.

### Feature flag

---

## Data model (sketch)

### `property_tenant_email_campaigns`

| Column                                          | Notes                                                                       |
| ----------------------------------------------- | --------------------------------------------------------------------------- |
| `id`                                            | UUID                                                                        |
| `property_id`                                   | FK                                                                          |
| `created_by`                                    | User who sent                                                               |
| `subject`                                       |                                                                             |
| `html_body`                                     | Sanitized snapshot (immutable after submit)                                 |
| `text_body`                                     | Plain-text fallback                                                         |
| `status`                                        | `queued` \| `sending` \| `completed` \| `completed_with_errors` \| `failed` |
| `recipient_count`                               | Total intended                                                              |
| `sent_count` / `failed_count` / `skipped_count` | Aggregates                                                                  |
| `idempotency_key`                               | Unique per `(property_id, idempotency_key)`                                 |
| `created_at` / `updated_at` / `completed_at`    | Audit                                                                       |

### `property_tenant_email_recipients`

| Column        | Notes                                       |
| ------------- | ------------------------------------------- |
| `id`          | UUID                                        |
| `campaign_id` | FK                                          |
| `lease_id`    | FK                                          |
| `tenant_role` | `primary` \| `secondary`                    |
| `tenant_name` | Snapshot                                    |
| `email`       | Normalized                                  |
| `status`      | `queued` \| `sent` \| `failed` \| `skipped` |
| `attempts`    | Retry count                                 |
| `last_error`  | Failure message                             |
| `sent_at`     |                                             |

**Recipient resolution:** Active leases for property → primary `tenantEmail` + secondary emails from `secondaryTenants` → dedupe by normalized email → skip blank/invalid with `skipped` + reason.

---

## Shared contract (`packages/shared`)

| Type                                                | Purpose                                                          |
| --------------------------------------------------- | ---------------------------------------------------------------- |
| `TTenantEmailCampaignStatus`                        | Campaign lifecycle enum                                          |
| `TTenantEmailRecipientStatus`                       | Per-recipient status                                             |
| `ICreateTenantEmailCampaignBody`                    | `subject`, `htmlBody` (+ optional audience filters later)        |
| `ITenantEmailCampaign`                              | Campaign summary for list/detail                                 |
| `ITenantEmailCampaignCreateResponse`                | `{ campaignId, status, recipientCount, skippedCount }` — **202** |
| `ITenantEmailCampaignPreviewResponse`               | Recipient/skipped counts before send                             |
| `INotificationStreamTenantEmailCampaignUpdatedData` | SSE payload                                                      |

---

## API (sketch)

| Method | Path                                                           | Notes                                  |
| ------ | -------------------------------------------------------------- | -------------------------------------- |
| `POST` | `/admin/properties/:propertyId/tenant-email-campaigns`         | 202; requires `Idempotency-Key` header |
| `GET`  | `/admin/properties/:propertyId/tenant-email-campaigns`         | History list                           |
| `GET`  | `/admin/properties/:propertyId/tenant-email-campaigns/:id`     | Detail + counts (polling fallback)     |
| `GET`  | `/admin/properties/:propertyId/tenant-email-campaigns/preview` | Optional: recipient count before send  |

---

## SSE events

Extend `packages/shared/src/notification-stream-types.ts`:

- Event type: `tenant_email_campaign.updated`
- Payload: `{ campaignId, propertyId, status, sentCount, failedCount, skippedCount, totalCount }`

Worker publishes to the **sender's `userId`** via `notificationStreamHub`. Throttle progress events (e.g. every 10 sends or every ~2s). Admin handler in `notification-stream-handlers.ts` updates Communications UI when the user is on the matching property page.

---

## BullMQ worker

- Queue name: `tenant-email-send` (one job per recipient, or batched jobs of ~10)
- Separate process: e.g. `bun run worker:email` — do not run bulk sends in the API process
- **Rate limiter** aligned with SES account quotas
- **Retries:** exponential backoff, max ~5 attempts for transient errors (429, 5xx)
- **Non-retryable:** invalid address, hard bounce → mark `failed`, do not retry forever
- Reuse `apps/server/src/ses/ses.ts`; include List-Unsubscribe headers where applicable

---

## UI — Communications tab

1. **Compose** — subject + rich text (TipTap recommended)
2. **Preview** — recipient count, skipped count, sample list
3. **Submit** — disable after success; client-generated idempotency key per submit
4. **Active send banner** — SSE-driven progress
5. **History** — past campaigns with status badges; detail drawer for failed recipients

Add tab to `apps/admin/src/config/property-shell-tabs.ts`. Gate on `canSendTenantNotifications`.

---

## Phased rollout

### Phase 0 — Foundation (no user-facing feature)

**Goal:** Infrastructure and contracts without sending mail.

- [ ] Add Redis to local/docker dev (not in compose today)
- [ ] Add BullMQ dependency + queue configuration
- [ ] DB migration: `property_tenant_email_campaigns`, `property_tenant_email_recipients`
- [ ] Shared types in `packages/shared`
- [ ] Recipient resolver (pure function + colocated tests)
- [ ] HTML sanitizer + plain-text fallback generator (server-side)

**Exit criteria:** Migrations run; resolver tests pass; Redis connects; no UI, no sends.

---

### Phase 1 — Backend pipeline (worker + admin API only)

**Goal:** End-to-end send via API/script, not the property tab.

- [ ] `POST` campaign endpoint (owner + admin auth, idempotency, **202**)
- [ ] Transaction: insert campaign + recipient rows, then enqueue BullMQ jobs
- [ ] Worker: send via SES, update recipient row, bump campaign aggregates
- [ ] Campaign status transitions: `queued` → `sending` → `completed` \| `completed_with_errors`
- [ ] Retries with backoff; classify permanent vs transient failures
- [ ] Audit: immutable body snapshot; `created_by` recorded

**Exit criteria:** API never awaits all sends; verify with 2–3 test leases via script/Postman; DB + SES (sandbox) correct.

**Optional Phase 1b — dry-run:** `mode: "preview_only"` creates campaign + recipients without enqueueing jobs (QA).

---

### Phase 2 — SSE progress

**Goal:** Live updates before full UI.

- [ ] Add `tenant_email_campaign.updated` to shared stream types
- [ ] Extend `notificationStreamHub` publish path for campaign events
- [ ] Worker emits progress (throttled) and completion to sender's `userId`
- [ ] Admin stream handler updates campaign query / local state
- [ ] `GET` campaign detail as reconnect fallback

**Exit criteria:** Script-triggered campaign emits SSE on connected admin session; GET restores state after page refresh.

---

### Phase 3 — Property tab MVP

**Goal:** First usable UI.

- [ ] Communications tab + routed page under property shell
- [ ] Rich text compose (TipTap) + preview + submit
- [ ] Toast on queue ("Notification queued for N tenants")
- [ ] SSE-driven active send banner and completion
- [ ] Campaign history table
- [ ] Permission gate on tab and routes

**Exit criteria:** Owner/admin sends from UI; no multi-minute loading spinner; completion via SSE; history visible.

---

### Phase 4 — Hardening

**Goal:** Production-safe.

| Concern         | Action                                                                         |
| --------------- | ------------------------------------------------------------------------------ |
| Rate limits     | BullMQ limiter + max recipients per campaign (config)                          |
| Idempotency     | `Idempotency-Key` header + DB unique on `(property_id, idempotency_key)`       |
| Dedupe          | One send per normalized email per campaign                                     |
| Skipped tenants | No email → `skipped`, visible in preview + final summary                       |
| Dead letters    | Failed recipients listed in campaign detail drawer                             |
| HTML safety     | Server-side sanitize (e.g. DOMPurify); max body size                           |
| Compliance      | Transactional vs marketing classification; reuse unsubscribe infra in `ses.ts` |
| API abuse       | Rate limit POST per user/property                                              |
| Observability   | Structured logs per campaign/job; alert on high failure rate                   |

**Exit criteria:** Load test ~500 recipients; worker stable; failure modes documented.

---

### Phase 5 — Enhancements (post-launch)

- Audience filters (unit, lease status)
- Send test email to self before blast
- Scheduled send (delayed BullMQ job)
- Templates / saved drafts
- Separate worker deployment in production (scale independently of API)

---

## What not to do

- Do **not** loop `await sendEmail()` for all tenants in the HTTP handler
- Do **not** use fire-and-forget in the API process without DB persistence (restarts lose jobs)
- Do **not** show a multi-minute submit loading state
- Do **not** allow unsanitized HTML from the rich text editor
- Do **not** skip idempotency on the submit button (double-click = duplicate campaign without it)

---

## Safest sequencing summary

1. **DB + resolver before Redis jobs** — re-enqueue from `queued` rows if needed
2. **Worker before UI** — prove send path without exposing compose
3. **SSE in Phase 2** — validate events before building the tab
4. **Feature flag** — ship code dark; enable per environment
5. **Small caps in dev** — e.g. max 50 recipients until monitored in prod
