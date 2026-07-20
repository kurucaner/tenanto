# Lease Term (Months) End Date — Implementation Phases

Phased rollout to change **Term (months)** lease end calculation from “same calendar day N months later” to **(start + N calendar months) − 1 day**, so a 12-month lease starting 7/1/2026 ends on 6/30/2027 instead of 7/1/2027. Applies to **new** month-based creates, edit-terms (months mode), and extend-by-months. **Extend lease** must use an aligned rule (extension starts the day after current contract end). Pure shared-utils change in `packages/shared` — server and admin pick it up through existing `resolveLeaseEndDate` / `resolveExtendLeaseEndDate` paths. **No DB migration**, **no include/exclude toggle**, **no backfill** of existing leases.

**Related code today**

- [`packages/shared/src/lease-date-utils.ts`](../packages/shared/src/lease-date-utils.ts) — `calculateLeaseEndDate` (today: add N months, same day)
- [`packages/shared/src/lease-term-input-utils.ts`](../packages/shared/src/lease-term-input-utils.ts) — `resolveLeaseEndDate`, `resolveExtendLeaseEndDate`, `isCustomLeaseEndDate`, `addMonthsToIsoDate`
- [`packages/shared/src/lease-rent-utils.ts`](../packages/shared/src/lease-rent-utils.ts) — `validateExtendLease`, `getExtensionRentEffectiveMonthOptions`
- [`packages/shared/src/lease-terms-edit-utils.ts`](../packages/shared/src/lease-terms-edit-utils.ts) — edit-terms validation via `resolveLeaseEndDate`
- [`packages/shared/src/lease-proration-utils.ts`](../packages/shared/src/lease-proration-utils.ts) — inclusive proration through stored `lease_end_date` (unchanged)
- [`apps/server/src/db/property-long-stays.ts`](../apps/server/src/db/property-long-stays.ts) — `create`, `updateTerms`, `extendLease` all call shared resolve helpers
- [`apps/server/src/routes/admin/property-long-stay-routes.ts`](../apps/server/src/routes/admin/property-long-stay-routes.ts) — create / terms / extend body parsers (no change expected)
- [`apps/admin/src/components/leases/lease-term-end-fields.tsx`](../apps/admin/src/components/leases/lease-term-end-fields.tsx) — `resolveLeaseTermEndPreview`, `getInitialLeaseTermEndValues`
- [`apps/admin/src/hooks/use-start-lease-form.ts`](../apps/admin/src/hooks/use-start-lease-form.ts) — start lease end preview
- [`apps/admin/src/components/leases/edit-lease-terms-dialog.tsx`](../apps/admin/src/components/leases/edit-lease-terms-dialog.tsx) — edit terms preview
- [`apps/admin/src/components/leases/extend-lease-dialog.tsx`](../apps/admin/src/components/leases/extend-lease-dialog.tsx) — extend preview via `resolveExtendLeaseEndDate`
- [`apps/admin/src/components/leases/lease-overview-section.tsx`](../apps/admin/src/components/leases/lease-overview-section.tsx) — “Custom end” badge via `isCustomLeaseEndDate`
- [`docs/LEASE_CUSTOM_END_DATE_PHASES.md`](./LEASE_CUSTOM_END_DATE_PHASES.md) — custom end mode (unchanged); months mode behavior updated here

---

## Goals

- **Term (months)** on Start lease, Edit terms, and Extend (additional months) computes end as **(start + N months) − 1 calendar day**
- Example: start `2026-07-01`, 12 months → end `2027-06-30` (also 3 → `2026-09-30`, 6 → `2026-12-31`)
- **Extend-by-months** stays consistent: next term window starts **the day after** current `lease_end_date`, then applies the same formula
- Admin previews (start / edit / extend) show the new end automatically via shared helpers
- Existing **custom end date** mode unchanged — operator-supplied `leaseEndDate` still wins
- Proration stays **inclusive** through stored `lease_end_date` — no formula change in `lease-proration-utils`

## Non-goals (initial release)

- Include/exclude end-date toggle or configurable anniversary behavior
- DB migration or backfill of existing `lease_end_date` / `term_months` rows
- Recomputing or editing stored terms on legacy leases
- Changing proration day-count math (`daysBetweenInclusive`, etc.)
- Tenant portal changes (displays stored API dates only)
- Bulk export or reporting recalculation for historical leases

---

## Guiding principles

