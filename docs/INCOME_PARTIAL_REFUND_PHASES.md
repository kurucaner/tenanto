# Income Partial Refunds — Implementation Phases

Roadmap for partial refunds on short stays (reservations) and other income (income lines). Builds on full refunds ([`INCOME_REFUND_PHASES.md`](./INCOME_REFUND_PHASES.md), migration v49). Refunded entries remain visible in the income ledger; reports count only the **remaining** (non-refunded) portion.

**Prerequisite:** Full refund flow is live (Phases 1–3 of `INCOME_REFUND_PHASES.md`).

**Related code today**

- Refund columns: `refunded_at`, `refunded_by` on `property_reservations` + `property_income_lines` (migration v49)
- Refund routes: `POST .../short-stays/:id/refund`, `POST .../income-lines/:id/refund` (no request body)
- Report exclusion: `property-report-service.ts` → early return when `refundedAt !== null`
- Lease rent schedule: `property-long-stays.ts` → `refunded_at IS NULL`
- Refund UI: `property-income-page.tsx` → `useDeleteConfirmation` + `DeleteConfirmationDialog`
- Decimal input pattern: `isValidDecimalInput` in `decimal-input-utils.ts`

---

## Architecture decision

**Extend existing refund columns with `refunded_amount` — not a separate table, not negative adjustment lines (for now).**

| Approach | Verdict |
| -------- | ------- |
| `refunded_amount` on parent row | **Recommended** — extends v1 model; one row in ledger; Full/Partial dialog maps directly |
| Negative income line / adjustment row | Better for multiple partial refunds over time; defer unless product needs refund history rows |
| Separate `refunded_incomes` table | Extra JOINs on every list and report read |

### Schema (migration v52)

```sql
ALTER TABLE property_reservations
  ADD COLUMN refunded_amount NUMERIC(12,2);

ALTER TABLE property_income_lines
  ADD COLUMN refunded_amount NUMERIC(12,2);
```

Keep `refunded_at` / `refunded_by` unchanged. Do **not** add `is_refunded` — `refunded_at IS NOT NULL` remains the refunded flag.

### Refund amount semantics

| State | `refunded_at` | `refunded_amount` | Report behavior |
| ----- | ------------- | ----------------- | --------------- |
| **Normal** | `NULL` | `NULL` | Count full row |
| **Partial** | set | `0 < amount < cap` | Count **remaining** portion (proportional) |
| **Full** | set | `= cap` (or omit body → default to cap) | Count nothing (same as v1) |

**Refundable cap per entry type:**

| Entry | Cap field | Rationale |
| ----- | --------- | --------- |
| Income line | `amount` | User-editable sale amount; equals `grossIncome` for misc lines |
| Stay | `grossIncome` | Reports aggregate gross; room total, taxes, and commission are derived |

Full refund with no body `{ }` sets `refunded_amount = cap` (backward compatible with v1 behavior).

### Behavior matrix (updated)

| | Income table | Reports / home overview | Lease rent schedule |
| --- | --- | --- | --- |
| **Normal** | Visible | Counted in totals | Month paid if rent line exists |
| **Partially refunded** | Visible + partial badge | **Reduced** totals (proportional) | Month paid if **remaining** rent > 0 |
| **Fully refunded** | Visible + badge | Excluded | Month **unpaid** |
| **Deleted** | Hidden (default) | Excluded | Excluded |

### Do not reuse

| Mechanism | Why not |
| --------- | ------- |
| Negative `amount` on normal income lines | Only valid under a future adjustment-line model; not this phase |
| Mutating stored `grossIncome` / `roomTotal` on refund | Original sale must stay intact for audit and undo |
| `is_deleted` | Delete hides; refund reverses financially but keeps visible |

---

## Product decisions (lock in Phase 0)

| Decision | Recommendation |
| -------- | -------------- |
| Refund basis (stays) | `grossIncome` |
| Refund basis (lines) | `amount` |
| Multiple partial refunds | **No** in v1 — one refund event per entry; undo to change amount |
| Edit while partially refunded | Blocked (same as full refund today via `rejectIfRefunded`) |
| Undo refund | Clears `refunded_at`, `refunded_by`, and `refunded_amount` |
| CSV import partial refunds | Out of scope |

---

## Guiding principles

1. **Extend v1, don't replace it** — full refund (no body) behaves exactly as today.
2. **Original amounts are immutable** — store refund separately; compute reportable amounts at read time.
3. **Proportional scaling for stays** — scale `grossIncome`, `netIncome`, `taxBreakdown`, `roomTotal`, `cleaningFee`, and `channelCommission` by `(cap - refundedAmount) / cap`.
4. **Shared math in `packages/shared`** — server reports and any future client previews use the same helpers.
5. **Server validates cap** — client enforces max for UX; API rejects `amount <= 0` or `amount > cap`.

