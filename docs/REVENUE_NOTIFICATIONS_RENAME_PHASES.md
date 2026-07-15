# Revenue & Notifications Rename — Implementation Phases

Roadmap to rename product surfaces **Income → Revenue** and **Communications → Notifications** across the monorepo, including **Postgres tables, enums, API paths, shared contracts, admin UI, marketing site, and docs**. Early-stage app with minimal production data — prefer a clean break over long-lived aliases.

**Related code today**

- Property shell tabs: `apps/admin/src/config/property-shell-tabs.ts`
- Admin router: `apps/admin/src/app/router.tsx`
- Income page + components: `apps/admin/src/pages/property-income-page.tsx`, `apps/admin/src/components/income/`
- Communications page + components: `apps/admin/src/pages/property-communications-page.tsx`, `apps/admin/src/components/communications/`
- Shared income contract: `packages/shared/src/property-income-*.ts`, `packages/shared/src/income-import-*.ts`
- Server income layer: `apps/server/src/db/property-income-*.ts`, `apps/server/src/routes/admin/property-income-*.ts`, `apps/server/src/services/property-income-calculator.ts`
- Tenant email (notifications backend today): `apps/server/src/db/property-tenant-email-campaigns.ts`, `apps/server/src/routes/admin/property-tenant-email-campaign-routes.ts`
- Migrations: `apps/server/src/db/migrations.ts` (current latest: **v56**)
- Calculation docs: `docs/CALCULATION_RULES.md`
- Prior tenant-email roadmap: `docs/TENANT_EMAIL_CAMPAIGN_PHASES.md` (references **Communications** tab)
- Marketing: `apps/web/lib/marketing-content.ts`, `apps/web/app/(landing)/income/page.tsx`

---

## Goals

- Property shell tabs read **Revenue** and **Notifications** (user pick).
- URL paths, API routes, shared types, DB schema, and file names align with the new vocabulary.
- **Revenue** tab still represents the unified ledger: short stays (reservations) + manual revenue lines.
- **Notifications** tab still represents tenant email campaigns to active lease tenants (no product behavior change).
- One migration (v57+) renames income tables/columns/enums; export job rows updated in the same transaction.
- All tests green; `bun run lint` / `build` pass in admin, server, shared, web.

## Non-goals (initial release)

- Renaming **short stays / reservations** domain (`property_reservations`, `shortStaysApi`) — stays are a entry *kind* inside Revenue, not a separate product rename.
- Renaming **tenant email** DB tables (`property_tenant_email_campaigns`, …) — already accurate; only the admin tab/shell used “Communications”.
- SMS / push notification channels (future work under Notifications tab).
- Redirect middleware for old `/income` bookmarks (optional; add only if external links exist).
- Historical release-notes text rewrite (old bullets may still say “Income”).

---

## Guiding principles

1. **`packages/shared` is the contract** — rename types/enums here first; server and admin import the new symbols only.
2. **DB rename in one migration** — `ALTER TABLE … RENAME`, `ALTER TYPE … RENAME`, column renames, index/trigger/constraint renames; update `export_jobs.resource_type` values in the same migration.
3. **No dual naming** — avoid `incomeLinesApi` aliases calling `/revenue-lines`; rename symbols and paths together per phase.
4. **Reservations share money columns** — `property_reservations.gross_income` / `net_income` rename to `gross_revenue` / `net_revenue` for ledger consistency (both appear in revenue entries list).
5. **“Other revenue” not “other income”** — UI copy for manual lines; entry kind enum becomes `RevenueEntryKind.LINE` (internal) with label “Other revenue”.
6. **Notifications = shell name** — backend may keep `tenant-email-campaigns` API segment (describes transport); tab path becomes `notifications`.

---

## Target naming map

### Product / UI

| Before | After |
| ------ | ----- |
| Tab: Income | Tab: **Revenue** |
| Tab: Communications | Tab: **Notifications** |
| Route: `…/income` | Route: `…/revenue` |
| Route: `…/communications` | Route: `…/notifications` |
| “Income type” | **Revenue type** (or **Category**) |
| “Other income” | **Other revenue** |
| “Income composition” (report) | **Revenue composition** |
| Export chip: Income | **Revenue** |

### API paths

