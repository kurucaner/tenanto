# Domain Errors & Shared Types — DRY Refactor Phases

Reduce repeated boilerplate across **server domain errors**, **route error mappers**, and **shared TypeScript contracts** without breaking existing HTTP behavior or API shapes. Work is incremental: low-risk shared-type cleanups first, then invite-family error consolidation, then broader domain rollout.

**Related code today**

- Repeated error classes (~50): `apps/server/src/services/*`, `apps/server/src/db/*` — each exports `class XError extends Error { constructor(...) { this.name = "XError" } }`
- Route `instanceof` chains: [`property-long-stay-portal-routes.ts`](apps/server/src/routes/admin/property-long-stay-portal-routes.ts), [`property-routes.ts`](apps/server/src/routes/admin/property-routes.ts), [`property-long-stay-routes.ts`](apps/server/src/routes/admin/property-long-stay-routes.ts), [`tenant-lease-routes.ts`](apps/server/src/routes/tenant/tenant-lease-routes.ts), etc.
- Duplicated signup mappers: [`tenant-invite-signup-service.ts`](apps/server/src/services/tenant-invite-signup-service.ts), [`property-member-invite-signup-service.ts`](apps/server/src/services/property-member-invite-signup-service.ts) — nearly identical `mapSignupDomainError`
- Existing centralized patterns to extend (not replace): [`reply-from-database-error.ts`](apps/server/src/routes/admin/reply-from-database-error.ts), [`pg-errors.ts`](apps/server/src/db/pg-errors.ts), [`constants/account.ts`](apps/server/src/constants/account.ts) (`code` on `Error`)
- List meta duplication: [`packages/shared/src/list-meta-types.ts`](packages/shared/src/list-meta-types.ts) — six interfaces identical except name; two richer (units, long stays)
- Contact source overlap: [`lease-primary-tenant-contact.ts`](packages/shared/src/lease-primary-tenant-contact.ts), [`lease-secondary-tenant-contact.ts`](packages/shared/src/lease-secondary-tenant-contact.ts)
- Export errors already use inheritance: [`property-export-service.ts`](apps/server/src/services/property-export/property-export-service.ts) — `PropertyExportDuplicateError extends PropertyExportValidationError`

---

## Goals

- **Less boilerplate** — stop copy-pasting 6-line error class definitions and identical HTTP mapping blocks.
- **Single mapping path** — domain error → HTTP status/body in one place per feature area (mirror `replyFromDatabaseError`).
- **Preserve behavior** — same status codes, messages, and client-visible error bodies after each phase.
- **Shared types stay semantic** — keep named exports like `IPropertyExpensesListMeta` for API clarity; dedupe implementation via aliases/base types.
- **Incremental rollout** — small reviewable PRs; no big-bang rewrite of all ~50 errors.

## Non-goals

- Replacing all errors with untyped `throw new Error(message)` (breaks discrimination).
- Merging `ILeasePrimaryTenantContact` and `ILeaseSecondaryTenantContact` into one model (different fields and business rules).
- Result/Either types at every service boundary (optional future; out of scope here).
- Changing client error UX (new error codes in API responses) unless explicitly noted per phase.
- Refactoring Postgres constraint handling (already centralized).

---

## Guiding principles

1. **Discriminate safely** — routes must distinguish errors reliably (`instanceof`, `error.code`, or a typed base class). A bare `createError(name, msg)` factory without subclasses breaks current handlers.
2. **Map once, throw many** — services throw domain errors; routes call one mapper (`replyFromDomainError` / `handlePortalInviteError` successor).
3. **Keep semantic type names in `packages/shared`** — use type aliases over deleting exported names clients depend on.
4. **Follow existing precedents** — `AccountError` + `code` on `Error` in [`constants/account.ts`](apps/server/src/constants/account.ts); DB errors via [`reply-from-database-error.ts`](apps/server/src/routes/admin/reply-from-database-error.ts).
5. **Migrate by domain cluster** — invite flows first (highest duplication), then lease/long-stay, then export/campaign/rent/auth.
6. **No behavior change per PR** — each phase includes tests or route-level assertions that status + message are unchanged.

---

## Target architecture