---

## Phase 0 — Design spike ✅

**Goal:** Lock API shape and proportional scaling rules before implementation.

**Deliverable:** Confirm cap fields, rounding rules, and lease rent schedule behavior for partial rent refunds. No user-facing changes.

**Implemented in `packages/shared`:**

| File | Contents |
| ---- | -------- |
| `property-partial-refund-types.ts` | `IRefundLedgerEntryBody`, `IReportableStayAmounts`, `TReportableIncomeLineAmounts` |
| `property-partial-refund-utils.ts` | Cap, report-factor, reportable-amount, rent-schedule, and validation helpers |
| `property-partial-refund-utils.test.ts` | Unit tests for scaling, caps, and lease rent schedule rules |

**Shared helpers:**

```ts
getIncomeLineRefundableCap(line: IPropertyIncomeLine): number;
getStayRefundableCap(stay: IPropertyReservation): number;
isFullyRefunded(refundedAt: string | null, refundedAmount: number | null, cap: number): boolean;
getReportableStayAmounts(stay: IPropertyReservation): IReportableStayAmounts;
getReportableIncomeLineAmounts(line: IPropertyIncomeLine): TReportableIncomeLineAmounts;
getPartialRefundReportFactor(refundedAt, refundedAmount, cap): number;
isIncomeLinePaidForRentSchedule(line): boolean;
validateRefundAmount(body, cap): { ok: true; amount } | { ok: false; error };
```

**Locked rules:**

- Stay cap = `grossIncome`; line cap = `amount`
- Proportional factor = `(cap - refundedAmount) / cap` (not rounded); each monetary field rounded via `roundMoney`
- `channelCommissionRate` is not scaled
- Lease rent schedule: month paid when `getReportableIncomeLineAmounts(line).netIncome > 0`

**Types added (ahead of Phase 1 migration):** `refundedAmount: number | null` on `IPropertyReservation` and `IPropertyIncomeLine`; mappers return `null` until migration v52.

---

## Phase 1 — Shared contract + DB

**Goal:** Persist partial refund amount; no user-facing changes yet.

### `packages/shared`

Add to `IPropertyReservation` and `IPropertyIncomeLine`:

- `refundedAmount: number | null`

Add request body type:

```ts
interface IRefundLedgerEntryBody {
  amount?: number; // omitted = full refund (defaults to cap)
}
```

Add cap + reportable-amount helpers (see Phase 0) with unit tests.

### Server

| File | Change |
| ---- | ------ |
| `db/migrations.ts` | Migration v52 (`refunded_amount` on both tables) |
| `db/mappers.ts` | Map `refunded_amount` → `refundedAmount` |
| `db/property-reservations.ts` | `refund(id, userId, amount?)`, clear `refunded_amount` on `unrefund` |
| `db/property-income-lines.ts` | Same |

**Backfill:** Existing refunded rows (where `refunded_at IS NOT NULL`) should get `refunded_amount = cap` in migration `up` so they remain fully refunded.

**Deliverable:** DB layer ready; list endpoints return `refundedAmount` automatically.

---

## Phase 2 — API + report logic

**Goal:** Refund endpoints accept optional amount; financial and lease logic use reportable (remaining) amounts.

### Routes

Existing endpoints gain an optional JSON body:

| Method | Path | Body |
| ------ | ---- | ---- |
| `POST` | `/properties/:propertyId/short-stays/:shortStayId/refund` | `{ amount?: number }` |
| `POST` | `/properties/:propertyId/income-lines/:lineId/refund` | `{ amount?: number }` |

`unrefund` routes unchanged (no body).

**Auth:** Same as v1 — `assertPropertyMemberAccess` + `assertPropertyLedgerWriteAccess`.

### Route validation

| Case | Response |
| ---- | -------- |
| Not found | 404 |
| Deleted | 400 |
| Already refunded | 409 |
| `amount <= 0` | 400 |
| `amount > cap` | 400 |
| Invalid / non-numeric amount | 400 |

Update `executeLedgerRefund` in `ledger-refund-route-actions.ts` to parse body and pass amount to DB.

### Report logic

In `property-report-service.ts`, replace early return on `refundedAt !== null` with reportable amounts:

