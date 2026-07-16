# Lease rent period + partial payments — Implementation Phases

Small phased rollout: add explicit **rent period** on lease income lines (`rent_period_month`), then replace binary **paid / unpaid** with **amount rollup** (`paidRent`, `remainingRent`, `isPaid` = fully covered). Aligns manual admin recording, `getRentSchedule`, and tenant Stripe balance on one model.

**Related code today**

- [`apps/server/src/db/property-long-stays.ts`](../apps/server/src/db/property-long-stays.ts) — `getRentSchedule`; binary `isPaid` via first income line per `transactionDate` month
- [`packages/shared/src/property-partial-refund-utils.ts`](../packages/shared/src/property-partial-refund-utils.ts) — `isIncomeLinePaidForRentSchedule` (`netIncome > 0`)
- [`packages/shared/src/property-long-stay-types.ts`](../packages/shared/src/property-long-stay-types.ts) — `IPropertyLongStayRentMonth`
- [`packages/shared/src/property-income-line-types.ts`](../packages/shared/src/property-income-line-types.ts) — `IPropertyIncomeLine`, create/update bodies
- [`apps/server/src/routes/admin/property-income-line-routes.ts`](../apps/server/src/routes/admin/property-income-line-routes.ts) — create/update income; no future dates
- [`apps/admin/src/lib/lease-record-rent-prefill.ts`](../apps/admin/src/lib/lease-record-rent-prefill.ts) — Record Rent prefill; clamps date to today
- [`apps/admin/src/components/leases/lease-payments-section.tsx`](../apps/admin/src/components/leases/lease-payments-section.tsx) — Unpaid / Upcoming / Record UI
- [`apps/admin/src/lib/lease-rent-schedule-display.ts`](../apps/admin/src/lib/lease-rent-schedule-display.ts) — partition due vs upcoming
- [`apps/server/src/services/tenant-rent-payment-service.ts`](../apps/server/src/services/tenant-rent-payment-service.ts) — `buildBalancePeriods`, Stripe allocations, income on full cover
- [`packages/shared/src/tenant-rent-payment-utils.ts`](../packages/shared/src/tenant-rent-payment-utils.ts) — `remainingCents`, FIFO allocation
- [`docs/TENANT_STRIPE_RENT_PAYMENTS.md`](./TENANT_STRIPE_RENT_PAYMENTS.md) — Stripe period model (`period_month` on allocations)
- [`docs/LEASE_RENT_PRORATION_PHASES.md`](./LEASE_RENT_PRORATION_PHASES.md) — proration; currently any `netIncome > 0` marks paid

---

## Goals

- Operators can record rent **for a specific lease month**, even when `transactionDate` differs (late payment; prepayment later).
- Schedule shows **partially paid** months (`$500 / $1,500`) until fully covered.
- **Record** stays enabled on due unpaid/partial months; disabled on upcoming (already shipped).
- Tenant **amount due** and admin **unpaid summary** use the same rollup (income + Stripe allocations).
- **`isPaid`** remains on the contract but means **fully paid** (`remainingRent <= 0`).

## Non-goals (initial release)

- Tenant UI to choose periods or custom partial checkout amounts
- Prepayment for future months in admin UI (schema supports it; UI deferred)
- ACH, credits, late fees as first-class products
- Changing proration math
- Multi-currency
- Replacing `property_income_lines` with a separate payments ledger

---

## Guiding principles

1. **One period bucket per lease month** — rollup key is `YYYY-MM` on the lease schedule, not calendar date alone.
2. **`rent_period_month` is attribution; `transactionDate` is cash date** — reports stay correct; schedule uses period.
3. **Amount rollup is source of truth** — `paid = sum(reportable netIncome by period) + sum(succeeded Stripe allocations by period)`; no binary “any line exists”.
4. **Backward compatible reads** — null `rent_period_month` ⇒ fall back to `transactionDateToMonth(transactionDate)` until backfill complete.
5. **Reuse Stripe helpers** — extend `tenant-rent-payment-utils` / `buildBalancePeriods`; do not fork a second balance engine.
6. **API before UI** — prove rollup in `getRentSchedule` + tests before Payments tab changes.

---

## Target architecture

