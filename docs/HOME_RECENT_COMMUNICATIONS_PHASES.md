# Home Recent Communications — Implementation Phases

Replace the Home hub **Suggested** column with **recent tenant email campaigns** (Communications tab sends) across properties the user can send from. Tab rename is out of scope — keep internal route/label **Communications** for now.

**Related code today**

- Home hub: [`apps/admin/src/components/home/home-workspace-hub.tsx`](../apps/admin/src/components/home/home-workspace-hub.tsx)
- Suggested column (to replace): [`apps/admin/src/components/home/home-suggested-column.tsx`](../apps/admin/src/components/home/home-suggested-column.tsx)
- Column shell: [`apps/admin/src/components/home/home-column-panel.tsx`](../apps/admin/src/components/home/home-column-panel.tsx)
- Per-property campaigns API: [`apps/server/src/routes/admin/property-tenant-email-campaign-routes.ts`](../apps/server/src/routes/admin/property-tenant-email-campaign-routes.ts)
- Campaign DB: [`apps/server/src/db/property-tenant-email-campaigns.ts`](../apps/server/src/db/property-tenant-email-campaigns.ts)
- Home route pattern: [`apps/server/src/routes/admin/home-routes.ts`](../apps/server/src/routes/admin/home-routes.ts)
- Campaign deep link: [`apps/admin/src/lib/notification-routing.ts`](../apps/admin/src/lib/notification-routing.ts)
- Permissions: [`apps/admin/src/hooks/use-property-permissions.ts`](../apps/admin/src/hooks/use-property-permissions.ts) (`canSendTenantNotifications`)

---

## Goals

- Show up to **6 most recent** tenant email campaigns on Home idle state (newest first).
- Row click opens the property Communications tab with the campaign detail sheet (`?campaignId=`).
- Match existing column density: icon + breadcrumb-style label + chevron; loading / error / empty parity with Properties column.
- **Owner, property creator, and platform admin** only — same gate as the Communications tab.

## Non-goals

- Renaming **Communications** → Tenant emails / Announcements (separate pass).
- Portfolio-wide Communications index page or header chevron destination.
- Managers / accountants seeing campaigns they cannot open.
- Client-side fan-out (N per-property list requests).
- Scheduled sends, drafts, or compose-from-Home.

## Guiding principles

1. **One home endpoint** — mirror `/home/financial-overview`; do not N+1 per property from the client.
2. **Postgres is source of truth** — join campaigns to accessible properties; order by `created_at DESC`.
3. **Reuse column chrome** — `HomeColumnPanel` / `HomeColumnRow`; no new card patterns.
4. **Same auth as send** — reuse `assertPropertyTenantNotificationAccess` rules server-side.
5. **Invalidate on change** — home list refreshes after send + SSE terminal updates.

---

## Phase 0a — Shared contract + DB query

**Files (4)**

- [x] Add [`packages/shared/src/home-recent-tenant-email-campaigns-types.ts`](../packages/shared/src/home-recent-tenant-email-campaigns-types.ts) — `IHomeRecentTenantEmailCampaign`, `IHomeRecentTenantEmailCampaignsResponse`, default limit constant
- [x] Export from [`packages/shared/src/index.ts`](../packages/shared/src/index.ts)
- [x] Add `listRecentForAccessibleProperties(userId, isAdmin, limit)` to [`apps/server/src/db/property-tenant-email-campaigns.ts`](../apps/server/src/db/property-tenant-email-campaigns.ts) — join `properties`, filter owner/creator/admin, select `campaign` fields + `property.name`, exclude bodies
- [x] Add [`apps/server/src/db/property-tenant-email-campaigns-recent.test.ts`](../apps/server/src/db/property-tenant-email-campaigns-recent.test.ts) — ordering, limit, excludes manager-only properties

**Exit criteria:** DB helper returns correct rows for owner vs manager fixtures; shared types compile on server and admin.

---

## Phase 0b — Home API route

**Files (2)**

- [x] Extend [`apps/server/src/routes/admin/home-routes.ts`](../apps/server/src/routes/admin/home-routes.ts) — `GET /home/recent-tenant-email-campaigns?limit=6`
- [x] Add [`apps/server/src/routes/admin/home-recent-tenant-email-campaigns.test.ts`](../apps/server/src/routes/admin/home-recent-tenant-email-campaigns.test.ts) — auth required, empty portfolio, capped limit

**Exit criteria:** Authenticated owner receives merged recent list; unauthenticated 401; manager with no owner properties gets `[]`.

---

## Phase 1 — Admin data layer

**Files (5)**

- [x] Add `homeRecentTenantEmailCampaigns` to [`apps/admin/src/lib/query-keys.ts`](../apps/admin/src/lib/query-keys.ts)
- [x] Add `recentTenantEmailCampaigns()` to [`apps/admin/src/lib/api-client.ts`](../apps/admin/src/lib/api-client.ts) (`homeApi`)
- [x] Add [`apps/admin/src/lib/home-recent-communications-utils.ts`](../apps/admin/src/lib/home-recent-communications-utils.ts) — `buildHomeCommunicationsCampaignHref`, row label helper, in-progress status check
- [x] Add [`apps/admin/src/lib/home-recent-communications-utils.test.ts`](../apps/admin/src/lib/home-recent-communications-utils.test.ts)
- [x] Add [`apps/admin/src/hooks/use-home-recent-communications.ts`](../apps/admin/src/hooks/use-home-recent-communications.ts) — TanStack Query, stale time aligned with home workspace properties

