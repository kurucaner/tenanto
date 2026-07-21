# Communications → Announcement — Implementation Phases

Rename the admin product surface **Communications** to **Announcement** across the operator UI. The underlying feature remains **tenant email campaigns** on the server (`tenant-email-campaigns` API, `property_tenant_email_campaigns` tables, BullMQ worker, SES). This plan is **admin + routing only** — no Postgres migration, no shared contract rename, no API path changes.

Work is split into **three optional scopes** (Phases 1–3). Ship Phase 1 alone for a quick win; add Phase 2 when URL consistency matters; add Phase 3 only if internal code clarity is worth the churn.

**Related code today**

- Property shell tab config: [`apps/admin/src/config/property-shell-tabs.ts`](../apps/admin/src/config/property-shell-tabs.ts)
- Tab visibility: [`apps/admin/src/lib/property-shell-tab-visibility.ts`](../apps/admin/src/lib/property-shell-tab-visibility.ts)
- Admin router: [`apps/admin/src/app/router.tsx`](../apps/admin/src/app/router.tsx)
- Property page: [`apps/admin/src/pages/property-communications-page.tsx`](../apps/admin/src/pages/property-communications-page.tsx)
- UI components: [`apps/admin/src/components/communications/`](../apps/admin/src/components/communications/)
- Home column: [`apps/admin/src/components/home/home-communications-column.tsx`](../apps/admin/src/components/home/home-communications-column.tsx)
- Home hook + utils: [`apps/admin/src/hooks/use-home-recent-communications.ts`](../apps/admin/src/hooks/use-home-recent-communications.ts), [`apps/admin/src/lib/home-recent-communications-utils.ts`](../apps/admin/src/lib/home-recent-communications-utils.ts)
- Deep links: [`apps/admin/src/lib/notification-routing.ts`](../apps/admin/src/lib/notification-routing.ts), [`apps/admin/src/lib/notification-stream-handlers.ts`](../apps/admin/src/lib/notification-stream-handlers.ts)
- Launcher / command palette labels: [`apps/admin/src/lib/property-launcher-destinations.ts`](../apps/admin/src/lib/property-launcher-destinations.ts) (labels flow from `PROPERTY_SHELL_TABS`)
- Release notes copy: [`apps/admin/src/config/release-notes.ts`](../apps/admin/src/config/release-notes.ts)
- Server API (unchanged): [`apps/server/src/routes/admin/property-tenant-email-campaign-routes.ts`](../apps/server/src/routes/admin/property-tenant-email-campaign-routes.ts)
- Prior rename reference (different target name): [`docs/REVENUE_NOTIFICATIONS_RENAME_PHASES.md`](./REVENUE_NOTIFICATIONS_RENAME_PHASES.md)

---

## Goals

- Operators see **Announcement** instead of **Communications** in the property shell, Home hub, command palette, and in-app copy.
- (Phase 2+) URLs use `/properties/:id/announcements` instead of `/communications`.
- (Phase 3+) File paths, folders, hooks, and helpers use **announcement** vocabulary where they today say **communications**.
- All admin tests and `bun run lint` / `build:admin` pass after each shipped phase.

## Non-goals

- Renaming **tenant email campaign** backend symbols (`property_tenant_email_campaigns`, `tenant-email-campaigns` API segment, worker queue names).
- Changing `packages/shared` types (`IHomeRecentTenantEmailCampaign`, etc.) — already transport-accurate.
- SMS, push, or two-way messaging under the Announcement tab (future product scope).
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

| Before | After (target) |
| ------ | -------------- |
| Tab label: **Communications** | Tab label: **Announcement** |
| Route segment: `communications` | Route segment: **`announcements`** (plural; matches `units`, `leases`, `expenses`) |
| Home column title: **Communications** | **Announcement** |
| Empty-state tooltip: “Create a property first to send tenant emails.” | Keep or tweak to “…send an announcement.” (copy-only) |
| Folder: `components/communications/` | `components/announcements/` (Phase 3) |
| Page: `property-communications-page.tsx` | `property-announcements-page.tsx` (Phase 3) |
| API: `…/tenant-email-campaigns` | **unchanged** |

**Decision:** Tab label is singular (**Announcement**); URL path is plural (**announcements**). If you prefer path `announcement`, apply the same Phase 2 checklist with that segment instead.

---

## Scope overview

| Phase | Scope | Effort | User-visible? | Server / DB? |
| ----- | ----- | ------ | ------------- | ------------ |
| **1** | UI copy only | ~1–2 hours | Yes | No |
| **2** | URL path + link builders | ~half day | Yes (URLs) | No |
| **3** | Files, folders, identifiers | ~1 day | No (internal) | No |
| **4** | Docs + optional redirect | ~1–2 hours | Docs / bookmarks | No |
| — | Server / shared contract | **N/A — out of scope** | — | — |

