# Home Workspace Launcher — Implementation Phases

Phased rollout to transform the admin **Home** page from a portfolio reports preview into a **property workspace launcher**: deep links to units, leases, expenses, and income in one click; resume-last-tab; global property switcher and Cmd+K; optional actionable widgets later. Reuses existing property-shell tab routes and recent-property storage — no parallel navigation system.

**Related code today**

- [`apps/admin/src/pages/home-page.tsx`](../apps/admin/src/pages/home-page.tsx) — Home page (invites, admin cards, financial overview)
- [`apps/admin/src/components/home/home-financial-overview.tsx`](../apps/admin/src/components/home/home-financial-overview.tsx) — Report charts on Home (to demote)
- [`apps/admin/src/lib/recent-properties-storage.ts`](../apps/admin/src/lib/recent-properties-storage.ts) — Recent properties (localStorage, max 5)
- [`apps/admin/src/components/properties/property-switcher.tsx`](../apps/admin/src/components/properties/property-switcher.tsx) — Property switcher (inside property shell only)
- [`apps/admin/src/config/property-shell-tabs.ts`](../apps/admin/src/config/property-shell-tabs.ts) — Tab definitions (Overview, Units, Leases, …)
- [`apps/admin/src/lib/property-shell-tab-navigation.ts`](../apps/admin/src/lib/property-shell-tab-navigation.ts) — `buildPropertyShellTabPath`, `resolveActivePropertyShellTab`
- [`apps/admin/src/lib/property-switch-navigation.ts`](../apps/admin/src/lib/property-switch-navigation.ts) — Tab suffix + switch-path preservation
- [`apps/admin/src/lib/property-shell-tab-visibility.ts`](../apps/admin/src/lib/property-shell-tab-visibility.ts) — Role-gated tab visibility
- [`apps/admin/src/hooks/use-property-permissions.ts`](../apps/admin/src/hooks/use-property-permissions.ts) — `derivePropertyPermissions`
- [`apps/server/src/db/properties.ts`](../apps/server/src/db/properties.ts) — Paginated property list (favorites sort)
- [`apps/server/src/routes/admin/home-routes.ts`](../apps/server/src/routes/admin/home-routes.ts) — `GET /home/financial-overview`
- [`packages/shared/src/property-types.ts`](../packages/shared/src/property-types.ts) — `IProperty`, list query types

---

## Goals

- Home answers **“Where do I go next?”** in one click for units, leases, expenses, income, etc.
- **Resume** returns users to their last property + tab (not always Overview).
- **Favorites + recents + search** scale to many properties without N+1 detail fetches.
- **Role-aware shortcuts** reuse permission logic without loading full `IPropertyDetail` per card.
- **Reports demoted** on Home — keep `/reports`; remove chart-heavy Home as primary content.
- **Global navigation** (header switcher + Cmd+K) works from any page, not only Home.
- **Future widgets** (leases ending soon, etc.) plug into the same launcher model.

## Non-goals (through Phase 4)

- Replacing property shell tabs or duplicating full DataTables on Home
- Server-side recent-property sync (localStorage is sufficient for Phases 0–4)
- Cross-property aggregated task inbox before Phase 5
- Tenant portal changes
- Sidebar restructuring (Properties nav item stays)
- Auto-redirect single-property users away from Home without a preference

---

## Guiding principles

1. **One destination config** — Home shortcuts, property shell tabs, and Cmd+K read from `property-launcher-destinations.ts`; never hardcode `/properties/:id/units` in three places.
2. **List item permissions** — add `callerRole` to `IProperty` list response; avoid N× `getDetail` on Home.
3. **Resume is client-local** — extend recent storage with `lastPath`; clear on logout (already in `clear-app-session.ts`).
4. **Shell stays authoritative** — Home links into existing routes; pages enforce write access as today.
5. **≤ 8 files per subphase** — keep PRs reviewable; split when a phase would touch more.

---

## Target architecture

```
[Home Page]
  Pending invites (keep)
  Continue (recents + lastPath)
  Property launcher cards (shortcuts)
  Find property search
  Portfolio reports link (demoted)
        ↓
[property-launcher-destinations.ts]
  → getVisiblePropertyShellTabs (permissions)
  → buildPropertyShellTabPath (routes)
        ↓
[Global nav — Phase 3]
  Header property switcher
  Cmd+K command palette
        ↓
[Phase 5 — optional]
  GET /home/workspace-summary → widget badges on cards
```

