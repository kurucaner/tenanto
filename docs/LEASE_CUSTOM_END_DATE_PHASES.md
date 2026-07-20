# Custom Lease End Date — Implementation Phases

Phased rollout for **optional custom contract end dates** on long-term leases: operators choose **Term (months)** or **End date** when creating, editing terms (pre-rent), or extending. **Proration math stays unchanged** (inclusive occupied days through the stored `lease_end_date`). Fixes month-boundary cases (e.g. start 7/1/2026, end 6/30/2027 → 12 full months, no extra Jul 2027 day) by letting operators set the last occupied day explicitly. Postgres + Fastify + `packages/shared` + admin dialogs. **No migration** — `lease_end_date` already exists.

**Related code today**

- [`packages/shared/src/lease-date-utils.ts`](packages/shared/src/lease-date-utils.ts) — `calculateLeaseEndDate`, `enumerateLeaseMonths`, move-out bounds
- [`packages/shared/src/lease-proration-utils.ts`](packages/shared/src/lease-proration-utils.ts) — schedule effective end; proration uses stored dates
- [`packages/shared/src/lease-rent-utils.ts`](packages/shared/src/lease-rent-utils.ts) — `validateExtendLease`, `getExtensionRentEffectiveMonthOptions` (extend end from start + total term today)
- [`packages/shared/src/lease-terms-edit-utils.ts`](packages/shared/src/lease-terms-edit-utils.ts) — edit-terms validation (termMonths only)
- [`packages/shared/src/property-long-stay-types.ts`](packages/shared/src/property-long-stay-types.ts) — `ICreatePropertyLongStayBody`, `IEditPropertyLongStayTermsBody`, `IExtendPropertyLongStayBody`
- [`apps/server/src/db/property-long-stays.ts`](apps/server/src/db/property-long-stays.ts) — `create`, `updateTerms`, `extendLease`, `getRentSchedule`
- [`apps/server/src/routes/admin/property-long-stay-routes.ts`](apps/server/src/routes/admin/property-long-stay-routes.ts) — body parsers for create / terms / extend
- [`apps/admin/src/pages/property-start-lease-page.tsx`](apps/admin/src/pages/property-start-lease-page.tsx) — create lease page (see [`START_LEASE_PAGE_PHASES.md`](START_LEASE_PAGE_PHASES.md))
- [`apps/admin/src/components/leases/edit-lease-terms-dialog.tsx`](apps/admin/src/components/leases/edit-lease-terms-dialog.tsx) — term months only
- [`apps/admin/src/components/leases/extend-lease-dialog.tsx`](apps/admin/src/components/leases/extend-lease-dialog.tsx) — additional months; preview via `calculateLeaseEndDate(start, termMonths + additional)`
- [`apps/admin/src/lib/lease-proration-display.ts`](apps/admin/src/lib/lease-proration-display.ts) — first-month preview uses computed end from term
- [`apps/admin/src/components/leases/lease-overview-section.tsx`](apps/admin/src/components/leases/lease-overview-section.tsx) — displays `termMonths` + `leaseEndDate`
- [`docs/LEASE_RENT_PRORATION_PHASES.md`](docs/LEASE_RENT_PRORATION_PHASES.md) — proration formula; currently lists “don’t change leaseEndDate on create” as non-goal

---

## Goals

- Operators can set a **custom contract end date** instead of only term months on **Start lease**, **Edit terms**, and **Extend lease**
- **Rent schedule** reflects the stored `lease_end_date` with existing inclusive proration (no formula changes)
- **Extend** advances from the **current** `lease_end_date` (preserves prior custom ends), not `calculateLeaseEndDate(originalStart, totalTermMonths)`
- Shared validation in `packages/shared` so admin + server agree on modes, bounds, and errors
- Small PRs: sub-phases touch **≤5 files** each where possible

## Non-goals (initial release)

- Changing proration formulas or exclusive/inclusive day-count rules
- DB migration or backfill of existing leases
- Inline lease-end editing in the leases table
- Tenant portal changes (already displays API `leaseEndDate`)
- Bulk import / API-only create without admin UI
- Auto-suggesting 6/30 when user enters 12 months (operator picks end explicitly)

---

## Guiding principles

1. **`lease_end_date` is authoritative for rent schedule** — `getRentSchedule` / `getLeaseScheduleEffectiveEndDate` already read stored end; custom end is a write-path change only.
2. **Two input modes, one resolved end** — `termMonths` **or** explicit `leaseEndDate` in forms; server resolves via shared helper before persist.
3. **Extend from current end** — additional months → `addMonthsToIsoDate(lease.leaseEndDate, n)`; custom extend → validated `newLeaseEndDate > lease.leaseEndDate`.
4. **Keep `termMonths` stored** — months mode: user value; custom end mode: `deriveTermMonthsFromDates(start, end)` for display and max-term guards (document rounding behavior in tests).
5. **Shared contract first** — new helpers + tests in `packages/shared` before route/UI changes.
6. **Same permissions** — `assertPropertyLedgerWriteAccess` / `canManageLedger`; edit-terms gate unchanged.

