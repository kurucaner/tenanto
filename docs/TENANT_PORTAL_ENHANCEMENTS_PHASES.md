# Tenant Portal Enhancements + Scale — Implementation Phases

Post-launch roadmap after Phase 0–4 of [TENANT_PORTAL_PHASES.md](./TENANT_PORTAL_PHASES.md). Portal invite → accept → active/ended lease read is **already shipping**. This plan covers product enhancements (auto-invite, auth options, notifications, maintenance, messaging, payments, disconnect) and scale/infra (docs hygiene, Railway split, read replica, CDN). Stack stays **Postgres + Fastify + SES (+ SNS/Expo/S3 as needed)** — no second database until compliance forces it.

**Mapping to parent doc sub-phases:** Enhancements Phase 0 → Portal **5.1**; Phase 1 → **5.2**; Phase 2 → **5.3**; Phase 3 → **5.4**; Phase 4 → **5.5**; Phase 5 → **5.6**; Phase 6 → **5.7**; Phase 7 → **5.8**; Phase 8 → **5.9**; Phase 9 → deferred backlog.

**Related code today**

- Parent portal plan / failure modes: `docs/TENANT_PORTAL_PHASES.md`, `docs/TENANT_PORTAL_FAILURE_MODES.md`
- Invite pipeline: `apps/server/src/services/tenant-portal-invite-service.ts`
- Membership lifecycle: `apps/server/src/services/tenant-portal-membership-service.ts`, `packages/shared/src/tenant-membership-transitions.ts`
- Tenant auth (email/OTP): `apps/server/src/routes/tenant/tenant-auth-routes.ts`, `apps/server/src/auth/tenant-jwt.ts`, `apps/server/src/services/auth-otp-service.ts`
- Platform Google/Apple (operators only): `apps/server/src/auth/google.ts`, `apps/server/src/auth/apple.ts`, `apps/server/src/routes/auth/auth-routes.ts`
- Lease create (no invite hook): `apps/server/src/routes/admin/property-long-stay-routes.ts`
- Property settings: `apps/server/src/db/property-settings.ts`, `packages/shared/src/property-settings-types.ts`
- Rent recorded email: `apps/server/src/services/lease-notifications.ts`
- Expo client (unused send path): `apps/server/src/push/expo-client.ts`, `apps/server/src/db/push-tokens.ts` (platform `users` only)
- SSE hub (platform-user keyed): `apps/server/src/services/notification-stream-hub.ts`, `apps/server/src/routes/notification-routes.ts`
- Admin SSE client: `apps/admin/src/hooks/use-notification-stream.ts`
- S3/MinIO + support attachments: `apps/server/src/s3/`, `apps/server/src/routes/support-routes.ts`
- SMS client: `apps/server/src/sns/sns.ts`
- Shared UI: `packages/app-ui` (theme, API client, auth shell, lease cards)
- Docker tenant (already present): `docker-compose.yml` (`tenant` → `3003`), `docker/Dockerfile.tenant`
- Root scripts: `package.json` (`dev:tenant`, `build:tenant`, …)
- Railway worker precedent: `apps/server/railway.email-worker.toml`, `docs/RAILWAY_TENANT_EMAIL_WORKER.md`
- DB pool (single primary): `apps/server/src/db/pool.ts`

---

## Goals

- Operators can **opt in** to auto-invite on lease create without changing the default “explicit invite” rule.
- Tenants get **more auth options** (Google/Apple; phone OTP where email is missing) without mixing `JwtAudience.TENANT` and platform JWTs.
- Tenants receive **near-real-time** invite/lifecycle signals (SSE and/or push) without polling forever.
- Tenants can **disconnect** from a lease in the portal without ending the lease for accounting.
- New product domains (maintenance, messaging, rent payments) ship behind **feature flags**, with contracts in `packages/shared` and admin + tenant surfaces only after the API path works.
- Local/Docker/docs accurately describe `apps/tenant`; infra scale items have an explicit trigger (load/compliance), not “build now.”

## Non-goals (this enhancement series)

