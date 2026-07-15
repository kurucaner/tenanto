# Data table reference

Template files, naming, imports, and pitfalls for PropertyOS list tables.

## Template files by layer

### Core UI primitives

| Purpose             | Path                                                                 |
| ------------------- | -------------------------------------------------------------------- |
| Table shell         | `apps/admin/src/components/data-table/data-table.tsx`                |
| Column / sort types | `apps/admin/src/components/data-table/data-table-types.ts`           |
| Toolbar layout      | `apps/admin/src/components/data-table/data-table-toolbar.tsx`        |
| Active filter chips | `apps/admin/src/components/data-table/data-table-active-filters.tsx` |
| Row virtualizer     | `apps/admin/src/components/virtualized/virtualized-table-body.tsx`   |
| Footer totals       | `apps/admin/src/components/data-table/data-table-count-footer.tsx`   |
| Sortable header     | `apps/admin/src/components/ui/sortable-table-head.tsx`               |

### URL / filter hooks & libs

| Purpose              | Path                                                                |
| -------------------- | ------------------------------------------------------------------- |
| Filter schema        | `apps/admin/src/lib/url-search-params.ts` (`defineUrlFilterSchema`) |
| Filter read/write    | `apps/admin/src/hooks/use-url-filter-state.ts`                      |
| Sort (`sort`/`dir`)  | `apps/admin/src/hooks/use-url-table-sort.ts`                        |
| Date + `allTime`     | `apps/admin/src/hooks/use-url-date-range-filter.ts`                 |
| Debounced search     | `apps/admin/src/hooks/use-ledger-url-search.ts`                     |
| Infinite scroll      | `apps/admin/src/hooks/use-infinite-scroll-trigger.ts`               |
| Pending vs refetch   | `apps/admin/src/lib/filtered-table-fetch-state.ts`                  |
| Date presets         | `apps/admin/src/lib/date-range-presets.ts`                          |
| Date chip helpers    | `apps/admin/src/lib/ledger-toolbar-date-filters.ts`                 |
| Ledger date default  | `apps/admin/src/lib/report-date-defaults.ts`                        |
| Support date default | `apps/admin/src/lib/support-list-date-defaults.ts`                  |
| Search debounce ms   | `packages/shared/src/list-search-constants.ts`                      |

### Filter panel components

| Component            | Path                                                            |
| -------------------- | --------------------------------------------------------------- |
| Date popover/sheet   | `apps/admin/src/components/filters/date-range-filter-panel.tsx` |
| Mobile/desktop panel | `apps/admin/src/components/filters/responsive-filter-panel.tsx` |
| Search input         | `apps/admin/src/components/filters/search-filter-field.tsx`     |
| Select in panel      | `apps/admin/src/components/filters/filter-select-field.tsx`     |

### Best end-to-end: Support (config-driven)

| Layer                | Path                                                             |
| -------------------- | ---------------------------------------------------------------- |
| List orchestrator    | `apps/admin/src/components/support/support-requests-list.tsx`    |
| Variant config       | `apps/admin/src/components/support/support-list-config.ts`       |
| Infinite hook        | `apps/admin/src/hooks/use-support-requests-list.ts`              |
| Table                | `apps/admin/src/components/support/support-requests-table.tsx`   |
| Toolbar              | `apps/admin/src/components/support/support-requests-toolbar.tsx` |
| Filter panel         | `apps/admin/src/components/support/support-filter-panel.tsx`     |
| Toolbar filters      | `apps/admin/src/lib/support-list-toolbar-filters.ts`             |
| Applied filters type | `apps/admin/src/components/support/support-constants.ts`         |

### Property ledger pages

| Feature  | Page                               | Toolbar                                            | Filter panel                                   | Toolbar filters                  | Infinite hook                                    |
| -------- | ---------------------------------- | -------------------------------------------------- | ---------------------------------------------- | -------------------------------- | ------------------------------------------------ |
| Expenses | `pages/property-expenses-page.tsx` | `components/expenses/property-expense-toolbar.tsx` | `components/expenses/expense-filter-panel.tsx` | `lib/expense-toolbar-filters.ts` | `hooks/use-property-expenses-infinite-list.ts`   |
| Income   | `pages/property-income-page.tsx`   | `components/income/property-income-toolbar.tsx`    | `components/income/income-filter-panel.tsx`    | `lib/income-toolbar-filters.ts`  | `hooks/use-property-income-*-infinite-list.ts`   |
| Leases   | `pages/property-leases-page.tsx`   | `components/leases/property-lease-toolbar.tsx`     | `components/leases/lease-filter-panel.tsx`     | `lib/lease-toolbar-filters.ts`   | `hooks/use-property-long-stays-infinite-list.ts` |
| Exports  | `pages/property-exports-page.tsx`  | `components/exports/property-export-toolbar.tsx`   | (inline)                                       | `lib/export-toolbar-filters.ts`  | `hooks/use-property-exports-infinite-list.ts`    |
| Units    | `pages/property-units-page.tsx`    | `components/units/property-unit-toolbar.tsx`       | `components/units/unit-filter-panel.tsx`       | `lib/unit-toolbar-filters.ts`    | `hooks/use-property-units-infinite-list.ts`      |