```
[Admin Record Rent] ──► POST income (transactionDate, rentPeriodMonth, amount)
[Tenant Stripe webhook] ──► allocations(period_month) ──► optional income line
                              │
                              ▼
              [rollupLeaseRentByPeriod]  ← packages/shared (pure)
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
      getRentSchedule   tenant balance   admin partition
              │               │               │
              ▼               ▼               ▼
   paidRent/remainingRent   amountDueCents   Unpaid / Partial UI
```

### Permissions

- Unchanged: owners/managers record rent via existing ledger write access (`assertPropertyLedgerWriteAccess`).
- Tenants: read balance only; no manual income.

---

## Data model (sketch)

### `property_income_lines` (migration v60+)

| Column | Notes |
| --- | --- |
| `rent_period_month` | `VARCHAR(7)` nullable, `YYYY-MM` check; meaningful when `long_stay_id IS NOT NULL` |
| Index | `(long_stay_id, rent_period_month)` partial where not deleted |

**Read rule:** effective period = `rent_period_month ?? transactionDateToMonth(transactionDate)`.

**Paid rule:** month fully paid when `paidRent >= expectedRent` (tolerance e.g. `0.01`).

---

## Shared contract (`packages/shared`)

| Type | Purpose |
| --- | --- |
| `IPropertyLongStayRentMonth` | Add `paidRent: number`, `remainingRent: number`; keep `isPaid` as fully paid |
| `IPropertyIncomeLine` | Add `rentPeriodMonth: string \| null` |
| `ICreatePropertyIncomeLineBody` | Optional `rentPeriodMonth` when `longStayId` set |
| `IUpdatePropertyIncomeLineBody` | Optional `rentPeriodMonth` when `longStayId` set |
| `rollupLeaseRentPeriod(input)` | Pure: income lines + allocations → per-month paid/remaining |
| `isLeaseRentMonthFullyPaid(expected, paid)` | Shared tolerance helper |

---