- Splitting Postgres into a second tenant DB (compliance-only later; join-friendly memberships remain on primary).
- Replacing email invites with push-only invites.
- Letting tenants end leases, edit rent schedules, or write operator ledgers from `/tenant/*`.
- Full shadcn catalog in `packages/app-ui` “just in case” — extract when **both** apps need the same primitive.
- Building a payment provider integration before maintenance/messaging have proven usage (or before product picks PCI approach).
- Admin feature-flag product from `ADMIN_CAPABILITIES_GAP.md` as a prerequisite (use env gates like existing workers).

---

## Guiding principles

1. **Explicit invite remains default** — auto-invite is a per-property setting, default `false`; never imply portal access on bare lease create.
2. **Reuse invite + membership state machine** — auto-invite, disconnect, and re-invite call `tenant-portal-invite-service` / membership transitions; do not invent parallel status enums.
3. **Audience isolation forever** — tenant social login / phone OTP still issue `JwtAudience.TENANT`; never link into `users` / `property_members` for portal ACL.
4. **Notify from proven events** — wire SSE/push to existing lifecycle hooks (`tenant_portal.*` logs / invite / rent-recorded / lease-end) before inventing a second event bus.
5. **API before UI before polish** — especially for maintenance, messaging, payments: Postman/script exit criteria before tenant/admin tabs.
6. **Flag gate new domains** — env flags (and setting toggles) hide API + UI until ready; dark ship workers behind the same flag.
7. **Scale when measured** — Railway tenant API split / read replica / CDN only after traffic or incident data, not as launch blockers.

---

## Target architecture

```
[Admin lease create] --(if auto_invite)--> [tenant-portal-invite-service]
                                                    |
                                                    v
                                         [lease_tenant_memberships]
                                                    |
         +------------------------------------------+----------------------------------+
         |                                          |                                  |
         v                                          v                                  v
   [SES invite email]                    [tenant SSE stream]                   [Expo push]
         |                                          ^                                  ^
         v                                          |                                  |
[Tenant auth: email | Google/Apple | phone OTP]      |                                  |
         |                                          |                                  |
         v                                          |                                  |
[accept / disconnect / maintenance / messages] -----+----------------------------------+
         |
         v (payments, later)
   [Payment provider + webhook → income line / schedule]
```

### Permissions

| Capability | Who |
| --- | --- |
| Auto-invite setting | Property owner/manager (ledger write), same as long-stay write |
| Invite / revoke / disconnect (admin) | Existing portal invite auth |
| Tenant disconnect | Authenticated tenant with `active` membership on that lease |
| Maintenance / messages / pay | Tenant with `active` membership; admin responds with property access |
| Scale ops | Platform / infra only |

Mirror any new tabs with `property-route-access` + admin permission hooks.

### Feature flags

| Flag | Gates |
| --- | --- |
| `TENANT_PORTAL_AUTO_INVITE_ENABLED` | Optional global kill-switch on top of per-property setting |
| `TENANT_PHONE_AUTH_ENABLED` | Phone OTP routes + UI (+ SNS) |
| `TENANT_PUSH_ENABLED` | Tenant push token register + send path |
| `TENANT_SSE_ENABLED` | `/tenant/notifications/stream` |
| `TENANT_MAINTENANCE_ENABLED` | Maintenance API + UI |
| `TENANT_MESSAGING_ENABLED` | Lease messaging API + UI |
| `TENANT_PAYMENTS_ENABLED` | Payment intents + webhooks + UI |

---

## Data model (sketch)

### `property_settings` (extend) or `property_portal_settings`

| Column | Notes |
| --- | --- |
| `auto_invite_on_lease_create` | `BOOLEAN NOT NULL DEFAULT FALSE` |

### `tenant_push_tokens` (new)

| Column | Notes |
| --- | --- |
| `tenant_user_id` | FK → `tenant_users` |
| `token` | Expo push token |
| `platform` | ios/android/web |
| `active` | soft revoke on logout |

### `tenant_maintenance_requests` (new)

| Column | Notes |
| --- | --- |
| `lease_id` / `membership_id` | Scope to active membership |
| `status` | `open` \| `in_progress` \| `resolved` \| `cancelled` |
| `body` / `priority` | Tenant-authored |
| attachments | Via existing S3 key pattern (support-style) |

### `lease_message_threads` + `lease_messages` (new)

