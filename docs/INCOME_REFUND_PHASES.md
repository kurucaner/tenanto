# Income Refunds — Implementation Phases

Roadmap for full refunds on short stays (reservations) and other income (income lines). Refunded entries remain visible in the income ledger but are excluded from financial reports and lease rent schedules.

**Related code today**

- Income table merges two sources: `property-income-page.tsx` → `reservationsApi.list` + `incomeLinesApi.list`
- Soft delete pattern: `is_deleted` + `deleted_at` on both tables (migration v35)
- Report aggregation: `property-report-service.ts` → `loadReportData` + `applyReservationToReport` / `applyIncomeLineToReport`
- Lease rent schedule: `property-long-stays.ts` → `getRentSchedule` (checks paid income lines by month)
- Confirmation UI: `useDeleteConfirmation` + `DeleteConfirmationDialog`

---

## Architecture decision

**Add columns to each table — not a separate `refunded_incomes` table.**

| Approach | Verdict |
|----------|---------|
| `refunded_at` on `property_reservations` + `property_income_lines` | **Recommended** — no JOINs, same query paths as today |
| Separate refund table | Extra JOIN/EXISTS on every list and report read |
| Negative income line (partial refund) | Future feature, not v1 |

### Schema (migration v49)

```sql
ALTER TABLE property_reservations
  ADD COLUMN refunded_at TIMESTAMPTZ,
  ADD COLUMN refunded_by UUID REFERENCES users(id);

ALTER TABLE property_income_lines
  ADD COLUMN refunded_at TIMESTAMPTZ,
  ADD COLUMN refunded_by UUID REFERENCES users(id);
```

Use `refunded_at IS NOT NULL` as the refunded flag (no separate boolean needed).

### Behavior matrix

| | Income table | Reports / home overview | Lease rent schedule |
|--|--------------|-------------------------|---------------------|
| **Normal** | Visible | Counted in totals | Month marked paid if income line exists |
| **Refunded** | Visible + badge | **Excluded** from totals | Month marked **unpaid** if rent line refunded |
| **Deleted** | Hidden (default) | Excluded (`is_deleted = false`) | Excluded |

### Do not reuse

| Mechanism | Why not |
|-----------|---------|
| `is_deleted` | Delete = remove/hide; refund = financial reversal with audit trail |
| `status = canceled` | Booking status; canceled stays still count toward report revenue today |

---

## Guiding principles

1. **Mirror soft-delete patterns** — `refund()` / `unrefund()` DB methods, `/refund` and `/unrefund` routes like `/restore`.
2. **List shows refunded rows; reports hide them** — opposite visibility intent from delete.
3. **Stays and lines are independent** — refunding a stay does not auto-refund linked income lines.
4. **Full refund only in v1** — partial refunds deferred (negative income line adjustment).

---

## Phase 1 — Shared contract + DB

**Goal:** Persist refund state; no user-facing changes yet.

### `packages/shared`

Add to `IPropertyReservation` and `IPropertyIncomeLine`:

- `refundedAt: string | null`
- `refundedBy: string | null` (optional to expose in API responses in v1)

### Server

| File | Change |
|------|--------|
| `db/migrations.ts` | Migration v49 (columns on both tables) |
| `db/mappers.ts` | Map `refunded_at`, `refunded_by` |
| `db/property-reservations.ts` | `refund(id, userId)`, `unrefund(id)` |
| `db/property-income-lines.ts` | `refund(id, userId)`, `unrefund(id)` |

**Deliverable:** DB layer ready; mappers return `refundedAt` on existing list endpoints automatically.

---

## Phase 2 — API + report logic

**Goal:** Refund/unrefund endpoints; financial and lease logic respect refund state.

### Routes

| Method | Path |
|--------|------|
| `POST` | `/properties/:propertyId/reservations/:reservationId/refund` |
| `POST` | `/properties/:propertyId/reservations/:reservationId/unrefund` |
| `POST` | `/properties/:propertyId/income-lines/:lineId/refund` |
| `POST` | `/properties/:propertyId/income-lines/:lineId/unrefund` |

**Auth:** Same as delete — `assertPropertyMemberAccess` + `assertPropertyLedgerWriteAccess` (“Only property owners and managers can manage income entries”).

### Route guards