| Before | After |
| ------ | ----- |
| `GET/POST …/income-lines` | `…/revenue-lines` |
| `PATCH/DELETE …/income-lines/:lineId` | `…/revenue-lines/:lineId` |
| `POST …/income-lines/:lineId/refund` | `…/revenue-lines/:lineId/refund` |
| `GET …/income-entries` | `…/revenue-entries` |
| `POST …/income/import/parse` | `…/revenue/import/parse` |
| `POST …/income/import/commit` | `…/revenue/import/commit` |
| `GET/POST …/tenant-email-campaigns` | **unchanged** (transport-specific) |

### Shared types (representative)

| Before | After |
| ------ | ----- |
| `IPropertyIncomeLine` | `IPropertyRevenueLine` |
| `ICreatePropertyIncomeLineBody` | `ICreatePropertyRevenueLineBody` |
| `IPropertyIncomeLinesListQuery` | `IPropertyRevenueLinesListQuery` |
| `IPropertyIncomeLineType` | `IPropertyRevenueLineType` |
| `IncomeEntryKind` | `RevenueEntryKind` |
| `grossIncome` / `netIncome` (TS fields) | `grossRevenue` / `netRevenue` |
| `incomeLineTypeId` | `revenueLineTypeId` |
| `ExportResourceType.INCOME` (`"income"`) | `ExportResourceType.REVENUE` (`"revenue"`) |
| `isIncomeLinePaidForRentSchedule` | `isRevenueLinePaidForRentSchedule` |

### Postgres (migration v57)

| Before | After |
| ------ | ----- |
| `property_income_lines` | `property_revenue_lines` |
| `property_income_line_types` | `property_revenue_line_types` |
| `income_line_type_id` | `revenue_line_type_id` |
| `gross_income` (lines + reservations) | `gross_revenue` |
| `net_income` (lines + reservations) | `net_revenue` |
| `export_resource_type` value `'income'` | `'revenue'` (new enum value + row update; Postgres cannot drop enum values) |
| Indexes / triggers `…income_lines…` | `…revenue_lines…` |
| FK `property_income_lines_unit_id_fkey` | `property_revenue_lines_unit_id_fkey` |
| Error code `UNIT_HAS_INCOME` | `UNIT_HAS_REVENUE` |

### Admin file moves (representative)

| Before | After |
| ------ | ----- |
| `pages/property-income-page.tsx` | `pages/property-revenue-page.tsx` |
| `components/income/` | `components/revenue/` |
| `pages/property-communications-page.tsx` | `pages/property-notifications-page.tsx` |
| `components/communications/` | `components/notifications/` |
| `lib/invalidate-property-income-caches.ts` | `lib/invalidate-property-revenue-caches.ts` |
| `hooks/use-property-income-*` | `hooks/use-property-revenue-*` |

### Server file moves (representative)

| Before | After |
| ------ | ----- |
| `db/property-income-lines.ts` | `db/property-revenue-lines.ts` |
| `db/property-income-line-types.ts` | `db/property-revenue-line-types.ts` |
| `db/property-income-entries.ts` | `db/property-revenue-entries.ts` |
| `routes/admin/property-income-line-routes.ts` | `routes/admin/property-revenue-line-routes.ts` |
| `routes/admin/property-income-entries-routes.ts` | `routes/admin/property-revenue-entries-routes.ts` |
| `routes/admin/property-income-import-routes.ts` | `routes/admin/property-revenue-import-routes.ts` |
| `services/property-income-calculator.ts` | `services/property-revenue-calculator.ts` |
| `services/property-export/income-table-export.ts` | `services/property-export/revenue-table-export.ts` |

### Shared package file moves

| Before | After |
| ------ | ----- |
| `property-income-line-types.ts` | `property-revenue-line-types.ts` |
| `property-income-entries-types.ts` | `property-revenue-entries-types.ts` |
| `property-income-calculator.ts` | `property-revenue-calculator.ts` |
| `property-income-utils.ts` | `property-revenue-utils.ts` |
| `property-income-refund-filter-types.ts` | `property-revenue-refund-filter-types.ts` |
| `property-income-entries-list-constants.ts` | `property-revenue-entries-list-constants.ts` |
| `property-income-line-type-config.ts` | `property-revenue-line-type-config.ts` |
| `property-income-import-types.ts` | `property-revenue-import-types.ts` |
| `income-import-preview-row.ts` | `revenue-import-preview-row.ts` |
| `income-import-duplicate-utils.ts` | `revenue-import-duplicate-utils.ts` |