## API (sketch)

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/properties/:id/long-stays/:leaseId` | `rentSchedule[]` includes `paidRent`, `remainingRent` |
| `POST` | `/properties/:id/income-lines` | Accept `rentPeriodMonth`; validate ∈ lease schedule when `longStayId` set |
| `PATCH` | `/properties/:id/income-lines/:lineId` | Same optional field; recompute affected months |
| `GET` | `/tenant/me/leases/:leaseId/balance` | Uses unified rollup (already exposes `remainingCents`) |

No new endpoints required for v1 if existing detail + balance responses carry enriched schedule fields.

---

## Real-time / events

N/A — cache invalidation via existing TanStack Query keys (`invalidatePropertyLongStayCaches`, `invalidatePropertyIncomeCaches`).

---

## Worker / job queue

N/A for v1. Optional one-off backfill script in Phase 1b (not a long-running worker).

---

## Phased rollout

### Phase 0 — Foundation (no user-facing change)

**Goal:** Schema + pure rollup utilities + tests.

- [x] Migration v60: `rent_period_month` on `property_income_lines`
- [x] Mapper + `IPropertyIncomeLine` / create body in `packages/shared`
- [x] `rollupLeaseRentPeriod()` in `packages/shared` (income + optional allocation inputs)
- [x] Unit tests: zero paid, partial, full, multiple lines same period, refund reduces paid, fallback when `rentPeriodMonth` null

**Exit criteria:** Migration applies; shared rollup tests pass.

---

### Phase 1 — Server read path (API only)

**Goal:** `getRentSchedule` and tenant `buildBalancePeriods` use amount rollup.

- [x] Refactor `getRentSchedule` in [`property-long-stays.ts`](../apps/server/src/db/property-long-stays.ts): load all lease income lines; group by effective period; sum reportable `netIncome`
- [x] Include succeeded Stripe allocations in rollup (same sources as `buildBalancePeriods` today)
- [x] Populate `paidRent`, `remainingRent`, `isPaid` (= fully paid)
- [x] Align [`tenant-rent-payment-service.ts`](../apps/server/src/services/tenant-rent-payment-service.ts) `buildBalancePeriods` to call shared rollup (remove `isPaid ? expectedCents : 0` shortcut)
- [x] Server tests: partial manual payment keeps month unpaid; two partials sum to paid; Stripe partial allocation reflected

**Exit criteria:** API returns correct partial state in Postman/tests (legacy binary `isPaid` path removed).

---

### Phase 1b — Write path (still minimal UI)

**Goal:** New/edited lines set period correctly.

- [x] Parse/validate `rentPeriodMonth` on income create/update when `longStayId` present (must match a month in lease schedule)
- [x] Default: `rentPeriodMonth = transactionDateToMonth(transactionDate)` if omitted
- [x] [`buildLeaseRecordRentPrefill`](../apps/admin/src/lib/lease-record-rent-prefill.ts): set `rentPeriodMonth` from clicked schedule month (not only `transactionDate`)
- [x] Stripe `applyIncomeForFullyCoveredMonths`: set `rentPeriodMonth` on created lines; consider writing income on **partial** allocation (optional in 1b or Phase 3)
- [x] Backfill script: set `rent_period_month = left(transaction_date, 7)` for existing `long_stay_id` rows

**Exit criteria:** New Record Rent rows persist `rent_period_month`; schedule reflects them via rollup.

---

### Phase 2 — Admin UI MVP

**Goal:** Payments tab shows partial state; Record works per period.

- [x] Extend [`lease-payments-section.tsx`](../apps/admin/src/components/leases/lease-payments-section.tsx): show `paidRent / expectedRent` subtitle; keep Record on due months with `remainingRent > 0`
- [x] [`partitionRentSchedule`](../apps/admin/src/lib/lease-rent-schedule-display.ts): treat partial as due unpaid (not paid section)
- [x] Record dialog: show **Rent period** (read-only from row) vs **Payment date**
- [x] Summary: `{count} unpaid · {total} expected` uses `remainingRent` sum, not full expected
- [x] Invalidate caches on income create as today

**Exit criteria:** Operator records $500 on $1,500 month → stays in Unpaid with partial label; second payment completes → moves to Paid.

---

### Phase 3 — Tenant balance alignment

**Goal:** Tenant amount due matches admin partial logic.

- [x] Rent summary / balance endpoints use Phase 1 rollup
- [x] Partial Stripe payment reduces `amountDueCents` before month is fully paid

**Exit criteria:** Sandbox partial Stripe payment → tenant home shows reduced due; full payment → month paid on both sides.

---

### Phase 4 — Hardening

**Goal:** Production-safe edge cases.

| Concern | Action |
| --- | --- |
| Refunds | Recompute period paid after partial/full refund |
| Idempotency | Multiple income lines per period allowed; rollup is sum |
| Validation | Reject `rentPeriodMonth` outside lease schedule; block upcoming prepay until product allows |
| Rounding | Single tolerance constant in shared helper |
| Observability | Optional metric for partial months count |
| Docs | Update [`LEASE_RENT_PRORATION_PHASES.md`](./LEASE_RENT_PRORATION_PHASES.md) paid rule |

**Exit criteria:** Refund + re-record tests pass; backfill complete.

---

### Phase 5 — Enhancements (post-launch)

- Admin prepayment: Record with `transactionDate=today`, `rentPeriodMonth=future` (when upcoming UX allows)
- Tenant partial / period-select checkout UI (reuse FIFO helpers in `tenant-rent-payment-utils`)
- Income list column/filter by `rentPeriodMonth`

---

## What not to do

- Do **not** implement partial rollup on `transactionDate` alone without `rent_period_month` — prepayment and late pay stay broken.
- Do **not** keep binary `isPaid` as “any payment exists” once rollup ships — that hides partial state.
- Do **not** write Stripe income only on full cover without updating allocation rollup — tenant partial pay would be invisible until income row exists.
- Do **not** allow Record on upcoming months until prepayment is an explicit product decision.
- Do **not** add a second balance implementation in admin — consume enriched `rentSchedule` from API.
- Do **not** require exact amount match on Record — partial amounts are valid v1.
- Do **not** change proration formulas in this project — only payment attribution and rollup.

---

## Safest sequencing summary

1. **Schema + pure rollup (Phase 0)** before any read-path or UI change.
2. **Read path (Phase 1)** before write path or UI — verify with tests/API.
3. **Write path + backfill (Phase 1b)** before showing partial UI — otherwise UI lies.
4. **Admin UI (Phase 2)** only after API returns `paidRent` / `remainingRent`.
5. **Tenant balance (Phase 3)** after admin + Stripe paths share rollup.
6. **Hardening (Phase 4)** after backfill + refund paths are verified.
