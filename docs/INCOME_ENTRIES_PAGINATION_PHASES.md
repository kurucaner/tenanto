# Income Entries Pagination — Implementation Phases

Roadmap for paginating the Property Income ledger safely. The income table merges **short stays** (`property_reservations`) and **other income lines** (`property_income_lines`) into one sortable view. Paginating both APIs independently and merging on the client does **not** produce correct global order — the standard fix is a **unified read API** with **server-side sort** and **keyset cursor pagination**, mirroring the expenses ledger.

**Related code today**

- Income page: `apps/admin/src/pages/property-income-page.tsx` — dual `useQuery` (`shortStaysApi` + `incomeLinesApi`), client `buildMergedEntries` + `sortIncomeEntries`, row virtualization
- Client merge/sort: `apps/admin/src/lib/income-entry-sort.ts`
- Shared entry type: `packages/shared/src/property-income-line-types.ts` → `TPropertyIncomeEntry`
- Short-stays API: `apps/server/src/routes/admin/property-reservation-routes.ts` → `GET /properties/:propertyId/short-stays`
- Income-lines API: `apps/server/src/routes/admin/property-income-line-routes.ts` → `GET /properties/:propertyId/income-lines`
- DB list queries: `apps/server/src/db/property-reservations.ts`, `apps/server/src/db/property-income-lines.ts`
- **Pattern to mirror:** expenses pagination
  - `apps/admin/src/hooks/use-property-expenses-infinite-list.ts`
  - `apps/admin/src/pages/property-expenses-page.tsx` — `useInfiniteQuery`, `useInfiniteScrollTrigger`, `DataTableCountFooter`
  - `apps/server/src/db/property-expenses.ts` — `listPaginatedByProperty`
  - `apps/server/src/pagination/keyset-cursor.ts`, `limit-plus-one.ts`, `should-include-list-meta.ts`
  - `packages/shared/src/property-expense-list-constants.ts` — `EXPENSES_LIST_LIMIT`

**Current problem**

- Both list endpoints return **all matching rows** in one response (income-lines has no cursor; short-stays has optional `limit` but the admin client does not pass it).
- The income page merges and sorts thousands of rows client-side.
- Row virtualization helps scroll/DOM only — it does not reduce fetch, parse, merge, or sort cost.

---

## Guiding principles

1. **Add before replace** — ship the unified list API and verify parity before switching the income page.
2. **Don't break CRUD** — keep `short-stays` and `income-lines` APIs for create/edit/delete/refund/restore and pickers.
3. **Don't paginate two sources and merge** — correct pagination requires a single ordered stream (unified API) for the "All income" view.
4. **Paginate single-source views first** — when the type filter isolates stays or a line type, paginate that one API independently.
5. **Mirror expenses** — keyset cursor (not offset), `limit + 1`, `nextCursor`, `useInfiniteQuery`, infinite scroll sentinel.
6. **Each phase is shippable** — no half-built unified API wired to production UI.

---

## Why not "paginate both APIs and merge"?

The income table is one globally sorted list built from two sources:

- stays sorted by `checkIn`
- lines sorted by `transactionDate`

If each API returns "page 1" independently, there is no way to know the true global page 1 after merging. Over-fetching from both (often everything) defeats the purpose.

This approach **only** works when the user views **one source**:

| Filter | Data source |
| ------ | ----------- |
| Stay | `short-stays` only |
| Specific line type | `income-lines` only |
| All / empty | **unified `income-entries` API** (Phase 3+) |

---

## Target architecture

```
Income page (All view)
        ↓
GET /properties/:propertyId/income-entries?cursor&limit&filters&sort
        ↓
UNION ALL (stays + lines) with normalized sort keys
        ↓
ORDER BY sort columns → LIMIT n+1 → nextCursor
        ↓
Map rows → TPropertyIncomeEntry[]
        ↓
useInfiniteQuery → flatMap pages → virtualized table + scroll sentinel

CRUD / pickers / import duplicate check
        ↓
Existing short-stays + income-lines APIs (bounded/paginated where needed)
```

### Canonical default sort (Phase 3–4)

`date DESC, createdAt DESC, id DESC`

- stays: `date` = `checkIn`
- lines: `date` = `transactionDate`

### API ownership

| Use case | API |
| -------- | --- |
| Income table — All view | `GET .../income-entries` (new) |
| Income table — Stay only | `GET .../short-stays` (paginated) |
| Income table — Line type only | `GET .../income-lines` (paginated) |
| Create/edit/delete/refund stay | `short-stays` |
| Create/edit/delete/refund line | `income-lines` |
| Link-to-stay picker | `short-stays` (filtered, paginated) |
| CSV import duplicate preview | `short-stays` (bounded) or dedicated check endpoint |

---

## Phase 0 — Guardrails (no behavior change)

**Goal:** Establish contracts and reduce risk before pagination.

### Backend