- `applyReservationToReport` → use `getReportableStayAmounts(stay)`; skip if reportable gross is 0
- `applyIncomeLineToReport` → use `getReportableIncomeLineAmounts(line)`; skip if reportable gross is 0

This automatically fixes property reports, portfolio reports, and `/home/financial-overview`.

### Lease rent schedule

Update `getRentSchedule` in `property-long-stays.ts`:

- Replace `refunded_at IS NULL` with logic that treats a rent line as paid when **reportable amount > 0**
- Full refund → month unpaid (same as v1)
- Partial refund → month still paid if remaining rent > 0

### Tests

| File | Coverage |
| ---- | -------- |
| `packages/shared` (new) | Cap helpers, proportional scaling, rounding edge cases |
| `property-report-service.test.ts` | Partial stay/line reduces gross/net; full still excluded |
| `ledger-refund-route-actions.test.ts` | Amount validation (400, 409) |
| `property-long-stays-rent-schedule.test.ts` | Partial rent refund → month still paid; full → unpaid |

**Milestone:** Partial refund works via API; reports and rent schedule correct.

---

## Phase 3 — Admin UI

**Goal:** Refund dialog with Full / Partial options and amount input.

### API client (`api-client.ts`)

```ts
shortStaysApi.refund(propertyId, shortStayId, { amount?: number });
incomeLinesApi.refund(propertyId, lineId, { amount?: number });
// unrefund unchanged
```

### New component: `RefundEntryDialog`

Replace simple confirmation for **refund** (not undo) with a dedicated dialog:

| UI element | Behavior |
| ---------- | -------- |
| Radio: **Full** | Default; no amount field; POST with no body |
| Radio: **Partial** | Shows amount input |
| Amount input | `isValidDecimalInput` (blocks letters); max 2 decimal places |
| Max label | Shows cap (`formatMoney(cap)`) |
| Submit disabled | When Partial selected and amount invalid or `amount > cap` |
| Confirm label | "Refund" |

Undo refund keeps the existing simple confirmation (`Undo refund`).

### Income page (`property-income-page.tsx`)

- Replace `buildStayRefundConfirmationOptions` / `buildLineRefundConfirmationOptions` refund path with `RefundEntryDialog`
- Pass cap: `getStayRefundableCap(stay)` / `getIncomeLineRefundableCap(line)`
- Undo refund flow unchanged

### Visual

| Component | Purpose |
| --------- | ------- |
| `PartiallyRefundedBadge` | Shows refunded amount, e.g. "Partially refunded · $125.00" |
| `RefundedBadge` | Keep for full refund |
| Row class | Same muted styling as full refund (`ledger-entry-row-styles.ts`) |

Optional: show remaining amount in table cells for partially refunded rows (e.g. "$375.00 of $500.00").

### Cache invalidation

Same as v1 — invalidate income + report + lease caches on refund/unrefund.

**Milestone:** Partial refunds live in admin UI.

---

## PR sequence

| # | PR | User value |
| --- | --- | --- |
| 1 | Phase 1 — migration v52, types, mappers, DB methods, shared helpers + tests | Internal |
| 2 | Phase 2 — route body, validation, report scaling, rent schedule, tests | API-ready |
| 3 | Phase 3 — `RefundEntryDialog` + badges + cache invalidation | **Partial refunds live** |

**Solo dev order:** Phase 1 → Phase 2 → Phase 3.

---

## Out of scope (v1 partial)

- Multiple partial refunds on the same entry (incremental `refunded_amount` updates)
- Negative adjustment income lines linked to original
- Partial refunds via CSV import
- Refund reason / notes column
- Audit log events for partial refund actions
- Auto-refund linked income lines when partially refunding a stay

---

## What not to do

1. **Do not add `is_refunded`** — `refunded_at IS NOT NULL` is sufficient.
2. **Do not mutate original sale amounts** on refund — store `refunded_amount` separately.
3. **Do not allow negative amounts** on normal income line create/update.
4. **Do not skip proportional scaling for stays** — subtracting only `refunded_amount` from gross while leaving taxes/commission untouched will skew reports.
5. **Do not filter partially refunded rows out of the income list** — only reduce report aggregation.
6. **Do not trust client-side max validation alone** — server must enforce `amount <= cap`.

---

## Future (optional follow-ups)

- Negative adjustment income line with `refund_of_reservation_id` / `refund_of_income_line_id` (supports multiple partial refunds + audit trail)
- Incremental partial refunds (add to `refunded_amount` until cap)
- Filter income table by refunded / partially refunded / not refunded
- Audit events: `income_partially_refunded`, `income_refunded`
- CSV import: partial refund amount column
