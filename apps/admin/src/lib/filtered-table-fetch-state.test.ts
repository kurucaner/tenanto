import { describe, expect, test } from "bun:test";

import { getFilteredTableFetchState } from "./filtered-table-fetch-state";

describe("getFilteredTableFetchState", () => {
  test("shows skeleton only on initial load with no rows", () => {
    expect(
      getFilteredTableFetchState({
        isFetching: true,
        isFetchingNextPage: false,
        isPending: true,
        itemCount: 0,
      })
    ).toEqual({
      isFilterRefetching: false,
      isTableInitialPending: true,
    });
  });

  test("dims table during filter refetch when rows are visible", () => {
    expect(
      getFilteredTableFetchState({
        isFetching: true,
        isFetchingNextPage: false,
        isPending: true,
        itemCount: 12,
      })
    ).toEqual({
      isFilterRefetching: true,
      isTableInitialPending: false,
    });
  });

  test("does not dim table while fetching next page", () => {
    expect(
      getFilteredTableFetchState({
        isFetching: true,
        isFetchingNextPage: true,
        isPending: false,
        itemCount: 12,
      })
    ).toEqual({
      isFilterRefetching: false,
      isTableInitialPending: false,
    });
  });
});
