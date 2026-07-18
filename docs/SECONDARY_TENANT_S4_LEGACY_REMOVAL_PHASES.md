# Secondary Tenant S4 — Legacy Removal & Campaign Recipients

Completes **S4** of [`SECONDARY_TENANT_IDENTITY.md`](SECONDARY_TENANT_IDENTITY.md): fix tenant email campaigns to resolve secondary recipients from `lease_tenant_memberships` (plus linked portal users), and remove all `legacy_jsonb` / JSONB fallback paths from contact resolution and admin display. Occupancy names and unit search (S4 partial) are already shipped.

**Related code today**

- Parent roadmap: [`docs/SECONDARY_TENANT_IDENTITY.md`](SECONDARY_TENANT_IDENTITY.md) (S4 checklist, S5 follow-up)
- Campaign service: [`apps/server/src/services/tenant-email-campaign-service.ts`](apps/server/src/services/tenant-email-campaign-service.ts) — loads active leases, calls shared resolver
- Campaign resolver (broken for secondaries post-v63): [`packages/shared/src/tenant-email-recipient-resolver.ts`](packages/shared/src/tenant-email-recipient-resolver.ts) — loops `lease.secondaryTenants` (always `[]` from mapper)
- Secondary contact resolver: [`packages/shared/src/lease-secondary-tenant-contact.ts`](packages/shared/src/lease-secondary-tenant-contact.ts) — merges `jsonbOrphans` with `source: legacy_jsonb`
- Server detail contacts: [`apps/server/src/services/resolve-secondary-tenant-contacts-service.ts`](apps/server/src/services/resolve-secondary-tenant-contacts-service.ts) — passes `longStay.secondaryTenants` as orphans
- Admin display fallback: [`apps/admin/src/lib/resolve-secondary-tenant-contacts-for-display.ts`](apps/admin/src/lib/resolve-secondary-tenant-contacts-for-display.ts)
- Admin tenants UI: [`apps/admin/src/components/leases/lease-tenants-section.tsx`](apps/admin/src/components/leases/lease-tenants-section.tsx) — `legacy-jsonb-${index}` keys
- Membership DB: [`apps/server/src/db/lease-tenant-memberships.ts`](apps/server/src/db/lease-tenant-memberships.ts) — `loadSecondaryMembershipsForLease`, batch name loader from S4
- Occupancy helper: [`packages/shared/src/lease-tenant-utils.ts`](packages/shared/src/lease-tenant-utils.ts) — still falls back to `secondaryTenants` when `secondaryOccupantNames` absent
- Mapper stub: [`apps/server/src/db/mappers.ts`](apps/server/src/db/mappers.ts) — `secondaryTenants: []` via `parseSecondaryTenants`
- Campaign phases (original design): [`docs/TENANT_EMAIL_CAMPAIGN_PHASES.md`](TENANT_EMAIL_CAMPAIGN_PHASES.md)

---

## Goals

- **Email campaigns** include secondary tenants from membership rows on active leases (listed, pending, active linked users).
- **Remove legacy merge** — no `jsonbOrphans`, no `legacy_jsonb` source, no admin JSONB fallback.
- **Single resolution path** — campaigns and lease detail both derive secondary contacts from memberships + linked `tenant_users`.
- **Tests and docs** updated so S4 exit criteria in the parent doc can be checked off.

## Non-goals (this slice)

- **Drift check** (JSONB vs membership) — N/A after migration v63 dropped `secondary_tenants`; skip rather than implement.
- **S5 full cleanup** — removing `secondaryTenants` from `IPropertyLongStay`, dropping `parseSecondaryTenants`, removing `secondaryIndexes` from invite contract.
- **Primary tenant contact consolidation** — campaigns keep using `tenantEmail` / `guestName` on the lease row.
- **New migrations** — membership schema is already correct.

---

## Guiding principles

1. **Memberships are the only secondary source** — post-v63, JSONB is gone; fallbacks hide bugs and leave campaigns broken.
2. **Server batch-loads, shared resolves** — match existing patterns (`resolve-secondary-tenant-contacts-service`, list hydration); avoid N+1 membership queries per lease in campaigns.
3. **Reuse contact resolution** — campaigns should consume `ILeaseSecondaryTenantContact.effectiveEmail` / `effectiveName`, not duplicate membership join logic in shared code.
4. **DRY the server loader** — one batch helper used by campaigns and refactored single-lease detail path.
5. **Deploy server before admin** — admin fallback removal is safe once detail API always returns `secondaryTenantContacts` (true since S3a).