### Permissions

- Shortcut visibility: reuse `getVisiblePropertyShellTabs` (communications gated today; extend when needed).
- Derive permissions from list item via `callerRole` + `createdBy` + `userType` (mirror `derivePropertyPermissions`).
- Server route auth unchanged — Home only deep-links.

### Feature flag

N/A for Phases 0–4. Phase 5 widgets may use env gate if needed.

---

## Shared contract (`packages/shared`)

| Type / field            | Purpose                                                                        |
| ----------------------- | ------------------------------------------------------------------------------ |
| `IProperty.callerRole`  | Viewer's `TPropertyRole` on list items (`null` for admin / non-member creator) |
| `IHomeWorkspaceSummary` | Phase 5 — portfolio/property attention counts                                  |

---

## API (sketch)

| Method | Path                       | Phase | Notes                                      |
| ------ | -------------------------- | ----- | ------------------------------------------ |
| `GET`  | `/properties`              | 0     | Existing list; response gains `callerRole` |
| `GET`  | `/home/financial-overview` | 4     | Keep optional; no charts on Home           |
| `GET`  | `/home/workspace-summary`  | 5     | New — leases ending soon, etc.             |

---

## UI — Home (target layout)

1. **Pending invitations** — keep existing banner
2. **Continue** — recent properties with “Resume → {Tab}”
3. **Your properties** — launcher cards with shortcut links
4. **Find property** — search → `/properties?q=` or inline filter
5. **Portfolio reports** — link card to `/reports` (optional one-line KPI)
6. **Admin shortcuts** — keep Users / Activity / Config for `UserType.ADMIN`

---

## Phased rollout

> **File budget:** each subphase touches **at most 8 files** (new + modified). Tests count toward the budget.

---

### Phase 0 — Foundation (no user-facing Home change)

**Goal:** Shared contracts and helpers so Home, switcher, and Cmd+K share one source of truth.

#### Phase 0a — `callerRole` on property list (5 files)

- [x] Add `callerRole: TPropertyRole | null` to `IProperty` in [`packages/shared/src/property-types.ts`](../packages/shared/src/property-types.ts)
- [x] Export type from [`packages/shared/src/index.ts`](../packages/shared/src/index.ts) if needed
- [x] Add correlated subquery in [`apps/server/src/db/properties.ts`](../apps/server/src/db/properties.ts) list SELECT for viewer membership role
- [x] Map `caller_role` in [`apps/server/src/db/mappers.ts`](../apps/server/src/db/mappers.ts)
- [x] Add/adjust server list test (e.g. [`apps/server/src/db/properties-list.test.ts`](../apps/server/src/db/) or route test) — owner/manager/accountant get role; admin gets `null`

**Exit criteria:** Property list API returns `callerRole` for member users; tests pass.

#### Phase 0b — Permissions + launcher destinations (4 files)

- [x] Add `derivePropertyPermissionsFromListItem` in [`apps/admin/src/hooks/use-property-permissions.ts`](../apps/admin/src/hooks/use-property-permissions.ts)
- [x] Add tests in [`apps/admin/src/hooks/use-property-permissions.test.ts`](../apps/admin/src/hooks/use-property-permissions.test.ts) for list-item derive (admin, owner, manager, accountant, creator)
- [x] Create [`apps/admin/src/lib/property-launcher-destinations.ts`](../apps/admin/src/lib/property-launcher-destinations.ts) — `getVisiblePropertyLauncherDestinations(permissions)` derived from [`PROPERTY_SHELL_TABS`](../apps/admin/src/config/property-shell-tabs.ts) with `showOnHome` / `showInCommandPalette` metadata
- [x] Create [`apps/admin/src/lib/property-launcher-destinations.test.ts`](../apps/admin/src/lib/property-launcher-destinations.test.ts) — per-role destination lists; communications hidden when unauthorized

**Exit criteria:** Destination config is the single shortcut source; tests pass.

#### Phase 0c — Recent storage `lastPath` (3 files)

