---
name: data-table
description: >-
  Scaffold or migrate admin DataTables in PropertyOS following repo conventions — virtualized
  DataTable, URL-backed filters/sort/search/date, infinite scroll with keyset cursors,
  toolbar chips, shared list types, server list endpoints, and TanStack Query cache keys.
  Use when creating a new table, migrating an existing table to DataTable, adding list
  filters/sorting/search/date persistence, or when the user mentions table conventions.
---

# PropertyOS data table conventions

Build or migrate list UIs to match existing ledger/support tables. **Read the codebase first** — copy the closest example; do not invent patterns.

## Choose your path

| Situation                                                  | Primary template                      | Orchestrator location                                                           |
| ---------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------- |
| **New global list** (admin + user variants, config-driven) | Support                               | `components/{feature}/{feature}-requests-list.tsx` + `{feature}-list-config.ts` |
| **New property ledger list** (date + filters, page-owned)  | Expenses                              | `pages/property-{resource}-page.tsx`                                            |
| **Migrate existing table**                                 | Closest ledger page                   | Same file, refactor in place                                                    |
| **Sortable + searchable + date**                           | Support (server) + Expenses (toolbar) | Both                                                                            |
| **Footer totals / meta**                                   | Units                                 | `DataTableCountFooter`                                                          |
| **Many filters + server sort**                             | Exports or Income                     | Page + `*-list-sort.ts`                                                         |

Full file index, imports, and pitfalls: [reference.md](reference.md).

## Architecture (do not skip layers)

```
URL schema → applied filters → useInfiniteQuery → DataTable
     ↓              ↓                  ↓
useUrlTableSort   api-client      memo Row + virtualization
useUrlDateRange   queryKeys       infinite scroll sentinel
useLedgerUrlSearch  server keyset cursor
```

**Data persistence** = URL search params (`replace: true`). Filters, sort, date range, and search survive refresh/share/back. Defaults are encoded in `defineUrlFilterSchema`, not `useState`.

## Workflow: NEW table

Copy this checklist and track progress:

```
- [ ] 1. Pick template (table above)
- [ ] 2. Shared contract (packages/shared)
- [ ] 3. Server list endpoint + DB pagination
- [ ] 4. api-client + queryKeys + infinite hook
- [ ] 5. URL schema + applied filters + type guards
- [ ] 6. Toolbar filters lib + filter panel + toolbar
- [ ] 7. Table (columns, memo rows, DataTable)
- [ ] 8. Tests + lint/build
```

### 1. Shared contract (`packages/shared`)

Per list resource add:

- `I*ListQuery` — includes `cursor?`, `limit?`, filters, optional `sortBy`/`sortDir`
- `T*ListFilters` — `Pick` of query without `cursor`/`limit`
- `I*ListResponse` — `{ items: T[]; nextCursor: string | null; meta?: … }`
- `*_LIST_LIMIT` / `*_LIST_MAX_LIMIT` when page size is fixed
- Sort enums + `*_DEFAULT_SORT_BY` / `*_DEFAULT_SORT_DIR` if sortable
- Export from `packages/shared/src/index.ts`

### 2. Server

- Route: `GET` with `parse*ListQuery` → 400 on invalid enum/date/cursor
- DB: `build*ListConditions` + `listPaginated*`
- Pagination: `LIMIT limit + 1` → `takePageWithNextCursor` (`apps/server/src/pagination/limit-plus-one.ts`)
- Keyset cursor encode/decode in `apps/server/src/pagination/keyset-cursor.ts` (per resource)
- Sortable lists: separate `*-list-sort.ts` with `resolve*ListSort`, `build*OrderByClause`, `build*CursorPredicate`
- Date filter on timestamp columns: `col >= $n::date` and `col < ($n::date + interval '1 day')`
- `meta` only on first page: `shouldIncludeListMeta(cursor)`
- Tests: query parsing + sort/cursor (see `support-query-utils.test.ts`)

### 3. Admin data layer

- `build*SearchParams` in `apps/admin/src/lib/api-client.ts` — omit empty/undefined params
- `queryKeys.*` in `apps/admin/src/lib/query-keys.ts` — **all filters/sort, no `cursor`/`limit`**
- `use*InfiniteList` hook:
  - `useInfiniteQuery` + `keepPreviousData`
  - `getNextPageParam: (last) => last.nextCursor ?? undefined`
  - Inject `limit` in hook (from shared constant), not in query key
  - `flatMap` pages into rows array

### 4. URL state (orchestrator)

