# Tenant Multi-Lease Home — Implementation Phases

Improve the tenant portal **Home** experience when a resident has **multiple active leases**, especially the **Pay rent → Stripe** flow. Today, multi-lease users with balances due are sent to the leases list, then lease detail, then Pay rent — **3+ clicks** to reach Checkout. Single-lease direct checkout already works.

Work is split into **three optional scopes** (Phases 1–3). Ship Phase 1 alone for the biggest UX win with minimal surface area; add Phase 2 when Home should clearly show each lease; add Phase 3 to polish the leases list as a secondary entry point.

**Related code today**

- Home dashboard: [`apps/tenant/src/pages/home-dashboard-page.tsx`](../apps/tenant/src/pages/home-dashboard-page.tsx)
- Pay action resolver: [`apps/tenant/src/lib/rent-summary-utils.ts`](../apps/tenant/src/lib/rent-summary-utils.ts)
- Checkout helper: [`apps/tenant/src/lib/start-rent-checkout.ts`](../apps/tenant/src/lib/start-rent-checkout.ts)
- Lease detail Pay card: [`apps/tenant/src/components/portal/pay-rent-card.tsx`](../apps/tenant/src/components/portal/pay-rent-card.tsx)
- Leases list: [`apps/tenant/src/pages/leases-page.tsx`](../apps/tenant/src/pages/leases-page.tsx)
- Shared contract: [`packages/shared/src/tenant-rent-payment-types.ts`](../packages/shared/src/tenant-rent-payment-types.ts) (`ITenantRentSummaryResponse`, `ITenantRentSummaryLease`)
- Rent payments overview: [`docs/TENANT_STRIPE_RENT_PAYMENTS.md`](./TENANT_STRIPE_RENT_PAYMENTS.md)
- Portal roadmap: [`docs/TENANT_PORTAL_ENHANCEMENTS_PHASES.md`](./TENANT_PORTAL_ENHANCEMENTS_PHASES.md)

---

## Problem today

Home aggregates rent via `GET /tenant/rent-summary` and shows a single **Amount due** total plus one **Pay rent** button.

[`resolveRentPayAction`](../apps/tenant/src/lib/rent-summary-utils.ts) only starts Stripe Checkout directly when **exactly one** lease has a balance **and** online pay is enabled. Otherwise it navigates away:

| Condition | Pay rent behavior |
| --------- | ----------------- |
| No balance due | Navigate to `/leases` |
| 1 due lease, payable | **Direct Checkout** (1 click) |
| 1 due lease, not payable | Navigate to `/leases/:id` |
| **2+ due leases** | Navigate to `/leases` |

Multi-lease path today:

1. Home → **Pay rent** → `/leases`
2. Pick a lease card → `/leases/:id`
3. **Pay rent** on detail → Stripe

The API already returns per-lease rows in `summary.leases` (`propertyName`, `unitLabel`, `amountDueCents`, `paymentsEnabled`, `leaseId`). **Phases 1–2 need no backend or contract changes.**

---

## Goals

- Multi-lease tenants reach Stripe Checkout in **≤ 2 clicks** from Home (Phase 1) or **1 click** per lease (Phase 2).
- Home clearly communicates **which lease** has a balance — not only an aggregated total.
- Single-lease Home stays fast (direct Checkout preserved).
- Shared pay UI/logic is DRY across Home, picker sheet, and lease detail.

## Non-goals

- Full **admin-style Home hub** (search, 3-column workspace) — tenant Home is task-oriented, not navigation-oriented.
- **Pay all leases** in one Checkout session — each lease/property uses separate Stripe Connect context; keep one Checkout per lease unless product explicitly designs bundling.
- New rent-summary API fields or Postgres changes for Phases 1–3.
- Partial/custom payment amounts — server-authoritative amount due remains unchanged.
- Maintenance, messaging, or other quick actions (still “Coming soon” on Home).

## Guiding principles

1. **Task-first Home** — optimize for “pay rent” and “view my lease(s)”, not operator-style discovery.
2. **API data you already have** — build from `ITenantRentSummaryLease[]`; don’t add endpoints until a gap is proven.
3. **Single lease is the default path** — don’t regress the 1-click Checkout case.
4. **Reuse checkout plumbing** — `startRentCheckoutForAmountDue(leaseId)` everywhere; same validation as [`PayRentCard`](../apps/tenant/src/components/portal/pay-rent-card.tsx).
5. **Phase 1 before layout redesign** — picker sheet fixes confusion with minimal churn; Phase 2 reshapes Home when ready.

## Why not copy admin Home hub?

Admin Home ([`home-workspace-hub.tsx`](../apps/admin/src/components/home/home-workspace-hub.tsx)) is built for **cross-property navigation** (search, continue, properties, communications). Tenants typically open the portal to **pay rent** or **check one lease**. A 3-column hub would add weight without matching monthly usage. Prefer **lease-centric rows** with inline Pay actions.

