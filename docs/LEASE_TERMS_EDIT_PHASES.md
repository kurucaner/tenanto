# Lease Terms Edit (Pre-Rent Correction) — Implementation Phases

Phased rollout for correcting **lease start date**, **term (→ contract end)**, and **base monthly rent** on active leases **before any rent accounting exists**. Postgres + Fastify + shared contract + admin lease detail UI. No new tables in v1; reuse existing proration/schedule math.

**Related code today**

- [`packages/shared/src/lease-date-utils.ts`](../packages/shared/src/lease-date-utils.ts) — `calculateLeaseEndDate`, month enumeration, move-out bounds
- [`packages/shared/src/lease-rent-utils.ts`](../packages/shared/src/lease-rent-utils.ts) — rent-by-month, `validateExtendLease`
- [`packages/shared/src/property-long-stay-types.ts`](../packages/shared/src/property-long-stay-types.ts) — `IPropertyLongStay`, create/extend/end bodies; `IUpdatePropertyLongStayBody` is tenant contact only
- [`apps/server/src/db/property-long-stays.ts`](../apps/server/src/db/property-long-stays.ts) — `create`, `extendLease`, `endLease`, `getRentSchedule`, `updateLease` (contact fields)
- [`apps/server/src/routes/admin/property-long-stay-routes.ts`](../apps/server/src/routes/admin/property-long-stay-routes.ts) — create / extend / end / list / detail routes
- [`apps/server/src/lib/build-lease-rent-schedule-with-rollup.ts`](../apps/server/src/lib/build-lease-rent-schedule-with-rollup.ts) — schedule from dates + income + Stripe allocations
- [`apps/admin/src/components/leases/start-lease-dialog.tsx`](../apps/admin/src/components/leases/start-lease-dialog.tsx) — create UX + validation patterns
- [`apps/admin/src/components/leases/extend-lease-dialog.tsx`](../apps/admin/src/components/leases/extend-lease-dialog.tsx) — post-rent term/rent changes
- [`apps/admin/src/components/leases/end-lease-dialog.tsx`](../apps/admin/src/components/leases/end-lease-dialog.tsx) — move-out / holdover
- [`apps/admin/src/pages/property-lease-detail-page.tsx`](../apps/admin/src/pages/property-lease-detail-page.tsx) — lease detail shell
- [`apps/admin/src/components/leases/lease-overview-section.tsx`](../apps/admin/src/components/leases/lease-overview-section.tsx) — read-only term/dates/rent display
- [`docs/LEASE_RENT_PRORATION_PHASES.md`](./LEASE_RENT_PRORATION_PHASES.md) — schedule is computed, not stored

---

## Goals

- Operators can fix **data-entry mistakes** (wrong start, term, or rent) on a lease **before rent is recorded**
- Server enforces a clear **editability gate** — no silent rewrite after ledger activity
- Edited terms immediately refresh **rent schedule** (`expectedRent`, proration) for all unpaid months
- UI lives on **lease detail** as a dedicated action — not inline table editing
- Owners/managers/accountants with ledger write access can edit; accountants remain read-only elsewhere

## Non-goals (initial release)

- Inline edit of dates/rent in the leases **table**
- Editing terms after **any** income line or **succeeded** tenant Stripe payment exists
- Post-rent **correction/amendment** flow (adjust income, reconcile partials) — use Extend / End / manual income edits
- **Delete lease** in v1 (optional Phase 4 enhancement)
- Changing **unit** on an existing lease
- Editing **ended** leases
- Audit log table / terms history snapshot
- Tenant portal notification on term correction

---

## Practical recommendation

**Use a hard gate, not “first month unpaid.”**

| Allow edit when ALL are true                        | Block when ANY are true                                                       |
| --------------------------------------------------- | ----------------------------------------------------------------------------- |
| Lease `status = active`                             | Any non-deleted `property_income_lines` with `long_stay_id = lease`           |
| Zero linked income lines                            | Any `tenant_rent_payments` for lease with `status = succeeded`                |
| No extend rent history (see rent-period rule below) | Lease was **extended** — rent period rows beyond the pristine single-row case |
|                                                     | Pending Stripe checkout in flight (Phase 3.2)                                 |

