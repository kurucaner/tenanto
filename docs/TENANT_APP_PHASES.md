# Tenant Portal App — Implementation Phases

Roadmap for a **resident-facing portal**: separate Vite SPA (`apps/tenant`), tenant-scoped API routes on the existing server, and explicit **invite → accept** access per lease. Tenants view lease and rent data tied to `property_long_stays`; operators continue to manage leases in admin.

Stack: **same Postgres** (new tables, not a new database) + **existing server** (`/tenant/*` routes) + **SES** (invite emails) + optional **SSE** later.

**Related code today**

- Lease data: `apps/server/src/db/property-long-stays.ts`, `packages/shared/src/property-long-stay-types.ts`
- Lease lifecycle: `apps/server/src/routes/admin/property-long-stay-routes.ts` (`end`, `extend`, update)
- One-way tenant emails (no login): `apps/server/src/services/lease-notifications.ts`
- Operator invite pattern: `apps/server/src/db/property-invites.ts`, `apps/server/src/routes/auth/auth-routes.ts` (auto-claim on register)
- Operator auth: `apps/server/src/auth/jwt.ts`, `apps/server/src/routes/auth/auth-routes.ts`
- Property access (operators): `apps/server/src/routes/admin/property-route-access.ts`
- Admin app shell: `apps/admin/` (mirror stack for `apps/tenant/`)
- Shared contracts: `packages/shared/`
- Migrations: `apps/server/src/db/migrations.ts` (currently v56)

---

## Goals

- Tenants with an **active membership** can sign in and view **their lease** (unit, dates, rent schedule).
- Operators **explicitly invite** primary/secondary tenants from a lease; tenants **accept** before portal access is granted.
- Returning tenants (new landlord on PropertyOS) get a **pending acceptance** flow — never silent auto-link.
- When a lease ends, portal access **ends automatically**; tenant account persists for future leases.
- Contracts in `packages/shared`; tenant JWT separate from operator JWT.

## Non-goals (initial release)

- Separate Postgres database or separate API microservice
- Tenant self-service **end lease** (operator-only, same as admin today)
- Rent payments in-app
- Maintenance requests, documents, messaging
- Mobile native app (responsive web only)
- Unified operator + tenant account (same email in both apps)
- Auto-invite on lease create (manual invite button in v1)
- Short-term / reservation guests (long-stay leases only)

---

## Guiding principles

1. **Lease record ≠ portal access** — `tenantEmail` on a lease enables one-way emails today; portal access requires `lease_tenant_memberships.status = active`.
2. **Same Postgres, separate tables** — tenant rows live beside operator data; FK to `property_long_stays` keeps joins simple. Do not split databases until a bounded context justifies operational cost.
3. **Acceptance always** — new email → signup + accept; existing `tenant_users` → login + accept/decline. Never attach a lease to an account without tenant action.
4. **Operators end leases** — tenants cannot close the lease; membership moves to `ended` when operator ends the lease or revokes access.
5. **Extend the monolith first** — `routes/tenant/*` on `apps/server`; extract a service later only with proven need.
6. **Mirror proven patterns** — OTP auth, invite tables, and transactional email follow operator invite + register flows.

---

## Database architecture — one DB or two?

### Recommendation: **one Postgres database** (new tables)

| Approach                                                             | Verdict                                                |
| -------------------------------------------------------------------- | ------------------------------------------------------ |
| **Same DB, new tables** (`tenant_users`, `lease_tenant_memberships`) | **Start here**                                         |
| **Same DB, separate schema** (`tenant.*`)                            | Optional later for clarity; not required for v1        |
| **Separate Postgres database**                                       | **Defer** until compliance or team boundaries force it |

**Why not a separate database now**

- Tenant portal reads **lease, unit, property, rent schedule** — all operator-owned tables today. Splitting DBs means cross-DB queries, sync jobs, or duplicated snapshots; you lose FK integrity.
- Fast growth is handled by **indexes, connection pooling, read replicas, and horizontal API replicas** — not by a second database on day one.
- This repo already runs one migration runner and one pool (`apps/server/src/db/pool.ts`); a second DB doubles migration tooling, backups, and consistency work.

**When to reconsider a split** (likely Phase 8+ / years out)