```
Service / DB layer
  throw DomainError(code, message, httpStatus)
       or throw NamedDomainError subclass (factory-generated)
              ↓
Route handler catch
  replyFromDomainError(reply, error)     ← new shared helper
       or feature mapInviteSignupError   ← consolidated signup mapper
              ↓
HTTP { error, code? } + HttpStatus
```

Parallel track (shared types — no runtime change):

```
packages/shared/list-meta-types.ts
  IListTotalCountMeta
  type IPropertyExpensesListMeta = IListTotalCountMeta   // semantic alias kept

packages/shared/tenant-contact-types.ts (new, optional)
  TTenantContactLinkedUserSource | TTenantContactMembershipPendingSource
  composed into TPrimaryTenantContactSource / TSecondaryTenantContactSource
```

### Permissions

N/A — internal refactor only; no auth or capability changes.

### Feature flag

N/A.

---

## Inventory — error classes by domain

Use this table to sequence migration. Count ≈ **50** named classes today.

| Domain | Classes (location) | Route / mapper consumers |
| --- | --- | --- |
| **Portal invite** | `PortalInviteNotFoundError`, `PortalInviteLeaseMismatchError`, `PortalInviteInvalidStateError`, `PortalInviteTargetError` — [`tenant-portal-invite-service.ts`](apps/server/src/services/tenant-portal-invite-service.ts) | [`property-long-stay-portal-routes.ts`](apps/server/src/routes/admin/property-long-stay-portal-routes.ts), [`tenant-lease-routes.ts`](apps/server/src/routes/tenant/tenant-lease-routes.ts) |
| **Portal membership (DB)** | `DuplicatePortalInviteError`, `InvalidTenantMembershipTransitionError`, `MaxSecondaryOccupantsError`, `SecondaryOccupantNotFoundError`, `SecondaryOccupantLeaseMismatchError` — [`lease-tenant-memberships.ts`](apps/server/src/db/lease-tenant-memberships.ts) | Portal routes, [`property-secondary-occupant-routes.ts`](apps/server/src/routes/admin/property-secondary-occupant-routes.ts) |
| **Property member invite** | `PropertyMemberInviteNotFoundError`, `PropertyMemberInviteMismatchError`, `PropertyMemberInviteInvalidStateError`, `PropertyMemberAlreadyMemberError` — [`property-member-invite-service.ts`](apps/server/src/services/property-member-invite-service.ts) | [`property-routes.ts`](apps/server/src/routes/admin/property-routes.ts), [`property-invite-routes.ts`](apps/server/src/routes/property-invite-routes.ts) |
| **Property member invite (DB)** | `InvalidPropertyMemberInviteTransitionError`, `DuplicatePropertyMemberInviteError` — [`property-invites.ts`](apps/server/src/db/property-invites.ts) | [`property-routes.ts`](apps/server/src/routes/admin/property-routes.ts) |
| **Invite signup (tenant portal)** | `TenantInviteSignupAccountExistsError`, `TenantInviteSignupEmailMismatchError`, `TenantInviteSignupValidationError` — [`tenant-invite-signup-service.ts`](apps/server/src/services/tenant-invite-signup-service.ts) | Internal `mapSignupDomainError`; auth/tenant routes |
| **Invite signup (platform)** | `PropertyMemberInviteSignupAccountExistsError`, `PropertyMemberInviteSignupEmailMismatchError`, `PropertyMemberInviteSignupValidationError` — [`property-member-invite-signup-service.ts`](apps/server/src/services/property-member-invite-signup-service.ts) | Internal `mapSignupDomainError` |
| **Long stay / lease** | `ActiveLongStayConflictError`, `LongStayNotFoundError`, `LongStayNotActiveError`, `InvalidExtendLeaseError` — [`property-long-stays.ts`](apps/server/src/db/property-long-stays.ts) | [`property-long-stay-routes.ts`](apps/server/src/routes/admin/property-long-stay-routes.ts), secondary occupant routes |
| **Lease terms** | `LeaseTermsNotEditableError`, `LeaseTermsValidationError` — [`lease-terms-edit-service.ts`](apps/server/src/services/lease-terms-edit-service.ts) | Long-stay routes |
| **Primary tenant contact** | `LinkedTenantContactError` — [`update-primary-tenant-contact-service.ts`](apps/server/src/services/update-primary-tenant-contact-service.ts) | Long-stay + secondary occupant routes |
| **Tenant access** | `TenantLeaseAccessDeniedError` — [`tenant-portal-access.ts`](apps/server/src/services/tenant-portal-access.ts) | Tenant lease + rent routes |
| **Tenant membership** | `TenantMembershipNotFoundError` — [`tenant-portal-membership-service.ts`](apps/server/src/services/tenant-portal-membership-service.ts) | Tenant lease routes |
| **Email campaigns** | `TenantEmailCampaignValidationError`, `TenantEmailCampaignNoRecipientsError` — service; `TenantEmailCampaignIdempotencyConflictError` — DB; `TenantEmailCampaignNotFoundError` — reenqueue | Campaign routes + service |
| **Property export** | `PropertyExportValidationError` + subclasses — [`property-export-service.ts`](apps/server/src/services/property-export/property-export-service.ts); `ExportRowLimitExceededError`, `ExportJobPermanentError` — worker | Export routes + worker |
| **Rent payments** | `RentPaymentConnectNotReadyError`, `RentPaymentValidationError`, `RentPaymentNotFoundError` — [`tenant-rent-payment-service.ts`](apps/server/src/services/tenant-rent-payment-service.ts) | [`tenant-rent-payment-routes.ts`](apps/server/src/routes/tenant/tenant-rent-payment-routes.ts) |
| **Stripe** | `StripeConnectNotConfiguredError`, `StripeWebhookSignatureError` | Connect + webhook routes |
| **Auth OTP** | `OtpAlreadySendingError`, `OtpCooldownActiveError` — [`auth-otp-service.ts`](apps/server/src/services/auth-otp-service.ts) | Auth routes |