### Marketing (`apps/web`)

| Before | After |
| ------ | ----- |
| `/income` landing route | `/revenue` |
| `marketing-content.ts` income section | `revenue` slug + copy |
| `platform-flow-diagram.tsx` “Income + Expenses” | “Revenue + Expenses” |

---

## Data model (migration sketch)

**New migration v57** — `rename_income_to_revenue` (single transaction):

```sql
-- 1. Tables
ALTER TABLE property_income_line_types RENAME TO property_revenue_line_types;
ALTER TABLE property_income_lines RENAME TO property_revenue_lines;

-- 2. Columns on revenue lines
ALTER TABLE property_revenue_lines RENAME COLUMN income_line_type_id TO revenue_line_type_id;
ALTER TABLE property_revenue_lines RENAME COLUMN gross_income TO gross_revenue;
ALTER TABLE property_revenue_lines RENAME COLUMN net_income TO net_revenue;

-- 3. Columns on reservations (same ledger math fields)
ALTER TABLE property_reservations RENAME COLUMN gross_income TO gross_revenue;
ALTER TABLE property_reservations RENAME COLUMN net_income TO net_revenue;

-- 4. Indexes, triggers, constraints — rename to match (see migrations.ts for full list)
-- e.g. idx_property_income_lines_property_date → idx_property_revenue_lines_property_date

-- 5. Export enum: add 'revenue', migrate rows, stop writing 'income'
ALTER TYPE export_resource_type ADD VALUE IF NOT EXISTS 'revenue';
UPDATE export_jobs SET resource_type = 'revenue' WHERE resource_type = 'income';
-- Note: cannot DROP 'income' from Postgres enum; leave orphaned value unused.

-- 6. Property settings JSON keys if stored (verify property_settings snapshot shape)
```

**`down` migration:** reverse renames where possible; enum value `'income'` cannot be removed from Postgres — document as one-way for enum.

**`SOFT_DELETE_TABLES`** in `migrations.ts`: update `"property_income_lines"` → `"property_revenue_lines"`.

---

## Architecture after rename

```
[Reservations + revenue lines in Postgres]
        ↓
packages/shared  RevenueEntryKind, IPropertyRevenueLine, property-revenue-utils
        ↓
propertyRevenueLinesDb / propertyRevenueEntriesDb
        ↓
GET /revenue-entries  →  admin Revenue tab (unified table)
POST /revenue-lines   →  Record rent / other revenue
        ↓
property_reports / exports  ←  grossRevenue, netRevenue fields

[Lease tenants]
        ↓
POST /tenant-email-campaigns  (unchanged)
        ↓
admin Notifications tab  ←  compose + campaign history
```

---

## Phased rollout

### Phase 0 — Inventory & doc freeze

**Goal:** Lock the naming map (this document) before code changes.

- [x] Document targets (this file)
- [ ] Agree UI sub-labels: **Revenue type** vs **Category**; **Other revenue** vs **Manual entry**
- [ ] Decide marketing URL: `/revenue` only vs temporary redirect from `/income`
- [ ] Snapshot `rg -i "income|communications" --type ts` counts for regression grep

**Exit criteria:** Naming map approved; no ambiguous terms left.

---

### Phase 1 — Shared contract (`packages/shared`)

**Goal:** New types and enums exported from `index.ts`; no server/admin consumers switched yet.

- [ ] Rename/move shared files per table above
- [ ] Rename all `IPropertyIncome*` → `IPropertyRevenue*`
- [ ] Rename `IncomeEntryKind` → `RevenueEntryKind`; values `stay` | `line` unchanged
- [ ] Rename `grossIncome` / `netIncome` → `grossRevenue` / `netRevenue` on line + reservation interfaces
- [ ] `ExportResourceType.INCOME` → `REVENUE`; `TExportResourceType` union
- [ ] Rename calculator/utils: `property-revenue-calculator.ts`, `property-revenue-utils.ts`
- [ ] Update `property-settings-types.ts`: `incomeLineTypes` → `revenueLineTypes` (API body field)
- [ ] Update `property-partial-refund-utils.ts`: `isRevenueLinePaidForRentSchedule`
- [ ] Update `property-report-types.ts` / chart utils labels
- [ ] Fix all `packages/shared` tests; run `bun test` in shared

