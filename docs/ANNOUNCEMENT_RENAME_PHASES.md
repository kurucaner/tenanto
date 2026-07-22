# Communications → Announcements — Implementation Phases

Rename the admin product surface **Communications** to **Announcements** across the operator UI (tab name, page name, routes, Home hub column, deep links). The underlying feature remains **tenant email campaigns** on the server. This plan is **admin + routing only** — no Postgres migration, no shared contract rename, no API path changes.

Work is split into **four optional scopes** (Phases 1–4). Ship Phase 1 alone for a quick win; add Phase 2 when URL consistency matters; add Phase 3 only if internal code clarity is worth the churn; add Phase 4 for docs alignment and optional bookmark redirects.

---

## What does not need to change (backend)

The server already uses domain-accurate names, not "Communications". **No backend migration is required** for this rename.

| Layer            | Current name                                     | Action          |
| ---------------- | ------------------------------------------------ | --------------- |
| API routes       | `/properties/:propertyId/tenant-email-campaigns` | Keep            |
| DB tables        | `property_tenant_email_campaigns`, …             | Keep            |
| Shared types     | `IHomeRecentTenantEmailCampaign`, …              | Keep            |
| Workers / queues | `tenant-email-*`                                 | Keep            |
| Permissions      | `canSendTenantNotifications`                     | Keep (internal) |
| Home API         | `GET /home/recent-tenant-email-campaigns`        | Keep            |

**Related server code (unchanged):**

- [`apps/server/src/routes/admin/property-tenant-email-campaign-routes.ts`](../apps/server/src/routes/admin/property-tenant-email-campaign-routes.ts)
- [`apps/server/src/routes/admin/home-routes.ts`](../apps/server/src/routes/admin/home-routes.ts) (recent campaigns endpoint)
- [`apps/server/src/db/property-tenant-email-campaigns.ts`](../apps/server/src/db/property-tenant-email-campaigns.ts)

---

## What to change (admin only)

The **single source of truth** for tab label and path is:

[`apps/admin/src/config/property-shell-tabs.ts`](../apps/admin/src/config/property-shell-tabs.ts)

```ts
{ label: "Communications", path: "communications" }, // today
{ label: "Announcements", path: "announcements" }, // target (Phase 2+)
```

Everything else flows from that, directly or indirectly.

**Related admin code today:**

- Tab visibility: [`apps/admin/src/lib/property-shell-tab-visibility.ts`](../apps/admin/src/lib/property-shell-tab-visibility.ts)
- Admin router: [`apps/admin/src/app/router.tsx`](../apps/admin/src/app/router.tsx)
- Property page: [`apps/admin/src/pages/property-communications-page.tsx`](../apps/admin/src/pages/property-communications-page.tsx)
- UI components: [`apps/admin/src/components/communications/`](../apps/admin/src/components/communications/)
- Home column: [`apps/admin/src/components/home/home-communications-column.tsx`](../apps/admin/src/components/home/home-communications-column.tsx)
- Home hook + utils: [`apps/admin/src/hooks/use-home-recent-communications.ts`](../apps/admin/src/hooks/use-home-recent-communications.ts), [`apps/admin/src/lib/home-recent-communications-utils.ts`](../apps/admin/src/lib/home-recent-communications-utils.ts)
- Deep links: [`apps/admin/src/lib/notification-routing.ts`](../apps/admin/src/lib/notification-routing.ts), [`apps/admin/src/lib/notification-stream-handlers.ts`](../apps/admin/src/lib/notification-stream-handlers.ts)
- Launcher / command palette: [`apps/admin/src/lib/property-launcher-destinations.ts`](../apps/admin/src/lib/property-launcher-destinations.ts) (labels derive from `PROPERTY_SHELL_TABS`)
- Continue column tab labels: [`apps/admin/src/lib/home-workspace-continue-utils.ts`](../apps/admin/src/lib/home-workspace-continue-utils.ts) (reads `PROPERTY_SHELL_TABS`)
- Release notes: [`apps/admin/src/config/release-notes.ts`](../apps/admin/src/config/release-notes.ts)
- Prior rename reference (different target name): [`docs/REVENUE_NOTIFICATIONS_RENAME_PHASES.md`](./REVENUE_NOTIFICATIONS_RENAME_PHASES.md)

---

## Goals

- Operators see **Announcements** instead of **Communications** in the property shell, Home hub, command palette, and in-app copy.
- (Phase 2+) URLs use `/properties/:id/announcements` instead of `/communications`.
- (Phase 3+) File paths, folders, hooks, and helpers use **announcement** vocabulary where they today say **communications**.
- All admin tests and `bun run lint` / `build:admin` pass after each shipped phase.