**Rent-period rule (v1):** Block when `property_long_stay_rent_periods` has more than one row, or has a row whose `effective_from_month` is not the lease-start month. Pristine leases have **zero** rent-period rows; rent comes from `property_long_stays.monthly_rent`.

**Why not “first rent unpaid”?** A partial income line or succeeded Stripe allocation still ties accounting to the old dates. `getRentSchedule` mixes income lines and Stripe allocations — the gate must match that.

**What to edit in the form**

- `leaseStartDate`
- **Term (months)** or **custom contract end date** — same modes as Start lease; server resolves via `resolveLeaseEndDate` (see [`LEASE_CUSTOM_END_DATE_PHASES.md`](./LEASE_CUSTOM_END_DATE_PHASES.md))
- `monthlyRent` (base rent on `property_long_stays.monthly_rent`)

**After the gate fails:** show “Use **Extend lease** or **End lease**” — do not add table cell editing.

---

## Guiding principles

1. **Computed schedule is source of truth for unpaid months** — change lease fields; `getRentSchedule` recalculates proration (see [`LEASE_RENT_PRORATION_PHASES.md`](./LEASE_RENT_PRORATION_PHASES.md)).
2. **Ledger lock** — once money is linked, terms are contractual/accounting facts; block edits with **409** and a reason code.
3. **Same shape as create** — start + term or end date + rent; shared `resolveLeaseEndDate` keeps `termMonths` and `leaseEndDate` consistent.
4. **Dedicated flow, not inline** — dialog on lease detail with preview of new contract end + first-month proration hint (reuse `getStartLeaseFirstMonthRentPreview` in admin).
5. **Shared contract** — validation and editability rules in `packages/shared` so admin + server agree.
6. **Mirror permissions** — server `assertPropertyLedgerWriteAccess`; client `canManageLedger` (same as Start / Extend / End).

---

## Target architecture

```
[Edit lease terms dialog]
        ↓ PATCH …/long-stays/:id/terms
[property-long-stay-routes]
        ↓ assertPropertyLedgerWriteAccess
[lease-terms-edit-service]
        ↓ canEditLeaseTerms()? → 409 if locked
[propertyLongStaysDb.updateTerms]  (transaction)
        ↓ UPDATE property_long_stays
        ↓ optional: sync single rent_period row if present
[getRentSchedule]  → unchanged consumers refresh via cache invalidation
```

### Permissions

- **Can edit:** platform admin, property creator, owner, manager (`canManageLedger`)
- **Cannot:** accountant (read-only), non-members
- Mirror on server routes and client button visibility

### Feature flag

N/A — low-risk admin-only correction. Optional `LEASE_TERMS_EDIT_ENABLED` only if a dark launch is needed; not required for v1.

---

## Data model (sketch)

**No migration in v1.** Uses existing tables:

### `property_long_stays`

| Column             | Edit behavior                         |
| ------------------ | ------------------------------------- |
| `lease_start_date` | Updatable when gate passes            |
| `term_months`      | Updatable → recalc `lease_end_date`   |
| `lease_end_date`   | Derived via `calculateLeaseEndDate`   |
| `monthly_rent`     | Updatable when gate passes            |
| `actual_end_date`  | **Not** editable here (use End lease) |

### `property_long_stay_rent_periods`

| Rule                                                                                                      |
| --------------------------------------------------------------------------------------------------------- |
| Pristine lease: **no rows** — rent comes from `monthly_rent` on lease row                                 |
| If exactly **one** row at lease-start month (edge case): update its `monthly_rent` when base rent changes |
| If **extend** created multiple periods → **not editable** (gate fails)                                    |

### Eligibility queries (new DB helpers)

| Check                    | SQL sketch                                                                                    |
| ------------------------ | --------------------------------------------------------------------------------------------- |
| Income linked            | `EXISTS (SELECT 1 FROM property_income_lines WHERE long_stay_id = $1 AND is_deleted = false)` |
| Stripe succeeded         | `EXISTS (SELECT 1 FROM tenant_rent_payments WHERE lease_id = $1 AND status = 'succeeded')`    |
| Extension / rent history | `COUNT(*) > 1` on rent_periods, or row with `effective_from_month <> start month`             |

