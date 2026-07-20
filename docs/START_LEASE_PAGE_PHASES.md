# Start Lease Page — Implementation Phases

Phased rollout to move **Start lease** from a scroll-trapped dialog to a dedicated admin page at `/properties/:propertyId/leases/new`. Admin-only UI refactor — **no server, shared contract, or migration changes**.

**Related code today**

- [`apps/admin/src/pages/property-start-lease-page.tsx`](../apps/admin/src/pages/property-start-lease-page.tsx) — page shell, back link, permission gate
- [`apps/admin/src/components/leases/start-lease-form.tsx`](../apps/admin/src/components/leases/start-lease-form.tsx) — Card sections (unit, rent, term, tenant)
- [`apps/admin/src/hooks/use-start-lease-form.ts`](../apps/admin/src/hooks/use-start-lease-form.ts) — form state, mutation, validation UX
- [`apps/admin/src/lib/start-lease-form-schema.ts`](../apps/admin/src/lib/start-lease-form-schema.ts) — Zod schema + defaults
- [`apps/admin/src/lib/start-lease-routes.ts`](../apps/admin/src/lib/start-lease-routes.ts) — path + query param helpers
- [`apps/admin/src/lib/property-shell-routes.ts`](../apps/admin/src/lib/property-shell-routes.ts) — focused shell chrome for `/leases/new`
- [`apps/admin/src/pages/property-leases-page.tsx`](../apps/admin/src/pages/property-leases-page.tsx) — navigates to new page
- [`apps/admin/src/pages/property-units-page.tsx`](../apps/admin/src/pages/property-units-page.tsx) — navigates with `?unitId=&from=units`

See also: [`LEASE_CUSTOM_END_DATE_PHASES.md`](LEASE_CUSTOM_END_DATE_PHASES.md) (term/end-date fields on create).

---

## Goals

- Start lease opens on a **full page** with room to add fields later
- **Monthly rent** visible without scrolling past tenant/term fields
- Entry from **leases list** and **units table** (unit prefill + locked)
- Success navigates to **lease detail**
- Invalid submit shows toast + scrolls to first error

## Non-goals

- New API fields or secondary tenant at create
- Multi-step wizard (single page with sections in v1)
- Keeping the dialog as a parallel entry point

---

## Phase 1 — Route + shell

- [x] Register `leases/new` before `leases/:leaseId` in router
- [x] `isPropertyLeaseFocusedPath` hides property tab chrome for `/leases/new`
- [x] Page skeleton with back link and `canManageLedger` gate

**Exit criteria:** `/properties/:id/leases/new` renders focused shell.

## Phase 2 — Form + page

- [x] Extract schema, hook, and presentational form
- [x] Card sections: Unit → Rent → Term → Primary tenant
- [x] Submit → `longStaysApi.create` → navigate to lease detail

**Exit criteria:** Create flow works from URL; `?unitId=` locks unit.

## Phase 3 — Entry points + cleanup

- [x] Leases list and units table navigate to new page
- [x] Remove `start-lease-dialog.tsx`

**Exit criteria:** No `StartLeaseDialog` references.

## Phase 4 — Hardening + docs

- [x] Invalid-submit toast + `scrollFormToFirstError`
- [x] Unit tests for route helpers and schema defaults
- [x] Release notes

**Exit criteria:** Tests pass; release notes updated.

---

## What not to do

- Register `leases/new` **after** `leases/:leaseId`
- Put monthly rent below term/tenant fields again
- Duplicate mutation logic outside `use-start-lease-form`

## Safest sequencing

1. Route + shell before page content
2. Extract hook/schema before deleting dialog
3. Wire page via URL before switching list/units buttons
4. Delete dialog last
5. UX polish and docs after behavior is stable