---

## Target UX by lease count

| Active leases with balance | Phase 1 (picker) | Phase 2 (home rows) |
| -------------------------- | ---------------- | ------------------- |
| 0 | “All caught up” + View leases | Same |
| 1, payable | Direct Checkout (unchanged) | Hero: big amount + Pay rent |
| 1, not payable | Navigate to lease detail | Hero + “Online pay unavailable” |
| 2+, payable | Pay rent → **picker sheet** → Checkout | Per-lease cards with inline Pay |
| 2+, mixed payable | Picker: Pay on payable rows; disabled + link for others | Same per row |
| 2+, only 1 payable | **Improvement:** direct Checkout for that lease (today: sends to `/leases`) | Inline Pay on the one payable row |

---

## Scope overview

| Phase | Scope | Effort | Clicks to Stripe (multi-lease) | Server / DB? |
| ----- | ----- | ------ | ------------------------------ | ------------ |
| **1** | Pay rent lease picker sheet | ~1 day | 2 | No |
| **2** | Multi-lease Home layout (lease rows) | ~2–3 days | 1 | No |
| **3** | Due amounts + Pay on leases list | ~1 day | 2 (from `/leases`) | No |
| — | Pay-all / new API | **N/A — out of scope** | — | — |

---

## Shared building blocks (DRY)

Introduce reusable pieces in `apps/tenant/src/` (exact paths TBD in implementation):

| Piece | Responsibility |
| ----- | -------------- |
| `getLeasesWithDue(summary)` | Filter `summary.leases` where `amountDueCents > 0` |
| `getPayableLeases(summary)` | Filter where due **and** `paymentsEnabled` |
| `resolveRentPayAction` (extend) | Add `{ kind: "pick-lease"; leases: ITenantRentSummaryLease[] }` or separate helper |
| `PayRentLeasePickerSheet` | Sheet/dialog: property, unit, amount, Pay per row |
| `LeaseDueRow` | Shared row UI: labels, amount, Pay / disabled / View lease |
| `startRentCheckoutForAmountDue` | Already shared — keep as single Checkout entry |

Unit tests colocated with [`rent-summary-utils.ts`](../apps/tenant/src/lib/rent-summary-utils.ts) (add `rent-summary-utils.test.ts` if missing).

---

## Phase 1 — Pay rent lease picker sheet

**Goal:** When multiple leases have a balance, **Pay rent** opens a sheet to choose which lease to pay — no detour through leases list + lease detail.

**Behavior**

- Extend pay action resolution:
  - `pick-lease` when `payable.length > 1` (or `withDue.length > 1` and at least one payable — product choice: show all with due, disable non-payable).
  - **Bonus fix:** when `withDue.length > 1` but `payable.length === 1`, return direct `checkout` for the sole payable lease (don’t send to `/leases`).
- Home: on `pick-lease`, open sheet titled **“Choose a lease to pay”**; each row shows `propertyName`, `unitLabel`, formatted amount, **Pay** button.
- Row Pay calls `startRentCheckoutForAmountDue(leaseId)` (same as `PayRentCard`).
- Non-payable rows: disabled Pay + short copy (“Online payments not available”) + link to `/leases/:id`.
- Keep button label **Pay rent** on Home; sheet explains the choice.

**Files (~4–6)**

- [ ] [`apps/tenant/src/lib/rent-summary-utils.ts`](../apps/tenant/src/lib/rent-summary-utils.ts) — extend `TRentPayAction`, update `resolveRentPayAction`, add `getPayableLeases` / `getLeasesWithDue`
- [ ] `apps/tenant/src/lib/rent-summary-utils.test.ts` — cases: 0/1/multi due, single payable among many, none payable
- [ ] `apps/tenant/src/components/portal/pay-rent-lease-picker-sheet.tsx` — new sheet component
- [ ] [`apps/tenant/src/pages/home-dashboard-page.tsx`](../apps/tenant/src/pages/home-dashboard-page.tsx) — wire sheet + updated `handlePayRent`
- [ ] Use Sheet/Dialog from `@/packages/app-ui` (match existing tenant portal patterns)

**Exit criteria**

- 2+ payable leases: Home → Pay rent → sheet → Pay on row → Stripe (**2 clicks**).
- 1 payable lease (any total due count): still **1 click** to Stripe.
- Single-lease Home unchanged visually.
- `cd apps/tenant && bun run lint && bun run build` pass.
- Unit tests for resolver pass.

---

## Phase 2 — Multi-lease Home layout (lease rows)

**Goal:** When `summary.leases.length > 1`, Home shows **per-lease due rows** with inline Pay — not only one aggregated total and one ambiguous button.

**Layout (multi-lease)**