| Column | Notes |
| --- | --- |
| Thread per `(lease_id)` or `(lease_id, membership_id)` | Pick one and stick |
| `sender_type` | `tenant` \| `operator` |
| `sender_id` | `tenant_users.id` or `users.id` |

### Payments (later)

| Concern | Sketch |
| --- | --- |
| Provider customer/payment intent tables | TBD after product picks Stripe/ACH |
| Link to rent schedule period | Prefer snapshot period id + amount |

**Domain rule — disconnect:** Tenant-initiated disconnect transitions membership `active` → `revoked` (or dedicated `disconnected` only if product needs distinct admin copy). Does **not** call `endLease`. Operator can re-invite.

---

## Shared contract (`packages/shared`)

| Type | Purpose |
| --- | --- |
| `IPropertySettings.autoInviteOnLeaseCreate` | Setting field |
| `TTenantDisconnectResponse` | Membership after self-disconnect |
| `ITenantPushTokenRegisterBody` | Device registration |
| `ITenantMaintenanceRequest` / list filters | Maintenance domain |
| `ILeaseMessage` / thread DTOs | Messaging |
| `ITenantPaymentIntent*` | Payments (late phases) |
| Stream events | e.g. `tenant_portal.invite_pending`, `maintenance.updated` |

---

## API (sketch)

| Method | Path | Notes |
| --- | --- | --- |
| `PATCH` | `/properties/:id/settings` | Extend body with auto-invite boolean |
| `POST` | `/tenant/me/leases/:leaseId/disconnect` | Tenant JWT; membership → revoked |
| `GET` | `/tenant/notifications/stream` | Tenant JWT SSE |
| `POST` | `/tenant/push-tokens/register` | Tenant JWT |
| `POST` | `/tenant/auth/google` / `apple` | Flagged; issue tenant session |
| `POST` | `/tenant/auth/phone/start` + `verify` | Flagged; SNS OTP |
| `POST/GET` | `/tenant/me/leases/:leaseId/maintenance…` | Flagged CRUD |
| `POST/GET` | `/tenant/me/leases/:leaseId/messages…` | Flagged |
| `POST` | `/tenant/me/leases/:leaseId/payments…` | Flagged late |

Admin counterparts for maintenance/messages under `/properties/:id/long-stays/:leaseId/…`.

---

## Real-time / events

Extend hub pattern in `notification-stream-hub.ts`:

- Either **tenant channel keyed by `tenantUserId`** on a new path, or dual registry in the same hub.
- Events: invite created/pending for that email’s user, membership revoked/ended, maintenance status, new message.
- Client: `apps/tenant` hook mirrored from admin `use-notification-stream.ts`.
- Fallback: list endpoints already exist for invites/leases; poll only if SSE unavailable.

Push: on same domain events, best-effort Expo send via existing `expo-client.ts` to `tenant_push_tokens`.

---

## Worker / job queue (if applicable)

- Auto-invite: **sync** call after lease create is fine for 1–2 emails; if Invite all on large secondary lists becomes slow, enqueue like tenant-email campaigns.
- Payments webhooks / message spam / push fan-out: prefer BullMQ only when latency or volume requires it.
- Reuse Redis connection + Railway worker pattern from email/export workers.

---

## UI surfaces

1. **Admin property settings** — Auto-invite toggle (default off) + copy that invite still needs valid emails.
2. **Tenant leases** — Disconnect action on active lease detail; confirm dialog.
3. **Tenant notifications** — Wire stream; toasts/badges for pending invites.
4. **Tenant auth** — Optional Google/Apple buttons; phone register/login flows when flagged.
5. **Maintenance / messages / pay** — Tenant create + list; admin respond; shared cards in `packages/app-ui` only when both apps share markup.

---

## Phased rollout

### Phase 0 — Foundation (docs + contracts hygiene)

**Goal:** Docs match reality; shared types ready without exposing new product.

- [x] Update `CLAUDE.md`: `apps/tenant`, `packages/app-ui`, `dev:tenant` / `build:tenant`, Docker tenant on `3003`
- [x] Confirm `docker-compose.yml` tenant service + `.env.example` for tenant documented (already built — close checklist item)
- [x] Shared sketch types for auto-invite setting + disconnect response (no migration yet if unused)
- [x] Cross-link this doc from `TENANT_PORTAL_PHASES.md` Phase 5 section