---

## Target architecture

```
Campaign preview/create
  → listByProperty (active leases)
  → loadSecondaryTenantContactsByLeaseIds(leaseIds)   [NEW batch server helper]
       → load memberships (WHERE lease_id = ANY)
       → batch load tenant_users
       → resolveSecondaryTenantContactsForLease per lease (memberships only)
  → resolveTenantEmailRecipients(leases, secondaryContactsByLeaseId)   [UPDATED shared]
       → primary from lease.tenantEmail
       → secondary from contact.effectiveEmail / effectiveName
       → dedupe + skip rules unchanged

Lease detail (simplified)
  → loadSecondaryMembershipsForLease
  → resolveSecondaryTenantContactsForLease({ memberships, tenantUsersById })   [no jsonbOrphans]
```

### Permissions

No change — campaigns already gated by `canSendTenantNotifications` (owner or platform admin).

### Feature flag

N/A — behavior fix, not a new surface.

---

## Data model (sketch)

No schema changes.

| Source | Secondary recipient email |
| --- | --- |
| Listed / pending membership | `invite_email` on row |
| Active linked secondary | Verified `tenant_users.email` (via existing `resolveSecondaryTenantContact`) |
| Name-only secondary (null email) | Skipped with reason `"Missing email address"` |

---

## Shared contract (`packages/shared`)

| Change | Purpose |
| --- | --- |
| `resolveTenantEmailRecipients(leases, secondaryContactsByLeaseId?)` | Second arg: `ReadonlyMap<string, readonly Pick<ILeaseSecondaryTenantContact, "effectiveEmail" \| "effectiveName">[]>` |
| Remove `secondaryTenants` from `leases` pick type | Resolver no longer reads JSONB field |
| `IResolveSecondaryTenantContactsForLeaseInput` | Remove `jsonbOrphans` |
| `TSecondaryTenantContactSource` | Remove `"legacy_jsonb"` |
| Delete `mapLegacyJsonbSecondaryTenantToContact` | No callers after admin fallback removal |

---

## API (sketch)

No route or response shape changes.

| Path | Notes |
| --- | --- |
| `POST .../tenant-email-campaigns/preview` | Secondary recipients appear when memberships have deliverable email |
| `POST .../tenant-email-campaigns` | Same resolution at create time |

---

## Phased rollout

### Phase 1 — Batch secondary contact loader (server)

**Goal:** One reusable server function to resolve secondary contacts for many leases in two DB round-trips.

**New file:** [`apps/server/src/services/load-secondary-tenant-contacts-by-lease-ids.ts`](apps/server/src/services/load-secondary-tenant-contacts-by-lease-ids.ts)

- [x] Export `loadSecondaryTenantContactsByLeaseIds(leaseIds: string[]): Promise<Map<string, ILeaseSecondaryTenantContact[]>>`
- [x] Query all non-terminal secondary memberships for `lease_id = ANY($1)` (reuse status filter from `loadSecondaryMembershipsForLease`)
- [x] Collect distinct `tenant_user_id`s; batch-load via `tenantUsersDb` (parallel `findById` or add batch helper if one exists)
- [x] Group memberships by `leaseId`; call `resolveSecondaryTenantContactsForLease({ memberships, tenantUsersById })` per group
- [x] Return empty map entry or omit key for leases with no secondaries
- [x] Unit tests with mocked DB modules

**Refactor:** [`resolve-secondary-tenant-contacts-service.ts`](apps/server/src/services/resolve-secondary-tenant-contacts-service.ts)

- [x] `resolveSecondaryTenantContactsForLongStay` delegates to batch loader with `[longStay.id]` (or inline shared grouping logic via extracted private helper)

**Exit criteria:** Batch loader tests pass; single-lease detail behavior unchanged.

---

### Phase 2 — Campaign recipient resolver (shared)

**Goal:** Shared resolver accepts pre-resolved secondary contacts; stop reading `lease.secondaryTenants`.