---

## Target architecture

```
[Start / Edit / Extend dialog]
   termMode: "months" | "customEnd"
        ↓
packages/shared  resolveLeaseEndDate / resolveExtendLeaseEndDate
        ↓
POST create | PATCH terms | POST extend
        ↓
propertyLongStaysDb  →  UPDATE lease_end_date (+ term_months)
        ↓
getRentSchedule  →  calculateExpectedRentForLeaseMonth (unchanged)
        ↓
Admin payments tab / Record Rent prefill
```

### Permissions

- **Can set custom end:** owner, manager, platform admin (same as Start / Extend / Edit terms)
- **Cannot:** accountant (read-only)
- Edit terms still blocked after income / succeeded payments / rent-period history (unchanged)

### Feature flag

N/A — admin-only scheduling correction; ship when tests pass.

---

## Data model (sketch)

**No migration.** Existing columns:

| Column             | Role                                                             |
| ------------------ | ---------------------------------------------------------------- |
| `lease_start_date` | Occupancy start (inclusive)                                      |
| `lease_end_date`   | Contract end; **authoritative** for active schedule              |
| `term_months`      | Stored label / max-term accounting; derived when custom end used |
| `actual_end_date`  | Set on End lease only; overrides schedule when ended             |

**Domain rule:** When `customEnd` mode is used, persist operator-selected `lease_end_date` and derived `term_months`. When `months` mode is used, keep today’s behavior: `lease_end_date = calculateLeaseEndDate(start, termMonths)`.

---

## Shared contract (`packages/shared`)

New module: [`packages/shared/src/lease-term-input-utils.ts`](packages/shared/src/lease-term-input-utils.ts)

| Type / function                                                       | Purpose                                                                  |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `LeaseTermInputMode`                                                  | `"months" \| "customEnd"`                                                |
| `resolveLeaseEndDate({ leaseStartDate, termMonths?, leaseEndDate? })` | Single resolved end for create/edit                                      |
| `validateLeaseTermInput(...)`                                         | Mutual exclusivity, end ≥ start, max span                                |
| `addMonthsToIsoDate(iso, months)`                                     | Extend-by-months from **current** end                                    |
| `deriveTermMonthsFromDates(start, end)`                               | Store term when custom end picked                                        |
| `resolveExtendLeaseEndDate(lease, body)`                              | Months extend vs custom new end                                          |
| Updated `IExtendPropertyLongStayBody`                                 | Optional `newLeaseEndDate` (xor additional months in custom extend mode) |
| Updated `ICreatePropertyLongStayBody`                                 | Optional `leaseEndDate`                                                  |
| Updated `IEditPropertyLongStayTermsBody`                              | Optional `leaseEndDate`                                                  |

Export from [`packages/shared/src/index.ts`](packages/shared/src/index.ts).

Update [`packages/shared/src/lease-rent-utils.ts`](packages/shared/src/lease-rent-utils.ts): `validateExtendLease`, `getExtensionRentEffectiveMonthOptions` use resolved extend end.

---

## API (sketch)

| Method  | Path                                    | Change                                                                                    |
| ------- | --------------------------------------- | ----------------------------------------------------------------------------------------- |
| `POST`  | `/properties/:id/long-stays`            | Accept optional `leaseEndDate`; resolve before insert                                     |
| `PATCH` | `/properties/:id/long-stays/:id/terms`  | Accept optional `leaseEndDate`                                                            |
| `POST`  | `/properties/:id/long-stays/:id/extend` | Accept optional `newLeaseEndDate` **or** `additionalTermMonths` (extend-from-current-end) |

Parsers in [`property-long-stay-routes.ts`](apps/server/src/routes/admin/property-long-stay-routes.ts): `parseCreateLongStayBody`, `parseEditLeaseTermsBody`, `parseExtendLongStayBody`.

---

## UI — Admin lease dialogs

1. **Start lease** — segmented Term / End date; live end preview; first-month proration preview uses resolved end
2. **Edit terms** — same pattern (pre-rent gate unchanged)
3. **Extend lease** — segmented Additional months / New end date; preview new end; rent-effective month options from new extension window
4. **Lease overview** — show stored end; optional “Custom end” when end ≠ `calculateLeaseEndDate(start, termMonths)`

Helper copy: “Rent is calculated through the end date you set (inclusive).”

---

## Phased rollout

> **PR sizing:** each sub-phase targets **2–4 files** (max ~5). Run `bun test` + `lint` before merge.

### Phase 0 — Foundation (no user-facing feature)

**Goal:** Shared resolve/validate/date helpers + tests; no API or UI behavior change.