- [x] Add shared types in `packages/shared`:
  - `IPropertyIncomeEntriesListQuery` — filters + `cursor` + `limit` + (later) `sortBy` / `sortDir`
  - `IPropertyIncomeEntriesListResponse` — `entries: TPropertyIncomeEntry[]`, `nextCursor`, optional `meta`
  - `IPropertyIncomeEntriesListMeta` — `totalCount` (in `list-meta-types.ts`)
  - `INCOME_ENTRIES_LIST_LIMIT` — start with `50` (match `EXPENSES_LIST_LIMIT`)
- [x] Export new types/constants from `packages/shared/src/index.ts`
- [x] Document canonical default sort: `date DESC, createdAt DESC, id DESC`

### Frontend

- [x] Add query key: `adminQueryKeys.propertyIncomeEntries(propertyId, filters)`
- [x] Extend `invalidatePropertyIncomeCaches` to also invalidate the new query key (stub is fine until Phase 4)
- [x] No API switch yet — no user-visible change

**Exit criteria:** Types compile; no user-visible change.

---

## Phase 1 — Quick win: shrink the dataset (low risk)

**Goal:** Cut load immediately without a new list API.

### Backend

- [ ] Optional: log or monitor list response sizes per property (no API change required)

### Frontend

- [ ] Add a **default date range** on the income page (e.g. current month or YTD)
- [ ] Keep "clear dates" / "All time" available, but not the default
- [ ] Show a subtle hint when no date filter is active: e.g. "Showing all time — narrow dates for faster loading"

**Exit criteria:** Default view loads fewer rows; unfiltered all-time still works via the old path.

**Why first:** Zero API risk; immediate perf gain on large properties.

---

## Phase 2 — Paginate each source independently (single-type views only)

**Goal:** Paginate when the filter isolates one data source. **Do not** use this for the merged "All" view.

### Backend

- [ ] Add optional `cursor` + `limit` to `GET /properties/:propertyId/short-stays`
  - short-stays already accepts `limit`; add keyset cursor encoding/decoding
  - cursor matches `ORDER BY check_in DESC, created_at DESC, id DESC`
- [ ] Add optional `cursor` + `limit` to `GET /properties/:propertyId/income-lines`
  - cursor matches `ORDER BY transaction_date DESC, created_at DESC, id DESC`
- [ ] Reuse existing pagination utilities:
  - `takePageWithNextCursor` (`apps/server/src/pagination/limit-plus-one.ts`)
  - new encode/decode helpers in `apps/server/src/pagination/keyset-cursor.ts`
  - `shouldIncludeListMeta` for first-page `totalCount`
- [ ] Add `listPaginatedByProperty` (or equivalent) to:
  - `apps/server/src/db/property-reservations.ts`
  - `apps/server/src/db/property-income-lines.ts`
- [ ] **Backward compatible:** if `cursor`/`limit` omitted, retain current "return all" behavior temporarily (or cap at a safe max — decide in Phase 0)

### Frontend

- [ ] Add hooks (mirror `use-property-expenses-infinite-list.ts`):
  - `usePropertyShortStaysInfiniteList`
  - `usePropertyIncomeLinesInfiniteList`
- [ ] On income page:
  - filter = **Stay** → short-stays infinite list only
  - filter = **specific line type** → income-lines infinite list only
  - filter = **All / empty** → **keep current dual-fetch + client merge** (unchanged)
- [ ] Add `DataTableCountFooter` + `useInfiniteScrollTrigger` for paginated modes only
- [ ] Keep client sort for now (smaller pages make this acceptable)

**Exit criteria:** Stay-only and line-type-only views paginate correctly; All view unchanged.

---

## Phase 3 — Unified read API (backend only)

**Goal:** Build the correct merged list on the server. **Do not switch the income page yet.**

### Backend

- [ ] New route: `GET /properties/:propertyId/income-entries`
- [ ] New DB module: e.g. `apps/server/src/db/property-income-entries.ts`
  - `listPaginatedByProperty(propertyId, filters, { cursor, limit, includeDeleted })`
  - `UNION ALL` stays + lines into a normalized shape
  - Apply existing filters: `from`, `to`, `unitId`, `incomeType`, `channelCommissionId`, `status`, etc.
  - **Phase 3 sort:** server-side `date DESC` only (match current default)
  - Keyset cursor on `(sortDate, createdAt, id, entryKind)` — include `entryKind` in cursor to disambiguate ties across tables
- [ ] Map DB rows to existing `TPropertyIncomeEntry` (reuse mappers where possible)
- [ ] Register route in `apps/server/src/server.ts`
- [ ] Tests:
  - Same filters → unified result matches client `buildMergedEntries` + `sortIncomeEntries(date desc)`
  - Cursor continuity — no duplicates or gaps across pages
  - Filter edge cases: stay-only filters, line-only filters, deleted/refunded rows

### Frontend

- [ ] Add `incomeEntriesApi.list` in `apps/admin/src/lib/api-client.ts`
- [ ] No page switch yet (optional: dev-only flag to exercise the endpoint locally)