**Update:** [`packages/shared/src/tenant-email-recipient-resolver.ts`](packages/shared/src/tenant-email-recipient-resolver.ts)

- [ ] Add optional `secondaryContactsByLeaseId` parameter
- [ ] For each active lease, iterate contacts from map (default empty array)
- [ ] Use `effectiveEmail` and `effectiveName` in `pushRecipient`
- [ ] Remove `secondaryTenants` loop and from lease pick type
- [ ] Keep primary path, dedupe, skip reasons unchanged

**Tests:** [`packages/shared/src/tenant-email-recipient-resolver.test.ts`](packages/shared/src/tenant-email-recipient-resolver.test.ts)

- [ ] Secondary from membership listed email
- [ ] Secondary from linked active user email (contacts pre-built with `effectiveEmail` from user)
- [ ] Name-only secondary → skipped
- [ ] Duplicate email across leases → second skipped
- [ ] Empty map → primary-only audience (regression)

**Exit criteria:** Shared tests green; no references to `secondaryTenants` in resolver.

---

### Phase 3 — Wire campaigns (server)

**Goal:** Preview and create use membership-based secondary resolution.

**Update:** [`apps/server/src/services/tenant-email-campaign-service.ts`](apps/server/src/services/tenant-email-campaign-service.ts)

- [ ] After `listByProperty`, call `loadSecondaryTenantContactsByLeaseIds(leases.map((l) => l.id))`
- [ ] Pass map into `resolveTenantEmailRecipients(leases, secondaryContactsByLeaseId)` in both preview and create paths

**Tests:** Extend campaign service tests (or integration-style unit tests) verifying secondaries appear in preview when memberships exist.

**Exit criteria:** Manual/staging preview shows secondary emails; no dependency on `secondaryTenants` field.

---

### Phase 4 — Remove legacy JSONB merge (shared + server)

**Goal:** Contact resolution is membership-only end-to-end.

**Update:** [`packages/shared/src/lease-secondary-tenant-contact.ts`](packages/shared/src/lease-secondary-tenant-contact.ts)

- [ ] Remove `jsonbOrphans` from input interface
- [ ] Remove orphan merge loop in `resolveSecondaryTenantContactsForLease`
- [ ] Remove `mapLegacyJsonbSecondaryTenantToContact`
- [ ] Remove `"legacy_jsonb"` from `TSecondaryTenantContactSource`

**Update:** [`resolve-secondary-tenant-contacts-service.ts`](apps/server/src/services/resolve-secondary-tenant-contacts-service.ts)

- [ ] Stop passing `longStay.secondaryTenants`

**Tests:**

- [ ] [`packages/shared/src/lease-secondary-tenant-contact.test.ts`](packages/shared/src/lease-secondary-tenant-contact.test.ts) — delete legacy JSONB cases
- [ ] [`apps/server/src/services/resolve-secondary-tenant-contacts-service.test.ts`](apps/server/src/services/resolve-secondary-tenant-contacts-service.test.ts) — delete orphan merge expectations

**Exit criteria:** `rg legacy_jsonb|jsonbOrphans|mapLegacyJsonb` returns no production code (tests/docs except historical notes).

---

### Phase 5 — Remove admin fallbacks

**Goal:** Admin trusts API `secondaryTenantContacts` only.

**Update:** [`apps/admin/src/lib/resolve-secondary-tenant-contacts-for-display.ts`](apps/admin/src/lib/resolve-secondary-tenant-contacts-for-display.ts)

- [ ] Return `apiContacts ?? []`; delete JSONB fallback block and `mapLegacyJsonbSecondaryTenantToContact` import
- [ ] `getSecondaryPortalActingMembershipId`: require `contact.membershipId`; throw or assert if null (all S3a+ secondaries have ids)
- [ ] Simplify `resolveSecondaryPortalMembershipForContact` if email-only fallback was only for legacy rows

**Update:** [`apps/admin/src/components/leases/lease-tenants-section.tsx`](apps/admin/src/components/leases/lease-tenants-section.tsx)

- [ ] List keys: `contact.membershipId` only (remove `legacy-jsonb-${index}`)