- Legal/compliance requires tenant PII in an isolated trust zone
- Tenant API team deploys independently with strict SLA separation
- Tenant traffic dominates and you extract `apps/tenant-api` with an explicit contract — still often **same DB** initially, split DB only if profiling proves connection/contention isolation is insufficient

**Scale path without a new DB**

1. v1–v2: new tables + indexes on `lease_id`, `tenant_user_id`, `invite_email`
2. Traffic growth: scale server replicas; CDN for `apps/tenant` static assets
3. Read-heavy endpoints: read replica for tenant list/detail (optional)
4. Extract worker/service: only if async tenant workloads appear (notifications at scale)

---

## Target architecture

```
Operator (admin) → POST .../long-stays/:id/portal-invites → lease_tenant_memberships (pending)
                                                                    ↓
                                                          SES invite email (magic link)
                                                                    ↓
Tenant (apps/tenant) → /tenant/auth/* + /tenant/invites/:id/accept → tenant_users + active membership
                                                                    ↓
                                                          GET /tenant/me/leases/:id
                                                                    ↓
                                                    property_long_stays + rent schedule (scoped read)
```

### Permissions

**Tenant API**

- Every route requires tenant JWT (`aud: tenant`).
- Lease data: membership `status = active` and `lease_id` match.
- Past leases: `status = ended` → read-only archive (Phase 4).

**Admin API**

- Invite / revoke / resend: property **owner or manager** (align with long-stay write access).
- View portal status on lease detail: any property member.

### Feature flag

`TENANT_PORTAL_ENABLED=true` — gate `/tenant/*` routes, invite endpoints, and admin invite UI until production-ready.

Optional: `TENANT_APP_URL` in server env for invite links (e.g. `http://localhost:5174`).

---

## Data model (sketch)

### `tenant_users`

| Column                     | Notes                        |
| -------------------------- | ---------------------------- |
| `id`                       | UUID PK                      |
| `email`                    | Unique, normalized lowercase |
| `name`                     | Display name                 |
| `password_hash`            | Nullable (social later)      |
| `email_verified_at`        | Set after OTP on register    |
| `created_at`, `updated_at` |                              |

Separate from operator `users` — different JWT audience and authorization.

### `lease_tenant_memberships`

| Column                                                                             | Notes                                        |
| ---------------------------------------------------------------------------------- | -------------------------------------------- |
| `id`                                                                               | UUID PK                                      |
| `lease_id`                                                                         | FK → `property_long_stays`                   |
| `tenant_user_id`                                                                   | FK → `tenant_users`, nullable until accepted |
| `role`                                                                             | `primary` \| `secondary`                     |
| `invite_email`                                                                     | Normalized email at invite time              |
| `display_name`                                                                     | Snapshot from lease                          |
| `status`                                                                           | See lifecycle below                          |
| `invited_by`                                                                       | FK → operator `users`                        |
| `invite_token_hash`                                                                | Magic link (single-use, hashed)              |
| `invited_at`, `expires_at`, `accepted_at`, `declined_at`, `revoked_at`, `ended_at` |                                              |

**Status enum:** `pending_invite` | `pending_acceptance` | `active` | `declined` | `revoked` | `ended` | `expired`

**Domain rules**

- One **active** membership per `(lease_id, invite_email)`; re-invite after `declined` / `expired` / `revoked`.
- Primary maps to `tenantEmail` + `guestName`; each `secondaryTenants[]` entry gets its own row when invited.
- Lease end (operator) → all memberships on that lease → `ended`.
- Existing `tenant_users` email on invite → `pending_acceptance` (not auto-`active`).

---

## Shared contract (`packages/shared`)

| Type                                                                | Purpose                               |
| ------------------------------------------------------------------- | ------------------------------------- |
| `TTenantMembershipStatus`                                           | Membership lifecycle enum             |
| `TTenantMembershipRole`                                             | `primary` \| `secondary`              |
| `ITenantUser`                                                       | Tenant profile (safe fields)          |
| `ILeaseTenantMembership`                                            | Admin + tenant views                  |
| `ITenantInviteAcceptBody`                                           | Accept/decline payloads               |
| `ITenantLeaseSummary`                                               | Tenant home list item                 |
| `ITenantLeaseDetailResponse`                                        | Lease + rent schedule (tenant-scoped) |
| Admin: `ICreateLeasePortalInviteBody`, `ILeasePortalAccessResponse` | Invite from admin                     |

---