---

## Phase 1 — UI copy only (Scope 1)

**Goal:** Operators see **Announcement** everywhere in the UI while URLs stay `/communications` (no broken bookmarks, no router change).

**Files (~6)**

- [ ] [`apps/admin/src/config/property-shell-tabs.ts`](../apps/admin/src/config/property-shell-tabs.ts) — `label: "Announcement"` (keep `path: "communications"` for this phase)
- [ ] [`apps/admin/src/components/home/home-communications-column.tsx`](../apps/admin/src/components/home/home-communications-column.tsx) — column title `"Announcement"`; update `COMMUNICATIONS_TAB` label constant; adjust empty tooltip copy if desired
- [ ] [`apps/admin/src/config/release-notes.ts`](../apps/admin/src/config/release-notes.ts) — replace “Communications tab” with “Announcement tab” in current-version bullet(s) only (optional: leave historical bullets)
- [ ] [`apps/admin/src/lib/property-launcher-destinations.test.ts`](../apps/admin/src/lib/property-launcher-destinations.test.ts) — assertions on label `"Communications"` → `"Announcement"` (paths still `communications`)
- [ ] Grep admin for remaining user-visible **Communications** strings (page headings, aria labels, toast copy in tenant-email components) and update
- [ ] Run `cd apps/admin && bun run lint && bun run build`

**Exit criteria**

- Property shell tab reads **Announcement**; URL is still `…/communications`.
- Home hub third column header reads **Announcement**.
- Command palette property actions show **Announcement** (derived from tab config).
- No changes under `apps/server/` or `packages/shared/`.
- Admin lint + build pass.

---

## Phase 2 — URL path + deep links (Scope 2)

**Goal:** Route segment becomes **`announcements`**; all in-app navigation and notification deep links use the new path.

**Depends on:** Phase 1 (label already says Announcement).

**Files (~12)**

- [ ] [`apps/admin/src/config/property-shell-tabs.ts`](../apps/admin/src/config/property-shell-tabs.ts) — `path: "announcements"`
- [ ] [`apps/admin/src/app/router.tsx`](../apps/admin/src/app/router.tsx) — child route `announcements` (remove or redirect old `communications` — see Phase 4)
- [ ] [`apps/admin/src/lib/property-shell-tab-visibility.ts`](../apps/admin/src/lib/property-shell-tab-visibility.ts) — guard `tab.path === "announcements"`
- [ ] [`apps/admin/src/lib/property-launcher-destinations.ts`](../apps/admin/src/lib/property-launcher-destinations.ts) — metadata key `announcements:` (replace `communications:`)
- [ ] [`apps/admin/src/lib/home-recent-communications-utils.ts`](../apps/admin/src/lib/home-recent-communications-utils.ts) — href builder returns `…/announcements?campaignId=…`
- [ ] [`apps/admin/src/lib/notification-routing.ts`](../apps/admin/src/lib/notification-routing.ts) — tenant email campaign notification path
- [ ] [`apps/admin/src/lib/notification-stream-handlers.ts`](../apps/admin/src/lib/notification-stream-handlers.ts) — pathname check for live tab refetch (`announcementsPath`, rename locals)
- [ ] [`apps/admin/src/components/home/home-communications-column.tsx`](../apps/admin/src/components/home/home-communications-column.tsx) — `COMMUNICATIONS_TAB.path` → `"announcements"`
- [ ] [`apps/admin/src/pages/property-communications-page.tsx`](../apps/admin/src/pages/property-communications-page.tsx) — any redirect or `Navigate` targets using old path
- [ ] Tests: [`home-recent-communications-utils.test.ts`](../apps/admin/src/lib/home-recent-communications-utils.test.ts), [`notification-routing.test.ts`](../apps/admin/src/lib/notification-routing.test.ts), [`notification-stream-handlers.test.ts`](../apps/admin/src/lib/notification-stream-handlers.test.ts), [`property-shell-tab-visibility.test.ts`](../apps/admin/src/lib/property-shell-tab-visibility.test.ts), [`property-launcher-destinations.test.ts`](../apps/admin/src/lib/property-launcher-destinations.test.ts)
- [ ] Grep repo for `/communications` and `path === "communications"` in admin; fix stragglers
- [ ] Run `cd apps/admin && bun run lint && bun run build`

**Exit criteria**

- Navigating to `/properties/:id/announcements` loads the tenant email campaign page.
- Home recent row, notification bell, and SSE handlers open `…/announcements?campaignId=…`.
- Tab visibility and launcher tests use `announcements` path segment.
- Old `/communications` URLs **404** unless Phase 4 redirect is added.

---

## Phase 3 — Files, folders, and code identifiers (Scope 3)

**Goal:** Internal admin code matches **announcement** vocabulary; no user-facing change beyond Phases 1–2.