1. **Single source of truth in `packages/shared`** — change `calculateLeaseEndDate` and `resolveExtendLeaseEndDate` once; server + admin inherit via existing resolve paths.
2. **Extend from day-after contract end** — month-based extension must not use `addMonthsToIsoDate(currentEnd, n)` alone; use `calculateLeaseEndDate(addDays(currentEnd, 1), n)` so full rental months follow the stored last occupied day.
3. **Stored `termMonths` is operator-entered in months mode** — do not re-derive `termMonths` from dates on create/edit months mode; only compute `lease_end_date`.
4. **Extend still sums `termMonths`** — `newTermMonths = lease.termMonths + additionalTermMonths` (unchanged); custom extend still derives total from `deriveTermMonthsFromDates`.
5. **Legacy data stays as-is** — old leases with anniversary-style ends may show as “custom” under `isCustomLeaseEndDate`; acceptable without migration.
6. **No duplicate date math in admin** — previews already call `resolveLeaseEndDate` / `resolveExtendLeaseEndDate`; do not hand-roll dates in components.

---

## Target architecture

```
[Start / Edit / Extend dialog — months mode]
        ↓
packages/shared
  resolveLeaseEndDate(start, termMonths)
    → calculateLeaseEndDate = addMonths(start, N) − 1 day

  resolveExtendLeaseEndDate(lease, { additionalTermMonths })
    → calculateLeaseEndDate(addDays(lease.leaseEndDate, 1), additionalTermMonths)
    → newTermMonths = lease.termMonths + additionalTermMonths

[Custom end mode] — unchanged
  resolveLeaseEndDate({ leaseEndDate }) / resolveExtendLeaseEndDate({ newLeaseEndDate })
        ↓
POST create | PATCH terms | POST extend  (apps/server — no code change expected)
        ↓
property_long_stays.lease_end_date persisted
        ↓
getRentSchedule / proration (unchanged — reads stored end)
```

### Permissions

N/A — no new capability. Same as today:

- Start / Edit terms / Extend: owner, manager, platform admin (`assertPropertyLedgerWriteAccess`)
- Accountant: read-only

### Feature flag

N/A — behavior change ships when shared tests pass; affects new writes only.

---

## Data model (sketch)

**No migration.** Existing columns unchanged:

| Column             | Role after change                                                |
| ------------------ | ---------------------------------------------------------------- |
| `lease_start_date` | Occupancy start (inclusive)                                      |
| `lease_end_date`   | Contract end; **authoritative** for schedule (new math on write) |
| `term_months`      | Operator-entered N in months mode; derived when custom end used  |
| `actual_end_date`  | Set on End lease only                                            |

**Domain rule (months mode):** On create, edit terms, or extend-by-months, persist:

```text
lease_end_date = addDays(addMonths(anchor, N), -1)
```

- Create / edit terms: `anchor = lease_start_date`
- Extend-by-months: `anchor = addDays(lease.leaseEndDate, 1)`

**Legacy rows:** Stored values untouched; may not match new formula until operator edits or extends.

---

## Shared contract (`packages/shared`)

| Type / function                                                  | Change                                                                                                                                                                      |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `addDaysToIsoDate(iso, days)`                                    | **New** in `lease-date-utils.ts` (local-date arithmetic, same pattern as today)                                                                                             |
| `addMonthsToIsoDate`                                             | Optionally consolidate into `lease-date-utils.ts`; keep exported from `lease-term-input-utils` if moved                                                                     |
| `calculateLeaseEndDate(start, termMonths)`                       | **Change:** `addDaysToIsoDate(addMonthsToIsoDate(start, termMonths), -1)`                                                                                                   |
| `resolveLeaseEndDate`                                            | No signature change; months branch picks up new `calculateLeaseEndDate`                                                                                                     |
| `resolveExtendLeaseEndDate`                                      | **Change months branch:** use `calculateLeaseEndDate(addDaysToIsoDate(lease.leaseEndDate, 1), additionalTermMonths)` instead of `addMonthsToIsoDate(lease.leaseEndDate, …)` |
| `isCustomLeaseEndDate`                                           | No code change; **behavior flip** for new standard ends (6/30 no longer “custom” for 7/1 + 12)                                                                              |
| `IExtendPropertyLongStayBody`                                    | Unchanged                                                                                                                                                                   |
| `ICreatePropertyLongStayBody` / `IEditPropertyLongStayTermsBody` | Unchanged                                                                                                                                                                   |

---

## API (sketch)

| Method  | Path                                    | Change                                                              |
| ------- | --------------------------------------- | ------------------------------------------------------------------- |
| `POST`  | `/properties/:id/long-stays`            | Resolved `leaseEndDate` from new formula when `termMonths` provided |
| `PATCH` | `/properties/:id/long-stays/:id/terms`  | Same                                                                |
| `POST`  | `/properties/:id/long-stays/:id/extend` | New end when `additionalTermMonths` provided                        |

No route/parser changes expected — behavior comes from shared helpers in DB layer.

---

## Real-time / events