### Server

| Purpose             | Path                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------ |
| Keyset cursors      | `apps/server/src/pagination/keyset-cursor.ts`                                        |
| limit+1 helper      | `apps/server/src/pagination/limit-plus-one.ts`                                       |
| Meta on first page  | `apps/server/src/pagination/should-include-list-meta.ts`                             |
| Support route/parse | `apps/server/src/routes/support-routes.ts`, `support-query-utils.ts`                 |
| Support DB/sort     | `apps/server/src/db/support-requests.ts`, `support-requests-list-sort.ts`            |
| Expense route/DB    | `apps/server/src/routes/admin/property-expense-routes.ts`, `db/property-expenses.ts` |
| Date parse helper   | `apps/server/src/routes/admin/admin-query-utils.ts` (`parseDateString`)              |

### Cache / API

| Purpose            | Path                                                 |
| ------------------ | ---------------------------------------------------- |
| Query keys         | `apps/admin/src/lib/query-keys.ts`                   |
| API client         | `apps/admin/src/lib/api-client.ts`                   |
| List meta types    | `packages/shared/src/list-meta-types.ts`             |
| Cache invalidation | `apps/admin/src/lib/invalidate-property-*-caches.ts` |

## Naming conventions

| Artifact            | Pattern                                    | Example                                  |
| ------------------- | ------------------------------------------ | ---------------------------------------- |
| Page                | `property-{resource}-page.tsx`             | `property-expenses-page.tsx`             |
| Table               | `{resource}-table.tsx` or inline           | `support-requests-table.tsx`             |
| Toolbar             | `property-{resource}-toolbar.tsx`          | `property-expense-toolbar.tsx`           |
| Filter panel        | `{resource}-filter-panel.tsx`              | `expense-filter-panel.tsx`               |
| Filter key type     | `T{Resource}FilterKey`                     | `TExpenseFilterKey`                      |
| Toolbar filters lib | `{resource}-toolbar-filters.ts`            | `expense-toolbar-filters.ts`             |
| Infinite hook       | `use-property-{resource}-infinite-list.ts` | `use-property-expenses-infinite-list.ts` |
| Server sort module  | `{resource}-list-sort.ts`                  | `support-requests-list-sort.ts`          |
| Query utils         | `{resource}-query-utils.ts`                | `support-query-utils.ts`                 |
| Row component       | `{Resource}Row` (memo)                     | `ExpenseRow`                             |
| Applied filters     | `TApplied{Feature}Filters`                 | `TAppliedSupportFilters`                 |
| Interfaces / types  | `I*` / `T*` prefix                         | `IPropertyExpensesListQuery`             |

URL param names: camelCase (`categoryId`, `allTime`, `from`, `to`, `q`). Sort URL keys: `sort`, `dir`.

## Row height constants (typical)

| Table             | Height |
| ----------------- | ------ |
| Expenses / leases | 44     |
| Exports           | 56     |
| Income            | 64     |
| Support           | 76     |

## Standard imports

### Components

```ts
import { DataTable } from "@/components/data-table/data-table";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import {
  DataTableActiveFilters,
  type IDataTableActiveFilter,
} from "@/components/data-table/data-table-active-filters";
import {
  type DataTableColumn,
  type DataTableSortController,
} from "@/components/data-table/data-table-types";
import { DateRangeFilterPanel } from "@/components/filters/date-range-filter-panel";
import { ResponsiveFilterPanel } from "@/components/filters/responsive-filter-panel";
import { SearchFilterField } from "@/components/filters/search-filter-field";
import { FilterSelectField } from "@/components/filters/filter-select-field";
import { Card, CardContent } from "@/components/ui/card";
import { TableCell, TableRow } from "@/components/ui/table";
```

### Hooks & libs

```ts
import { useUrlFilterState } from "@/hooks/use-url-filter-state";
import { useUrlTableSort } from "@/hooks/use-url-table-sort";
import { useUrlDateRangeFilter } from "@/hooks/use-url-date-range-filter";
import { useLedgerUrlSearch } from "@/hooks/use-ledger-url-search";
import { useInfiniteScrollTrigger } from "@/hooks/use-infinite-scroll-trigger";
import { defineUrlFilterSchema } from "@/lib/url-search-params";
import { getDateRangeSummary } from "@/lib/date-range-presets";
import { getFilteredTableFetchState } from "@/lib/filtered-table-fetch-state";
import { queryKeys } from "@/lib/query-keys";
import {
  buildLedgerToolbarDateFilterItem,
  buildLedgerToolbarDateClearOnePatch,
} from "@/lib/ledger-toolbar-date-filters";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
```

