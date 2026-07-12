# Property Expenses Export — Implementation Phases

Roadmap for async CSV and Excel exports of property expenses (Tier 2: job queue + S3 + presigned download). Exports respect the same filters as the expenses table (`from`, `to`, `categoryId`, `q`).

**Related code today**

- Expenses list: cursor pagination in `apps/server/src/db/property-expenses.ts`
- Filters: `TPropertyExpensesListFilters` in `packages/shared/src/property-expense-types.ts`
- Sync report CSV (different use case): `GET .../reports/export` in `property-report-routes.ts`
- S3 presigned URLs: `apps/server/src/s3/s3-commands.ts`
- Background cron pattern: `apps/server/src/scheduler/refresh-token-cleanup-cron.ts`

---

## Guiding principles

1. **Build the job pipeline once** — one `export_jobs` table, one create/status/download API, one processor with a per-format strategy (`csv` | `xlsx`).
2. **CSV before Excel** — validates DB streaming, S3 upload, auth, and FE polling with lower memory risk.
3. **Backend contract before UI polish** — minimal FE can ship as soon as the CSV processor works.
4. **No client-side export** — never loop infinite-scroll pages in the browser.
5. **Vertical slice for first release** — aim for one shippable async CSV export early; avoid long stretches of unused infra-only PRs.

---

## Target architecture

```
User → POST .../expenses/exports  →  export_jobs (pending)
                                              ↓
                                    In-process worker (cron/poll)
                                              ↓
                              Stream DB rows → CSV or XLSX generator
                                              ↓
                                    Upload to S3 (MinIO)
                                              ↓
                              Job status: completed + presigned download URL
                                              ↓
User ← GET .../exports/:id/download  ←  generateDownloadUrl(s3Key)
```

### Shared contract (`packages/shared`)

| Type                                    | Purpose                                                                                              |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `TExpenseExportFormat`                  | `"csv" \| "xlsx"`                                                                                    |
| `TExportJobStatus`                      | `"pending" \| "processing" \| "completed" \| "failed" \| "expired"`                                  |
| `IPropertyExpensesExportRequest`        | Filters: `from`, `to`, `categoryId`, `q` + `format`                                                  |
| `IExportJob`                            | `id`, `status`, `format`, `filters`, `rowCount`, `fileName`, `errorMessage`, `expiresAt`, timestamps |
| `IPropertyExpensesExportCreateResponse` | `{ jobId }`                                                                                          |
| `IExportJobDownloadResponse`            | `{ downloadUrl, expiresAt }` — presigned URL, never raw S3 key                                       |

**Snapshot filters** into the job row as JSONB at create time so processing is deterministic even if the user changes URL filters later.

### Design decisions (lock in Phase 0)

| Decision      | Recommendation                                                                               |
| ------------- | -------------------------------------------------------------------------------------------- |
| Worker model  | In-process poller in `apps/server` (extend cron pattern), not a separate service yet         |
| File storage  | S3 via existing `PutObject` + `generateDownloadUrl`                                          |
| Row limit     | e.g. 100k rows; fail job with a clear message                                                |
| File TTL      | Job + S3 object expire after 48–72h                                                          |
| Dedup         | Reject or reuse if same user has `pending`/`processing` for same property + filters + format |
| Sync fallback | **Skip** — one async UX path only                                                            |

---

## Phase 0 — Design spike

**Goal:** Lock API shape and job lifecycle before implementation spreads.

**Deliverable:** Endpoints, job states, error codes, and column list for CSV/XLSX documented in this file or a linked issue. No user-facing changes.

**Export columns (proposed):**

| Column      | Source                 |
| ----------- | ---------------------- |
| Date        | `expenseDate`          |
| Category    | `categoryName`         |
| Description | `description`          |
| Amount      | `amount`               |
| Tax-free    | `taxFree`              |
| Created at  | `createdAt` (optional) |

---

## Backend phases

### BE-1 — Job persistence + API shell

**Goal:** Create and read export jobs; no file generation yet.