N/A — synchronous lease writes; no SSE or worker.

---

## Worker / job queue

N/A.

---

## UI — Admin lease dialogs

No dedicated UI phase — existing surfaces already use shared previews:

1. **Start lease Terms step** — `resolveLeaseTermEndPreview` → shows new end (already wired)
2. **Edit terms** — same preview helper
3. **Extend lease (additional months)** — `resolveExtendLeaseEndDate` preview
4. **Lease overview** — “Custom end” badge may disappear for new month-based leases; legacy anniversary ends may show as custom

Optional copy check: helper text in `lease-term-end-fields.tsx` (“Rent is calculated through the end date you set (inclusive)”) remains accurate.

---

## Phased rollout

### Phase 0 — Foundation (no user-facing feature)

**Goal:** Shared date helpers + unit tests; extend aligned in the same change set.

- [x] Add `addDaysToIsoDate` to [`packages/shared/src/lease-date-utils.ts`](../packages/shared/src/lease-date-utils.ts)
- [x] (Optional) Move `addMonthsToIsoDate` into `lease-date-utils.ts` and re-export from `lease-term-input-utils.ts` to dedupe `formatLocalIsoDate`
- [x] Update `calculateLeaseEndDate` to subtract one day after adding months
- [x] Update `resolveExtendLeaseEndDate` months branch to extend from `addDays(lease.leaseEndDate, 1)`
- [x] Update [`packages/shared/src/lease-date-utils.test.ts`](../packages/shared/src/lease-date-utils.test.ts) — canonical cases:

  | Start      | N   | Expected end |
  | ---------- | --- | ------------ |
  | 2026-07-01 | 12  | 2027-06-30   |
  | 2026-07-01 | 3   | 2026-09-30   |
  | 2026-10-01 | 3   | 2026-12-31   |
  | 2026-01-15 | 12  | 2027-01-14   |

- [x] Add edge-case tests (Jan 31 + N months, month-end anchors)
- [x] Update [`packages/shared/src/lease-term-input-utils.test.ts`](../packages/shared/src/lease-term-input-utils.test.ts):
  - `resolveLeaseEndDate` months case → `2027-06-30`
  - **Flip** `isCustomLeaseEndDate`: `2027-06-30` → `false`, `2027-07-01` → `true`
  - `resolveExtendLeaseEndDate` +6 from end `2027-06-30` → `2027-12-31` (not `2027-12-30`)

**Exit criteria:** `cd packages/shared && bun test src/lease-date-utils.test.ts src/lease-term-input-utils.test.ts` passes.

---

### Phase 1 — Server integration tests

**Goal:** Confirm DB layer persists new ends without route changes.

- [x] Update [`apps/server/src/db/property-long-stays-extend.test.ts`](../apps/server/src/db/property-long-stays-extend.test.ts) — expect `leaseEndDate: "2027-12-31"` for +6 from `2027-06-30`
- [x] Verify [`packages/shared/src/lease-rent-utils.test.ts`](../packages/shared/src/lease-rent-utils.test.ts) — `getExtensionRentEffectiveMonthOptions("2027-06-30", "2027-12-31")` should still list Jul–Dec 2027 (likely no assertion change)
- [x] Run `cd apps/server && bun test src/db/property-long-stays-extend.test.ts`

**Exit criteria:** Server extend test green; no changes required in `property-long-stays.ts` if it already delegates to `resolveExtendLeaseEndDate`.

---

### Phase 2 — Admin verification (no code expected)

**Goal:** Previews and badges reflect shared math.

- [x] Manual smoke — Start lease: 7/1/2026, 12 months → preview “Lease ends Jun 30, 2027”
- [x] Manual smoke — Extend: lease ending 6/30/2027, +6 months → preview 12/31/2027
- [x] Manual smoke — New lease overview: no “Custom end” badge for standard month-based end
- [x] Manual smoke — Legacy lease stored as 7/1/2027 with `termMonths: 12` → may show “Custom end” when edited (acceptable)

**Exit criteria:** Happy-path QA signed off; no admin TS diffs unless a preview bypasses shared helpers (none known today). Automated in [`lease-term-end-admin-verification.test.ts`](../apps/admin/src/components/leases/lease-term-end-admin-verification.test.ts).

---

### Phase 3 — Docs cross-link

**Goal:** Related docs describe the new default months behavior.

- [ ] Add pointer from [`docs/LEASE_CUSTOM_END_DATE_PHASES.md`](./LEASE_CUSTOM_END_DATE_PHASES.md) — months mode now defaults to −1 day; custom end still available for overrides
- [ ] Optional note in [`docs/LEASE_TERMS_EDIT_PHASES.md`](./LEASE_TERMS_EDIT_PHASES.md) if months-mode default is referenced