---

## Shared contract changes (`packages/shared`)

| Change | Phase | Notes |
| --- | --- | --- |
| `IListTotalCountMeta` | 0 | `{ totalCount: number }` base |
| Semantic list meta aliases | 0 | `type IPropertyExpensesListMeta = IListTotalCountMeta` — keep exports in [`index.ts`](packages/shared/src/index.ts) |
| `TTenantContactLinkedUserSource`, `TTenantContactMembershipPendingSource` | 0 | Shared literals for contact sources |
| `ILeaseTenantContactBase` (optional) | 0b | Only if a third consumer needs it; do not merge primary/secondary interfaces |
| `DomainErrorCode` enum (optional) | 1 | Server-only or shared if clients need stable codes later |

**List meta consumers (unchanged names after alias):**

- [`property-expense-types.ts`](packages/shared/src/property-expense-types.ts), [`property-income-entries-types.ts`](packages/shared/src/property-income-entries-types.ts), [`property-income-line-types.ts`](packages/shared/src/property-income-line-types.ts), [`property-reservation-types.ts`](packages/shared/src/property-reservation-types.ts), [`tenant-email-campaign-types.ts`](packages/shared/src/tenant-email-campaign-types.ts), [`property-export-types.ts`](packages/shared/src/property-export-types.ts), [`property-long-stay-types.ts`](packages/shared/src/property-long-stay-types.ts), [`property-types.ts`](packages/shared/src/property-types.ts)

---

## Server infrastructure (sketch)

### Option A — `defineDomainError` factory (minimal change)

**New:** [`apps/server/src/lib/define-domain-error.ts`](apps/server/src/lib/define-domain-error.ts)

```typescript
export function defineDomainError(defaultMessage: string) {
  return class extends Error {
    constructor(message = defaultMessage) {
      super(message);
      this.name = new.target.name;
    }
  };
}

// Usage preserves instanceof:
export class PortalInviteNotFoundError extends defineDomainError("Portal invite not found") {}
```

Use when migrating a domain but keeping `instanceof` route checks temporarily.

### Option B — `DomainError` + code (recommended for invite clusters)

**New:** [`apps/server/src/lib/domain-error.ts`](apps/server/src/lib/domain-error.ts)

```typescript
export class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly httpStatus: number,
    readonly body?: Record<string, unknown>
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
```