## Infinite query shape

```ts
const query = useInfiniteQuery({
  queryKey: queryKeys.propertyExpenses(propertyId, filters),
  queryFn: ({ pageParam }) =>
    api.list(propertyId, { ...filters, cursor: pageParam, limit: EXPENSES_LIST_LIMIT }),
  initialPageParam: undefined as string | undefined,
  getNextPageParam: (last) => last.nextCursor ?? undefined,
  placeholderData: keepPreviousData,
});

const rows = query.data?.pages.flatMap((p) => p.expenses) ?? [];
const meta = query.data?.pages[0]?.meta;

const { isFilterRefetching, isTableInitialPending } = getFilteredTableFetchState({
  isFetching: query.isFetching,
  isFetchingNextPage: query.isFetchingNextPage,
  isPending: query.isPending,
  itemCount: rows.length,
});
```

## Server list query shape

```ts
// Route: parse filters, validate cursor matches sort
const parsed = parseListQuery(request.query, reply);
if (parsed == null) return;

const { items, nextCursor } = await db.listPaginated({
  ...parsed.filters,
  cursor: request.query.cursor,
  limit: parsed.limit,
});
return reply.send({ items, nextCursor, meta: shouldIncludeListMeta(cursor) ? await count(...) : undefined });
```

Date conditions (created_at example):

```sql
sr.created_at >= $1::date
sr.created_at < ($2::date + interval '1 day')
```

## Config pattern (multi-variant lists)

```ts
export type TSupportListVariantConfig = {
  emptyMessage: string;
  errorMessage: string;
  fetchPage: (params: { applied: TAppliedFilters; cursor?: string }) => Promise<PageResponse>;
  getQueryKey: (applied: TAppliedFilters) => readonly unknown[];
  intro: AdminPageIntroProps;
  searchPlaceholder: string;
  tableVariant: "admin" | "user";
};
```

## Which example to copy?

| Scenario                                             | Copy from                      |
| ---------------------------------------------------- | ------------------------------ |
| Config-driven list, admin/user variants, server sort | **Support**                    |
| Simple ledger: date + 1–2 filters, no sort           | **Expenses**                   |
| Many filters + server sort                           | **Exports** or **Income**      |
| Footer aggregate counts                              | **Units**                      |
| Minimal server (filters + cursor, no sort module)    | **Expenses** server            |
| Dynamic multi-column server sort                     | **Support** server sort module |

## Common pitfalls

1. **Empty flash on filter change** — missing `keepPreviousData`; using `isPending` instead of `getFilteredTableFetchState`
2. **Cursor after sort change** — cursor encodes sort; new sort = new query key; server must reject mismatched cursor
3. **`cursor` in query key** — breaks infinite query cache
4. **Sentinel ref inside `infiniteScroll` object** — React Compiler issue; keep separate prop
5. **Client sort on paginated data** — only valid when all rows are loaded; otherwise server sort
6. **`allTime` default mismatch** — exports default all-time; ledger pages default current month; support defaults 30 days
7. **Search chip clear** — reset debounced input via `onSearchInputChange("")`, not only URL
8. **Date chip on default range** — hide via `isDefaultDateRange` + `buildLedgerToolbarDateFilterItem`
9. **Meta on every page** — server sends meta only without cursor; read `pages[0]?.meta`
10. **URL params are strings** — type-guard enums before API calls
11. **LIMIT in query key** — inject in hook only
12. **ORDER BY / cursor mismatch** — predicate must match `ORDER BY` exactly

## File checklist (new table)

### `packages/shared`

- [ ] `I*ListQuery`, `T*ListFilters`, `I*ListResponse`
- [ ] `*_LIST_LIMIT`, sort enums/defaults
- [ ] Export in `index.ts`

### `apps/server`

- [ ] Route + `parse*ListQuery`
- [ ] `db/*` listPaginated + conditions
- [ ] Keyset cursor + optional `*-list-sort.ts`
- [ ] `*.test.ts` for parse/sort

### `apps/admin`

- [ ] `api-client` search params + method
- [ ] `query-keys` entry
- [ ] `use-*-infinite-list.ts`
- [ ] `*-toolbar-filters.ts`
- [ ] `*-filter-panel.tsx`
- [ ] `property-*-toolbar.tsx` or list orchestrator
- [ ] `*-table.tsx` with DataTable + memo rows
- [ ] Page or list wiring URL schema + applied filters