## API (sketch)

### Tenant (`/tenant/*`)

| Method | Path                                       | Notes                               |
| ------ | ------------------------------------------ | ----------------------------------- |
| `POST` | `/tenant/auth/register/start`              | Email OTP                           |
| `POST` | `/tenant/auth/register/verify`             | Create `tenant_users`, issue tokens |
| `POST` | `/tenant/auth/login`                       | Email + password                    |
| `POST` | `/tenant/auth/refresh`                     | Refresh token rotation              |
| `GET`  | `/tenant/me`                               | Profile                             |
| `GET`  | `/tenant/me/invites/pending`               | Accept/decline list                 |
| `POST` | `/tenant/me/invites/:membershipId/accept`  |                                     |
| `POST` | `/tenant/me/invites/:membershipId/decline` |                                     |
| `GET`  | `/tenant/me/leases`                        | Active (+ past in Phase 4)          |
| `GET`  | `/tenant/me/leases/:leaseId`               | Detail + rent schedule              |

Magic link: `GET /tenant/accept-invite?token=…` validates token → routes to register or accept.

### Admin (extend long-stay routes)

| Method   | Path                                                                                 | Notes                           |
| -------- | ------------------------------------------------------------------------------------ | ------------------------------- |
| `GET`    | `/properties/:propertyId/long-stays/:longStayId/portal-access`                       | Membership statuses             |
| `POST`   | `/properties/:propertyId/long-stays/:longStayId/portal-invites`                      | Invite primary and/or secondary |
| `POST`   | `/properties/:propertyId/long-stays/:longStayId/portal-invites/:membershipId/resend` |                                 |
| `DELETE` | `/properties/:propertyId/long-stays/:longStayId/portal-invites/:membershipId`        | Revoke / cancel pending         |

---

## Phased rollout

### Phase 0 — Foundation (no UI)

**Goal:** Schema, shared types, feature flag, tenant JWT plugin skeleton.

**Tasks**

- [ ] Migration: `tenant_users`, `lease_tenant_memberships`, enums, indexes
- [ ] `packages/shared` types for membership status, roles, API bodies
- [ ] `apps/server/src/db/tenant-users.ts`, `lease-tenant-memberships.ts`
- [ ] `apps/server/src/auth/tenant-jwt.ts` — separate secret or `aud` claim from operator JWT
- [ ] `TENANT_PORTAL_ENABLED`, `TENANT_APP_URL` in `apps/server/.env.example`
- [ ] `assertTenantLeaseAccess(membershipId | leaseId, tenantUserId)` service

**Exit criteria:** Migrations run locally; unit tests for status transitions; flag off → tenant routes 404.

---

### Phase 1 — Invite pipeline (API + email, no tenant SPA)

**Goal:** Operator can invite via API; email sends; token validates — end-to-end without tenant UI.

**Tasks**

- [ ] Admin routes: create invite, list portal access on lease
- [ ] Invite service: detect existing `tenant_users` → `pending_invite` vs `pending_acceptance`
- [ ] `sendTenantPortalInviteEmail` in `transactional-emails.ts` + HTML template
- [ ] Token generate/hash/verify (reuse patterns from refresh tokens / OTP)
- [ ] Script or curl doc to accept invite via API for QA

**Exit criteria:** POST invite → email received → token exchange creates/activates membership in DB via test script.

---

### Phase 2 — Tenant auth

**Goal:** Tenant can register, login, accept/decline pending invites via API.

**Tasks**

- [ ] `/tenant/auth/*` routes (OTP register, login, refresh, logout)
- [ ] `tenant_refresh_tokens` table (mirror operator pattern) or shared refresh table with `aud`
- [ ] Accept/decline pending invites
- [ ] CORS: allow `TENANT_APP_URL` origin

**Exit criteria:** Postman/API flow: register → accept invite → `active`; existing user → login → accept second lease invite.

---

### Phase 3 — Tenant app shell + read-only lease view

**Goal:** First shippable UI — `apps/tenant` Vite app.

**Tasks**

- [ ] Scaffold `apps/tenant` (mirror admin: React 19, Vite, TanStack Query, Tailwind v4, shadcn)
- [ ] `apps/tenant/.env.example` — `VITE_API_URL`, `VITE_TENANT_APP_URL`
- [ ] Auth pages: login, register (OTP), accept-invite landing
- [ ] Home: active leases list; pending invites banner
- [ ] Lease detail: summary + rent schedule (reuse shared formatters from `packages/shared`)
- [ ] `lib/api-client.ts` typed from shared contracts
- [ ] Root `package.json` scripts: `dev:tenant`, `build:tenant`