Add `rejectIfRefunded` next to existing `rejectIfDeleted` in `routes/admin/reject-if-deleted.ts` (or sibling helper).

| Case | Response |
|------|----------|
| Not found | 404 |
| Deleted | 400 |
| Already refunded (on refund) | 409 |
| Not refunded (on unrefund) | 409 |

**Edit/delete while refunded:** Block edit (`rejectIfRefunded` on PATCH); allow delete (soft-delete unchanged).

### Report exclusion

In `property-report-service.ts`, skip refunded rows in:

- `applyReservationToReport`
- `applyIncomeLineToReport`

This automatically fixes property reports, portfolio reports, and `/home/financial-overview` (all use `buildPortfolioReportSummary` / `loadReportData`).

### Lease rent schedule

Update `getRentSchedule` in `property-long-stays.ts`:

```sql
WHERE long_stay_id = $1
  AND is_deleted = false
  AND refunded_at IS NULL
```

### Tests

| File | Coverage |
|------|----------|
| `property-report-service.test.ts` | Refunded stay/line excluded from gross/net totals |
| Route or DB tests | Refund/unrefund guards (404, 409, deleted) |
| Lease rent schedule test | Refunded rent line → month `isPaid: false` |

**Milestone:** Refund works via API; reports and rent schedule correct.

---

## Phase 3 — Admin UI

**Goal:** Refund action on income table with confirmation dialog.

### API client (`api-client.ts`)

```ts
reservationsApi.refund(propertyId, reservationId)
reservationsApi.unrefund(propertyId, reservationId)
incomeLinesApi.refund(propertyId, lineId)
incomeLinesApi.unrefund(propertyId, lineId)
```

### Income page (`property-income-page.tsx`)

Reuse existing confirmation pattern:

- `useDeleteConfirmation` + `DeleteConfirmationDialog`
- `confirmLabel: "Refund"` / `"Undo refund"`
- Separate confirmation flows for stays vs lines (same pattern as delete today)

**Actions column** (`IncomeStayEntryRow` + `IncomeLineEntryRow`, when `canManage && !isDeleted`):

| State | Action |
|-------|--------|
| Not refunded | Refund button → confirmation dialog |
| Refunded | Undo refund button → confirmation dialog |

Do not show refund on deleted rows.

### Visual

| Component | Purpose |
|-----------|---------|
| `RefundedBadge` | New badge (mirror `DeletedBadge` in `deleted-badge.tsx`) |
| Optional row class | Muted styling for refunded rows (lighter than deleted — still readable) |

### Cache invalidation

Extend `invalidatePropertyIncomeCaches` (or add `invalidatePropertyIncomeAndReportsCaches`) to also invalidate:

- `propertyReportSummary`
- `portfolioReportSummary`
- `homeFinancialOverview`
- `propertyLongStay` (when refunding a rent-linked income line)

**Milestone:** First user-facing release.

---

## PR sequence

| # | PR | User value |
|---|-----|------------|
| 1 | Phase 1 — migration, types, mappers, DB methods | Internal |
| 2 | Phase 2 — routes, reports, rent schedule, tests | API-ready |
| 3 | Phase 3 — admin UI + cache invalidation | **Refunds live** |

**Solo dev order:** Phase 1 → Phase 2 → Phase 3.

---

## Out of scope (v1)

- Partial refunds (future: negative income line / adjustment row)
- Auto-refund linked income lines when refunding a stay
- Refund reason / notes column
- Audit log events for refund actions
- Income export (separate roadmap: `EXPENSE_EXPORT_PHASES.md`)

---

## What not to do

1. **Do not use `status = canceled` as refund** — different domain meaning; reports still count canceled stays today.
2. **Do not use `is_deleted` for refunds** — delete hides; refund reverses financially but keeps visible.
3. **Do not add a `refunded_incomes` table** — unnecessary JOINs on every read for a 1:1 flag.
4. **Do not filter refunded rows out of the income list** — only exclude from report aggregation.
5. **Do not buffer or duplicate refund state client-side** — server is source of truth via `refundedAt`.
6. **Do not forget lease rent schedule** — refunded rent must show month as unpaid again.

---

## Future (optional follow-ups)

- Partial refund via negative income line with link to original
- Filter income table by refunded / not refunded
- Audit events: `income_refunded`, `income_unrefunded`
- Notification to property owner on refund (if multi-user audit matters)
