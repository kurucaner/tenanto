# Lease tenant identity consolidation — Implementation Phases

Phased rollout to eliminate drift between **lease contact fields** (`guest_name`, `tenant_email`, `tenant_phone` on `property_long_stays`), **portal memberships** (`lease_tenant_memberships`), and **tenant accounts** (`tenant_users`). v1 keeps lease columns for lease-before-invite; read/write paths prefer `tenant_users` when the primary membership is **active** and linked. Column deprecation comes last.

**Related code today**

- Lease contact storage: `apps/server/src/db/property-long-stays.ts`, `packages/shared/src/property-long-stay-types.ts`
- Lease mapper: `apps/server/src/db/mappers.ts` (`mapPropertyLongStayRow`)
- Portal memberships: `apps/server/src/db/lease-tenant-memberships.ts`
- Tenant accounts: `apps/server/src/db/tenant-users.ts`, `tenantUsersDb.setVerifiedPhone`
- Accept/redeem: `apps/server/src/services/tenant-portal-membership-service.ts` (`acceptMembershipForTenant`)
- Invite create: `apps/server/src/services/tenant-portal-invite-service.ts` (reads `lease.tenantEmail`, `lease.guestName`)
- Admin edit primary: `apps/admin/src/components/leases/edit-primary-tenant-dialog.tsx`, `tenant-contact-form-schema.ts` → `PATCH` via `longStaysApi.update`
- Admin tenants UI: `apps/admin/src/components/leases/lease-tenants-section.tsx`, `lease-tenant-block.tsx`
- Portal access API: `apps/server/src/routes/admin/property-long-stay-portal-routes.ts` (`ILeasePortalAccessResponse`)
- Tenant profile: `GET /tenant/me` → `tenantPortalMembershipService.getProfile` → `tenant_users` only
- Email campaigns audience: `packages/shared/src/tenant-email-recipient-resolver.ts` (reads lease `tenantEmail` / `guestName`)
- Lease list search/sort: `apps/server/src/db/property-long-stays-list-sort.ts` (`guest_name`)
- Unit search: `apps/server/src/db/property-units.ts` (ILIKE on `guest_name`, `tenant_email`)
- Portal design doc: `docs/TENANT_PORTAL_PHASES.md` (accept does not mutate lease)
- Auth expansion doc: `docs/TENANT_PORTAL_AUTH_EXPANSION_PHASES.md` (email-only invite key in v1)

---

## Goals

- **Single effective contact** for a linked primary tenant: admin lease UI, `/tenant/me`, and downstream features agree on name/email/phone.
- **No regression** for lease-before-invite: operator can still create a lease and invite before any `tenant_users` row exists.
- **Write path consistency**: editing primary tenant in admin updates the linked `tenant_users` row (and keeps membership invite email in sync where required); unlinked leases still update lease (+ membership snapshot) only.
- **Accept-time sync**: on primary invite accept, copy `lease.tenant_phone` → `tenant_users.phone` only when user phone is null (no overwrite of verified phone).
- **Path to deprecation**: measurable readiness to drop lease contact columns and move campaigns/search to JOINs.

## Non-goals (initial release)

- Dropping `guest_name`, `tenant_email`, `tenant_phone` from `property_long_stays` (Phase 5+ only)
- Adding `primary_tenant_user_id` FK on the lease (optional cache deferred)
- Secondary tenant identity consolidation (JSONB `secondary_tenants` unchanged in v1)
- Phone-only invites / nullable `tenant_users.email` (deferred in auth expansion doc)
- Forcing tenant UI confirmation modal for phone sync on accept (server-side null-only copy in v1)
- Operator editing `tenant_users` from a global admin “all tenants” screen (lease context only)

---

## Guiding principles

1. **`tenant_users` is canonical when linked** — Active primary membership with `tenant_user_id` → read name/email/phone from `tenant_users`.
2. **Lease fields are fallback + pre-link intent** — Unlinked or pending invites use lease columns + membership `invite_email` / `display_name`.
3. **Membership is the join, not a duplicate FK** — Use `lease_tenant_memberships` (`role = primary`); avoid a second link column until Phase 5 cache is justified.
4. **Writes follow link state** — Linked → update `tenant_users` (+ sync membership/lease snapshots as needed). Unlinked → update lease only.
5. **Never silently overwrite verified tenant phone** — Accept sync fills null phone only; admin cannot push lease phone over `phone_verified_at` without explicit product rule.
6. **Shared resolver in `packages/shared`** — Server, admin, and tests use one function for effective contact + source metadata.
7. **Deprecate columns only when metrics green** — No DDL drop until backfill + read-path migration + campaign/search cutover complete.

---

## Target architecture

```
                    ┌─────────────────────┐
                    │ property_long_stays │
                    │ guest_name/email/   │
                    │ phone (fallback)    │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │ lease_tenant_       │
                    │ memberships         │
                    │ invite_email,       │
                    │ display_name,       │
                    │ tenant_user_id?     │
                    └──────────┬──────────┘
                               │ active + linked
                    ┌──────────▼──────────┐
                    │ tenant_users        │
                    │ name, email, phone  │  ← canonical when linked
                    └─────────────────────┘

resolvePrimaryTenantContact(lease, membership?, user?)
        ↓
 effectiveName / effectiveEmail / effectivePhone + source
        ↓
 Admin UI · GET lease detail · /tenant/me · campaigns (later)
```