**Exit criteria:** Local demo: operator invites Jane → Jane completes flow in browser → sees rent schedule.

---

### Phase 4 — Admin UI + lease lifecycle hooks

**Goal:** Operators manage invites from lease detail; ending lease closes access.

**Tasks**

- [ ] Lease detail **Portal access** section (status badges, invite, resend, revoke)
- [ ] Hook `notifyPrimaryTenantLeaseEnded` path: set memberships → `ended`
- [ ] Tenant app: **Past leases** read-only section
- [ ] Admin: show declined / expired / pending states

**Exit criteria:** End lease in admin → tenant loses active access; past lease visible read-only; operator sees portal statuses.

---

### Phase 5 — Hardening

**Goal:** Production-ready invite/access behavior.

| Concern             | Action                                                              |
| ------------------- | ------------------------------------------------------------------- |
| Wrong email invited | Revoke + re-invite; acceptance required                             |
| Invite expiry       | Cron or check on use; 30-day TTL (match `property_invites`)         |
| Rate limits         | Invite creation per property; auth OTP cooldown                     |
| Idempotency         | Duplicate pending invite for same `(lease, email)` → 409            |
| Observability       | Structured logs: `tenant_portal.invite_sent`, `membership.accepted` |
| Security            | Tenant JWT cannot hit `/properties/*` admin routes                  |

**Exit criteria:** Failure modes documented; load test invite accept path; security smoke test cross-audience JWT.

---

### Phase 6 — Enhancements (post-v1)

Pick based on product priority:

- [ ] Auto-invite property setting (off by default)
- [ ] Push notifications (Expo — reuse `push/` infra)
- [ ] SSE for invite accepted → operator notification
- [ ] Maintenance requests
- [ ] Document upload / lease PDF
- [ ] Rent payment integration
- [ ] Phone OTP for tenants without email
- [ ] `packages/ui` extraction when admin + tenant share components

---

### Phase 7 — Scale (only when metrics justify)

- [ ] Read replica for tenant lease list queries
- [ ] Separate Railway service for tenant API process (same DB, same codebase, different start command)
- [ ] CDN + aggressive caching for static tenant app

---

### Phase 8 — Split database (unlikely near-term)

Only if compliance or organizational boundaries require it:

- [ ] Define sync/ownership boundary (tenant PII vs lease snapshots)
- [ ] Event-driven replication or API-only cross-service reads
- [ ] Migration plan for existing memberships

---

## Where to start (this week)

1. **Read this doc** and agree on non-goals (especially: one DB, no microservice v1).
2. **Phase 0** — migration + shared types only (~1–2 PRs).
3. **Phase 1** — invite API + email without any frontend (~1 PR).
4. **Phase 2** — tenant auth API (~1 PR).
5. **Phase 3** — scaffold `apps/tenant` and wire read-only lease view.

Do **not** start with `apps/tenant` UI or a separate database. Schema and invite pipeline first.

---

## What not to do

1. **Do not create a second Postgres database** for v1 — you need joins to leases and complicate every read.
2. **Do not reuse operator `users` + `property_members`** for tenants — wrong authorization model.
3. **Do not auto-grant portal access when a lease is created** — always explicit invite + acceptance.
4. **Do not auto-link a new lease to an existing tenant account** without accept/decline.
5. **Do not let tenants end leases** — operator `end lease` only.
6. **Do not build a tenant microservice** before Phase 3 UI proves the API surface.
7. **Do not duplicate lease rows into tenant DB tables** — membership points at `property_long_stays`.
8. **Do not share JWT secrets/claims** between admin and tenant apps without `aud` separation.

---

## Safest sequencing summary

1. **DB + shared types** before any HTTP or UI.
2. **Invite + email + token** before tenant SPA (prove pipeline with scripts).
3. **Tenant auth API** before lease read routes.
4. **Read-only tenant UI** before admin portal-access UI (dogfood via API first).
5. **Lease end → membership ended** before marketing the portal to operators.
6. **Scale infra** (replicas, CDN) before **split DB**.
