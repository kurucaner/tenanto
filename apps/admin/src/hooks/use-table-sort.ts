import { useCallback, useState } from "react";

import {
  getAriaSort,
  type ISortState,
  type TAriaSort,
  type TSortDirection,
} from "@/lib/table-sort";

export function useTableSort(defaultColumnId: string, defaultDirection: TSortDirection = "asc") {
  const [sortState, setSortState] = useState<ISortState>({
    columnId: defaultColumnId,
    direction: defaultDirection,
  });

  const toggleSort = useCallback((columnId: string) => {
    setSortState((current) => {
      if (current.columnId === columnId) {
        return {
          columnId,
          direction: current.direction === "asc" ? "desc" : "asc",
        };
      }
      return { columnId, direction: "asc" };
    });
  }, []);

  const getColumnAriaSort = useCallback(
    (columnId: string): TAriaSort => getAriaSort(columnId, sortState),
    [sortState]
  );

  const getColumnDirection = useCallback(
    (columnId: string): TSortDirection | null =>
      sortState.columnId === columnId ? sortState.direction : null,
    [sortState]
  );

  return {
    getColumnAriaSort,
    getColumnDirection,
    sortState,
    toggleSort,
  };
}