```ts
const schema = defineUrlFilterSchema({
  allTime: { defaultValue: "" },
  from: { defaultValue: defaultDateRange.from },
  to: { defaultValue: defaultDateRange.to },
  q: { defaultValue: "" },
  // feature filters…
});

const { filters, setFilter, setFilters } = useUrlFilterState(schema);
const {
  effectiveFrom,
  effectiveTo,
  displayFrom,
  displayTo,
  activePreset,
  onPresetChange,
  onFromChange,
  onToChange,
} = useUrlDateRangeFilter({
  allTime: filters.allTime === "true",
  dateFilterSchema: schema,
  from: filters.from,
  to: filters.to,
});
const { searchInput, onSearchInputChange } = useLedgerUrlSearch(filters.q, setFilter);
const sort = useUrlTableSort({
  defaultColumnId: DEFAULT_SORT_BY,
  defaultDirection: DEFAULT_SORT_DIR,
});
```

**Date defaults:**

- Ledger pages (expenses, income, leases): `getDefaultReportDateRange()` → current month
- Support list: `getDefaultSupportListDateRange()` → rolling 30 days (`DateRangePreset.MONTH`)
- Exports: `allTime` default `"true"` + `allTimeDefault: true` in `useUrlDateRangeFilter`

**Applied object:** strip empty strings, trim `q`, validate URL strings with type guards before API.

### 5. Toolbar

Create `apps/admin/src/lib/{resource}-toolbar-filters.ts`:

- `T*ToolbarFilterId` — chip ids (`"date" | "q" | …`)
- `count*SecondaryFilters()` — badge on Filters button (excludes date + search)
- `build*ToolbarFilterItems()` — reuse `buildLedgerToolbarDateFilterItem` for date chip
- `build*ToolbarClearOnePatch(id, defaultDateRange)` — date uses `buildLedgerToolbarDateClearOnePatch`
- `build*ToolbarClearAllPatch(defaultDateRange)` — reset date to default, clear `allTime`
- `build*ToolbarClearSecondaryPatch()` — category/status only

Toolbar composition (`*Toolbar.tsx`):

```
DataTableToolbar
  search → SearchFilterField
  controls → DateRangeFilterPanel → *FilterPanel (ResponsiveFilterPanel) → optional RefetchButton
  countLabel → from meta or loaded count
  activeFilters → DataTableActiveFilters chips
```

**Search chip removal:** call `onSearchInputChange("")` **and** URL patch.

### 6. Table

```tsx
<Card className="gap-0 py-0">
  <CardContent className="p-0">
    <DataTable
      columns={COLUMNS}
      emptyMessage="…"
      getItemKey={getItemKey}
      infiniteScroll={{ hasNextPage, isFetchingNextPage }}
      infiniteScrollSentinelRef={scrollSentinelRef} // separate prop — React Compiler
      isPending={isTableInitialPending}
      isRefreshing={isFilterRefetching}
      items={rows}
      renderRow={renderRow}
      sort={sortController}
      toolbar={toolbar}
      virtualization={{ estimateRowHeight: ROW_HEIGHT }}
    />
  </CardContent>
</Card>
```

- Row component: `memo` + `displayName`
- Column `id` must match sort keys when sortable
- `getFilteredTableFetchState` for pending vs refetch dimming
- `useInfiniteScrollTrigger` for sentinel ref

### 7. Config pattern (optional)

Use `*-list-config.ts` when one list serves multiple API variants (admin vs user). Property ledger pages keep logic in the page file.

## Workflow: MIGRATE existing table

1. **Inventory** — current pagination (offset?), filter state (`useState`?), sort (client?), search debounce?
2. **Server first** if offset pagination — add keyset cursor + sort module before UI swap
3. **Replace** raw `<Table>` with `DataTable` + virtualization row height
4. **Move state** → `useUrlFilterState` + schema (shareable URLs)
5. **Extract** toolbar → `DataTableToolbar` + `DateRangeFilterPanel` + `ResponsiveFilterPanel`
6. **Extract** chip/clear logic → `*-toolbar-filters.ts` (never inline chip labels in page)
7. **Wire** `useLedgerUrlSearch`, `useUrlDateRangeFilter`, `useUrlTableSort` as needed
8. **Swap** to `useInfiniteQuery` + `keepPreviousData` + `getFilteredTableFetchState`
9. **Align** query key with all applied filters
10. **Move types** to `packages/shared` if still local
11. **Delete** dead filter bars / offset pagination UI

## Verification

```bash
cd apps/server && bun test src/routes/{resource}-query-utils.test.ts src/db/{resource}-list-sort.test.ts
cd apps/admin && bun run lint && bun run build
```

Manual: change filter → URL updates; refresh → state restored; sort change → new query (no stale cursor); infinite scroll loads next page; clear-all resets to defaults.

## Non-negotiables

- **DRY** — shared filter/date helpers in `*-toolbar-filters.ts` and `ledger-toolbar-date-filters.ts`
- **No `useMemo`/`useCallback` for referential stability alone** — React Compiler handles it
- **Named exports**; `memo` list rows with `displayName`
- **Type imports** use `import { type X }`
- **Strict TS** — guard URL string params before API
- **Do not** put `cursor` in query keys
- **Do not** nest `infiniteScrollSentinelRef` inside `infiniteScroll` object

## Additional resources

- [reference.md](reference.md) — template files, naming table, pitfalls, copy-from guide
