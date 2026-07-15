# Lease Rent Proration — Implementation Phases

Roadmap for **industry-standard residential proration** on long-term leases: actual calendar days in month, inclusive move-in/move-out days, applied to the first partial month, last partial month (early move-out or holdover), and full months in between. Uses existing Postgres lease fields — **no schema migration** — with authoritative math in `packages/shared` and `expectedRent` computed server-side in `getRentSchedule`.

**Related code today**

- Lease date math: `packages/shared/src/lease-date-utils.ts` — end date, month enumeration, move-out validation (blocks post-lease-end dates)
- Rent lookup by month: `packages/shared/src/lease-rent-utils.ts` — `getLeaseRentForMonth`, extension validation
- Rent schedule (full month today): `apps/server/src/db/property-long-stays.ts` — `getRentSchedule`
- Rent schedule tests: `apps/server/src/db/property-long-stays-rent-schedule.test.ts`
- End lease API: `apps/server/src/routes/admin/property-long-stay-routes.ts` — `POST …/end`
- End lease UI: `apps/admin/src/components/leases/end-lease-dialog.tsx`
- Payments UI: `apps/admin/src/components/leases/lease-payments-section.tsx`
- Record rent prefill: `apps/admin/src/pages/property-lease-detail-page.tsx`, `apps/admin/src/pages/property-leases-page.tsx`
- Start lease: `apps/admin/src/components/leases/start-lease-dialog.tsx`
- Paid-month detection: `packages/shared/src/property-partial-refund-utils.ts` — `isIncomeLinePaidForRentSchedule`
- Shared types: `packages/shared/src/property-long-stay-types.ts` — `IPropertyLongStayRentMonth`

---

## Goals

- First month prorated when `leaseStartDate` is not the 1st
- Last month prorated when tenant moves out before month end (early move-out) or after `leaseEndDate` (holdover)
- Middle months remain full `monthlyRent` (respecting rent periods from extensions)
- `expectedRent = roundMoney(monthlyRent × (occupiedDays / daysInMonth))` with **inclusive** day counting
- **End Lease** accepts `actualEndDate` after `leaseEndDate` so holdover days are billable
- Rent schedule, Record Rent prefill, and unpaid summaries all use the same prorated `expectedRent`
- Comprehensive edge-case test matrix (February, same-month leases, leap years, rent period changes)

## Non-goals (initial release)

- Holdover **penalty** rate (150%/200% daily) — defer to Phase 5
- Configurable proration method (30-day month, 365-day year)
- "Extend lease by X days" workflow
- DB migration or persisted proration snapshots
- Server enforcement that income amount must exactly equal `expectedRent`
- Backfill/recalculate historical income lines
- Changes to how `leaseEndDate` is computed on lease create

---

## Guiding principles

1. **`packages/shared` is the contract** — proration formula lives in pure utilities with tests; server and admin import identical logic.
2. **Actual move-out is source of truth** — `actualEndDate` drives the final partial month; holdover is not a separate product concept in v1.
3. **Compute, don't store** — `expectedRent` is derived from dates + `monthlyRent` + rent periods; no new columns.
4. **Inclusive day counting** — move-in and move-out days both count (June 16–30 = 15 days).
5. **Same rounding everywhere** — use existing `roundMoney` (2 decimal places) on final prorated amounts.
6. **Paid status unchanged** — a month stays "paid" when a linked income line has reportable `netIncome > 0` (partial payments still allowed).

---

## Target architecture

```
[Lease dates + rent periods]
        ↓
packages/shared  calculateExpectedRentForLeaseMonth()
        ↓
propertyLongStaysDb.getRentSchedule()  →  IPropertyLongStayRentMonth[]
        ↓
GET /long-stays/:id  →  admin lease detail / payments section
        ↓
Record Rent dialog  ←  expectedRent prefill
        ↓
POST /long-stays/:id/end  ←  actualEndDate (may be > leaseEndDate)
```

### Permissions

- Unchanged: owners/managers end leases and record rent (`assertPropertyLedgerWriteAccess`)
- Accountants: read-only (no new permissions)

### Feature flag

N/A — safe to ship as corrected billing math. Optional `LEASE_PRORATION_V2` only if a dark period is needed; not required for a pure calculation fix.

---

## Data model (sketch)

**No migration.** Existing fields drive proration:

| Field | Role |
| --- | --- |
| `lease_start_date` | First-month occupancy start |
| `lease_end_date` | Contract end (may be before actual move-out) |
| `actual_end_date` | Set on end; overrides schedule end when present |
| `monthly_rent` | Base rate |
| `property_long_stay_rent_periods` | Mid-lease rent changes via `getLeaseRentForMonth` |

**Schedule effective end date (v1 rule):**