**Update:** [`apps/admin/src/hooks/use-property-long-stay-detail.ts`](apps/admin/src/hooks/use-property-long-stay-detail.ts) if call site comments reference fallback

**Tests:** [`apps/admin/src/lib/resolve-secondary-tenant-contacts-for-display.test.ts`](apps/admin/src/lib/resolve-secondary-tenant-contacts-for-display.test.ts) — remove legacy JSONB cases

**Exit criteria:** Admin tenants section unchanged for membership-only leases; no JSONB fallback code paths.

---

### Phase 6 — Cleanup & docs

**Goal:** Tighten remaining stubs; update parent roadmap.

**Optional same PR:**

- [ ] [`packages/shared/src/lease-tenant-utils.ts`](packages/shared/src/lease-tenant-utils.ts) — `getLeaseOccupancyNames`: use `secondaryOccupantNames ?? []` only; drop `secondaryTenants` fallback
- [ ] [`docs/SECONDARY_TENANT_IDENTITY.md`](SECONDARY_TENANT_IDENTITY.md) S4 checkboxes:
  - [x] Campaign secondary recipients via memberships
  - [x] Legacy merge removal (note drift check **N/A post-v63**)
- [ ] [`docs/TENANT_EMAIL_CAMPAIGN_PHASES.md`](TENANT_EMAIL_CAMPAIGN_PHASES.md) — update "Recipient resolution" line to reference memberships, not `secondaryTenants`

**Deferred to S5:**

- Remove `IPropertyLongStay.secondaryTenants` from types
- Remove `parseSecondaryTenants` from mapper
- Remove `secondaryIndexes` from invite contract

**Exit criteria:** Parent S4 exit met; campaign docs accurate.

---

## Deploy order

1. **Server** — Phases 1–4 + 3 (campaign wiring + merge removal). Campaigns fixed immediately; detail API unchanged for clients.
2. **Admin** — Phase 5 (fallback removal). Safe after server ships S3a detail contacts (already in prod).

No migration. No coordinated flag.

---

## Verification checklist

| Scenario | Expected |
| --- | --- |
| Active lease, listed secondary with email | Campaign preview includes secondary recipient |
| Active lease, linked secondary (portal user) | Campaign uses linked user email |
| Secondary with no email | Appears in **skipped**, not recipients |
| Duplicate email (primary + secondary or two secondaries) | Second entry skipped with dedupe reason |
| Lease detail tenants section | Same contacts as before for membership-only data |
| Grep for `legacy_jsonb`, `jsonbOrphans` | Zero hits in `apps/` and `packages/` (excluding this doc / parent history) |

**Commands:**

```bash
cd packages/shared && bun test src/tenant-email-recipient-resolver.test.ts src/lease-secondary-tenant-contact.test.ts
cd apps/server && bun test src/services/resolve-secondary-tenant-contacts-service.test.ts
cd apps/admin && bun test src/lib/resolve-secondary-tenant-contacts-for-display.test.ts
```

---

## What not to do

- Do **not** reintroduce JSONB reads — the column is dropped; fallbacks mask the campaign bug.
- Do **not** implement a drift check against JSONB — nothing to compare after v63.
- Do **not** duplicate membership→email logic inside `resolveTenantEmailRecipients` — use `ILeaseSecondaryTenantContact` from the server batch loader.
- Do **not** N+1 query memberships per lease in campaign create — use the batch loader.
- Do **not** fold S5 type removal into this PR — keep scope to S4 exit; S5 is a separate migration/doc pass.
- Do **not** change campaign permissions, SES path, or queue behavior — recipient resolution only.

---

## Safest sequencing summary

1. **Batch loader + tests first** — unblocks campaigns and DRYs detail resolution.
2. **Shared resolver second** — contract change with tests before server wiring.
3. **Campaign service third** — user-visible fix once resolver accepts the map.
4. **Remove legacy merge fourth** — shared + server; grep confirms no orphans path.
5. **Admin fallback removal last** — after server merge removal is deployed.
6. **Docs + occupancy fallback cleanup** — same release or immediate follow-up PR.

---

## Suggested commits

1. `feat: resolve campaign secondary recipients from memberships`
2. `refactor: remove legacy JSONB secondary tenant fallbacks`