## Non-goals

- Renaming **tenant email campaign** backend symbols (`property_tenant_email_campaigns`, `tenant-email-campaigns` API segment, worker queue names).
- Changing `packages/shared` types (`IHomeRecentTenantEmailCampaign`, etc.) — already transport-accurate.
- SMS, push, or two-way messaging under the Announcements tab (future product scope).
- Rewriting historical release-notes bullets (optional doc pass only).
- Marketing site generic English (“resident communications” on landing pages) — not the product tab name.
- Automatic redirects from old `/communications` URLs (optional Phase 4 add-on).

## Guiding principles

1. **Single source for tab label + path** — update `PROPERTY_SHELL_TABS` first; launcher and palette labels follow automatically.
2. **User-facing before internal** — Phase 1 ships value without file moves; Phase 3 is optional polish.
3. **Path and label move together in Phase 2** — every hard-coded `/communications` string must be updated in the same PR as the router path.
4. **No dual naming** — avoid keeping `buildHomeCommunicationsCampaignHref` as an alias; rename once in Phase 3.
5. **Backend unchanged** — if a change touches `apps/server` routes or DB, it is out of scope for this rename.

---

## Target naming map

| Before                                                                | After (target)                                                                     |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Tab label: **Communications**                                         | Tab label: **Announcements**                                                       |
| Route segment: `communications`                                       | Route segment: **`announcements`** (plural; matches `units`, `leases`, `expenses`) |
| Home column title: **Communications**                                 | **Announcements**                                                                  |
| Empty-state tooltip: “Create a property first to send tenant emails.” | Keep or tweak to “…send an announcement.” (copy-only)                              |
| Folder: `components/communications/`                                  | `components/announcements/` (Phase 3)                                              |
| Page: `property-communications-page.tsx`                              | `property-announcements-page.tsx` (Phase 3)                                        |
| API: `…/tenant-email-campaigns`                                       | **unchanged**                                                                      |

**Decision:** Tab label is **Announcements**; URL path is **announcements** (plural, consistent with other shell tabs).

---

## Scope overview

| Phase | Scope                       | Effort                 | User-visible?    | Server / DB? |
| ----- | --------------------------- | ---------------------- | ---------------- | ------------ |
| **1** | UI copy only                | ~1–2 hours             | Yes              | No           |
| **2** | URL path + link builders    | ~half day              | Yes (URLs)       | No           |
| **3** | Files, folders, identifiers | ~1 day                 | No (internal)    | No           |
| **4** | Docs + optional redirect    | ~1–2 hours             | Docs / bookmarks | No           |
| —     | Server / shared contract    | **N/A — out of scope** | —                | —            |

---

## Phase 1 — UI copy only

**Goal:** Operators see **Announcements** everywhere in the UI while URLs stay `/communications` (no broken bookmarks, no router change).

**Files (~6)**

- [x] [`apps/admin/src/config/property-shell-tabs.ts`](../apps/admin/src/config/property-shell-tabs.ts) — `label: "Announcements"` (keep `path: "communications"` for this phase)
- [x] [`apps/admin/src/components/home/home-communications-column.tsx`](../apps/admin/src/components/home/home-communications-column.tsx) — column title `"Announcements"`; update `COMMUNICATIONS_TAB` label constant; adjust empty tooltip copy if desired
- [x] [`apps/admin/src/config/release-notes.ts`](../apps/admin/src/config/release-notes.ts) — replace “Communications tab” with “Announcements tab” in current-version bullet(s) only (optional: leave historical bullets)
- [x] [`apps/admin/src/lib/property-launcher-destinations.test.ts`](../apps/admin/src/lib/property-launcher-destinations.test.ts) — assertions on label `"Communications"` → `"Announcements"` (paths still `communications`)
- [x] Grep admin for remaining user-visible **Communications** strings (page headings, aria labels, toast copy in tenant-email components) and update
- [x] Run `cd apps/admin && bun run lint && bun run build`

**Exit criteria**

- Property shell tab reads **Announcements**; URL is still `…/communications`.
- Home hub third column header reads **Announcements**.
- Command palette property actions show **Announcements** (derived from tab config).
- Continue column shows **Announcements** when resuming a saved recent path under that tab (via `PROPERTY_SHELL_TABS` label).
- No changes under `apps/server/` or `packages/shared/`.
- Admin lint + build pass.

---

## Phase 2 — URL path + deep links

**Goal:** Route segment becomes **`announcements`**; all in-app navigation and notification deep links use the new path.