**Exit criteria:** Shared package builds; tests pass; old symbol names removed from exports.

---

### Phase 2 — Database migration (v57)

**Goal:** Postgres schema matches new vocabulary.

- [ ] Add migration v57 `rename_income_to_revenue` with `up`/`down` per sketch
- [ ] Rename tables, columns, indexes, triggers, FK constraint names
- [ ] Update `export_jobs.resource_type` rows `'income'` → `'revenue'`
- [ ] Update `postgres-constraint-messages.ts` keys + `UNIT_HAS_REVENUE`
- [ ] Update `mappers.ts`: `mapPropertyRevenueLineRow`, `gross_revenue` / `net_revenue` columns
- [ ] Update `SOFT_DELETE_TABLES` constant
- [ ] Run migration on dev DB; verify `\d property_revenue_lines`

**Exit criteria:** Server starts; `initializeDatabase()` applies v57; manual spot-check SELECT on renamed columns.

---

### Phase 3 — Server rename

**Goal:** DB modules, routes, services, and tests use revenue naming.

- [ ] Rename db modules (`property-revenue-lines.ts`, etc.)
- [ ] Update all SQL strings to new table/column names
- [ ] Rename route modules; register paths `/revenue-lines`, `/revenue-entries`, `/revenue/import/*`
- [ ] Rename `property-income-calculator.ts` → `property-revenue-calculator.ts`
- [ ] Update `property-long-stays.ts` rent schedule paid detection import
- [ ] Update `property-report-service.ts`, export worker, `revenue-table-export.ts`
- [ ] Update `property-settings.ts` / routes for `revenueLineTypes`
- [ ] Update `server.ts` route registrations
- [ ] Update seed SQL if present (`apps/server/scripts/`)
- [ ] Run `bun test` in server

**Exit criteria:** All server tests pass; API responds on new paths only (no `/income-*` routes).

---

### Phase 4 — Admin client rename

**Goal:** UI routes, components, API client, and copy say Revenue / Notifications.

**Revenue**

- [ ] Router: `path: "revenue"`; `PropertyRevenuePage`
- [ ] Move `components/income/` → `components/revenue/`; fix imports
- [ ] `api-client.ts`: `revenueLinesApi`, `revenueEntriesApi`, new paths
- [ ] `query-keys.ts`: `propertyRevenueLines`, `propertyRevenueEntries`
- [ ] `invalidate-property-revenue-caches.ts`
- [ ] Tab config: `{ label: "Revenue", path: "revenue" }`
- [ ] User-facing copy pass (toolbar, toasts, dialogs, settings, reports charts)
- [ ] `export-toolbar-filters.ts`, `property-export-utils.ts`
- [ ] Lease pages: record-rent prefill imports
- [ ] Update navigation tests (`property-shell-tab-navigation.test.ts`, etc.)

**Notifications**

- [ ] Router: `path: "notifications"`; `PropertyNotificationsPage`
- [ ] Move `components/communications/` → `components/notifications/`
- [ ] Tab config: `{ label: "Notifications", path: "notifications" }`
- [ ] `property-shell-tab-visibility.ts`: `tab.path === "notifications"`
- [ ] `notification-routing.ts`: `/notifications?campaignId=…`
- [ ] `notification-stream-handlers.ts`: path checks
- [ ] Release notes forward copy only (optional backfill)

**Exit criteria:** Admin builds; manual QA on Revenue + Notifications tabs; grep shows no `components/income` imports.

---

### Phase 5 — Marketing site (`apps/web`)

**Goal:** Public site matches product language.

- [ ] Rename route `app/(landing)/income/` → `revenue/`
- [ ] Update `marketing-content.ts`, `marketing-mocks.ts`, sitemap paths
- [ ] Update `platform-flow-diagram.tsx`
- [ ] Cross-links from long-term-leases page → `/revenue`
- [ ] Optional: Next.js redirect `/income` → `/revenue`

**Exit criteria:** `bun run build` in web; all internal links resolve.

---

### Phase 6 — Docs & cleanup

**Goal:** Repository docs and grep hygiene.

