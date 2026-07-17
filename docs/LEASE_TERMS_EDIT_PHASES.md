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
- Free-form edit of **`leaseEndDate`** without going through **start + termMonths** (same model as create)
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

| Allow edit when ALL are true | Block when ANY are true |
| --- | --- |
| Lease `status = active` | Any non-deleted `property_income_lines` with `long_stay_id = lease` |
| Zero linked income lines | Any `tenant_rent_payments` for lease with `status = succeeded` |
| No extend rent history (see rent-period rule below) | Lease was **extended** — rent period rows beyond the pristine single-row case |
| | Pending Stripe checkout in flight (optional Phase 3 hardening) |

**Rent-period rule (v1):** Block when `property_long_stay_rent_periods` has more than one row, or has a row whose `effective_from_month` is not the lease-start month. Pristine leases have **zero** rent-period rows; rent comes from `property_long_stays.monthly_rent`.

**Why not “first rent unpaid”?** A partial income line or succeeded Stripe allocation still ties accounting to the old dates. `getRentSchedule` mixes income lines and Stripe allocations — the gate must match that.

**What to edit in the form**

- `leaseStartDate`
- `termMonths` → server recalculates `leaseEndDate` via `calculateLeaseEndDate`
- `monthlyRent` (base rent on `property_long_stays.monthly_rent`)

**After the gate fails:** show “Use **Extend lease** or **End lease**” — do not add table cell editing.

---

## Guiding principles

1. **Computed schedule is source of truth for unpaid months** — change lease fields; `getRentSchedule` recalculates proration (see [`LEASE_RENT_PRORATION_PHASES.md`](./LEASE_RENT_PRORATION_PHASES.md)).
2. **Ledger lock** — once money is linked, terms are contractual/accounting facts; block edits with **409** and a reason code.
3. **Same shape as create** — start + term + rent, not arbitrary end date; avoids inconsistent `termMonths` vs `leaseEndDate`.
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

| Column | Edit behavior |
| --- | --- |
| `lease_start_date` | Updatable when gate passes |
| `term_months` | Updatable → recalc `lease_end_date` |
| `lease_end_date` | Derived via `calculateLeaseEndDate` |
| `monthly_rent` | Updatable when gate passes |
| `actual_end_date` | **Not** editable here (use End lease) |

### `property_long_stay_rent_periods`

| Rule |
| --- |
| Pristine lease: **no rows** — rent comes from `monthly_rent` on lease row |
| If exactly **one** row at lease-start month (edge case): update its `monthly_rent` when base rent changes |
| If **extend** created multiple periods → **not editable** (gate fails) |

### Eligibility queries (new DB helpers)

| Check | SQL sketch |
| --- | --- |
| Income linked | `EXISTS (SELECT 1 FROM property_income_lines WHERE long_stay_id = $1 AND is_deleted = false)` |
| Stripe succeeded | `EXISTS (SELECT 1 FROM tenant_rent_payments WHERE lease_id = $1 AND status = 'succeeded')` |
| Extension / rent history | `COUNT(*) > 1` on rent_periods, or row with `effective_from_month <> start month` |

**Domain rule:** Editability is derived from ledger signals, not from schedule `isPaid` flags alone.

---

## Shared contract (`packages/shared`)

| Type | Purpose |
| --- | --- |
| `TLeaseTermsEditBlockReason` | `has_income_lines` \| `has_succeeded_payments` \| `has_rent_period_history` \| `lease_ended` |
| `ILeaseTermsEditability` | `{ editable: boolean; reason?: TLeaseTermsEditBlockReason }` |
| `IEditPropertyLongStayTermsBody` | `{ leaseStartDate, termMonths, monthlyRent }` |
| `IEditPropertyLongStayTermsResponse` | `{ longStay: IPropertyLongStay }` |
| `validateEditLeaseTerms(body, lease, today)` | Pure validation (dates, term bounds) |
| `deriveLeaseTermsEditability(lease, signals)` | Pure gate from booleans |

Extend GET long-stay detail response with `termsEditability: ILeaseTermsEditability`.

---

## API (sketch)

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/properties/:propertyId/long-stays/:longStayId` | Include `termsEditability` on detail payload |
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

- [ ] Add `TLeaseTermsEditBlockReason`, `ILeaseTermsEditability`, `IEditPropertyLongStayTermsBody` in `packages/shared`
- [ ] Add `validateEditLeaseTerms` + `deriveLeaseTermsEditability` with unit tests (gate matrix, date/term validation)
- [ ] Add `propertyLongStaysDb.getTermsEditSignals(longStayId)` — income exists, succeeded payment exists, rent period shape
- [ ] Add `LeaseTermsNotEditableError` + map block reasons to **409** responses

**Exit criteria:** Shared tests pass; eligibility helper returns correct reasons for fixture leases; no API/UI changes.

---

### Phase 1 — Backend pipeline (API only)

**Goal:** PATCH terms works for eligible active leases; blocked leases get 409.

- [ ] Add `propertyLongStaysDb.updateTerms(id, body)` in transaction: update start/term/rent/end; sync single rent_period row if applicable
- [ ] Add `lease-terms-edit-service.ts` — orchestrate gate + validation + DB
- [ ] Register `PATCH …/terms` in `property-long-stay-routes.ts` with `assertPropertyLedgerWriteAccess`
- [ ] Include `termsEditability` on GET long-stay detail
- [ ] Server tests: editable lease updates schedule; blocked cases (income line, succeeded payment, extend history); ended lease rejected

**Exit criteria:** Script/Postman can PATCH a pristine lease; `getRentSchedule` reflects new dates/rent; 409 with reason when income exists.

---

### Phase 2 — Admin UI MVP

**Goal:** Operators can correct mistakes from lease detail.

- [ ] Add `longStaysApi.updateTerms` in `apps/admin/src/lib/api-client.ts`
- [ ] Add `EditLeaseTermsDialog` (mirror `start-lease-dialog.tsx` fields/validation)
- [ ] Wire button in `lease-detail-header.tsx` or `lease-terms-section.tsx`
- [ ] Show blocked copy when `termsEditability.editable === false`
- [ ] Invalidate caches via `invalidatePropertyLongStayCaches`

**Exit criteria:** Happy path on lease with no income; button hidden/disabled with clear reason after first Record rent; schedule + overview update without full page reload.

---

### Phase 3 — Hardening

**Goal:** Production-safe edge cases.

| Concern | Action |
| --- | --- |
| Concurrent edit | `UPDATE … WHERE updated_at = $expected` optimistic check → **409** conflict |
| Pending checkout | Block if open `tenant_rent_payments` (pending/processing) for lease |
| Unit conflict | Re-run active-lease-on-unit check if overlap logic ever applies (unit unchanged; cheap guard) |
| Error mapping | Map block reasons to user-facing strings in admin |
| Observability | Structured log `lease.terms_updated` with leaseId, propertyId (no PII) |
| Regression | Extend `property-long-stays-rent-schedule.test.ts` for post-edit proration |

**Exit criteria:** Double-submit safe; pending checkout blocked if implemented; cross-link added in `LEASE_RENT_PRORATION_PHASES.md`.

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