#### Phase 0.1 — Core utilities

- [x] Add [`packages/shared/src/lease-term-input-utils.ts`](packages/shared/src/lease-term-input-utils.ts)
- [x] Export from [`packages/shared/src/index.ts`](packages/shared/src/index.ts)

**Files:** 2

#### Phase 0.2 — Unit tests

- [x] Add [`packages/shared/src/lease-term-input-utils.test.ts`](packages/shared/src/lease-term-input-utils.test.ts) — months mode, custom 7/1→6/30, invalid end, `addMonthsToIsoDate`, derive term

**Files:** 1

**Exit criteria (Phase 0):** `cd packages/shared && bun test src/lease-term-input-utils.test.ts` passes; no server/admin diffs.

---

### Phase 1 — Create lease with custom end

**Goal:** API + Start Lease UI accept custom end; schedule correct for 7/1→6/30 case.

#### Phase 1.1 — Shared create contract

- [x] Extend `ICreatePropertyLongStayBody` with optional `leaseEndDate` in [`property-long-stay-types.ts`](packages/shared/src/property-long-stay-types.ts)
- [x] Wire `validateLeaseTermInput` for create in [`lease-term-input-utils.ts`](packages/shared/src/lease-term-input-utils.ts) + tests

**Files:** 3

#### Phase 1.2 — Server create path

- [x] `parseCreateLongStayBody` accepts optional `leaseEndDate` in [`property-long-stay-routes.ts`](apps/server/src/routes/admin/property-long-stay-routes.ts)
- [x] `propertyLongStaysDb.create` uses `resolveLeaseEndDate` + derived `termMonths` when custom end in [`property-long-stays.ts`](apps/server/src/db/property-long-stays.ts)

**Files:** 2

#### Phase 1.3 — Start Lease UI

- [x] Term / End date toggle, date picker, resolved preview, submit payload in [`property-start-lease-page.tsx`](../apps/admin/src/pages/property-start-lease-page.tsx) (formerly start-lease dialog)

**Files:** 1

#### Phase 1.4 — Create previews

- [x] `getStartLeaseFirstMonthRentPreview` accepts resolved end in [`lease-proration-display.ts`](apps/admin/src/lib/lease-proration-display.ts)

**Files:** 1

#### Phase 1.5 — Create + schedule test

- [x] Server or shared schedule test: custom end `2027-06-30` → 12 full months, no Jul 2027 row (extend [`property-long-stays-rent-schedule.test.ts`](apps/server/src/db/property-long-stays-rent-schedule.test.ts) or add create integration test)

**Files:** 1–2

**Exit criteria (Phase 1):** Manual — Start lease 7/1/2026, custom end 6/30/2027, $1000 → Payments shows Jul 2026–Jun 2027 only.

---

### Phase 2 — Edit lease terms with custom end

**Goal:** Pre-rent terms correction supports custom end (same UX as create).

#### Phase 2.1 — Shared edit contract

- [x] Extend `IEditPropertyLongStayTermsBody` + update `validateEditLeaseTerms` in [`lease-terms-edit-utils.ts`](packages/shared/src/lease-terms-edit-utils.ts) + tests in [`lease-terms-edit-utils.test.ts`](packages/shared/src/lease-terms-edit-utils.test.ts)

**Files:** 3

#### Phase 2.2 — Server edit terms path

- [x] `parseEditLeaseTermsBody` + `updateTerms` use `resolveLeaseEndDate`; schedule-changed detection includes end change in [`property-long-stay-routes.ts`](apps/server/src/routes/admin/property-long-stay-routes.ts) + [`property-long-stays.ts`](apps/server/src/db/property-long-stays.ts)

**Files:** 2

#### Phase 2.3 — Edit Terms UI

- [x] Term / End date toggle in [`edit-lease-terms-dialog.tsx`](apps/admin/src/components/leases/edit-lease-terms-dialog.tsx)

**Files:** 1

#### Phase 2.4 — Edit terms DB test

- [x] Custom end case in [`property-long-stays-update-terms.test.ts`](apps/server/src/db/property-long-stays-update-terms.test.ts)

**Files:** 1

**Exit criteria (Phase 2):** Edit terms (gate open) can set custom end; blocked leases still 409.

---

### Phase 3 — Extend lease with custom end

**Goal:** Extension respects current `lease_end_date`; no snap-back to anniversary-from-start.

#### Phase 3.1 — Shared extend logic

- [x] Extend `IExtendPropertyLongStayBody` with optional `newLeaseEndDate`
- [x] Add `resolveExtendLeaseEndDate`; update `validateExtendLease`, `validateLeaseRentChange`, `getExtensionRentEffectiveMonthOptions` in [`lease-rent-utils.ts`](packages/shared/src/lease-rent-utils.ts)
- [x] Tests in [`lease-rent-utils.test.ts`](packages/shared/src/lease-rent-utils.test.ts)