| Lease status | Effective end for rent schedule |
| --- | --- |
| `ended` | `actualEndDate ?? leaseEndDate` |
| `active`, today ≤ `leaseEndDate` | `leaseEndDate` |
| `active`, today > `leaseEndDate` (holdover) | `today` (provisional until End Lease sets `actualEndDate`) |

**Proration formula:**

```
dailyRate     = monthlyRent / daysInMonth
expectedRent  = roundMoney(dailyRate × occupiedDays)
```

Where `occupiedDays` is the inclusive overlap of `[leaseStartDate, effectiveEndDate]` with the calendar month.

---

## Shared contract (`packages/shared`)

| Type / function | Purpose |
| --- | --- |
| `getDaysInMonth(month: string): number` | Calendar days for `YYYY-MM` |
| `getOccupiedDaysInMonth(month, leaseStart, effectiveEnd): number` | Inclusive overlap with lease occupancy |
| `calculateExpectedRentForLeaseMonth({ month, leaseStartDate, effectiveEndDate, baseMonthlyRent, rentPeriods })` | Prorated or full rent |
| `getLeaseScheduleEffectiveEndDate(lease, today): string` | Centralize holdover vs ended logic |
| `isProratedLeaseMonth(...)` | Optional helper for UI badge |
| Extend `IPropertyLongStayRentMonth` | Optional `isProrated`, `occupiedDays`, `daysInMonth` for UI |

Update `validateEndLeaseMoveOutDate` / `getEndLeaseMoveOutDateBounds`:

- Allow `actualEndDate > leaseEndDate` (holdover)
- Still reject past dates relative to `today` when ending an active lease
- For overdue leases: allow `actualEndDate` from `leaseEndDate` through `today` (not only `today`)

---

## API (sketch)

| Method | Path | Change |
| --- | --- | --- |
| `GET` | `/properties/:id/long-stays/:longStayId` | `rentSchedule[].expectedRent` becomes prorated; optional metadata fields |
| `POST` | `/properties/:id/long-stays/:longStayId/end` | Relaxed move-out validation; same body `{ actualEndDate }` |

No new endpoints.

---

## Real-time / events

N/A — synchronous read/compute path.

---

## Worker / job queue

N/A.

---

## UI — lease surfaces

1. **Lease payments section** — show prorated hint on partial months (e.g. "15/30 days · $500.00")
2. **End Lease dialog** — allow move-out after lease end; show computed final-month rent before confirm
3. **Start Lease dialog** — preview first-month expected rent when start ≠ 1st (optional but high value)
4. **Record Rent** — prefill already uses `expectedRent`; should work once schedule is correct

---

## Phased rollout

### Phase 0 — Foundation (no user-facing feature)

**Goal:** Pure proration utilities + move-out validation redesign, fully tested in isolation.

- [ ] Add `packages/shared/src/lease-proration-utils.ts` (or extend `lease-rent-utils.ts` if small)
- [ ] Implement `getDaysInMonth`, `getOccupiedDaysInMonth`, `calculateExpectedRentForLeaseMonth`, `getLeaseScheduleEffectiveEndDate`
- [ ] Integrate `getLeaseRentForMonth` for the applicable monthly rate per calendar month
- [ ] Round with `roundMoney` on final amount
- [ ] Add `packages/shared/src/lease-proration-utils.test.ts` — edge case matrix:
  - Start 6/16 → June prorated, July full
  - End early mid-month
  - Holdover 5 days into next month
  - Same-month start and end
  - February 2024 (leap) and February 2025 (non-leap)
  - Start on 1st / end on last day → full month
  - Rent period change mid-lease on a prorated month
- [ ] Redesign `validateEndLeaseMoveOutDate` / `getEndLeaseMoveOutDateBounds` + update `lease-date-utils.test.ts`
- [ ] Export new symbols from `packages/shared/src/index.ts`

**Exit criteria:** All shared unit tests pass; no server/admin imports yet; formula documented in test names.

---

### Phase 1 — Backend pipeline (API only, no UI)

**Goal:** `getRentSchedule` and end-lease API return correct prorated `expectedRent`.

- [ ] Refactor `propertyLongStaysDb.getRentSchedule` to call `calculateExpectedRentForLeaseMonth` per month
- [ ] Use `getLeaseScheduleEffectiveEndDate` for holdover preview on active leases
- [ ] Optionally extend `IPropertyLongStayRentMonth` with `isProrated`, `occupiedDays`, `daysInMonth`
- [ ] Update `property-long-stays-rent-schedule.test.ts` — proration + holdover + early move-out cases
- [ ] Apply relaxed `validateEndLeaseMoveOutDate` in `property-long-stay-routes.ts` end handler
- [ ] Verify `GET /long-stays/:id` response via existing route tests or manual API check