```
┌─────────────────────────────────────┐
│  Greeting / Total due: $X,XXX       │  ← secondary context
└─────────────────────────────────────┘

┌─ Property / Unit ──────────────────┐
│  $X due              [ Pay rent ]   │
└─────────────────────────────────────┘
  (repeat per active lease with due, or all active leases)

Quick actions (maintenance, leases, …)
```

**Rules**

- **`leases.length === 1`:** keep current hero (large amount + single CTA) — no regression.
- **`leases.length > 1`:** show `LeaseDueRow` list; optional compact total at top.
- Rows with `amountDueCents === 0`: show “Caught up” or hide from pay section (product choice).
- Phase 1 picker still useful if user taps a generic “Pay rent” in the header; prefer **inline Pay on each row** as primary in Phase 2.

**Files (~3–5)**

- [ ] `apps/tenant/src/components/portal/lease-due-row.tsx` — extract from picker row UI
- [ ] [`apps/tenant/src/pages/home-dashboard-page.tsx`](../apps/tenant/src/pages/home-dashboard-page.tsx) — conditional single vs multi layout
- [ ] Refactor [`pay-rent-lease-picker-sheet.tsx`](../apps/tenant/src/components/portal/pay-rent-lease-picker-sheet.tsx) to reuse `LeaseDueRow` if sheet retained

**Exit criteria**

- Multi-lease Home shows property + unit + amount per lease.
- **1 click** to Stripe from the desired row’s Pay button.
- Single-lease Home visually unchanged from pre-Phase-2.
- Lint + build pass.

---

## Phase 3 — Leases list polish (optional)

**Goal:** `/leases` shows amount due and Pay on active lease cards when online pay is available — secondary path for users who navigate to Leases first.

**Behavior**

- Active lease cards: show `amountDueCents` when > 0 (requires balance on list API **or** reuse rent-summary cache — prefer extending list response only if summary doesn’t cover list freshness; otherwise fetch summary once on leases page).
- **Pay** on card when `paymentsEnabled && amountDueCents > 0`; else existing link to detail.

**Note:** If list endpoint lacks balance fields, either:
- (A) Call `getRentSummary()` on leases page and join by `leaseId`, or
- (B) Add balance snippet to lease list API (small server change — defer unless Phase 3 needs fresher per-lease data than summary).

**Files (~2–4)**

- [ ] [`apps/tenant/src/pages/leases-page.tsx`](../apps/tenant/src/pages/leases-page.tsx)
- [ ] [`packages/app-ui`](../packages/app-ui) — extend `TenantLeaseCard` optional due amount + Pay slot, or wrap in tenant-local component
- [ ] Reuse `LeaseDueRow` / checkout mutation

**Exit criteria**

- From `/leases`, payable active lease → Pay → Stripe in **2 clicks**.
- No duplicate checkout logic outside shared helpers.

---

## Edge cases

| Case | Handling |
| ---- | -------- |
| Only one lease payable among several with balance | Phase 1: direct Checkout for that lease |
| Due but `paymentsEnabled: false` | Disabled Pay + link to lease detail; explain contact manager |
| All caught up (`totalDue === 0`) | Existing copy; View leases |
| Checkout fails mid-flow | Existing toast from `startRentCheckoutForAmountDue` |
| Secondary occupant on multiple leases | `propertyName` + `unitLabel` sufficient v1; add role label later if needed |
| Mixed currency | Out of scope v1 — `summary.currency` assumed shared |

---

## What not to do

- Do **not** ship a full admin-style Home hub for tenants without proven need.
- Do **not** add Postgres migrations or new summary fields for Phases 1–2.
- Do **not** fork Checkout logic — always `startRentCheckoutForAmountDue`.
- Do **not** regress single-lease 1-click Checkout.
- Do **not** implement “pay all” without explicit Stripe Connect / product design.

---

## Recommended sequencing

1. **Phase 1 first** — fixes multi-lease confusion in ~1 day; no Home layout rewrite.
2. **Phase 2** when you want Home to be the primary multi-lease dashboard.
3. **Phase 3** optional — helps users who bookmark `/leases`.
4. **Single PR per phase** — easier review and rollback.

---

## Verification checklist

```bash
cd apps/tenant && bun run lint && bun run build
cd apps/tenant && bun test src/lib/rent-summary-utils.test.ts   # after Phase 1
```

**Manual smoke**

1. **Single lease, due, payable:** Home Pay rent → Stripe (1 click).
2. **Two leases, both due, payable:** Phase 1 — sheet → pick → Stripe (2 clicks); Phase 2 — inline Pay on row (1 click).
3. **Two due, one payable:** Direct Checkout for payable lease (Phase 1 bonus).
4. **Due, not payable:** No Checkout; clear message + lease detail link.
5. **Zero due:** Caught up copy; no Pay button.