- [ ] Rename/update `docs/CALCULATION_RULES.md` → revenue terminology (or `REVENUE_CALCULATION_RULES.md`)
- [ ] Update `docs/TENANT_EMAIL_CAMPAIGN_PHASES.md`: Communications → Notifications tab
- [ ] Update `docs/PROPERTY_EXPORTS_PHASES.md`, `CLAUDE.md`, `.claude/skills/data-table/reference.md`
- [ ] Update `docs/LEASE_RENT_PRORATION_PHASES.md` cross-refs (`isRevenueLinePaidForRentSchedule`)
- [ ] `rg "income-line|IncomeLine|property_income|/income"` — expect zero hits outside release-notes history
- [ ] `rg "communications"` in admin — expect zero hits (except historical release notes if kept)

**Exit criteria:** Doc grep clean; `bun run lint` across monorepo.

---

### Phase 7 — Hardening

**Goal:** Production-safe verification.

| Concern | Action |
| ------- | ------ |
| Export jobs | Create revenue export; confirm `resource_type = 'revenue'` persists |
| Rent recording | Record rent from lease detail; confirm `revenue_line` + schedule paid state |
| Refunds | Refund stay + other revenue line; cap math unchanged |
| CSV import | Parse + commit via `/revenue/import/*` |
| Reports | Revenue composition chart data keys |
| Tenant email | Notifications tab deep link from bell notification |
| Constraints | Deleting unit with revenue lines returns `UNIT_HAS_REVENUE` |
| February / proration | Rent schedule still uses `isRevenueLinePaidForRentSchedule` |

**Manual QA checklist**

1. Open property → **Revenue** tab; list loads stays + lines
2. Add short stay + other revenue; amounts match calculation rules
3. **Notifications** tab: compose, queue, SSE progress, history
4. Export revenue table (CSV/XLSX)
5. Property settings: save revenue types
6. Marketing `/revenue` page renders

**Exit criteria:** Full test matrix green; manual QA checklist signed off.

---

## What not to do

- Do **not** leave parallel `/income-*` and `/revenue-*` API routes — single path set only.
- Do **not** rename `property_reservations` table — only its `gross_revenue` / `net_revenue` columns.
- Do **not** rename `tenant-email-campaigns` API unless adding non-email channels (defer).
- Do **not** try to `DROP` enum value `'income'` from `export_resource_type` — Postgres limitation.
- Do **not** duplicate calculation logic during rename — move/rename files, keep formulas identical.
- Do **not** change rent proration math — only symbol/column renames touching `isRevenueLinePaidForRentSchedule`.

---

## Safest sequencing summary

1. **Shared types first** — contract before DB or routes.
2. **Migration second** — server SQL must match new column names before route switch.
3. **Server routes third** — API paths live before admin client update.
4. **Admin + web fourth** — UI and marketing last among code.
5. **Docs + grep fifth** — catch stragglers.
6. **Hardening last** — exports, refunds, notifications deep links.

**Suggested PR split (optional)**

| PR | Scope |
| -- | ----- |
| 1 | Phase 1 shared + Phase 2 migration |
| 2 | Phase 3 server |
| 3 | Phase 4 admin |
| 4 | Phase 5–7 web, docs, hardening |

---

## Edge cases reference

| Scenario | Expected behavior |
| -------- | ----------------- |
| Existing `export_jobs` with `resource_type = 'income'` | Migrated to `'revenue'` in v57 |
| Lease rent payment creates line | Still links via `long_stay_id`; type name “Rent” unchanged |
| `IncomeEntryKind.STAY` in old client | Breaking change — no old clients (early stage) |
| Notification URL bookmarked as `/communications` | 404 unless redirect added (non-goal unless requested) |
| `gross_revenue` on reservation | Same formula as former `gross_income`; reports unchanged numerically |
| Enum `export_resource_type` still contains `'income'` | Unused orphan value; filter only `'revenue'` in app code |

---

## Open decisions (resolve in Phase 0)

1. **Revenue sub-label:** “Revenue type” vs “Category” in forms and settings.
2. **Manual lines:** “Other revenue” vs “Manual revenue” in buttons and toasts.
3. **Marketing redirect:** permanent redirect `/income` → `/revenue` for SEO?
4. **Calculation doc title:** update `CALCULATION_RULES.md` in place vs new filename.