**Exit criteria:** API + tests green; parity with current merged list for default sort.

---

## Phase 4 — Switch "All income" view to unified API

**Goal:** Remove the expensive dual-fetch merge for the main table.

### Backend

- [ ] Return `meta.totalCount` on the first page (same pattern as expenses — `shouldIncludeListMeta`)
- [ ] Monitor query time; add indexes if needed:
  - `property_reservations(property_id, check_in, created_at)`
  - `property_income_lines(property_id, transaction_date, created_at)`

### Frontend

- [ ] Add `usePropertyIncomeEntriesInfiniteList` (copy expenses hook shape)
- [ ] Income page routing logic:
  - **All / empty type filter** → unified `income-entries` infinite query
  - **Stay only** → short-stays infinite (Phase 2)
  - **Line type only** → income-lines infinite (Phase 2)
- [ ] Remove `buildMergedEntries` from the All path
- [ ] Add infinite scroll footer on All view
- [ ] Update `invalidatePropertyIncomeCaches` to invalidate the unified query key

**Exit criteria:** All view uses one API; CRUD/refund/restore still work; pickers unaffected.

---

## Phase 5 — Server-side sorting (multi-column)

**Goal:** Move sort off the client for paginated views.

### Backend

- [ ] Add `sortBy` + `sortDir` to `IPropertyIncomeEntriesListQuery`
- [ ] Implement server sort column by column (priority order):
  1. `date` (default)
  2. `net` / `gross`
  3. `unit`, `guest`, `type`
  4. remaining columns as needed (`channel`, `status`, `nights`, `roomTotal`, `cleaning`, `taxes`, `commission`, `netPayout`, `checkOut`)
- [ ] Project sort fields in the UNION query (or computed columns per branch)
- [ ] Encode sort dimensions in the keyset cursor (same idea as `ExpenseKeysetCursorV1`)

### Frontend

- [ ] Wire `useUrlTableSort` → API params instead of `sortIncomeEntries` on paginated paths
- [ ] Disable client sort when server sort is active
- [ ] Reset cursor when sort or filters change (standard `useInfiniteQuery` behavior — new `queryKey` handles this)

**Exit criteria:** Changing sort column fetches correct global order across pages.

---

## Phase 6 — Cleanup + hardening

**Goal:** Remove migration cruft; lock in performance.

### Backend

- [ ] Decide fate of unpaginated list behavior:
  - **Keep** list endpoints for pickers/dialogs/import duplicate checks, but add sensible `limit` defaults
  - Or add lightweight endpoints: e.g. duplicate-key check for import preview
- [ ] Remove "return all" behavior from list endpoints if still present (or enforce a max limit)
- [ ] Add slow-query monitoring / alerts for `income-entries`

### Frontend

- [ ] Delete dead merge/sort code paths from the income page
- [ ] Ensure import dialog duplicate check does not fetch full stay history (use date-bounded query or dedicated endpoint)
- [ ] Final UX: loading next-page state, empty states, total count footer

**Exit criteria:** Income page has one pagination architecture; no full-property dual fetch on initial load.

---

## Ship order summary

| Phase | Backend | Frontend | Risk |
| ----- | ------- | -------- | ---- |
| 0 | Types/contracts | Query keys, invalidation stub | None |
| 1 | — (optional monitoring) | Default date filter | Very low |
| 2 | Paginate short-stays + income-lines | Infinite scroll for single-type filters | Low |
| 3 | New `income-entries` API + tests | API client only | Low (unused in prod UI) |
| 4 | Indexes, meta | Switch All view to unified API | Medium |
| 5 | Server sort | Wire URL sort to API | Medium |
| 6 | Limits, cleanup | Remove legacy merge paths | Low |

---

## Safety checklist (every phase)

- [ ] Old list endpoints still work for dialogs, pickers, and import flows
- [ ] Cache invalidation covers new query keys
- [ ] Filter/sort change resets pagination (new `queryKey` or explicit reset)
- [ ] Compare unified API output vs old client merge in tests **before** FE switch (Phase 3 → 4 gate)
- [ ] Keyset cursor only — no offset pagination (`page=2`)
- [ ] Row virtualization retained on the table

---

## Design decisions (lock in Phase 0)

| Decision | Recommendation |
| -------- | -------------- |
| Pagination style | Keyset cursor (match expenses) |
| Page size | `50` (`INCOME_ENTRIES_LIST_LIMIT`) |
| Default sort | `date DESC, createdAt DESC, id DESC` |
| All-view data source | Unified `income-entries` API (Phase 4+) |
| Single-type views | Paginate existing APIs (Phase 2) |
| Offset pagination | No — poor performance at scale |
| Client merge for All view | Temporary only — remove in Phase 4 |
| CRUD APIs | Unchanged — `short-stays` + `income-lines` |
| Default date filter | Yes (Phase 1) — current month or YTD |