### Permissions

- **Read effective contact**: same as lease read (`assertPropertyMemberAccess`).
- **Write linked tenant identity**: same as lease write (`assertPropertyLedgerWriteAccess` / property manager rules) — operator may update contact for their property’s linked primary tenant.
- **Tenant self-service**: tenant may bind phone via existing phone auth; v1 does not add tenant-side name/email edit.
- Mirror on server routes and admin dialogs (disable edit when ended lease; show “linked to portal account” badge).

### Feature flag

N/A for core consolidation. Optional env for accept phone sync:

- `TENANT_ACCEPT_SYNC_LEASE_PHONE=true` (default on) — gates copy-on-accept in Phase 2.

---

## Data model (sketch)

**No v1 migration.** Existing tables unchanged until Phase 5.

### Effective contact (computed, not stored)

| Field | Linked (active primary) | Pending invite | No membership |
| --- | --- | --- | --- |
| Name | `tenant_users.name` | `membership.display_name` ?? `lease.guest_name` | `lease.guest_name` |
| Email | `tenant_users.email` | `membership.invite_email` | `lease.tenant_email` |
| Phone | `tenant_users.phone` | `lease.tenant_phone` | `lease.tenant_phone` |

**Membership selection:** non-terminal primary row for lease (`active` preferred; else latest `pending_*` for display).

### Phase 5 (deferred) — column deprecation

| Action | Notes |
| --- | --- |
| Drop `guest_name`, `tenant_email`, `tenant_phone` | After all readers migrated |
| Optional `primary_tenant_user_id` | Denormalized cache; maintain on accept/end/revoke |

---

## Shared contract (`packages/shared`)

| Type | Purpose |
| --- | --- |
| `TPrimaryTenantContactSource` | `'linked_user' \| 'membership_pending' \| 'lease'` |
| `ILeasePrimaryTenantContact` | `effectiveName`, `effectiveEmail`, `effectivePhone`, `source`, `tenantUserId`, `membershipId`, `membershipStatus` |
| `resolvePrimaryTenantContact(...)` | Pure resolver + unit tests |
| `IPropertyLongStayDetailResponse` (extend) | Optional nested `primaryTenantContact` (additive; keep flat fields during transition) |
| `IUpdatePrimaryTenantContactBody` (optional) | Unified admin patch shape for Phase 3 |

---

## API (sketch)

| Method | Path | Change |
| --- | --- | --- |
| `GET` | `/properties/:id/long-stays/:id` | Include `primaryTenantContact`; flat `guestName`/`tenantEmail`/`tenantPhone` mirror **effective** values when linked (transition) |
| `GET` | `.../portal-access` | Expose link state; optional effective contact for admin tenants tab |
| `PATCH` | `/properties/:id/long-stays/:id` | Branch: linked → update `tenant_users` + sync snapshots; unlinked → lease only |
| `GET` | `/tenant/me` | Unchanged shape; phone populated after accept sync / bind |
| `POST` | `/tenant/me/invites/:id/accept` | Trigger phone sync helper after `acceptMembershipForTenant` |

---

## Phased rollout

### Phase 0 — Foundation (no user-facing behavior change)

**Goal:** Shared resolver + tests; no UI/API behavior change yet.

- [x] Add `packages/shared/src/lease-primary-tenant-contact.ts` with `resolvePrimaryTenantContact`
- [x] Tests: linked active, pending invite, no membership, ended membership ignored for “active contact”
- [x] Export from `packages/shared/src/index.ts`
- [x] Server helper: `loadPrimaryMembershipForLease(leaseId)` in `lease-tenant-memberships.ts` or service layer
- [x] JSDoc on `IPropertyLongStay` flat fields: “legacy storage; prefer `primaryTenantContact` when present”

**Exit criteria:** Shared tests pass; no API response changes; resolver used only in tests.

---

### Phase 1 — Read path (API + admin display)

**Goal:** Admin and lease APIs **show** effective contact when primary membership is active + linked; fall back to lease fields otherwise.

- [ ] Extend long-stay **detail** response with `primaryTenantContact` (`property-long-stays` route + shared type)
- [ ] **Transition rule:** optionally set response `guestName`/`tenantEmail`/`tenantPhone` to effective values for linked leases (document breaking-change risk; prefer additive field first, then flip admin to read `primaryTenantContact` only)
- [ ] Admin `LeasePrimaryTenantBlock` / edit dialog **prefill** from effective contact (via API field), not raw lease only
- [ ] Show badge: “Portal account linked” when `source === 'linked_user'`
- [ ] Tenant `/tenant/me` — no change required if accept sync not yet shipped; document that phone stays null until Phase 2

**Exit criteria:** Linked lease in admin shows `tenant_users` name/email/phone; unlinked lease unchanged; integration test: create user → invite → accept → GET lease detail shows user email/phone.