**Depends on:** Phase 2 complete (paths stable before large file moves).

**Renames (representative)**

| Before | After |
| ------ | ----- |
| `components/communications/` | `components/announcements/` |
| `property-communications-page.tsx` | `property-announcements-page.tsx` |
| `PropertyCommunicationsPage` | `PropertyAnnouncementsPage` |
| `home-communications-column.tsx` | `home-announcements-column.tsx` |
| `HomeCommunicationsColumn` | `HomeAnnouncementsColumn` |
| `use-home-recent-communications.ts` | `use-home-recent-announcements.ts` |
| `home-recent-communications-utils.ts` | `home-recent-announcements-utils.ts` |
| `buildHomeCommunicationsCampaignHref` | `buildHomeAnnouncementsCampaignHref` |
| `hasHomeRecentCommunicationsSendAccess` | `hasHomeRecentAnnouncementsSendAccess` |
| `useHomeRecentCommunications` | `useHomeRecentAnnouncements` |

**Tasks**

- [ ] Move [`apps/admin/src/components/communications/`](../apps/admin/src/components/communications/) → `components/announcements/`; fix all imports (page, tests, cross-component imports)
- [ ] Rename page, home column, hook, and utils files as above; update exports and imports in [`home-workspace-hub.tsx`](../apps/admin/src/components/home/home-workspace-hub.tsx), [`router.tsx`](../apps/admin/src/app/router.tsx), [`use-home-recent-communications.ts`](../apps/admin/src/hooks/use-home-recent-communications.ts)
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

## Phase 4 — Docs alignment + optional redirect (Scope 4 add-on)

**Goal:** Agent/human docs reflect **Announcement**; optionally preserve old bookmarks.

**Tasks**

- [ ] Update cross-references in [`docs/HOME_RECENT_COMMUNICATIONS_PHASES.md`](./HOME_RECENT_COMMUNICATIONS_PHASES.md), [`docs/TENANT_EMAIL_CAMPAIGN_PHASES.md`](./TENANT_EMAIL_CAMPAIGN_PHASES.md), [`docs/TENANT_EMAIL_CAMPAIGN_FAILURE_MODES.md`](./TENANT_EMAIL_CAMPAIGN_FAILURE_MODES.md), [`docs/HOME_WORKSPACE_LAUNCHER_PHASES.md`](./HOME_WORKSPACE_LAUNCHER_PHASES.md) — or add a one-line note at top pointing to this doc
- [ ] Update comment in [`apps/server/.env.example`](../apps/server/.env.example) — “Announcement tab” instead of “Communications tab”
- [ ] **Optional:** Add router redirect `communications` → `announcements` (preserve query string) for notification deep links emailed before deploy
- [ ] **Optional:** Add redirect test in admin router tests if redirect is shipped

**Exit criteria**

- Docs no longer instruct agents to use **Communications** as the current product name.
- (If redirect shipped) `/properties/:id/communications?campaignId=x` lands on Announcements tab with sheet open.

---

## Out of scope — Server / shared contract (no phase)

The following **do not** need renames for Announcement branding:

| Layer | Keep as-is | Why |
| ----- | ---------- | --- |
| API paths | `…/tenant-email-campaigns` | Describes transport + domain |
| DB tables | `property_tenant_email_campaigns`, … | Already accurate |
| Shared types | `IHomeRecentTenantEmailCampaign`, … | API contract, not shell label |
| Workers / queues | `tenant-email-*` | Operational naming |
| Notification resource types | Existing enum values | Server-driven |

**Exit criteria:** N/A — intentionally unchanged.

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

## Safest sequencing summary

1. **Phase 1 first** — instant UX win; zero routing risk.
2. **Phase 2 before Phase 3** — stabilize URLs, then move files.
3. **Single PR per phase** — easier review and rollback.
4. **Grep-driven exit** — each phase ends with `rg 'communications|Communications' apps/admin` (and `/communications` after Phase 2).
5. **Server stays untouched** — any server diff is a mistake for this rename.
6. **Optional Phase 4 redirect** — add only if users may have saved `/communications` links.

---

## Verification checklist (all phases)

```bash
cd apps/admin && bun run lint && bun run build
cd apps/admin && bun test src/lib/home-recent-communications-utils.test.ts  # rename path after Phase 3
cd apps/admin && bun test src/lib/notification-routing.test.ts
cd apps/admin && bun test src/lib/property-shell-tab-visibility.test.ts
cd apps/admin && bun test src/lib/property-launcher-destinations.test.ts
```

Manual smoke:

1. Property shell shows **Announcement** tab; compose + history work.
2. Home **Announcement** column rows open correct property tab with `campaignId`.
3. Notification for finished campaign opens Announcements tab (Phase 2+ path).
4. Manager/accountant still does not see tab or Home column when gated.