**New:** [`apps/server/src/routes/reply-from-domain-error.ts`](apps/server/src/routes/reply-from-domain-error.ts)

```typescript
export function replyFromDomainError(reply: FastifyReply, error: unknown): boolean {
  if (!isDomainError(error)) return false;
  void reply.status(error.httpStatus).send({ error: error.message, ...error.body });
  return true;
}
```

Align `code` strings with existing [`AccountError`](packages/shared/src/account-types.ts) pattern where overlaps exist.

---

## Phased rollout

### Phase 0 — Shared type DRY (no server behavior change)

**Goal:** Remove duplicate interface definitions in `packages/shared` while preserving exported type names.

**Tasks**

- [x] Add `IListTotalCountMeta { totalCount: number }` in [`list-meta-types.ts`](packages/shared/src/list-meta-types.ts)
- [x] Replace duplicate interfaces with type aliases:
  - `IPropertyExpensesListMeta`
  - `IPropertyIncomeEntriesListMeta`
  - `IPropertyIncomeLinesListMeta`
  - `IPropertyShortStaysListMeta`
  - `ITenantEmailCampaignsListMeta`
  - `IPropertyExportsListMeta`
- [x] Keep `IPropertyUnitsListMeta` and `IPropertyLongStaysListMeta` as extending interfaces:

  ```typescript
  export interface IPropertyLongStaysListMeta extends IListTotalCountMeta {
    activeCount: number;
    endedCount: number;
  }
  ```

- [x] Add shared contact source literals (new file or in existing contact modules):

  ```typescript
  export type TTenantContactLinkedUserSource = "linked_user";
  export type TTenantContactMembershipPendingSource = "membership_pending";

  export type TPrimaryTenantContactSource =
    | TTenantContactLinkedUserSource
    | TTenantContactMembershipPendingSource
    | "lease";

  export type TSecondaryTenantContactSource =
    | TTenantContactLinkedUserSource
    | TTenantContactMembershipPendingSource
    | "membership_listed";
  ```

- [x] Export new types from [`packages/shared/src/index.ts`](packages/shared/src/index.ts)
- [x] Run `packages/shared` tests; verify admin/server `tsc` unchanged

**Optional Phase 0b — Contact base interface**

- [ ] Add `ILeaseTenantContactBase` with shared effective fields only if adding a third reader; **do not** merge primary/secondary contact interfaces

**Exit criteria:** Zero API contract renames; all list response types still use semantic meta names; shared tests green.

**Deploy:** shared package only (no server deploy required for type-only aliases).

---

### Phase 1 — Error infrastructure foundation

**Goal:** Introduce shared server helpers without migrating call sites yet.

**Tasks**

- [x] Add [`apps/server/src/lib/domain-error.ts`](apps/server/src/lib/domain-error.ts) (`DomainError`, `isDomainError`)
- [x] Add [`apps/server/src/lib/define-domain-error.ts`](apps/server/src/lib/define-domain-error.ts) (optional companion for gradual migration)
- [x] Add [`apps/server/src/routes/reply-from-domain-error.ts`](apps/server/src/routes/reply-from-domain-error.ts)
- [x] Unit tests: `DomainError` preserves `code` / `httpStatus`; `replyFromDomainError` sends correct status/body; returns `false` for non-domain errors
- [x] Document code naming convention: `SCREAMING_SNAKE` domain prefix, e.g. `PORTAL_INVITE_NOT_FOUND`, `PROPERTY_MEMBER_INVITE_MISMATCH`

**Exit criteria:** New modules tested; no production route uses them yet; lint passes.

---

### Phase 2 — Portal invite domain

**Goal:** Replace four portal invite error classes + `handlePortalInviteError` instanceof chain with coded `DomainError` + central mapper.

**Tasks**

- [x] Add [`apps/server/src/errors/portal-invite-errors.ts`](apps/server/src/errors/portal-invite-errors.ts) — factory functions or constants:

  | Legacy class | Code | HTTP |
  | --- | --- | --- |
  | `PortalInviteNotFoundError` | `PORTAL_INVITE_NOT_FOUND` | 404 |
  | `PortalInviteLeaseMismatchError` | `PORTAL_INVITE_LEASE_MISMATCH` | 404 |
  | `PortalInviteInvalidStateError` | `PORTAL_INVITE_INVALID_STATE` | 400 |
  | `PortalInviteTargetError` | `PORTAL_INVITE_TARGET` | 400 |
  | `DuplicatePortalInviteError` | `PORTAL_INVITE_DUPLICATE` | 409 |

