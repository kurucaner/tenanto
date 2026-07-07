export type TSortDirection = "asc" | "desc";

export interface ISortState {
  columnId: string;
  direction: TSortDirection;
}

export type TAriaSort = "ascending" | "descending" | "none";

export function compareStrings(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export function compareNumbers(a: number, b: number): number {
  return a - b;
}

export function compareDates(a: string, b: string): number {
  return a.localeCompare(b);
}

export function applySortDirection(comparison: number, direction: TSortDirection): number {
  return direction === "asc" ? comparison : -comparison;
}

export function sortRows<T>(
  rows: T[],
  sortState: ISortState,
  compare: (a: T, b: T) => number
): T[] {
  const sorted = [...rows];
  sorted.sort((a, b) => applySortDirection(compare(a, b), sortState.direction));
  return sorted;
}

export function getAriaSort(
  columnId: string,
  sortState: ISortState
): TAriaSort {
  if (sortState.columnId !== columnId) {
    return "none";
  }
  return sortState.direction === "asc" ? "ascending" : "descending";
}