**Depends on:** Phase 1 (label already says Announcements).

**Files (~12)**

- [ ] [`apps/admin/src/config/property-shell-tabs.ts`](../apps/admin/src/config/property-shell-tabs.ts) — `path: "announcements"`
- [ ] [`apps/admin/src/app/router.tsx`](../apps/admin/src/app/router.tsx) — child route `announcements` (remove or redirect old `communications` — see Phase 4)
- [ ] [`apps/admin/src/lib/property-shell-tab-visibility.ts`](../apps/admin/src/lib/property-shell-tab-visibility.ts) — guard `tab.path === "announcements"`
- [ ] [`apps/admin/src/lib/property-launcher-destinations.ts`](../apps/admin/src/lib/property-launcher-destinations.ts) — metadata key `announcements:` (replace `communications:`); search terms: `announcement`, `announcements`
- [ ] [`apps/admin/src/lib/home-recent-communications-utils.ts`](../apps/admin/src/lib/home-recent-communications-utils.ts) — href builder returns `…/announcements?campaignId=…`
- [ ] [`apps/admin/src/lib/notification-routing.ts`](../apps/admin/src/lib/notification-routing.ts) — tenant email campaign notification path
- [ ] [`apps/admin/src/lib/notification-stream-handlers.ts`](../apps/admin/src/lib/notification-stream-handlers.ts) — pathname check for live tab refetch (`announcementsPath`, rename locals)
- [ ] [`apps/admin/src/components/home/home-communications-column.tsx`](../apps/admin/src/components/home/home-communications-column.tsx) — tab path constant → `"announcements"`
- [ ] [`apps/admin/src/pages/property-communications-page.tsx`](../apps/admin/src/pages/property-communications-page.tsx) — any redirect or `Navigate` targets using old path
- [ ] Tests: [`home-recent-communications-utils.test.ts`](../apps/admin/src/lib/home-recent-communications-utils.test.ts), [`notification-routing.test.ts`](../apps/admin/src/lib/notification-routing.test.ts), [`notification-stream-handlers.test.ts`](../apps/admin/src/lib/notification-stream-handlers.test.ts), [`property-shell-tab-visibility.test.ts`](../apps/admin/src/lib/property-shell-tab-visibility.test.ts), [`property-launcher-destinations.test.ts`](../apps/admin/src/lib/property-launcher-destinations.test.ts)
- [ ] Grep repo for `/communications` and `path === "communications"` in admin; fix stragglers
- [ ] Run `cd apps/admin && bun run lint && bun run build`

**Side effects to handle**

- **Recent properties in localStorage** may store `lastPath: "/communications"`. After Phase 2, `buildPropertyResumePath` in [`apps/admin/src/lib/property-switch-navigation.ts`](../apps/admin/src/lib/property-switch-navigation.ts) won't match that suffix and will fall back to Overview. Consider a Phase 4 redirect or a one-time migration of stored paths.
- Old `/communications` URLs will **404** unless Phase 4 redirect is added.

**Exit criteria**

- Navigating to `/properties/:id/announcements` loads the tenant email campaign page.
- Home recent row, notification bell, and SSE handlers open `…/announcements?campaignId=…`.
- Tab visibility and launcher tests use `announcements` path segment.
- Old `/communications` URLs **404** unless Phase 4 redirect is added.

---

## Phase 3 — Files, folders, and code identifiers

**Goal:** Internal admin code matches **announcement** vocabulary; no user-facing change beyond Phases 1–2.

**Depends on:** Phase 2 complete (paths stable before large file moves).

**Renames (representative)**

| Before                                  | After                                  |
| --------------------------------------- | -------------------------------------- |
| `components/communications/`            | `components/announcements/`            |
| `property-communications-page.tsx`      | `property-announcements-page.tsx`      |
| `PropertyCommunicationsPage`            | `PropertyAnnouncementsPage`            |
| `home-communications-column.tsx`        | `home-announcements-column.tsx`        |
| `HomeCommunicationsColumn`              | `HomeAnnouncementsColumn`              |
| `use-home-recent-communications.ts`     | `use-home-recent-announcements.ts`     |
| `home-recent-communications-utils.ts`   | `home-recent-announcements-utils.ts`   |
| `buildHomeCommunicationsCampaignHref`   | `buildHomeAnnouncementsCampaignHref`   |
| `hasHomeRecentCommunicationsSendAccess` | `hasHomeRecentAnnouncementsSendAccess` |
| `useHomeRecentCommunications`           | `useHomeRecentAnnouncements`           |