**Exit criteria:** Hook fetches typed list; utils tested; no UI yet.

---

## Phase 2 — Home Communications column

**Files (2)**

- [x] Add [`apps/admin/src/components/home/home-communications-column.tsx`](../apps/admin/src/components/home/home-communications-column.tsx) — `Mail` icon, `{propertyName} / {subject}` truncate, optional status hint for `Sending` / `Queued`, skeleton + error/retry + empty states (mirror Properties column)
- [x] Swap `<HomeSuggestedColumn />` → `<HomeCommunicationsColumn />` in [`apps/admin/src/components/home/home-workspace-hub.tsx`](../apps/admin/src/components/home/home-workspace-hub.tsx)

**Exit criteria:** Home idle grid shows recent campaigns; row navigates to `/properties/{id}/communications?campaignId={id}`.

---

## Phase 3 — Visibility + edge cases

**Files (3)**

- [x] Gate fetch in [`apps/admin/src/hooks/use-home-recent-communications.ts`](../apps/admin/src/hooks/use-home-recent-communications.ts) — `enabled` when user may have send access (platform admin or any owner/creator property in workspace list)
- [x] Hide column in [`apps/admin/src/components/home/home-communications-column.tsx`](../apps/admin/src/components/home/home-communications-column.tsx) when user has **no** send-eligible properties (manager/accountant-only) — render `null` so grid becomes two columns
- [x] Document role matrix in this file (see **Visibility matrix** below)

**Exit criteria:** Manager/accountant Home shows Properties + Continue only; owners see three columns; no 403 deep links.

### Visibility matrix

Client gating uses `hasHomeRecentCommunicationsSendAccess()` over the Home workspace property list (`derivePropertyPermissionsFromListItem(...).canSendTenantNotifications`), matching the Communications tab and server-side owner/creator/admin rules.

| Caller                    | Column shown | Data                                          |
| ------------------------- | ------------ | --------------------------------------------- |
| Platform admin            | Yes          | Recent campaigns across accessible properties |
| Property owner / creator  | Yes          | Campaigns for owned/created properties        |
| Manager / accountant only | Hidden       | —                                             |

---

## Phase 4 — Cache freshness

**Files (3)**

- [ ] Invalidate `homeRecentTenantEmailCampaigns` in [`apps/admin/src/lib/notification-stream-handlers.ts`](../apps/admin/src/lib/notification-stream-handlers.ts) on `tenant_email_campaign.updated` (especially terminal statuses)
- [ ] Invalidate on successful create in [`apps/admin/src/components/communications/tenant-email-compose-card.tsx`](../apps/admin/src/components/communications/tenant-email-compose-card.tsx)
- [ ] Extend [`apps/admin/src/lib/notification-stream-handlers.test.ts`](../apps/admin/src/lib/notification-stream-handlers.test.ts) — home query invalidated on campaign update

**Exit criteria:** New send appears on Home after compose; completed send updates without full page reload.

---

## Phase 5 — Remove Suggested column code

**Files (4)**

- [ ] Delete [`apps/admin/src/components/home/home-suggested-column.tsx`](../apps/admin/src/components/home/home-suggested-column.tsx)
- [ ] Delete [`apps/admin/src/lib/home-suggested-nav-items.ts`](../apps/admin/src/lib/home-suggested-nav-items.ts)
- [ ] Delete [`apps/admin/src/lib/home-suggested-nav-items.test.ts`](../apps/admin/src/lib/home-suggested-nav-items.test.ts)
- [ ] Append completion note to [`docs/HOME_WORKSPACE_UI_POLISH_PHASES.md`](../docs/HOME_WORKSPACE_UI_POLISH_PHASES.md) — Suggested → Recent Communications

**Exit criteria:** `rg HomeSuggested|home-suggested-nav` returns zero hits; lint/build pass.

---

## Row content (locked for v1)

| Element        | Treatment                                                            |
| -------------- | -------------------------------------------------------------------- |
| Column title   | **Communications** (rename later)                                    |
| Header chevron | None in v1 (no portfolio destination)                                |
| Row primary    | Truncated email subject                                              |
| Row secondary  | Muted property name prefix: `{propertyName} / {subject}`             |
| In-progress    | Subtle status text or reuse `TenantEmailCampaignStatusBadge` compact |
| Cap            | 6 rows                                                               |
| Empty          | `No tenant emails yet.`                                              |

---

## What not to do

- Do not fan out `tenantEmailCampaignsApi.list()` per property from Home.
- Do not show campaigns to users who cannot open the Communications tab.
- Do not add a new migration — query existing `property_tenant_email_campaigns`.
- Do not block on Communications tab rename.
- Do not reintroduce Suggested nav as a fallback inside the Communications column.

## Safest sequencing

1. Phase 0a → 0b (API provable via tests)
2. Phase 1 (hook + utils)
3. Phase 2 (visible MVP)
4. Phase 4 (live updates)
5. Phase 3 (role hiding — can ship with Phase 2 if hook `enabled` is simple)
6. Phase 5 (delete Suggested)

**Recommended MVP slice:** 0a + 0b + 1 + 2 + 5.