**Domain rule:** Editability is derived from ledger signals, not from schedule `isPaid` flags alone.

---

## Shared contract (`packages/shared`)

| Type                                          | Purpose                                                                                      |
| --------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `TLeaseTermsEditBlockReason`                  | `has_income_lines` \| `has_succeeded_payments` \| `has_rent_period_history` \| `lease_ended` |
| `ILeaseTermsEditability`                      | `{ editable: boolean; reason?: TLeaseTermsEditBlockReason }`                                 |
| `IEditPropertyLongStayTermsBody`              | `{ leaseStartDate, termMonths, monthlyRent }`                                                |
| `IEditPropertyLongStayTermsResponse`          | `{ longStay: IPropertyLongStay }`                                                            |
| `validateEditLeaseTerms(body, lease, today)`  | Pure validation (dates, term bounds)                                                         |
| `deriveLeaseTermsEditability(lease, signals)` | Pure gate from booleans                                                                      |

Extend GET long-stay detail response with `termsEditability: ILeaseTermsEditability`.

---

## API (sketch)

| Method  | Path                                                   | Notes                                                                                                                |
| ------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `GET`   | `/properties/:propertyId/long-stays/:longStayId`       | Include `termsEditability` on detail payload                                                                         |
| `PATCH` | `/properties/:propertyId/long-stays/:longStayId/terms` | Body: `IEditPropertyLongStayTermsBody`; **200** updated lease; **409** not editable; **400** validation; ledger auth |

No new list endpoint. Do **not** add PATCH on table row.

---

## Real-time / events

N/A — synchronous admin action; invalidate TanStack Query caches (`invalidatePropertyLongStayCaches`).

---

## Worker / job queue

N/A

---

## UI — lease detail

1. **Lease detail header / Terms section** — “Edit terms” button when `canManageLedger && termsEditability.editable`
2. **`EditLeaseTermsDialog`** — fields: start date, term months, monthly rent; preview contract end + first-month proration (reuse start-lease helpers)
3. **Blocked state** — when not editable, show one-line reason + pointer to Extend / End (no button)
4. **After save** — toast, invalidate lease detail + leases list caches

**Not in v1:** leases table columns as inputs.

---

## Phased rollout

### Phase 0 — Foundation (no user-facing feature)

**Goal:** Shared rules, DB eligibility queries, tests — no routes/UI.

- [x] Add `TLeaseTermsEditBlockReason`, `ILeaseTermsEditability`, `IEditPropertyLongStayTermsBody` in `packages/shared`
- [x] Add `validateEditLeaseTerms` + `deriveLeaseTermsEditability` with unit tests (gate matrix, date/term validation)
- [x] Add `propertyLongStaysDb.getTermsEditSignals(longStayId)` — income exists, succeeded payment exists, rent period shape
- [x] Add `LeaseTermsNotEditableError` + map block reasons to **409** responses

**Exit criteria:** Shared tests pass; eligibility helper returns correct reasons for fixture leases; no API/UI changes.

---

### Phase 1 — Backend pipeline (API only)

**Goal:** PATCH terms works for eligible active leases; blocked leases get 409.

- [x] Add `propertyLongStaysDb.updateTerms(id, body)` in transaction: update start/term/rent/end; sync single rent_period row if applicable
- [x] Add `lease-terms-edit-service.ts` — orchestrate gate + validation + DB
- [x] Register `PATCH …/terms` in `property-long-stay-routes.ts` with `assertPropertyLedgerWriteAccess`
- [x] Include `termsEditability` on GET long-stay detail
- [x] Server tests: editable lease updates schedule; blocked cases (income line, succeeded payment, extend history); ended lease rejected

**Exit criteria:** Script/Postman can PATCH a pristine lease; `getRentSchedule` reflects new dates/rent; 409 with reason when income exists.

---

### Phase 2 — Admin UI MVP

**Goal:** Operators can correct mistakes from lease detail.