---

### Phase 2 — Sync on accept (+ optional env)

**Goal:** On primary invite accept/redeem, copy lease phone to account when safe.

- [ ] Add `syncLeasePhoneToTenantUserOnAccept(lease, tenantUser)` in `tenant-portal-membership-service` or small helper module
- [ ] Rules: primary role only; `tenant_users.phone` is null; `lease.tenant_phone` valid E.164; do not set `phone_verified_at` (lease phone is operator-entered, not OTP-verified) unless product decides otherwise — **document as unverified contact**
- [ ] Call from `acceptMembershipForTenant` after link + transition to `active`
- [ ] Gate with `TENANT_ACCEPT_SYNC_LEASE_PHONE`
- [ ] Tests in `tenant-portal-happy-path.test.ts` / new accept-sync test

**Exit criteria:** Accept with null user phone + lease phone set → `/tenant/me` returns phone; existing user phone never overwritten.

---

### Phase 3 — Write path (admin edit primary tenant)

**Goal:** Editing primary tenant updates the right rows; no one-sided updates.

- [ ] Refactor `PATCH .../long-stays/:id` (or dedicated sub-route) in `property-long-stay-routes.ts`:
  - **Linked:** update `tenant_users` (name; email only if matches invite policy — email change may require re-invite; **v1: block email change when linked** or sync membership `invite_email` with validation)
  - **Phone:** update `tenant_users.phone` only if not verified OR same number; else 409 with clear error
  - **Always:** update lease columns as **snapshot** for exports/history OR stop writing lease columns when linked (pick one; recommend **dual-write snapshot** in v1 for safe rollback)
  - **Unlinked:** current behavior (lease fields only); if pending membership exists, update `display_name` / re-normalize `invite_email` when email changes
- [ ] Admin `EditPrimaryTenantDialog`: disable email field when linked (or show warning); toast on 409
- [ ] Invalidate portal access + lease detail caches on success

**Exit criteria:** Edit name/phone on linked lease updates `/tenant/me`; edit on unlinked lease updates lease only; no case where lease phone updates but user phone does not (when linked).

---

### Phase 4 — Hardening + downstream read paths

**Goal:** Production-safe; campaigns and search aware of effective contact.

| Concern | Action |
| --- | --- |
| Email campaigns | Extend `resolveTenantEmailRecipients` to use `resolvePrimaryTenantContact` (or server pre-join) for primary role |
| Drift detection | Admin-only script or log: active linked leases where lease email ≠ user email |
| List search/sort | Phase 4b: JOIN `tenant_users` for `guest_name` sort/search when linked (keep lease column fallback) |
| Exports | `leases-table-export.ts` use effective contact |
| Observability | Log `tenant_identity.sync_on_accept`, `tenant_identity.admin_update_linked` |
| Docs | Update `TENANT_PORTAL_PHASES.md` domain rules; add `TENANT_IDENTITY_FAILURE_MODES.md` |

**Exit criteria:** Campaign send uses linked user email for active primary; drift script reports zero rows in staging after backfill; failure modes doc complete.

---

### Phase 5 — Column deprecation (post-launch)

**Goal:** Remove duplicate lease contact columns when safe.

- [ ] Backfill: ensure every active lease has primary membership row (operator tooling if gaps)
- [ ] Migrate all readers off `guest_name`/`tenant_email`/`tenant_phone`
- [ ] Migration: drop columns (or rename to `_legacy_*` first)
- [ ] Optional: `primary_tenant_user_id` maintained by trigger/service on accept/end

**Exit criteria:** No code references lease contact columns; production active leases have linked primary or explicit pending state; campaigns/search use JOINs only.

---

### Phase 6 — Enhancements (explicitly deferred)

- Secondary tenant identity via memberships only (drop JSONB contacts)
- Tenant-facing confirm UI for phone sync on accept
- Operator “unlink portal account” with snapshot freeze
- `primary_tenant_user_id` denormalized cache for performance

---

## What not to do

- Do **not** drop lease contact columns in Phase 0–4.
- Do **not** add `primary_tenant_id` on the lease **instead of** using `lease_tenant_memberships`.
- Do **not** mutate `property_long_stays` on tenant accept (except optional dual-write snapshot from admin in Phase 3).
- Do **not** overwrite `tenant_users.phone` when `phone_verified_at` is set.
- Do **not** allow admin to change linked tenant email without a defined re-invite / identity policy.
- Do **not** make `/tenant/me` read lease phone directly — fix via accept sync + linked writes.
- Do **not** sync lease → user on every lease edit (accept + admin linked edit only).

---

## Safest sequencing summary

1. **Shared resolver + tests before any API shape change** — Phase 0.
2. **Read path before write path** — operators see correct data before edits can fan out.
3. **Accept sync before admin linked writes** — `/tenant/me` improves without complex PATCH logic first.
4. **Dual-write lease snapshots while linked** — rollback-friendly until Phase 5.
5. **Campaigns/search migration before column drop** — Phase 4 before Phase 5.
6. **Email remains invite key** — do not relax accept/redeem email match in this series.
