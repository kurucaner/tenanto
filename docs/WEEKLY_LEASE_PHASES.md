# Weekly Leases — Implementation Phases

Enable **weekly rent billing** for long-term leases end-to-end: admin can start a weekly lease, view a week-based rent schedule, record rent against weeks, and tenants can pay weekly rent via Stripe. Today the start-lease UI has a cadence selector gated behind `WEEKLY_RENT_BILLING_ENABLED = false`; the backend is entirely month-centric.

Work is split into **small phases (≤ 8 files each)** with sub-phases where needed. Monthly leases must remain unchanged throughout.

**Related code today**

- Start-lease cadence UI (gated): [`apps/admin/src/lib/start-lease-rent-billing.ts`](../apps/admin/src/lib/start-lease-rent-billing.ts)
- Start-lease form schema: [`apps/admin/src/lib/start-lease-form-schema.ts`](../apps/admin/src/lib/start-lease-form-schema.ts)
- Start-lease submit (cadence not sent): [`apps/admin/src/hooks/use-start-lease-form.ts`](../apps/admin/src/hooks/use-start-lease-form.ts)
- Start-lease form UI: [`apps/admin/src/components/leases/start-lease-form.tsx`](../apps/admin/src/components/leases/start-lease-form.tsx)
- Shared lease types: [`packages/shared/src/property-long-stay-types.ts`](../packages/shared/src/property-long-stay-types.ts)
- Month enumeration: [`packages/shared/src/lease-date-utils.ts`](../packages/shared/src/lease-date-utils.ts)
- Month proration: [`packages/shared/src/lease-proration-utils.ts`](../packages/shared/src/lease-proration-utils.ts)
- Schedule builder (server): [`apps/server/src/lib/build-lease-rent-schedule-with-rollup.ts`](../apps/server/src/lib/build-lease-rent-schedule-with-rollup.ts)
- Rent schedule DB: [`apps/server/src/db/property-long-stays.ts`](../apps/server/src/db/property-long-stays.ts) (`getRentSchedule`)
- Schedule tests: [`apps/server/src/db/property-long-stays-rent-schedule.test.ts`](../apps/server/src/db/property-long-stays-rent-schedule.test.ts)
- Create lease route: [`apps/server/src/routes/admin/property-long-stay-routes.ts`](../apps/server/src/routes/admin/property-long-stay-routes.ts)
- Lease payments UI: [`apps/admin/src/components/leases/lease-payments-section.tsx`](../apps/admin/src/components/leases/lease-payments-section.tsx)
- Schedule partition/display: [`apps/admin/src/lib/lease-rent-schedule-display.ts`](../apps/admin/src/lib/lease-rent-schedule-display.ts)
- Tenant balance utils: [`packages/shared/src/tenant-rent-balance-from-schedule.ts`](../packages/shared/src/tenant-rent-balance-from-schedule.ts)
- Tenant checkout service: [`apps/server/src/services/tenant-rent-payment-service.ts`](../apps/server/src/services/tenant-rent-payment-service.ts)
- Tenant home pay flow: [`apps/tenant/src/lib/rent-summary-utils.ts`](../apps/tenant/src/lib/rent-summary-utils.ts)
- Migrations: [`apps/server/src/db/migrations.ts`](../apps/server/src/db/migrations.ts) (current version: 72)

---

## Current state

### Admin UI (started, not wired)

- `rentBillingCadence` exists in the start-lease form, schema, and draft storage only.
- `WEEKLY_RENT_BILLING_ENABLED = false` in `start-lease-rent-billing.ts` — weekly option shows "Coming soon".
- Create still posts only `monthlyRent`; cadence is dropped in `use-start-lease-form.ts`.

### Backend (month-only)

| Layer          | Month-centric detail                                                                                           |
| -------------- | -------------------------------------------------------------------------------------------------------------- |
| DB             | `property_long_stays.monthly_rent`; rent periods use `effective_from_month CHAR(7)`                            |
| Schedule       | `enumerateLeaseMonths` → `calculateExpectedRentForLeaseMonth` → `IPropertyLongStayRentMonth.month` (`YYYY-MM`) |
| Income         | `property_income_lines.rent_period_month` constrained to `YYYY-MM`                                             |
| Payments       | `tenant_rent_payment_allocations.period_month` constrained to `YYYY-MM`                                        |
| Tenant balance | `tenant-rent-payment-utils.ts`, `tenant-rent-balance-from-schedule.ts` — due by month                          |

