# Start Lease Page — Implementation Phases

Phased rollout to move **Start lease** from a scroll-trapped dialog to a dedicated admin page at `/properties/:propertyId/leases/new`, then a **containerless three-step wizard** with session draft persistence. Admin-only UI refactor — **no server, shared contract, or migration changes**.

**Related code today**

- [`apps/admin/src/pages/property-start-lease-page.tsx`](../apps/admin/src/pages/property-start-lease-page.tsx) — full-bleed wizard shell, permission gate
- [`apps/admin/src/components/leases/start-lease-form.tsx`](../apps/admin/src/components/leases/start-lease-form.tsx) — Who → Term → Rent steps (containerless)
- [`apps/admin/src/hooks/use-start-lease-form.ts`](../apps/admin/src/hooks/use-start-lease-form.ts) — form, step validation, draft flush on navigation
- [`apps/admin/src/lib/start-lease-form-init.ts`](../apps/admin/src/lib/start-lease-form-init.ts) — sync draft + step init (no late `reset`)
- [`apps/admin/src/lib/start-lease-form-schema.ts`](../apps/admin/src/lib/start-lease-form-schema.ts) — Zod schema + per-step fields
- [`apps/admin/src/lib/start-lease-steps.ts`](../apps/admin/src/lib/start-lease-steps.ts) — step IDs / labels / navigation helpers
- [`apps/admin/src/lib/start-lease-draft-storage.ts`](../apps/admin/src/lib/start-lease-draft-storage.ts) — sessionStorage drafts (24h TTL)
- [`apps/admin/src/lib/start-lease-routes.ts`](../apps/admin/src/lib/start-lease-routes.ts) — path + `unitId` / `from` / `step` helpers
- [`apps/admin/src/lib/property-shell-routes.ts`](../apps/admin/src/lib/property-shell-routes.ts) — focused shell chrome for `/leases/new`

See also: [`LEASE_CUSTOM_END_DATE_PHASES.md`](LEASE_CUSTOM_END_DATE_PHASES.md) (term/end-date fields on create).

---

## Goals

- Start lease opens on a **full page** wizard: **Who** → **Term** → **Rent**
- Containerless editorial UI (no Card stacks)
- Draft survives **refresh** via `sessionStorage`; clears on **success**, **cancel**, and **sign-out**
- Entry from **leases list** and **units table** (unit prefill + locked)
- Success navigates to **lease detail**

## Non-goals

- New API fields or secondary tenant at create
- Server-side draft leases
- Keeping the dialog as a parallel entry point

---

## Phase 1 — Route + shell

- [x] Register `leases/new` before `leases/:leaseId` in router
- [x] `isPropertyLeaseFocusedPath` hides property tab chrome for `/leases/new`
- [x] Page skeleton with back link and `canManageLedger` gate

## Phase 2 — Form + page

- [x] Extract schema, hook, and presentational form
- [x] Submit → `longStaysApi.create` → navigate to lease detail

## Phase 3 — Entry points + cleanup

- [x] Leases list and units table navigate to new page
- [x] Remove `start-lease-dialog.tsx`

## Phase 4 — Hardening

- [x] Invalid-submit toast + `scrollFormToFirstError`
- [x] Unit tests for route helpers and schema defaults

## Phase 5 — Wizard + draft persistence

- [x] Step URL helpers (`step=who|term|rent`) + draft storage + tests
- [x] Clear all drafts on sign-out (`clearAppSession`)
- [x] Containerless Who / Term / Rent UI with sticky footer
- [x] Per-step `trigger` validation; one RHF instance
- [x] Sync init from sessionStorage into `useForm` defaultValues (no late `reset()`)
- [x] Draft persist on step navigation only (`flushDraft` on Continue / Back / progress nav)
- [x] All step fields stay mounted (hidden via `hidden`); URL `unitId` wins; clear on success/cancel

**Exit criteria:** After Continue, refresh restores values + step; success leaves no draft. Refresh on Who before Continue only restores the last navigation flush (expected).

## Phase 5b — Draft + form sync fix (Option B)

- [x] [`start-lease-form-init.ts`](../apps/admin/src/lib/start-lease-form-init.ts) — synchronous draft + step resolver
- [x] Lazy-mount form hook after units load (`PropertyStartLeaseFormLoaded`)
- [x] Remove debounced `watch()` persist and hydration `reset()`
- [x] Scope `scrollFormToFirstError` to active step section

---

## What not to do

- Register `leases/new` **after** `leases/:leaseId`
- Remount RHF per step or use three separate forms
- Persist drafts in `localStorage`
- Reintroduce Card stacks as the main layout