**Scope**

- Migration: `export_jobs` table
- `db/export-jobs.ts` — create, getById, claimNextPending, markCompleted / markFailed / markExpired
- Routes:
  - `POST /properties/:propertyId/expenses/exports` → `202` + `{ jobId }`
  - `GET /properties/:propertyId/expenses/exports/:jobId`
  - `GET /properties/:propertyId/expenses/exports/:jobId/download` (403 until `completed`)
- Auth: `assertPropertyMemberAccess` on all routes
- Jobs remain `pending` until BE-3

**Why first:** FE can integrate against real endpoints; jobs can be tested manually in DB.

---

### BE-2 — CSV generator (isolated)

**Goal:** Correct, testable CSV output without jobs or S3.

**Scope**

- `services/expense-export/csv-expense-export.ts`
- Reuse `buildPropertyExpenseListConditions` and the same JOIN as the list query
- Batch/keyset read from Postgres (no OFFSET)
- Extract shared `csvRow()` from report service into a reusable util
- Unit tests: escaping, headers, empty result, date/money formatting

**Why separate:** CSV correctness is the highest risk; test without async complexity.

---

### BE-3 — CSV job processor + S3

**Goal:** First real end-to-end CSV export.

**Scope**

- `services/expense-export/process-expense-export-job.ts`
- In-process worker: cron or interval on server startup (dev + prod)
- Flow: claim job → stream rows → CSV → upload S3 (`exports/{propertyId}/{jobId}.csv`) → mark `completed` with `rowCount`, `s3Key`, `expiresAt`
- Download route returns presigned URL via `generateDownloadUrl`
- Guardrails: row cap, processing timeout (stuck → `failed`), property scoping on download

**Milestone:** CSV export works via API — first demo-worthy release (pairs with FE-2).

---

### BE-4 — Cleanup + hardening

**Goal:** Production-safe limits and housekeeping.

**Scope**

- Cron: expire old jobs, delete S3 objects (or bucket lifecycle rule on `exports/` prefix)
- Rate limit: max one active export per user per property
- Idempotency / duplicate-click protection
- Structured logging: job id, duration, row count, format

**Why after BE-3:** Tune limits from real timings before over-engineering.

---

### BE-5 — Excel generator

**Goal:** XLSX export using the same job pipeline.

**Scope**

- Add `exceljs` (or equivalent) with **streaming** writer — not whole-workbook-in-memory
- `services/expense-export/xlsx-expense-export.ts` — same row iterator interface as CSV
- Same columns as CSV; header row; optional column widths
- Processor strategy: `format === "csv" ? csvExporter : xlsxExporter`
- S3 key and content type per format

**Why after CSV:** Processor, S3, and job lifecycle are proven; Excel is mostly a different serializer.

---

### BE-6 — Notifications (optional)

**Goal:** Notify user when export is ready (or failed).

**Scope**

- New `UserNotificationType`: e.g. `expense_export_ready`
- `notifyUser` on completion (optional on failure)
- Extend `UserNotificationResourceType` if deep-linking to property expenses is needed

**Why late:** Polling is enough for v1; notifications are UX polish.

---

## Frontend phases

### FE-1 — API client + types

**Goal:** Typed client for export endpoints; no UI yet.

**Scope**

- `expensesApi.createExport(propertyId, { filters, format })`
- `expensesApi.getExport(propertyId, jobId)`
- `expensesApi.getExportDownloadUrl(propertyId, jobId)`
- Query keys: e.g. `adminQueryKeys.propertyExpenseExport(propertyId, jobId)`

**Can run in parallel with BE-1 / BE-2.**

---

### FE-2 — Minimal export flow (CSV only)

**Goal:** Shippable export button on the expenses page.

**Scope**

- Export control on `property-expenses-page.tsx` (similar to reports “Download CSV”)
- Pass current URL filters (`from`, `to`, `categoryId`, `q`)
- On click: `POST` → poll `GET` every 2–3s until `completed` or `failed`
- On complete: presigned URL → browser download (`window.location.href` or anchor)
- Loading: “Preparing export…” + disabled button
- Error toast on `failed`