---

## Goals

- Operators can **create weekly leases** with correct first-week proration preview.
- Admin lease detail shows a **week-based rent schedule** (due / upcoming / paid).
- Operators can **record rent** against a specific week.
- Tenants can **see weekly amount due** and **pay via Stripe** with allocations on week keys.
- **Monthly leases behave exactly as today** — no regressions.

## Non-goals (initial release)

- Converting an existing monthly lease to weekly (cadence is immutable after create).
- Mid-lease **rent amount changes** for weekly leases (rent period history is month-shaped today).
- **Edit lease terms** for weekly leases in v1 — block with a clear reason (mirror existing edit guards).
- Renaming `monthly_rent` column or `IPropertyLongStayRentMonth` type in v1 — interpret by cadence instead.
- ISO week numbers (`2026-W29`) — use **week-start ISO dates** aligned to lease start weekday.

---

## Guiding principles

1. **Monthly leases must not change** — every phase ships with regression tests on existing monthly paths.
2. **Contracts before UI** — shared types + server schedule before flipping `WEEKLY_RENT_BILLING_ENABLED`.
3. **Server gate** — reject `rentBillingCadence: 'weekly'` on create until schedule + period keys work (don't rely on UI flag alone).
4. **≤ 8 files per phase** — split into sub-phases when scope grows.
5. **DRY** — cadence constants and period-key helpers live in `packages/shared`; admin imports from shared, not local duplicates.

---

## Target architecture

```
Admin start-lease form
        ↓  POST /admin/properties/:id/long-stays { rentBillingCadence, monthlyRent, … }
property_long_stays (rent_billing_cadence, monthly_rent)
        ↓
getRentSchedule(leaseId)
        ↓  cadence branch
  monthly → enumerateLeaseMonths + calculateExpectedRentForLeaseMonth
  weekly  → enumerateLeaseWeeks + calculateExpectedRentForLeaseWeek
        ↓
IPropertyLongStayRentMonth[] (period key in `month` field)
        ↓
Admin: record rent / Tenant: checkout
        ↓
property_income_lines.rent_period_month  +  tenant_rent_payment_allocations.period_month
```

### Period key model

| Cadence | Period key format           | Example      | Due alignment               |
| ------- | --------------------------- | ------------ | --------------------------- |
| Monthly | `YYYY-MM`                   | `2026-07`    | Calendar month              |
| Weekly  | `YYYY-MM-DD` (period start) | `2026-07-15` | Same weekday as lease start |

- Keep `monthlyRent` API/DB field name; meaning is **recurring rent amount** for the cadence.
- First/last week prorated: `weeklyRent × occupiedDays / 7`.
- Lexicographic string compare on period keys works for both formats when comparing to an `asOf` date string.

### Feature flag

- **Admin UI:** `WEEKLY_RENT_BILLING_ENABLED` in `start-lease-rent-billing.ts` — flip only after Phase 2b.
- **Server:** reject weekly create in route handler until Phase 2b complete (defense in depth).

---

## Data model (sketch)

### `property_long_stays` (migration)

| Column                 | Notes                                              |
| ---------------------- | -------------------------------------------------- |
| `rent_billing_cadence` | New enum: `monthly` \| `weekly`, default `monthly` |

### Period key columns (migration — widen constraints)

| Table / column                                         | Change                                                          |
| ------------------------------------------------------ | --------------------------------------------------------------- |
| `property_long_stay_rent_periods.effective_from_month` | Widen to `VARCHAR(10)`; CHECK accepts `YYYY-MM` or `YYYY-MM-DD` |
| `property_income_lines.rent_period_month`              | Same                                                            |
| `tenant_rent_payment_allocations.period_month`         | Same                                                            |

Existing monthly rows remain valid (`YYYY-MM` is a prefix of the relaxed pattern).

---

## Shared contract (`packages/shared`)

| Type / module                                    | Purpose                                                |
| ------------------------------------------------ | ------------------------------------------------------ |
| `TRentBillingCadence`                            | `'monthly' \| 'weekly'` enum + labels                  |
| `IPropertyLongStay.rentBillingCadence`           | Returned on all lease reads                            |
| `ICreatePropertyLongStayBody.rentBillingCadence` | Optional on create; default `monthly`                  |
| `rent-period-key-utils.ts`                       | Detect format, compare `<= asOf`, format display label |
| `lease-week-proration-utils.ts`                  | `calculateExpectedRentForLeaseWeek`                    |
| `lease-date-utils.ts`                            | `enumerateLeaseWeeks(start, end)`                      |

`IPropertyLongStayRentMonth` keeps its name in v1; `month` field holds the period key for either cadence.

---

## Scope overview

| Phase  | Scope                                 | Files (max) | User-facing?  |
| ------ | ------------------------------------- | ----------- | ------------- |
| **0**  | Persist cadence; server blocks weekly | 7           | No            |
| **1a** | Shared week math (pure)               | 4           | No            |
| **1b** | Shared period key helpers             | 4           | No            |
| **2a** | DB widen period key columns           | 4           | No            |
| **2b** | Server rent schedule for weekly       | 6           | No (API only) |
| **3**  | Admin create weekly lease             | 6           | Yes (admin)   |
| **4**  | Admin detail, record rent, list       | 6           | Yes (admin)   |
| **5a** | Tenant balance & checkout (server)    | 5           | No            |
| **5b** | Tenant portal UI                      | 6           | Yes (tenant)  |
| **6a** | End lease (weekly proration)          | 4           | Yes (admin)   |
| **6b** | Extend lease & edit-terms guards      | 6           | Yes (admin)   |
| **7**  | Release notes                         | 3           | Yes           |
| **8**  | Admin detail UI polish (v2 early)     | 4           | Yes (admin)   |
| **9**  | Rent-period history signals (v2 early)| 5           | No            |
| **10** | Weekly create bootstrap row (v2 early)| 3           | No            |
| **11** | Enable edit terms for weekly (v2 early)| 8          | Yes (admin)   |
| **12** | Weekly mid-lease rent changes (v2 later)| 8+         | Yes (admin)   |
| **13** | Shared period naming (v2 later)       | many        | No            |
| **14** | API + DB rename migration (v2 later)  | many        | Breaking      |
| **15** | Cadence conversion (v2 later)         | TBD         | Optional      |
| **16** | Portfolio / reports audit (v2 later)  | TBD         | Yes           |

---

## Phased rollout

### Phase 0 — Foundation: persist cadence (no weekly behavior yet)

**Goal:** Lease records carry cadence; API contract exists; weekly create is rejected server-side.

**Status:** ✅ Complete

**Files (7)**

| #   | File                                                        |
| --- | ----------------------------------------------------------- |
| 1   | `apps/server/src/db/migrations.ts`                          |
| 2   | `packages/shared/src/rent-billing-cadence.ts` _(new)_       |
| 3   | `packages/shared/src/property-long-stay-types.ts`           |
| 4   | `packages/shared/src/index.ts`                              |
| 5   | `apps/server/src/db/mappers.ts`                             |
| 6   | `apps/server/src/db/property-long-stays.ts`                 |
| 7   | `apps/server/src/routes/admin/property-long-stay-routes.ts` |

**Tasks**

- [x] Migration: add `rent_billing_cadence` enum column, default `monthly`.
- [x] Shared types: `TRentBillingCadence`, add to `IPropertyLongStay` and `ICreatePropertyLongStayBody`.
- [x] Mapper + DB create/read/list return cadence.
- [x] Route: parse `rentBillingCadence`; return **400** if `weekly` until Phase 2b.

**Exit criteria:** Existing monthly create/read unchanged; API returns `rentBillingCadence: 'monthly'` everywhere; weekly POST returns a clear error.

---

### Phase 1a — Shared week math (pure, tested)

**Goal:** Week enumeration + proration utilities with no server/UI wiring.

**Status:** ✅ Complete

**Files (4)**

| #   | File                                                             |
| --- | ---------------------------------------------------------------- |
| 1   | `packages/shared/src/lease-date-utils.ts`                        |
| 2   | `packages/shared/src/lease-week-proration-utils.ts` _(new)_      |
| 3   | `packages/shared/src/lease-week-proration-utils.test.ts` _(new)_ |
| 4   | `packages/shared/src/index.ts`                                   |

**Tasks**

- [x] `enumerateLeaseWeeks(leaseStartDate, leaseEndDate)` — week starts on lease-start weekday.
- [x] `calculateExpectedRentForLeaseWeek({ weeklyRent, leaseStartDate, effectiveEndDate, periodStart })`.
- [x] Tests: full weeks, partial first/last week, lease ending mid-week.

**Exit criteria:** All new unit tests pass; no imports from server/admin.

---

### Phase 1b — Shared period helpers

**Goal:** Cadence-aware period keys and labels (still no DB changes).

**Status:** ✅ Complete

**Files (4)**

| #   | File                                                        |
| --- | ----------------------------------------------------------- |
| 1   | `packages/shared/src/rent-period-key-utils.ts` _(new)_      |
| 2   | `packages/shared/src/rent-period-key-utils.test.ts` _(new)_ |
| 3   | `packages/shared/src/lease-income-rent-period.ts`           |
| 4   | `packages/shared/src/index.ts`                              |

**Tasks**

- [x] Helpers: `isMonthlyPeriodKey`, `isWeeklyPeriodKey`, `comparePeriodKeys`, `formatRentPeriodLabel`.
- [x] `resolveDefaultRentPeriodForIncomeLine` accepts weekly keys in schedule.
- [x] Tests for lexicographic compare (`2026-07` vs `2026-07-15`) and label formatting.

**Exit criteria:** Schedule partition logic can branch on cadence using shared helpers.

---

### Phase 2a — DB: widen period key columns

**Goal:** DB accepts weekly period keys without breaking monthly rows.

**Status:** ✅ Complete

**Files (4)**

| #   | File                                               |
| --- | -------------------------------------------------- |
| 1   | `apps/server/src/db/migrations.ts`                 |
| 2   | `apps/server/src/db/mappers.ts`                    |
| 3   | `packages/shared/src/tenant-rent-payment-utils.ts` |
| 4   | `apps/server/src/db/tenant-rent-payments.ts`       |

**Tasks**

- [x] Widen `period_month`, `rent_period_month`, `effective_from_month` to `VARCHAR(10)`.
- [x] Relax CHECK constraints to `YYYY-MM` **or** `YYYY-MM-DD`.
- [x] Update period key validation regex in shared utils.

**Exit criteria:** Migration runs; existing monthly allocation/income rows unchanged; new weekly keys pass constraints.

---

### Phase 2b — Server rent schedule for weekly leases

**Goal:** `getRentSchedule` returns correct weekly rows for weekly cadence; monthly unchanged.

**Status:** ✅ Complete

**Files (6)**

| #   | File                                                                |
| --- | ------------------------------------------------------------------- |
| 1   | `apps/server/src/lib/build-lease-rent-schedule-with-rollup.ts`      |
| 2   | `apps/server/src/db/property-long-stays.ts`                         |
| 3   | `packages/shared/src/lease-rent-period-rollup.ts`                   |
| 4   | `apps/server/src/lib/resolve-lease-income-rent-period-month.ts`     |
| 5   | `apps/server/src/db/property-long-stays-rent-schedule.test.ts`      |
| 6   | `apps/server/src/lib/build-lease-rent-schedule-with-rollup.test.ts` |

**Tasks**

- [x] Branch schedule builder on `rentBillingCadence`.
- [x] Weekly create inserts initial rent period row (week-start key).
- [x] Income period resolution defaults to correct week for weekly leases.
- [x] Add weekly test cases; all existing monthly schedule tests still pass.

**Exit criteria:** Weekly lease detail API returns schedule with week-start keys, expected/paid/remaining; monthly schedule unchanged.

---

### Phase 3 — Admin: create weekly lease end-to-end

**Goal:** Operator can start a weekly lease; first-week proration preview; UI flag on.

**Status:** ✅ Complete

**Files (6)**

| #   | File                                                        |
| --- | ----------------------------------------------------------- |
| 1   | `apps/admin/src/lib/start-lease-rent-billing.ts`            |
| 2   | `apps/admin/src/hooks/use-start-lease-form.ts`              |
| 3   | `apps/admin/src/lib/lease-proration-display.ts`             |
| 4   | `apps/admin/src/components/leases/start-lease-form.tsx`     |
| 5   | `apps/admin/src/lib/start-lease-form-schema.ts`             |
| 6   | `apps/server/src/routes/admin/property-long-stay-routes.ts` |

**Tasks**

- [x] Set `WEEKLY_RENT_BILLING_ENABLED = true`; import shared cadence type.
- [x] Send `rentBillingCadence` in create mutation.
- [x] Add first-week rent preview (mirror monthly first-month block).
- [x] Remove server-side weekly 400 gate.

**Exit criteria:** Create weekly lease → detail page loads with weekly schedule; monthly flow unchanged.

---

### Phase 4 — Admin: lease detail & record rent

**Goal:** Payments tab, list, and manual rent recording work for weekly periods.

**Status:** ✅ Complete

**Files (6)**

| #   | File                                                             |
| --- | ---------------------------------------------------------------- |
| 1   | `apps/admin/src/lib/lease-rent-schedule-display.ts`              |
| 2   | `apps/admin/src/components/leases/lease-payments-section.tsx`    |
| 3   | `apps/admin/src/pages/property-leases-page.tsx`                  |
| 4   | `apps/admin/src/pages/property-lease-detail-page.tsx`            |
| 5   | `apps/admin/src/components/income/create-income-line-dialog.tsx` |
| 6   | `apps/server/src/db/property-income-lines.ts`                    |

**Tasks**

- [x] Cadence-aware `asOf` comparison and period labels ("Week of Jul 15" vs "Jul 2026").
- [x] Leases list: rent column shows `/wk` vs `/mo`.
- [x] Record rent prefill + `rent_period_month` for weekly.

**Exit criteria:** Record rent against a due week; schedule marks paid; monthly UI unchanged.

---

### Phase 5a — Tenant payments: balance & checkout (server)

**Goal:** Tenant can pay weekly rent via Stripe; allocations use week keys.

**Status:** ✅ Complete

**Files (5)**

| #   | File                                                                |
| --- | ------------------------------------------------------------------- |
| 1   | `packages/shared/src/tenant-rent-balance-from-schedule.ts`          |
| 2   | `packages/shared/src/tenant-rent-balance-from-schedule.test.ts`     |
| 3   | `apps/server/src/services/tenant-rent-payment-service.ts`           |
| 4   | `apps/server/src/services/tenant-rent-payment-service.test.ts`      |
| 5   | `apps/server/src/services/tenant-rent-payment-apply-income.test.ts` |

**Tasks**

- [x] Cadence-aware due period selection (`asOf` = today for weekly).
- [x] Checkout idempotency + allocation uses week keys.
- [x] Tests for weekly checkout path.

**Exit criteria:** Weekly lease checkout allocates to correct week keys; monthly checkout unchanged.

---

### Phase 5b — Tenant portal UI

**Goal:** Home + Leases show weekly dues and Pay works.

**Status:** ✅ Complete

**Files (6)**

| #   | File                                                           |
| --- | -------------------------------------------------------------- |
| 1   | `apps/tenant/src/lib/rent-summary-utils.ts`                    |
| 2   | `apps/tenant/src/lib/rent-summary-utils.test.ts`               |
| 3   | `apps/tenant/src/pages/home-dashboard-page.tsx`                |
| 4   | `apps/tenant/src/components/lease-due-row.tsx`                 |
| 5   | `apps/tenant/src/pages/leases-page.tsx`                        |
| 6   | `apps/server/src/services/tenant-portal-membership-service.ts` |

**Tasks**

- [x] Period labels on due rows.
- [x] Verify multi-lease pay flow works with weekly leases mixed with monthly.

**Exit criteria:** Tenant with weekly lease sees amount due and completes payment.

---

### Phase 6a — End lease (weekly proration)

**Goal:** Ending a weekly lease prorates the final week correctly.

**Status:** ✅ Complete

**Files (4)**

| #   | File                                                   |
| --- | ------------------------------------------------------ |
| 1   | `packages/shared/src/lease-week-proration-utils.ts`    |
| 2   | `apps/admin/src/lib/lease-proration-display.ts`        |
| 3   | `apps/server/src/services/lease-notifications.ts`      |
| 4   | `apps/server/src/services/lease-notifications.test.ts` |

**Tasks**

- [x] Final week preview on end-lease dialog for weekly cadence.
- [x] Notification copy uses week period label.

**Exit criteria:** End lease preview + notification reflect final partial week.

---

### Phase 6b — Extend lease & guard edit terms

**Goal:** Safe boundaries for operations not ready in v1.

**Status:** ✅ Complete

**Files (6)**

| #   | File                                                           |
| --- | -------------------------------------------------------------- |
| 1   | `packages/shared/src/property-long-stay-types.ts`              |
| 2   | `apps/server/src/db/property-long-stays.ts`                    |
| 3   | `apps/server/src/routes/admin/property-long-stay-routes.ts`    |
| 4   | `apps/admin/src/components/leases/edit-lease-terms-dialog.tsx` |
| 5   | `apps/admin/src/components/leases/extend-lease-dialog.tsx`     |
| 6   | `apps/server/src/db/property-long-stays-extend.test.ts`        |

**Tasks**

- [x] Add edit block reason for weekly cadence (e.g. `WEEKLY_CADENCE`).
- [x] Extend: append weeks only; block mid-lease rent change for weekly.
- [x] Edit terms dialog disabled + message for weekly leases.

**Exit criteria:** Weekly leases can extend end date; edit terms blocked with clear reason; monthly extend/edit unchanged.

---

### Phase 7 — Ship & document

**Goal:** Release notes and manual QA checklist.

**Files (3)**

| #   | File                                                              |
| --- | ----------------------------------------------------------------- |
| 1   | `apps/admin/src/config/release-notes.ts`                          |
| 2   | `package.json`                                                    |
| 3   | `docs/WEEKLY_LEASE_PHASES.md` _(this doc — mark phases complete)_ |

**Exit criteria:** Version bumped; release notes describe weekly leases; QA checklist signed off.

---

## v2 roadmap (post–Phase 7)

Work after the initial weekly-billing launch. Split into **v2 early** (UI polish + correctness, no breaking API) and **v2 later** (rent changes, renames, migrations).

### v2 non-goals (until explicitly scheduled)

- Cadence conversion (monthly ↔ weekly after create) — high edge-case risk; product decision required.
- ISO week numbers (`2026-W29`) — keep week-start ISO dates aligned to lease start weekday.
- Breaking API/DB renames before operators are stable on v1 weekly flows.

---

### Phase 8 — Admin detail UI polish

**Goal:** Weekly leases read correctly on lease detail; no API contract changes.

**Status:** ✅ Complete

**Files (4)**

| #   | File                                                            |
| --- | --------------------------------------------------------------- |
| 1   | `apps/admin/src/components/leases/lease-terms-section.tsx`      |
| 2   | `apps/admin/src/components/leases/lease-overview-section.tsx`   |
| 3   | `apps/admin/src/lib/lease-rent-schedule-display.ts` _(if needed)_ |
| 4   | `apps/admin/src/components/leases/start-lease-form.tsx` _(optional — neutral input id)_ |

**Tasks**

- [x] Terms tab rent history: use `formatRentPeriodLabel` instead of `formatLeaseMonthLabel` for period keys.
- [x] Terms tab rent amounts: use `getLeaseRentAmountSuffix(lease.rentBillingCadence)` (`/wk` vs `/mo`).
- [x] Terms tab extend blurb: cadence-aware copy (weeks + no rent change for weekly; match extend dialog).
- [x] Overview tab: show billing cadence; clarify term display for weekly leases if needed.
- [x] Optionally hide rent history when a single bootstrap row equals base rate on a pristine weekly lease.

**Exit criteria:** Weekly lease Terms tab shows “Week of …” and `$X/wk`; monthly lease detail unchanged.

---

### Phase 9 — Rent-period history signals (weekly-correct)

**Status:** ✅ Complete

**Goal:** Pristine weekly leases are not treated as having rent period history.

**Files (6)**

| #   | File                                                         |
| --- | ------------------------------------------------------------ |
| 1   | `apps/server/src/db/property-long-stays.ts`                  |
| 2   | `packages/shared/src/lease-terms-edit-utils.ts`              |
| 3   | `packages/shared/src/rent-period-key-utils.ts`               |
| 4   | `packages/shared/src/lease-terms-edit-utils.test.ts`         |
| 5   | `apps/server/src/db/property-long-stays-terms-edit.test.ts`  |
| 6   | `packages/shared/src/property-long-stay-types.ts`            |

**Tasks**

- [x] Refactor `getTermsEditSignals`: load rent periods and derive `hasRentPeriodHistory` via shared `hasRentPeriodHistory(rentPeriods, leaseStartDate, rentBillingCadence)` (replaces month-only SQL subquery).
- [x] Cadence-aware `hasRentPeriodHistory()` using `getPristineRentPeriodKey` — `YYYY-MM` for monthly, lease start `YYYY-MM-DD` for weekly.
- [x] Document on `IPropertyLongStayRentPeriod`: `effectiveFromMonth` holds `YYYY-MM` or `YYYY-MM-DD` period keys; `monthlyRent` is recurring amount for the cadence.
- [x] Regression tests: shared weekly bootstrap + monthly extend-with-rent; server integration for both cadences.

**Exit criteria:** New weekly lease with one bootstrap period → `hasRentPeriodHistory: false`; monthly extend-with-rent still `true`. Required before Phase 11.

---

### Phase 10 — Weekly create bootstrap row (optional cleanup)

**Goal:** Avoid confusing `rentPeriods: [{ effectiveFromMonth: "<lease-start>", … }]` on brand-new weekly leases.

**Files (3)**

| #   | File                                                                |
| --- | ------------------------------------------------------------------- |
| 1   | `apps/server/src/db/property-long-stays.ts`                         |
| 2   | `apps/server/src/lib/build-lease-rent-schedule-with-rollup.test.ts` |
| 3   | `apps/server/src/db/property-long-stays-rent-schedule.test.ts`      |

**Tasks**

- [ ] Remove or skip weekly bootstrap insert on create (schedule already falls back to `lease.monthlyRent` when `rentPeriods` is empty).
- [ ] Only insert `rent_periods` rows when rent actually changes (extend/amendment flows).

**Exit criteria:** New weekly lease returns `rentPeriods: []`; schedule, record rent, and tenant pay unchanged.

---

### Phase 11 — Enable edit terms for weekly

**Goal:** Allow editing start/term/rent on weekly leases before any ledger activity (same gate as monthly).

**Files (8)**

| #   | File                                                           |
| --- | -------------------------------------------------------------- |
| 1   | `packages/shared/src/lease-terms-edit-utils.ts`              |
| 2   | `packages/shared/src/property-long-stay-types.ts`              |
| 3   | `apps/server/src/db/property-long-stays.ts`                    |
| 4   | `apps/admin/src/components/leases/edit-lease-terms-dialog.tsx` |
| 5   | `apps/admin/src/components/leases/lease-terms-section.tsx`   |
| 6   | `apps/admin/src/lib/lease-proration-display.ts`                |
| 7   | `packages/shared/src/lease-terms-edit-utils.test.ts`           |
| 8   | `apps/server/src/db/property-long-stays-update-terms.test.ts`  |

**Tasks**

- [ ] Remove `WEEKLY_CADENCE` block from `deriveLeaseTermsEditability` (keep block after income/payments/history).
- [ ] Cadence-aware `validateEditLeaseTerms` and first-period preview (first **week**, not first month).
- [ ] Edit dialog labels: “Weekly rent” when cadence is weekly.
- [ ] `updateTerms` writes week-start rent period keys when needed.

**Exit criteria:** Pristine weekly lease can edit terms; after recording rent or extending, edit blocked with existing reasons (not `WEEKLY_CADENCE`). Depends on Phase 9.

---

## v2 later (breaking / migration-heavy)

### Phase 12 — Weekly mid-lease rent changes

**Goal:** Change weekly rent during extend (and future amendment flow).

**Files (8+)**

| #   | File                                                           |
| --- | -------------------------------------------------------------- |
| 1   | `packages/shared/src/lease-rent-utils.ts`                      |
| 2   | `apps/server/src/db/property-long-stays.ts`                    |
| 3   | `apps/admin/src/components/leases/extend-lease-dialog.tsx`     |
| 4   | `packages/shared/src/lease-rent-utils.test.ts`                 |
| 5   | `apps/server/src/db/property-long-stays-extend.test.ts`        |
| 6   | `apps/admin/src/components/leases/lease-terms-section.tsx`     |
| 7   | `apps/server/src/lib/build-lease-rent-schedule-with-rollup.ts` |
| 8   | `apps/server/src/lib/build-lease-rent-schedule-with-rollup.test.ts` |

**Tasks**

- [ ] Allow rent change on weekly extend; insert `rent_periods` with week-start keys (`YYYY-MM-DD`).
- [ ] Effective-from picker: weeks in extension window, not calendar months.
- [ ] Cadence-aware rent lookup in schedule builder (week keys, not `transactionDateToMonth` only).
- [ ] Re-enable extend dialog rent-change UI for weekly with week-based effective period.

**Exit criteria:** Extend weekly lease with new rent from a chosen week; schedule reflects new rate from that week forward.

---

### Phase 13 — Shared “period” naming (code-only)

**Goal:** Reduce confusion without breaking API clients yet.

**Tasks**

- [ ] Add type aliases / parallel fields: `effectiveFromPeriod`, `periodKey`, `rentAmount`.
- [ ] JSDoc deprecation on `effectiveFromMonth`, `monthlyRent`, `IPropertyLongStayRentMonth.month`.
- [ ] Internal helpers and new code use neutral names; public API still accepts legacy field names.

**Exit criteria:** New code reads clearly; no client breakage; prelude to Phase 14.

---

### Phase 14 — API + DB rename migration

**Goal:** Align field names with meaning (breaking major version).

**Tasks**

- [ ] Migration: e.g. `monthly_rent` → `rent_amount`, `effective_from_month` → `effective_from_period`, `rent_period_month` → `rent_period_key`.
- [ ] Update `packages/shared`, mappers, routes, admin, tenant.
- [ ] Coexistence shim or versioned API if external consumers exist.

**Exit criteria:** All apps use new names; legacy names removed or shimmed for one release.

---

### Phase 15 — Cadence conversion (optional)

**Goal:** Convert an existing lease between monthly and weekly billing (currently immutable after create).

**Tasks**

- [ ] Product sign-off on conversion rules (open balances, partial periods, paid history).
- [ ] New route + admin UI; rebuild schedule from conversion date.

**Exit criteria:** Conversion does not corrupt paid history or allocations. **Defer unless operators request it.**

---

### Phase 16 — Portfolio / reports / email audit

**Goal:** No monthly-only assumptions outside lease detail flows.

**Tasks**

- [ ] Audit property reports, exports, and transactional emails for `/mo`, “calendar month”, and month-only period logic.
- [ ] Fix mixed monthly + weekly portfolio displays.

**Exit criteria:** Operators see correct cadence everywhere they manage rent.

---

## What not to do

- Do **not** enable `WEEKLY_RENT_BILLING_ENABLED` before Phase 2b — you'd create leases the server can't schedule.
- Do **not** rename `monthly_rent` / `IPropertyLongStayRentMonth` in v1 — too many touchpoints; interpret by cadence instead.
- Do **not** reuse `YYYY-MM` keys for weekly periods — collisions and wrong proration.
- Do **not** allow edit terms or mid-lease rent changes for weekly in v1 — rent period history is month-shaped today.
- Do **not** skip widening DB CHECK constraints before tenant checkout — allocations will fail at insert.
- Do **not** change monthly `asOfMonth` logic — branch on cadence; keep the monthly code path identical.

---

## Safest sequencing summary

### v1 (initial release)

1. **Phase 0** — cadence on lease + API; server blocks weekly create.
2. **Phases 1a–1b** — pure shared math and period helpers (testable in isolation).
3. **Phases 2a–2b** — DB period keys + server schedule.
4. **Phase 3** — admin create (flip UI flag).
5. **Phase 4** — admin operate (record rent, detail, list).
6. **Phases 5a–5b** — tenant pay.
7. **Phases 6a–6b** — end/extend/guards.
8. **Phase 7** — release notes + QA.

Each v1 phase is independently shippable behind the server gate until Phase 3.

### v2 early (post-launch)

9. **Phase 8** — admin detail UI polish (biggest user-visible win).
10. **Phase 9** — rent-period history signals (unblocks Phase 11).
11. **Phase 10** — optional bootstrap row cleanup.
12. **Phase 11** — enable edit terms for weekly.

### v2 later

13. **Phase 12** — weekly mid-lease rent changes (extend + history).
14. **Phase 13** — shared period naming (non-breaking).
15. **Phase 14** — API + DB rename migration (breaking).
16. **Phase 15** — cadence conversion (optional, product decision).
17. **Phase 16** — portfolio / reports / email audit.

---

## Manual QA checklist (post Phase 7)

- [ ] Create monthly lease — schedule, record rent, tenant pay unchanged from before.
- [ ] Create weekly lease starting mid-week — first week prorated in preview and schedule.
- [ ] Create weekly lease on lease-start weekday — first week full amount.
- [ ] Record rent for a due week — schedule shows paid.
- [ ] Tenant pays weekly rent — allocation on week key; balance clears.
- [ ] End weekly lease mid-week — final week prorated.
- [ ] Extend weekly lease — new weeks appear in schedule.
- [ ] Edit terms on weekly lease — blocked with clear message.
- [ ] Mixed portfolio: one tenant with monthly + weekly leases — multi-lease pay still works.