- [x] Extend `IRecentProperty` with optional `lastPath?: string` in [`apps/admin/src/lib/recent-properties-storage.ts`](../apps/admin/src/lib/recent-properties-storage.ts)
- [x] Update `recordRecentProperty` to accept `lastPath`; backward-compatible parse in `isRecentProperty` / `parseRecentProperties`
- [x] Add tests in [`apps/admin/src/lib/recent-properties-storage.test.ts`](../apps/admin/src/lib/recent-properties-storage.test.ts) for `lastPath` round-trip and legacy entries
- [x] Pass `getPropertyTabSuffix(pathname, propertyId)` from [`apps/admin/src/components/properties/property-page-shell.tsx`](../apps/admin/src/components/properties/property-page-shell.tsx) when recording recents

**Exit criteria:** Visiting `/properties/:id/leases` stores `lastPath: "/leases"`; old entries still load.

#### Phase 0d — Home workspace data hook (2 files)

- [x] Create [`apps/admin/src/hooks/use-home-workspace-properties.ts`](../apps/admin/src/hooks/use-home-workspace-properties.ts) — merge recents + favorites-first list page, cap ~8 entries
- [x] Add `queryKeys.homeWorkspace()` in [`apps/admin/src/lib/query-keys.ts`](../apps/admin/src/lib/query-keys.ts) if needed for cache identity

**Exit criteria:** Hook returns merged property list without N× detail fetches; unit test or integration test optional.

---

### Phase 1 — Home UI MVP (workspace launcher)

**Goal:** Shippable Home — reach Leases/Expenses in one click from Home.

#### Phase 1a — Property workspace card (3 files)

- [ ] Create [`apps/admin/src/components/home/home-property-workspace-card.tsx`](../apps/admin/src/components/home/home-property-workspace-card.tsx) — name, address, favorite star, shortcut link row, “Open property” CTA
- [ ] Wire `getVisiblePropertyLauncherDestinations` + `buildPropertyShellTabPath` + `derivePropertyPermissionsFromListItem`
- [ ] Reuse [`PropertyFavoriteButton`](../apps/admin/src/components/properties/property-favorite-button.tsx) + [`useSetPropertyFavorite`](../apps/admin/src/hooks/use-set-property-favorite.ts)

**Exit criteria:** Card renders shortcuts per role; links navigate to correct tab routes.

#### Phase 1b — Launcher + Continue sections (4 files)

- [ ] Create [`apps/admin/src/components/home/home-workspace-continue-section.tsx`](../apps/admin/src/components/home/home-workspace-continue-section.tsx) — recents with “Resume → {Tab label}” via `resolveActivePropertyShellTab`
- [ ] Create [`apps/admin/src/components/home/home-workspace-launcher.tsx`](../apps/admin/src/components/home/home-workspace-launcher.tsx) — grid of workspace cards from `useHomeWorkspaceProperties`
- [ ] Create [`apps/admin/src/components/home/home-workspace-empty-state.tsx`](../apps/admin/src/components/home/home-workspace-empty-state.tsx) — no properties CTA → `/properties`
- [ ] Loading skeleton component or inline skeleton in launcher (colocate in launcher file if skeleton is small)

**Exit criteria:** Continue hidden when no recents; launcher shows favorites/recents merge; empty state works.

#### Phase 1c — Home page restructure (3 files)

- [ ] Refactor [`apps/admin/src/pages/home-page.tsx`](../apps/admin/src/pages/home-page.tsx) — replace `HomeFinancialOverview` with launcher + continue + search + reports link; keep invites + admin cards
- [ ] Create [`apps/admin/src/components/home/home-property-search-field.tsx`](../apps/admin/src/components/home/home-property-search-field.tsx) — compact search navigates to `/properties?q=…`
- [ ] Create [`apps/admin/src/components/home/home-portfolio-reports-link.tsx`](../apps/admin/src/components/home/home-portfolio-reports-link.tsx) — “View portfolio reports →” link to `/reports` (no charts)

**Exit criteria:** Home loads without report charts; user reaches a property tab in one click; mobile layout stacks/wraps acceptably.

---

### Phase 2 — Resume + property switcher parity

**Goal:** Switcher and Home use the same resume path logic.

#### Phase 2a — Shared resume path helper (2 files)