**Files:** 3

#### Phase 3.2 — Server extend path

- [x] `parseExtendLongStayBody` (months xor custom end)
- [x] `extendLease`: new end from `resolveExtendLeaseEndDate`; update `term_months` in [`property-long-stay-routes.ts`](apps/server/src/routes/admin/property-long-stay-routes.ts) + [`property-long-stays.ts`](apps/server/src/db/property-long-stays.ts)

**Files:** 2

#### Phase 3.3 — Extend Lease UI

- [x] Additional months / New end date toggle; preview; submit in [`extend-lease-dialog.tsx`](apps/admin/src/components/leases/extend-lease-dialog.tsx)

**Files:** 1

#### Phase 3.4 — Extend tests

- [x] Extend from custom end +6 months; extend with custom new end (server test or rent-schedule test)

**Files:** 1

**Exit criteria (Phase 3):** Lease ending 6/30/2027 extended 6 months → 12/30/2027 schedule; no spurious partial month unless end date implies it.

---

### Phase 4 — Display and docs

**Goal:** Operators understand custom end; docs cross-linked.

#### Phase 4.1 — Overview display

- [x] [`lease-overview-section.tsx`](apps/admin/src/components/leases/lease-overview-section.tsx) — optional custom-end hint

**Files:** 1

#### Phase 4.2 — Proration doc update

- [x] Update [`docs/LEASE_RENT_PRORATION_PHASES.md`](docs/LEASE_RENT_PRORATION_PHASES.md) — remove obsolete non-goal; link to this doc; note inclusive end + custom end workflow

**Files:** 1

#### Phase 4.3 — Cross-link from lease terms edit doc

- [x] Update [`docs/LEASE_TERMS_EDIT_PHASES.md`](docs/LEASE_TERMS_EDIT_PHASES.md) — replace “no free-form leaseEndDate” with pointer to custom end phases

**Files:** 1

**Exit criteria (Phase 4):** Docs consistent; overview shows stored contract end.

---

### Phase 5 — Hardening

**Goal:** Regression matrix for common operator scenarios.

| Concern                     | Action                                                        |
| --------------------------- | ------------------------------------------------------------- |
| Month-boundary create       | Test 7/1 + custom 6/30 schedule                               |
| Mid-month create            | Test 1/15 + custom end still prorates correctly               |
| Extend after custom end     | Test add months from 6/30 end                                 |
| Holdover / end lease        | Manual QA — unchanged paths still use inclusive actualEndDate |
| deriveTermMonths edge cases | Document in shared tests                                      |

#### Phase 5.1 — Shared regression matrix

- [x] Add cases to [`lease-proration-regression.test.ts`](packages/shared/src/lease-proration-regression.test.ts) or new `lease-term-input-regression.test.ts`

**Files:** 1

#### Phase 5.2 — Release notes (when shipping)

- [x] Admin release notes entry via release-notes skill

**Files:** 1

**Exit criteria (Phase 5):** Full test suite green; manual QA checklist signed off.

---

### Phase 6 — Enhancements (post-launch)

- Smart default end when term months changes (e.g. suggest day before anniversary) — optional UX only
- Show computed vs custom end diff in leases list export
- Tenant portal “through [date]” copy tweak

---

## What not to do

- Do **not** change `calculateExpectedRentForLeaseMonth` or inclusive day math — fix dates via operator input
- Do **not** extend by recomputing `calculateLeaseEndDate(leaseStartDate, termMonths + additional)` — breaks custom ends
- Do **not** add a migration — `lease_end_date` column already exists
- Do **not** allow custom end on edit terms after the existing ledger gate fails
- Do **not** send both conflicting ends without validation — require mode or clear precedence (resolved helper)
- Do **not** duplicate date math in admin — import from `packages/shared`
- Do **not** bundle Phase 1–3 in one PR — keep sub-phase file limits

---

## Safest sequencing summary

1. **Shared utils + tests (Phase 0)** before any route or dialog changes.
2. **Create API before Start Lease UI** — prove persist + schedule with a script/test first.
3. **Edit terms and Extend in parallel** after Phase 0, each after create pattern is proven.
4. **Extend must use current `lease_end_date`** as the base for month additions.
5. **Docs last** (Phase 4) once behavior is frozen; update proration doc non-goals.
6. **≤5 files per sub-phase** — split if a step grows larger.

---

## Manual QA checklist

1. Start 7/1/2026, term 12 (months mode) — still shows Jul 2027 partial (unchanged default); custom end 6/30/2027 — 12 full months only
2. Edit terms with custom end before rent recorded
3. Extend custom-ended lease by 6 months — end advances from stored date
4. Extend with picked new end date + optional rent change
5. End lease / holdover on custom-ended lease — move-out preview still correct