**Exit criteria:** Docs consistent; no contradiction with “custom end fixes 7/1→6/30” narrative (months mode now does that automatically).

---

### Phase 4 — Hardening

**Goal:** Regression coverage for extend + legacy interaction.

| Concern                                | Action                                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------------------------- |
| Extend end alignment                   | Shared test: 6/30/2027 + 6 → 12/31/2027                                                     |
| 12-month extend from month-end anchor  | Shared test: 6/30/2027 + 12 → 6/30/2028                                                     |
| Legacy extend from old anniversary end | Document: 7/1/2027 + 6 → 1/1/2028 (same as old `addMonths` for month-start anchors)         |
| Rent effective months on extend        | Confirm Jul–Dec unchanged when end shifts by one day                                        |
| Proration                              | No code change; optional schedule test for new create 7/1 + 12 months → last month Jun 2027 |

- [ ] Run full shared package tests: `cd packages/shared && bun test`
- [ ] Run targeted server tests for long-stay create/extend/terms if any fail after Phase 0

**Exit criteria:** Targeted + shared test suites green; manual QA checklist complete.

---

### Phase 5 — Enhancements (post-launch)

- Release notes entry when shipping (admin app)
- Optional: soften “Custom end” badge copy for legacy anniversary mismatches
- Optional: export column note that pre-change leases may use anniversary-style ends

---

## Side effects reference

| Area                               | Impact                                                                  |
| ---------------------------------- | ----------------------------------------------------------------------- |
| **Create (months mode)**           | New ends one day earlier than before                                    |
| **Edit terms (months mode)**       | Same                                                                    |
| **Extend (months mode)**           | +N from day-after current end; e.g. 6/30 + 6 → 12/31 not 12/30          |
| **Extend (custom end)**            | Unchanged                                                               |
| **Custom end mode**                | Unchanged                                                               |
| **`isCustomLeaseEndDate`**         | New standard 6/30 ends not custom; legacy 7/1/2027 + 12 may show custom |
| **`getInitialLeaseTermEndValues`** | Legacy leases may open in customEnd mode when stored end ≠ new formula  |
| **Proration / schedule**           | Unchanged math; reads stored `lease_end_date`                           |
| **Holdover / end lease**           | Unchanged                                                               |
| **Tenant portal**                  | Unchanged                                                               |

### Extend worked example (canonical)

| Step         | Value                                           |
| ------------ | ----------------------------------------------- |
| Create       | start `2026-07-01`, 12 mo → end `2027-06-30`    |
| Extend +6    | extension start `2027-07-01` → end `2027-12-31` |
| `termMonths` | 18                                              |

---

## What not to do

- Do **not** change only `calculateLeaseEndDate` without updating `resolveExtendLeaseEndDate` — extend would stay on `addMonthsToIsoDate(currentEnd, n)` and drift from create
- Do **not** add a migration or backfill — user explicitly declined
- Do **not** add an include/exclude toggle — single formula for all new month-based terms
- Do **not** re-derive `termMonths` from dates in months mode — keep operator-entered N
- Do **not** change proration helpers — inclusive end-date semantics stay correct
- Do **not** mass-update test fixtures using arbitrary `leaseEndDate: "2027-01-01"` — only update tests asserting **computed** ends
- Do **not** duplicate date math in admin components — use shared resolve helpers only

---

## Safest sequencing summary

1. **Phase 0 first** — `calculateLeaseEndDate` and `resolveExtendLeaseEndDate` in the **same PR**; never ship one without the other.
2. **Tests before manual QA** — update shared + server extend tests, then smoke admin previews.
3. **No server route changes** — if `property-long-stays.ts` already calls shared helpers, DB layer needs no edits.
4. **Legacy leases untouched** — accept `isCustomLeaseEndDate` mismatch for old anniversary-style rows.
5. **Docs after behavior frozen** — cross-link from custom-end phases doc so operators understand months vs custom modes.

---

## Manual QA checklist

1. Start lease 7/1/2026, **12 months** → end preview and persisted `2027-06-30`; Payments schedule last full month Jun 2027
2. Start lease 7/1/2026, **3 months** → end `2026-09-30`
3. Extend lease ending **6/30/2027** by **6 months** → end `12/31/2027`, rent-effective months Jul–Dec 2027
4. Extend with **custom new end date** → unchanged behavior
5. Edit terms (months mode, gate open) → new preview matches persisted end
6. Legacy lease with end `2027-07-01` and `termMonths: 12` → may show “Custom end”; extend +6 still reaches `2028-01-01`

---

## Suggested commit message

```bash
git add .
git commit -m "fix: Compute lease end as start plus N months minus one day"
```