**Ship with BE-3** — first user-visible release.

---

### FE-3 — UX polish

**Scope**

- Format selector: CSV enabled; Excel disabled until BE-5
- Progress copy (e.g. row count when available)
- Handle `expired` download gracefully
- Optional: warn on navigate-away during active export

---

### FE-4 — Excel option

**Scope**

- Enable `format: "xlsx"` when BE-5 is deployed
- Filename: `expenses-{property}-{from}-{to}.xlsx`

**Small PR** if FE-2/3 were format-agnostic from the start.

---

### FE-5 — Notification deep link (optional)

**Scope**

- Handle `expense_export_ready` in notification center
- Navigate to expenses or show “Download export” affordance

**Only after BE-6.**

---

## Dependency graph

```
Phase 0 (design)
    │
    ├─ BE-1 ─────────────────────────► FE-1
    │
    ├─ BE-2
    │     │
    │     └─ BE-3 ───────────────────► FE-2   ★ First shippable (CSV)
    │           │
    │           ├─ BE-4 ─────────────► FE-3
    │           │
    │           └─ BE-5 ─────────────► FE-4   (Excel)
    │                 │
    │                 └─ BE-6 ─────────► FE-5   (notifications)
```

**Parallelism:** BE-2 while BE-1 is in review; FE-1 alongside BE-2; FE-2 waits for BE-3.

**Solo dev order:** BE-1 → BE-2 → BE-3 → FE-2 minimizes rework.

---

## Suggested PR sequence

| #   | PR                           | User value            |
| --- | ---------------------------- | --------------------- |
| 1   | Shared types + BE-1 job API  | Internal; FE can stub |
| 2   | BE-2 CSV generator + tests   | None (foundation)     |
| 3   | BE-3 processor + S3 + FE-2   | **CSV export live**   |
| 4   | BE-4 cleanup + limits + FE-3 | Production-ready CSV  |
| 5   | BE-5 + FE-4                  | Excel export live     |
| 6   | BE-6 + FE-5                  | Notifications         |

---

## CSV vs Excel phasing

|                  | CSV (BE-2 → BE-3)        | Excel (BE-5)                      |
| ---------------- | ------------------------ | --------------------------------- |
| Streaming        | Native text chunks       | Requires streaming XLSX writer    |
| Memory           | Low                      | Higher if implemented incorrectly |
| Dependencies     | None (reuse CSV helpers) | New dep (`exceljs`)               |
| User expectation | Raw data dump            | Formatted spreadsheet             |
| Risk             | Low                      | Medium (OOM, slow generation)     |

**Industry norm:** ship async CSV first; add Excel once the job system is stable.

---

## What not to do

1. **Do not build sync CSV and async CSV** — two code paths, double maintenance. Tier 2 only.
2. **Do not buffer the full file in memory** before S3 upload — stream rows or use multipart upload.
3. **Do not add Redis/Bull on day one** — in-process worker + Postgres job locking (`FOR UPDATE SKIP LOCKED`) is enough for current scale.
4. **Do not implement Excel before the job pipeline works** — debugging format + async + S3 together is painful.
5. **Do not export via infinite scroll on the client** — no looping `fetchNextPage` in the browser.
6. **Do not tie export to currently loaded table rows** — always use the filter snapshot stored on the job.
7. **Do not expose raw S3 keys to the client** — only presigned download URLs with TTL.
8. **Do not skip property access checks on download** — authorize at create **and** download time.
9. **Do not leave stuck jobs in `processing` forever** — timeout → `failed` with a recoverable message.
10. **Do not merge BE-2 and BE-5 into one giant PR** — keep CSV and Excel as separate reviewable steps.

---

## Future (out of scope for initial phases)

- Portfolio-wide export across all properties
- Read replica for export queries
- Scheduled / recurring exports
- Separate worker process or queue service (when in-process poller is insufficient)
- Email with download link (alternative to in-app notification)