- [x] Migrate [`tenant-portal-invite-service.ts`](apps/server/src/services/tenant-portal-invite-service.ts) throws
- [x] Migrate [`lease-tenant-memberships.ts`](apps/server/src/db/lease-tenant-memberships.ts) `DuplicatePortalInviteError` throws (or re-export from portal-invite-errors)
- [x] Replace `handlePortalInviteError` in [`property-long-stay-portal-routes.ts`](apps/server/src/routes/admin/property-long-stay-portal-routes.ts) with `replyFromDomainError` + portal code registry
- [x] Update [`tenant-lease-routes.ts`](apps/server/src/routes/tenant/tenant-lease-routes.ts) portal-related catches
- [x] Update [`property-secondary-occupant-routes.ts`](apps/server/src/routes/admin/property-secondary-occupant-routes.ts) for `DuplicatePortalInviteError`
- [x] Delete legacy classes once grep clean; update service tests

**Exit criteria:** Portal invite/resend/revoke flows return same statuses as before; no `PortalInvite*Error` classes remain; route files have no portal-specific `instanceof` chain.

**Deploy:** server only.

---

### Phase 3 — Property member invite domain

**Goal:** Consolidate platform property-member invite errors and route handlers.

**Tasks**

- [x] Add [`apps/server/src/errors/property-member-invite-errors.ts`](apps/server/src/errors/property-member-invite-errors.ts)

  | Legacy class | Code | HTTP |
  | --- | --- | --- |
  | `PropertyMemberInviteNotFoundError` | `PROPERTY_MEMBER_INVITE_NOT_FOUND` | 404 |
  | `PropertyMemberInviteMismatchError` | `PROPERTY_MEMBER_INVITE_MISMATCH` | 404 |
  | `PropertyMemberInviteInvalidStateError` | `PROPERTY_MEMBER_INVITE_INVALID_STATE` | 400 |
  | `PropertyMemberAlreadyMemberError` | `PROPERTY_MEMBER_ALREADY_MEMBER` | 409 |
  | `DuplicatePropertyMemberInviteError` | `PROPERTY_MEMBER_INVITE_DUPLICATE` | 409 |
  | `InvalidPropertyMemberInviteTransitionError` | `PROPERTY_MEMBER_INVITE_INVALID_TRANSITION` | 400 |

- [x] Migrate [`property-member-invite-service.ts`](apps/server/src/services/property-member-invite-service.ts)
- [x] Migrate [`property-invites.ts`](apps/server/src/db/property-invites.ts) throws
- [x] Consolidate handlers in [`property-routes.ts`](apps/server/src/routes/admin/property-routes.ts) and [`property-invite-routes.ts`](apps/server/src/routes/property-invite-routes.ts)

**Exit criteria:** Property invite create/resend/revoke/public redeem unchanged; no `PropertyMemberInvite*Error` classes in services/db.

---

### Phase 4 — Invite signup mapper consolidation

**Goal:** DRY the two nearly identical `mapSignupDomainError` implementations.

**Tasks**

- [x] Add [`apps/server/src/errors/invite-signup-errors.ts`](apps/server/src/errors/invite-signup-errors.ts) — shared signup validation/account-exists/email-mismatch errors (tenant + platform variants or unified codes with context)
- [x] Add [`apps/server/src/services/map-invite-signup-domain-error.ts`](apps/server/src/services/map-invite-signup-domain-error.ts):

  ```typescript
  export function mapInviteSignupDomainError(
    error: unknown,
    options?: { includePropertyMemberInviteErrors?: boolean }
  ): TSignupFailure | null
  ```

- [x] Migrate [`tenant-invite-signup-service.ts`](apps/server/src/services/tenant-invite-signup-service.ts) — replace local classes + mapper
- [x] Migrate [`property-member-invite-signup-service.ts`](apps/server/src/services/property-member-invite-signup-service.ts)
- [x] Keep `isIdentityConflictError` branch — already uses `AccountError` codes from [`constants/account.ts`](apps/server/src/constants/account.ts)
- [x] Tests: table-driven cases for each error → status/body (port existing assertions)