**Exit criteria:** New contributor can run tenant via `bun run dev:tenant` and Docker using CLAUDE.md alone; no new user-facing API.

---

### Phase 1 — Auto-invite + disconnect (API first)

**Goal:** Opt-in auto-invite and tenant self-disconnect on the existing membership model — no new auth stack.

- [ ] Migration: `auto_invite_on_lease_create` (default `false`) on property settings
- [ ] After successful lease create, if setting on: call `tenantPortalInviteService.createInvites` for primary (+ configurable secondaries later)
- [ ] Observability: reuse `tenant_portal.invited`; add `tenant_portal.auto_invited` context flag if useful
- [ ] `POST /tenant/me/leases/:leaseId/disconnect` → membership `revoked`; structured log
- [ ] Tests: setting off → no invite; setting on → membership row; disconnect → list access denied; lease still active in admin
- [ ] Admin settings UI toggle; tenant disconnect UI + confirm

**Exit criteria:** Property with auto-invite on creates lease → pending membership + email; tenant disconnect removes portal access without `endLease`; default-off properties unchanged.

---

### Phase 2 — Tenant notifications foundation (SSE + push registration)

**Goal:** Prove delivery channels before depending on them for product.

- [ ] `tenant_push_tokens` table + register/unregister routes (flagged)
- [ ] Hub: register SSE connections by `tenantUserId`; `GET /tenant/notifications/stream` (`authenticateTenant`, rate-limit exempt like admin)
- [ ] Publish events from invite create / revoke / accept / lease-end (reuse membership service hooks)
- [ ] Tenant client stream hook + toast/badge for pending invites
- [ ] Push send on invite (best-effort) when flag + active tokens

**Exit criteria:** Connected tenant app receives invite/revoke event without refresh; push token row created; disabled flags keep routes 404/403.

---

### Phase 3 — Auth expansion (Google / Apple / phone OTP)

Detailed phased plan: **[TENANT_PORTAL_AUTH_EXPANSION_PHASES.md](./TENANT_PORTAL_AUTH_EXPANSION_PHASES.md)**.

**Goal:** More ways to create a tenant session — still `JwtAudience.TENANT`.

- [ ] Mirror platform Google/Apple verify for `tenant_users` (link columns or identity table); issue tenant session
- [ ] Tenant login/register UI buttons for Google/Apple (always on)
- [ ] Phone OTP: purpose + SNS send; bind phone on `tenant_users`; rate limits reuse `tenant-auth-rate-limit` pattern
- [ ] Invite redemption: map invite email **or** verified phone policy (document: phone invite path may still need email on lease for v1 — **decide in this phase**)
- [ ] Tests: wrong audience JWT still rejected on `/tenant/*` and `/properties/*`

**Exit criteria:** Social and phone login work in staging (phone behind flag); platform Google user cannot call tenant lease routes with their platform token.

**Default if undecided:** Phone auth is for **login of an existing tenant_user** already invited by email; phone-only invites deferred.

**Locked in auth-expansion plan:** Invite accept stays **email-matched**; phone is bind/login only (no phone-only invites / nullable email in v1).

---

### Phase 4 — Maintenance requests MVP

**Goal:** Tenant opens a ticket on an active lease; operator sees/responds; attachments via existing S3 pattern.

- [ ] Tables + shared types + migrations
- [ ] Tenant CRUD (create/list/get); admin list/update status
- [ ] Presign upload + attach keys (copy support attachment flow)
- [ ] SSE/push: `maintenance.updated` for both sides
- [ ] Tenant + admin UI tabs/pages behind `TENANT_MAINTENANCE_ENABLED`
- [ ] Extract shared form/status badge to `packages/app-ui` only if both UIs share markup

**Exit criteria:** End-to-end create → attachment → status change → tenant sees update (SSE or refresh); flag off hides all surfaces.

---

### Phase 5 — In-app messaging MVP

**Goal:** Lease-scoped message thread between tenant and operators.