- [ ] Add `buildPropertyResumePath(propertyId, lastPath?)` in [`apps/admin/src/lib/property-switch-navigation.ts`](../apps/admin/src/lib/property-switch-navigation.ts)
- [ ] Add tests in [`apps/admin/src/lib/property-switch-navigation.test.ts`](../apps/admin/src/lib/property-switch-navigation.test.ts) — overview, tab suffix, nested path falls back to list tab for v1

**Exit criteria:** Helper covered by tests; documents nested-route limitation.

#### Phase 2b — Wire switcher + Continue to helper (2 files)

- [ ] Update [`apps/admin/src/components/properties/property-switcher.tsx`](../apps/admin/src/components/properties/property-switcher.tsx) — recent rows navigate with `lastPath` when present
- [ ] Update [`apps/admin/src/components/home/home-workspace-continue-section.tsx`](../apps/admin/src/components/home/home-workspace-continue-section.tsx) — use `buildPropertyResumePath`; show “Property · **Tab**” label

**Exit criteria:** Picking a recent property from switcher lands on last tab; Home Continue matches.

---

### Phase 3 — Global navigation

**Goal:** Property navigation from any page; Cmd+K for power users.

#### Phase 3a — Header property switcher (4 files)

- [ ] Extract trigger/popover shell into [`apps/admin/src/components/properties/property-switcher-trigger.tsx`](../apps/admin/src/components/properties/property-switcher-trigger.tsx)
- [ ] Refactor [`apps/admin/src/components/properties/property-switcher.tsx`](../apps/admin/src/components/properties/property-switcher.tsx) to use trigger; support `propertyId` optional (global mode)
- [ ] Mount switcher in [`apps/admin/src/components/layout/admin-layout.tsx`](../apps/admin/src/components/layout/admin-layout.tsx) header
- [ ] Remove duplicate in-shell switcher from [`apps/admin/src/components/properties/property-page-shell.tsx`](../apps/admin/src/components/properties/property-page-shell.tsx) (header-only)

**Exit criteria:** Switcher works outside property shell; tab preservation on property switch unchanged.

#### Phase 3b — Cmd+K command palette (5 files)

- [ ] Add `cmdk` dependency in [`apps/admin/package.json`](../apps/admin/package.json)
- [ ] Add shadcn Command dialog primitive if not present (or use cmdk directly)
- [ ] Create [`apps/admin/src/components/layout/global-command-palette.tsx`](../apps/admin/src/components/layout/global-command-palette.tsx) — recents, searchable properties, app nav groups
- [ ] Create [`apps/admin/src/hooks/use-global-command-palette.ts`](../apps/admin/src/hooks/use-global-command-palette.ts) — Meta+K / Ctrl+K listener, open state
- [ ] Wire palette in [`apps/admin/src/components/layout/admin-layout.tsx`](../apps/admin/src/components/layout/admin-layout.tsx); destinations from `getVisiblePropertyLauncherDestinations`

**Exit criteria:** Cmd+K opens globally; “Property → Expenses” navigates correctly; no duplicate destination config.

---

### Phase 4 — Demote reports + hardening

**Goal:** Home stays fast; edge cases handled.

#### Phase 4a — Remove charts from Home (3 files)

- [ ] Remove `HomeFinancialOverview` usage from [`apps/admin/src/pages/home-page.tsx`](../apps/admin/src/pages/home-page.tsx) (component file may remain for `/reports` reuse)
- [ ] Optional: extend [`apps/admin/src/components/home/home-portfolio-reports-link.tsx`](../apps/admin/src/components/home/home-portfolio-reports-link.tsx) with one-line KPI from `homeApi.financialOverview` (no Recharts)
- [ ] Verify [`apps/admin/src/lib/query-keys.ts`](../apps/admin/src/lib/query-keys.ts) — drop unused home overview key from Home critical path if applicable

**Exit criteria:** Home does not load Recharts bundle on first paint.

#### Phase 4b — Launcher hardening (3 files)

- [ ] Filter stale recent IDs in [`apps/admin/src/hooks/use-home-workspace-properties.ts`](../apps/admin/src/hooks/use-home-workspace-properties.ts) when property no longer in accessible list
- [ ] Add error + loading states in [`apps/admin/src/components/home/home-workspace-launcher.tsx`](../apps/admin/src/components/home/home-workspace-launcher.tsx)
- [ ] Offer “Remove from recents” for stale entries in Continue section (reuse `removeRecentProperty`)