**Exit criteria:** One shared mapper; duplicate signup error classes removed; tenant + platform signup flows unchanged.

---

### Phase 5 — Lease / long-stay / tenant contact domain

**Goal:** Migrate high-traffic lease errors and reduce repetition in [`property-long-stay-routes.ts`](apps/server/src/routes/admin/property-long-stay-routes.ts).

**Tasks**

- [x] Add [`apps/server/src/errors/lease-errors.ts`](apps/server/src/errors/lease-errors.ts):

  | Legacy | Code | HTTP |
  | --- | --- | --- |
  | `LongStayNotFoundError` | `LONG_STAY_NOT_FOUND` | 404 |
  | `LongStayNotActiveError` | `LONG_STAY_NOT_ACTIVE` | 400/409 (match today) |
  | `ActiveLongStayConflictError` | `ACTIVE_LONG_STAY_CONFLICT` | 409 |
  | `InvalidExtendLeaseError` | `INVALID_EXTEND_LEASE` | 400 |
  | `LeaseTermsNotEditableError` | `LEASE_TERMS_NOT_EDITABLE` | 400 |
  | `LeaseTermsValidationError` | `LEASE_TERMS_VALIDATION` | 400 |
  | `LinkedTenantContactError` | `LINKED_TENANT_CONTACT` | 409 |
  | `MaxSecondaryOccupantsError` | `MAX_SECONDARY_OCCUPANTS` | 409 |
  | `SecondaryOccupantNotFoundError` | `SECONDARY_OCCUPANT_NOT_FOUND` | 404 |
  | `SecondaryOccupantLeaseMismatchError` | `SECONDARY_OCCUPANT_LEASE_MISMATCH` | 404 |
  | `InvalidTenantMembershipTransitionError` | `TENANT_MEMBERSHIP_INVALID_TRANSITION` | 400 |

- [x] Migrate [`property-long-stays.ts`](apps/server/src/db/property-long-stays.ts), [`lease-terms-edit-service.ts`](apps/server/src/services/lease-terms-edit-service.ts), [`update-primary-tenant-contact-service.ts`](apps/server/src/services/update-primary-tenant-contact-service.ts), remaining membership errors
- [x] Add `replyFromLeaseDomainError` or extend registry in `reply-from-domain-error.ts`
- [x] Refactor long-stay + secondary occupant routes to use central mapper(s)
- [x] Migrate `TenantLeaseAccessDeniedError`, `TenantMembershipNotFoundError` for tenant routes

**Exit criteria:** Long-stay CRUD, terms edit, secondary occupant CRUD, primary contact edit return same errors; `property-long-stay-routes.ts` has no long `instanceof` ladder.

---

### Phase 6 — Export, campaigns, rent, auth, stripe

**Goal:** Finish remaining domains; respect existing export error inheritance where useful.

**Tasks**

**Export**

- [x] Migrate [`property-export-service.ts`](apps/server/src/services/property-export/property-export-service.ts) — can keep subclass pattern **or** map to `DomainError` codes (`PROPERTY_EXPORT_DUPLICATE`, etc.)
- [x] Migrate worker errors: `ExportRowLimitExceededError`, `ExportJobPermanentError`
- [x] Update [`property-export-routes.ts`](apps/server/src/routes/admin/property-export-routes.ts)

**Email campaigns**

- [x] Migrate campaign service + DB idempotency + reenqueue not-found errors
- [x] Update [`property-tenant-email-campaign-routes.ts`](apps/server/src/routes/admin/property-tenant-email-campaign-routes.ts)

**Rent + Stripe**

- [x] Migrate [`tenant-rent-payment-service.ts`](apps/server/src/services/tenant-rent-payment-service.ts), [`stripe-connect-config.ts`](apps/server/src/lib/stripe-connect-config.ts), [`stripe-webhook-service.ts`](apps/server/src/services/stripe-webhook-service.ts)
- [x] Update tenant rent + stripe connect + webhook routes