**Tasks**

- [ ] Move [`apps/admin/src/components/communications/`](../apps/admin/src/components/communications/) → `components/announcements/`; fix all imports (page, tests, cross-component imports)
- [ ] Rename page, home column, hook, and utils files as above; update exports and imports in [`home-workspace-hub.tsx`](../apps/admin/src/components/home/home-workspace-hub.tsx), [`router.tsx`](../apps/admin/src/app/router.tsx)
- [ ] Rename test files to match (`home-recent-announcements-utils.test.ts`)
- [ ] Update test `describe` / variable names (`communicationsPath` → `announcementsPath`)
- [ ] Grep admin for `communications` / `Communications` in identifiers; exclude comments in historical docs
- [ ] Run `cd apps/admin && bun run lint && bun run build`

**Exit criteria**

- No `components/communications/` directory remains.
- No imports from `*-communications-*` paths (except optional git history).
- Grep for `Communications` in `apps/admin/src` returns zero matches (or only intentional comments).
- Admin lint + build pass.

---

## Phase 4 — Docs alignment + optional redirect

**Goal:** Agent/human docs reflect **Announcements**; optionally preserve old bookmarks.

**Tasks**

- [ ] Update cross-references in [`docs/HOME_RECENT_COMMUNICATIONS_PHASES.md`](./HOME_RECENT_COMMUNICATIONS_PHASES.md), [`docs/TENANT_EMAIL_CAMPAIGN_PHASES.md`](./TENANT_EMAIL_CAMPAIGN_PHASES.md), [`docs/TENANT_EMAIL_CAMPAIGN_FAILURE_MODES.md`](./TENANT_EMAIL_CAMPAIGN_FAILURE_MODES.md), [`docs/HOME_WORKSPACE_LAUNCHER_PHASES.md`](./HOME_WORKSPACE_LAUNCHER_PHASES.md) — or add a one-line note at top pointing to this doc
- [ ] Update comment in [`apps/server/.env.example`](../apps/server/.env.example) — “Announcements tab” instead of “Communications tab”
- [ ] **Optional:** Add router redirect `communications` → `announcements` (preserve query string) for notification deep links and saved bookmarks
- [ ] **Optional:** Migrate stored `lastPath` values in recent-properties localStorage from `/communications` to `/announcements`
- [ ] **Optional:** Add redirect test in admin router tests if redirect is shipped

**Exit criteria**

- Docs no longer instruct agents to use **Communications** as the current product name.
- (If redirect shipped) `/properties/:id/communications?campaignId=x` lands on Announcements tab with sheet open.

---

## What not to do

- Do **not** rename Postgres tables or API segments to `announcements` — product label only.
- Do **not** ship Phase 2 without updating **every** `/communications` deep link (notifications, Home, SSE) in the same change.
- Do **not** leave `path: "communications"` in `PROPERTY_SHELL_TABS` after Phase 2 — tab config must match router.
- Do **not** rename files (Phase 3) before URL paths (Phase 2) — avoids double churn on href builders.
- Do **not** change generic marketing copy (“resident communications”) on `apps/web` unless deliberately repositioning the product.
- Do **not** fork dual helpers (`buildHomeCommunicationsCampaignHref` wrapping the new name) — rename once.
- Do **not** update historical release-notes bullets unless product/marketing asks for consistency.

---

## Recommended sequencing

1. **Phase 1 first** — instant UX win; zero routing risk.
2. **Phase 2 before Phase 3** — stabilize URLs, then move files.
3. **Single PR per phase** — easier review and rollback.
4. **Phase 4 redirect** — add if users may have saved `/communications` links or stored recent paths.
5. **Server stays untouched** — any server diff is a mistake for this rename.

---

## Verification checklist (all phases)

```bash
cd apps/admin && bun run lint && bun run build
rg 'communications|Communications' apps/admin/src   # after Phase 2, also: rg '/communications' apps/admin
cd apps/admin && bun test src/lib/home-recent-communications-utils.test.ts  # rename path after Phase 3
cd apps/admin && bun test src/lib/notification-routing.test.ts
cd apps/admin && bun test src/lib/property-shell-tab-visibility.test.ts
cd apps/admin && bun test src/lib/property-launcher-destinations.test.ts
```

**Manual smoke**

1. Property shell shows **Announcements** tab; compose + history work.
2. Home **Announcements** column rows open correct property tab with `campaignId`.
3. Notification for finished campaign opens Announcements tab (Phase 2+ path).
4. Manager/accountant still does not see tab or Home column when gated (`canSendTenantNotifications`).