- [ ] Thread + messages schema; send/list APIs (tenant + admin)
- [ ] Abuse: rate limits per lease/sender; max body size; sanitize
- [ ] Real-time via Phase 2 SSE; optional email digest later
- [ ] UI: conversation view tenant + admin lease panel
- [ ] Do **not** reuse support-chat tables — wrong tenant boundary

**Exit criteria:** Message round-trip on one lease; revoked/ended membership cannot send; flag gated.

---

### Phase 6 — Rent payments (post product + compliance decision)

**Goal:** Tenant pays scheduled rent via a chosen provider; operator ledger remains source of truth.

- [ ] Product pick: Stripe / ACH / other; PCI scope documented
- [ ] Intent + webhook endpoints; idempotent webhook handling
- [ ] On success: create/link income line (or dedicated payment ledger) using existing property income patterns
- [ ] Notify tenant + operator (email/SSE/push)
- [ ] UI only after webhook path proven with sandbox

**Exit criteria:** Sandbox payment → durable payment row → income visibility in admin; failures leave no double-charge (idempotency keys).

---

### Phase 7 — Hardening (cross-cutting)

**Goal:** Production-safe gates for everything shipped in Phases 1–6.

| Concern | Action |
| --- | --- |
| Rate limits | Extend Redis fixed-window helpers for disconnect / maintenance / messages / phone OTP |
| Idempotency | Lease create + auto-invite must not double-invite on retry; payment webhooks idempotent |
| Auth | Constant-time where applicable; never log tokens; audience checks in route tests |
| Observability | Stable `tenant_portal.*` / `tenant_maintenance.*` / `tenant_payments.*` log keys |
| Failure modes | Extend `TENANT_PORTAL_FAILURE_MODES.md` per shipped domain |
| Flags | Staging matrix: each flag on/off |

**Exit criteria:** Documented failure modes updated; load light-test on accept + disconnect + notification fan-out; flags proven.

---

### Phase 8 — Scale / infra (trigger-based)

**Goal:** Scale without rewriting the portal model.

- [ ] **Railway tenant API process** — same image as API, start command serving only tenant routes or shared server with process role env (copy email-worker pattern); doc in `docs/RAILWAY_*.md`
- [ ] **Read replica** — optional second pool for `GET /tenant/me/leases*` when primary CPU/IO measured; writes stay primary
- [ ] **CDN** — host `apps/tenant` static behind CDN (ops); cache headers on Vite build assets
- [ ] **Split Postgres** — write decision memo only if legal/org boundary requires it; otherwise leave unchecked

**Exit criteria:** Each item has a measured trigger (p99 latency, error rate, compliance request) written in the PR/docs before build; no premature split DB.

---

### Phase 9 — Deferred enhancements

- Phone-only invites (no email on lease)
- Scheduled maintenance visits / vendor dispatch
- Marketing push campaigns
- Full feature-flag admin product (`ADMIN_CAPABILITIES_GAP.md`)
- Tenant-initiated lease end (explicitly forbidden)

---

## What not to do

- Do **not** auto-invite when the property setting is off or missing — default must remain explicit invite.
- Do **not** store tenant Google/Apple identities on `users` / grant `property_members` for portal access.
- Do **not** key tenant SSE sockets by platform `userId` or reuse `/notifications/stream` without audience checks.
- Do **not** treat support chat as lease messaging — different tenancy and ACL.
- Do **not** let disconnect or revoke call `endLease` / mark long-stay ended.
- Do **not** ship payments UI before webhook+ledger idempotency is proven.
- Do **not** split the database or start a microservice for convenience — Railway process split is enough until proven otherwise.
- Do **not** dump all of admin shadcn into `packages/app-ui` prophylactically.

---

## Safest sequencing summary

1. **Phase 0 docs** — unblock contributors; Docker tenant already exists.
2. **Auto-invite + disconnect** — deepen the existing membership model before new domains.
3. **SSE + push channels** — unlock real-time UX for everything that follows.
4. **Auth expansions** — add session methods only after invite/membership remain boring.
5. **Maintenance then messaging** — both need attachments/realtime; maintenance is the smaller workflow.
6. **Payments last** — money + compliance after communication workflows exist.
7. **Scale when measured** — replica / Railway split / CDN are Phase 8 with triggers, not launch gates.