- [x] Add `longStaysApi.updateTerms` in `apps/admin/src/lib/api-client.ts`
- [x] Add `EditLeaseTermsDialog` (mirror `start-lease-dialog.tsx` fields/validation)
- [x] Wire button in `lease-detail-header.tsx` or `lease-terms-section.tsx`
- [x] Show blocked copy when `termsEditability.editable === false`
- [x] Invalidate caches via `invalidatePropertyLongStayCaches`

**Exit criteria:** Happy path on lease with no income; button hidden/disabled with clear reason after first Record rent; schedule + overview update without full page reload.

---

### Phase 3 — Hardening

**Goal:** Production-safe edge cases — concurrent edits, in-flight Stripe checkouts, and operator-visible failures without silent data races.

| Sub-phase                                              | Concern                                       |
| ------------------------------------------------------ | --------------------------------------------- |
| [3.1](#phase-31--concurrent-edit-optimistic-locking)   | Double-submit / concurrent PATCH              |
| [3.2](#phase-32--pending-checkout-gate)                | Open tenant checkout blocks terms edit        |
| [3.3](#phase-33--unit-conflict-guard)                   | Cheap active-lease-on-unit guard              |
| [3.4](#phase-34--admin-error-mapping)                  | Block reasons + 409 copy in admin             |
| [3.5](#phase-35--observability)                        | Structured `lease.terms_updated` log          |
| [3.6](#phase-36--proration-regression--doc-cross-link) | Post-edit schedule tests + proration doc link |

**Exit criteria (Phase 3 overall):** All sub-phases below complete; double-submit returns **409**; pending checkout blocked; proration regression tests pass; cross-link added in [`LEASE_RENT_PRORATION_PHASES.md`](./LEASE_RENT_PRORATION_PHASES.md).

---

#### Phase 3.1 — Concurrent edit (optimistic locking)

**Goal:** Two operators (or double-submit) cannot silently overwrite each other's terms PATCH.

**Tasks**

- [ ] Accept optional `expectedUpdatedAt` on `IEditPropertyLongStayTermsBody` (or read from GET detail `longStay.updatedAt` client-side only — server compares DB row)
- [ ] `propertyLongStaysDb.updateTerms` — `UPDATE … WHERE id = $1 AND updated_at = $expected` inside existing transaction; **0 rows** → dedicated error (e.g. `LeaseTermsConcurrentEditError`)
- [ ] Route maps concurrent conflict to **409** `{ error, code: "LEASE_TERMS_STALE" }` (distinct from editability **409** `{ reason }`)
- [ ] Admin dialog: send current `lease.updatedAt`; on stale conflict toast + refetch detail (do not close dialog with stale values)
- [ ] Tests: two sequential updates with same `expectedUpdatedAt` → second fails; fresh timestamp succeeds

**Exit criteria:** Rapid double-click Save or stale tab edit returns **409** stale conflict; refetch shows latest terms; no partial rent_period sync without lease row update.

---

#### Phase 3.2 — Pending checkout gate

**Goal:** Block terms edit while a tenant Stripe checkout is in flight (`pending`, `requires_action`, or `processing`).

**Tasks**

- [ ] Add `TLeaseTermsEditBlockReason` value `has_pending_checkout` + message in `getLeaseTermsEditBlockMessage`
- [ ] Extend `getTermsEditSignals` — `EXISTS (… tenant_rent_payments WHERE lease_id AND status IN ('pending','requires_action','processing'))`
- [ ] Update `deriveLeaseTermsEditability` priority (after `has_succeeded_payments`, before `has_rent_period_history` — or document chosen order in shared tests)
- [ ] Shared gate matrix test for pending checkout
- [ ] Admin blocked copy uses shared message (Phase 3.4 may refine wording)

**Exit criteria:** Lease with open checkout shows `termsEditability.editable === false` and **409** on PATCH; after payment succeeds/fails/cancels, existing succeeded-payment or editable rules apply.

---

#### Phase 3.3 — Unit conflict guard

**Goal:** Cheap server guard even though unit is not editable — catch impossible overlap if dates shift or data is inconsistent.

**Tasks**

- [x] In `updateTerms` (or service, before write): `findActiveByUnitId(lease.unitId)` — if another active lease exists and `id !== longStayId`, throw `ActiveLongStayConflictError` (same as create)
- [x] Only run when `leaseStartDate` or `termMonths` change (no-op rent-only patch skips)
- [x] Test: fixture with two active leases on same unit should not be creatable; guard documents intent if bad data exists

**Exit criteria:** PATCH that would imply two active leases on one unit returns **409**; rent-only correction on unchanged dates skips check.

---

#### Phase 3.4 — Admin error mapping

**Goal:** Operators see consistent, actionable copy for every failure mode (gate, validation, stale, network).

**Tasks**

- [ ] Centralize admin strings in one module (e.g. `lease-terms-edit-messages.ts`) mapping `TLeaseTermsEditBlockReason` → UI copy (can wrap `getLeaseTermsEditBlockMessage` with product tone)
- [ ] Map PATCH **409** editability responses using `reason` field (not only `error` string)
- [ ] Map stale conflict **409** (`LEASE_TERMS_STALE`) → “Lease was updated elsewhere. Refresh and try again.”
- [ ] Map **400** validation → field-level or toast from server `error`
- [ ] Terms tab blocked state uses same mapper as dialog errors (single source)

**Exit criteria:** Each block reason and stale conflict has distinct, tested admin copy; no raw server enum slugs shown to operators.

---

#### Phase 3.5 — Observability

**Goal:** Production debugging for terms corrections without PII in logs.

**Tasks**

- [ ] Emit structured log `lease.terms_updated` from `editLeaseTerms` (or route) with `propertyId`, `longStayId`, `userId` (operator id ok); **no** guest name, email, phone, or rent amounts
- [ ] Optional debug fields: `{ changedFields: ["leaseStartDate","termMonths"] }` booleans only
- [ ] Mirror pattern from `tenant-portal-observability.ts` / `log-helpers.ts`
- [ ] Test or snapshot that log payload shape excludes PII keys

**Exit criteria:** Successful PATCH produces one grep-able `lease.terms_updated` event in server logs; blocked PATCH does not emit it.

---

#### Phase 3.6 — Proration regression + doc cross-link

**Goal:** Prove `getRentSchedule` stays correct after terms PATCH; link proration doc to this flow.

**Tasks**

- [ ] Extend `property-long-stays-rent-schedule.test.ts` — mid-month start after `updateTerms`: first month prorated, full middle months, term boundary months correct
- [ ] Case: edit only `monthlyRent` on pristine lease → all months reflect new rent
- [ ] Case: edit `leaseStartDate` + `termMonths` → month list length matches `enumerateLeaseMonths`
- [ ] Add subsection + link in [`LEASE_RENT_PRORATION_PHASES.md`](./LEASE_RENT_PRORATION_PHASES.md) under related code / post-edit correction pointer to this doc Phase 3.6
- [ ] Add back-link here to proration doc test matrix

**Exit criteria:** New rent-schedule tests pass in CI; both phase docs cross-reference each other.

---

### Phase 4 — Enhancements (post-launch)

- [ ] **Delete lease** when same eligibility gate passes + no active portal memberships (or only pending invites)
- [ ] Post-rent **amendment** flow (separate doc — income reconciliation, not silent PATCH)
- [ ] Optional audit row / activity feed entry

---

## What not to do

- Do **not** add editable date/rent cells to `property-leases-page.tsx` table
- Do **not** allow editing **`actualEndDate`** or ended leases in this flow
- Do **not** use “no paid months on schedule” as the sole gate — partial income still locks
- Do **not** PATCH `leaseEndDate` without updating `termMonths` consistently
- Do **not** wipe or rewrite existing `property_income_lines` silently
- Do **not** bypass `assertPropertyLedgerWriteAccess` for accountants
- Do **not** add a migration for proration snapshots — keep compute-only model

---

## Safest sequencing summary

1. **Shared gate + validation before any route** — admin and server must agree on when edit is allowed.
2. **Backend PATCH + schedule verification before UI** — prove `getRentSchedule` updates correctly.
3. **Lease detail dialog only** — not table inline edit.
4. **Lock on first ledger touch** — income line or succeeded Stripe payment, not “fully paid month.”
5. **Post-rent changes stay on Extend / End** — defer amendment flow to Phase 4 enhancement.