**Auth OTP**

- [x] Migrate [`auth-otp-service.ts`](apps/server/src/services/auth-otp-service.ts); update auth routes

**Exit criteria:** `rg 'export class \\w+Error extends Error' apps/server` returns zero hits (or only documented exceptions); all routes use `replyFromDomainError` or domain registries.

---

### Phase 7 — Hardening & guardrails

**Goal:** Prevent regression to copy-paste error classes.

**Tasks**

- [ ] Add ESLint rule or CI grep check: discourage new `class FooError extends Error` outside `apps/server/src/errors/`
- [ ] Add [`docs/DOMAIN_ERROR_CONVENTIONS.md`](docs/DOMAIN_ERROR_CONVENTIONS.md) — when to use `DomainError` vs DB `replyFromDatabaseError` vs `AccountError` codes
- [ ] Optional: expose stable `code` in JSON responses for new domains (product decision; document in API changelog)
- [ ] Audit admin/client: confirm no reliance on `error.name` string matching (should use HTTP status + message only today)

**Exit criteria:** Conventions doc merged; CI/grep gate active; team knows which helper to use for new features.

---

## Verification checklist (per phase)

| Check | How |
| --- | --- |
| HTTP status unchanged | Route/integration tests or manual matrix for affected endpoints |
| Message text unchanged | Snapshot key error messages in unit tests |
| No duplicate mappers | `rg 'instanceof \\w+Error' apps/server/src/routes` count decreases each phase |
| Shared exports stable | `packages/shared` build; admin + tenant `tsc -b` |
| Signup flows | Tenant portal + platform invite register/login paths |

---

## What not to do

- Do **not** replace typed errors with plain `throw new Error(msg)` — routes will lose discrimination.
- Do **not** big-bang migrate all ~50 errors in one PR — reviewability and rollback suffer.
- Do **not** collapse `IPropertyExpensesListMeta` into a single generic `IListMeta` in public API — breaks semantic clarity and future per-resource fields.
- Do **not** merge primary and secondary tenant contact interfaces — different sources and field names (`membershipStatus` vs `status`).
- Do **not** reimplement Postgres constraint mapping — keep using [`reply-from-database-error.ts`](apps/server/src/routes/admin/reply-from-database-error.ts).
- Do **not** add `DomainError` to `packages/shared` until product needs client-visible stable codes — keep server-local initially.
- Do **not** delete export error subclasses until route mapper handles all former `instanceof` cases (including subclass checks).

---

## Safest sequencing summary

1. **Phase 0 first** — shared type aliases are zero runtime risk and build DRY momentum.
2. **Phase 1 before any migration** — helpers must exist and be tested before call sites switch.
3. **Phases 2 → 4 together logically** — portal invite, property invite, signup mappers share shapes; deploy server once after 2–4 if possible.
4. **Phase 5 separate** — long-stay routes are large; own PR series reduces conflict.
5. **Phase 6 by subdomain** — export, campaigns, rent, auth as independent PRs.
6. **Phase 7 last** — conventions + CI after patterns are proven.

---

## Suggested PR / commit sequence

1. `refactor(shared): dedupe list meta and contact source types` (Phase 0)
2. `feat(server): add DomainError and replyFromDomainError helpers` (Phase 1)
3. `refactor(server): migrate portal invite errors to DomainError` (Phase 2)
4. `refactor(server): migrate property member invite errors` (Phase 3)
5. `refactor(server): consolidate invite signup domain error mapper` (Phase 4)
6. `refactor(server): migrate lease and membership domain errors` (Phase 5)
7. `refactor(server): migrate export, campaign, rent, and auth errors` (Phase 6)
8. `docs: add domain error conventions and CI guard` (Phase 7)

---

## Related follow-ups (out of scope)

- [`TODO.md`](../TODO.md) — link this doc when starting refactor work
- Tenant contact primary consolidation ([`LEASE_TENANT_IDENTITY_CONSOLIDATION_PHASES.md`](LEASE_TENANT_IDENTITY_CONSOLIDATION_PHASES.md)) — orthogonal to error boilerplate
- Client typed error codes in `packages/shared` — only if product wants machine-readable codes in all API errors
