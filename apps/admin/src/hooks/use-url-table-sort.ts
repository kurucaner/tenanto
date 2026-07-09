import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import {
  getAriaSort,
  type ISortState,
  type TAriaSort,
  type TSortDirection,
} from "@/lib/table-sort";
import {
  getSortParamKeys,
  parseSortParam,
  patchSearchParams,
  serializeSortParam,
} from "@/lib/url-search-params";

export function useUrlTableSort({
  defaultColumnId,
  defaultDirection = "asc",
  prefix,
}: {
  defaultColumnId: string;
  defaultDirection?: TSortDirection;
  prefix?: string;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { column: columnParam, direction: dirParam } = getSortParamKeys(prefix);

  const sortState = useMemo(
    () =>
      parseSortParam(
        searchParams.get(columnParam),
        searchParams.get(dirParam),
        defaultColumnId,
        defaultDirection
      ),
    [columnParam, defaultColumnId, defaultDirection, dirParam, searchParams]
  );

  const setSortState = useCallback(
    (next: ISortState) => {
      const serialized = serializeSortParam(next, defaultColumnId, defaultDirection);
      setSearchParams(
        (current) =>
          patchSearchParams(current, {
            [columnParam]: serialized.column,
            [dirParam]: serialized.direction,
          }),
        { replace: true }
      );
    },
    [columnParam, defaultColumnId, defaultDirection, dirParam, setSearchParams]
  );

  const toggleSort = useCallback(
    (columnId: string) => {
      setSortState(
        sortState.columnId === columnId
          ? {
              columnId,
              direction: sortState.direction === "asc" ? "desc" : "asc",
            }
          : { columnId, direction: "asc" }
      );
    },
    [setSortState, sortState.columnId, sortState.direction]
  );

  const getColumnAriaSort = useCallback(
    (columnId: string): TAriaSort => getAriaSort(columnId, sortState),
    [sortState]
  );

  const getColumnDirection = useCallback(
    (columnId: string): TSortDirection | null =>
      sortState.columnId === columnId ? sortState.direction : null,
    [sortState.columnId, sortState.direction]
  );

  return {
    getColumnAriaSort,
    getColumnDirection,
    setSortState,
    sortState,
    toggleSort,
  };
}