**Exit criteria:** API returns prorated schedule for mid-month start, early end, and holdover scenarios; end lease accepts move-out after `leaseEndDate`; existing paid-month/refund behavior unchanged.

**Optional Phase 1b — Golden fixtures:** JSON fixture file with 8–10 lease scenarios and expected schedule arrays for regression.

---

### Phase 2 — Admin read path verification (no new dialogs)

**Goal:** Confirm admin consumers display prorated values without dialog changes.

- [ ] Manually verify lease detail page loads new schedule (payments section amounts)
- [ ] Verify `property-leases-page` Record Rent prefill uses prorated `expectedRent`
- [ ] Verify unpaid summary totals sum prorated amounts
- [ ] No UI code required unless types need updating for optional metadata fields

**Exit criteria:** Lease detail shows correct dollar amounts for known test leases; no regressions in extend-lease rent periods.

---

### Phase 3 — UI MVP (End Lease + visibility)

**Goal:** Operators can complete holdover and early move-out flows with confidence.

- [ ] **End Lease dialog** — update `max` date bounds for holdover; helper text when move-out > lease end
- [ ] Show live preview: "Final month rent: $X.XX (N/M days)" using shared util (client-side preview OK if inputs match server)
- [ ] **Lease payments section** — prorated badge/subtitle on partial months
- [ ] **Start Lease dialog** — first-month rent preview when start date ≠ 1st (read-only, uses shared util)
- [ ] Copy pass: holdover state when lease is active past `leaseEndDate`

**Exit criteria:** Operator can end lease 5 days after contract end, see prorated July row, record rent at prefilled amount, end lease successfully.

---

### Phase 4 — Hardening

**Goal:** Production-safe edge cases and operator clarity.

| Concern | Action |
| --- | --- |
| Holdover ambiguity | Clear copy: schedule uses `today` until End Lease sets `actualEndDate` |
| Overdue leases | Allow move-out from `leaseEndDate` through `today`, not only today |
| Extend + prorate | Test extension with rent change on same month as partial end |
| Refunds | Confirm partial refund still marks month unpaid/paid correctly |
| Leap year / TZ | Dates stay `YYYY-MM-DD` local ISO; no timezone conversion |
| Regression | Run `bun test` on shared + server rent schedule + lease-date-utils |
| Lint/build | `bun run lint` / `build` in admin + server |

**Exit criteria:** Full test matrix green; manual QA checklist completed for 6 scenarios (see below).

**Manual QA checklist**

1. Mid-month start → prorated first month
2. Early move-out → prorated last month
3. Holdover 5 days → prorated final month after end
4. Full-month start and end → no proration
5. February lease → correct day count
6. Extended lease with higher rent → proration uses correct rate for that month

---

### Phase 5 — Enhancements (post-launch)

- Holdover penalty multiplier (lease-level or property setting)
- Configurable proration method (30-day month)
- Soft warning when recorded rent ≠ `expectedRent`
- Property-level proration policy in settings
- Portfolio reporting notes for partial months

---

## Edge cases reference

| Scenario | Expected behavior |
| --- | --- |
| Start 6/16, rent $1,000 | June: $1,000 × (15/30) = $500; July onward: full rent |
| Move-out 7/15, lease end 12/31 | July: $1,000 × (15/31); Aug–Dec not in schedule |
| Holdover: lease end 6/30, move-out 7/5 | June: full month; July: $1,000 × (5/31) |
| Start and end in same month | Single month row, prorated for occupied days only |
| February 2024 (29 days) | Use 29 as `daysInMonth` |
| February 2025 (28 days) | Use 28 as `daysInMonth` |
| Start on 1st | Full first month |
| End on last day of month | Full last month |
| Rent increase mid-lease | Proration uses `getLeaseRentForMonth` rate for that calendar month |
| Active holdover (not yet ended) | Schedule projects through `today` with prorated partial month |

---

## What not to do

- Do **not** add a "extend by 5 days" flow — use actual move-out + proration instead
- Do **not** duplicate proration math in admin — import from `packages/shared`
- Do **not** persist prorated amounts on income lines automatically — keep income as recorded facts
- Do **not** change `isIncomeLinePaidForRentSchedule` to require exact amount match in v1
- Do **not** block holdover move-out dates above `leaseEndDate` — that's the core fix
- Do **not** use a fixed 30-day denominator in v1 — residential standard is actual days in month
- Do **not** add a migration — all fields already exist
- Do **not** build holdover penalty before basic proration ships

---

## Safest sequencing summary

1. **Shared pure functions + tests before server** — formula is the contract; get edge cases right first
2. **`getRentSchedule` before UI dialogs** — prefill and payments read from API
3. **Relax end-lease validation in same backend phase** — holdover is unusable without it
4. **UI previews last** — they call the same shared helpers; server is already correct
5. **Hardening before announcing to users** — especially February, same-month, and holdover copy