**Exit criteria:** Removed/inaccessible properties don’t break Home; errors show retry/empty sensibly.

---

### Phase 5 — Actionable widgets (post-launch)

**Goal:** Home surfaces what needs attention, not just links.

#### Phase 5a — Workspace summary API (5 files)

- [ ] Create [`packages/shared/src/home-workspace-summary-types.ts`](../packages/shared/src/home-workspace-summary-types.ts) — `IHomeWorkspaceSummary`, per-property attention items
- [ ] Export from [`packages/shared/src/index.ts`](../packages/shared/src/index.ts)
- [ ] Add `GET /home/workspace-summary` in [`apps/server/src/routes/admin/home-routes.ts`](../apps/server/src/routes/admin/home-routes.ts)
- [ ] Create [`apps/server/src/services/home-workspace-summary-service.ts`](../apps/server/src/services/home-workspace-summary-service.ts) — leases ending within 30 days (v1 widget)
- [ ] Add [`apps/server/src/services/home-workspace-summary-service.test.ts`](../apps/server/src/services/home-workspace-summary-service.test.ts)

**Exit criteria:** Endpoint returns counts for accessible properties; no N+1; tested.

#### Phase 5b — Widget UI + card badges (4 files)

- [ ] Create [`apps/admin/src/components/home/home-workspace-widgets.tsx`](../apps/admin/src/components/home/home-workspace-widgets.tsx) — widget row below launcher (leases ending soon first)
- [ ] Extend [`apps/admin/src/components/home/home-property-workspace-card.tsx`](../apps/admin/src/components/home/home-property-workspace-card.tsx) with optional `badges` prop
- [ ] Add `homeApi.workspaceSummary()` in [`apps/admin/src/lib/api-client.ts`](../apps/admin/src/lib/api-client.ts) + query key
- [ ] Wire widgets in [`apps/admin/src/pages/home-page.tsx`](../apps/admin/src/pages/home-page.tsx); deep-link to property tab with URL filters

**Exit criteria:** One actionable widget live; clicking widget row opens relevant property view.

---

## What not to do

- Do **not** add property tabs to the sidebar — does not scale with portfolio size
- Do **not** fetch `getDetail` per Home card — use `callerRole` on list items
- Do **not** duplicate tab paths in Home, Cmd+K, and shell — single `property-launcher-destinations` module
- Do **not** store recents on the server in Phases 0–4
- Do **not** auto-redirect single-property users away from Home without a preference
- Do **not** remove `/reports` — demote only the Home chart section
- Do **not** exceed 8 files per subphase in a single PR — split subphases instead

---

## Safest sequencing summary

1. **Phase 0a–0d** — contracts + hook (no Home UI yet)
2. **Phase 1a–1c** — Home launcher MVP (biggest UX win)
3. **Phase 2** — resume parity with switcher
4. **Phase 3a** then **3b** — header switcher, then Cmd+K
5. **Phase 4** — remove charts, harden edge cases
6. **Phase 5** — summary API, then widgets

---

## Suggested PR breakdown

| PR  | Subphases    | Focus                                             |
| --- | ------------ | ------------------------------------------------- |
| 1   | 0a + 0b      | Server `callerRole` + launcher destination config |
| 2   | 0c + 0d + 1a | Recent `lastPath` + hook + workspace card         |
| 3   | 1b + 1c      | Home page launcher MVP                            |
| 4   | 2            | Resume path helper + switcher parity              |
| 5   | 3a           | Global header switcher                            |
| 6   | 3b           | Cmd+K palette                                     |
| 7   | 4            | Hardening + demote charts                         |
| 8   | 5a + 5b      | Actionable widgets (when prioritized)             |

---

## Progress tracker

| Subphase | Status      |
| -------- | ----------- |
| Phase 0a | Not started |
| Phase 0b | Not started |
| Phase 0c | Not started |
| Phase 0d | Not started |
| Phase 1a | Not started |
| Phase 1b | Not started |
| Phase 1c | Not started |
| Phase 2a | Not started |
| Phase 2b | Not started |
| Phase 3a | Not started |
| Phase 3b | Not started |
| Phase 4a | Not started |
| Phase 4b | Not started |
| Phase 5a | Not started |
| Phase 5b | Not started |

When a subphase is complete, check all its `[ ]` items above `[x]` and update this table to **Done**.
