export type TPropertyLongStaysListSortBy = "end" | "rent" | "start" | "status" | "tenant" | "unit";

export type TPropertyLongStaysListSortDir = "asc" | "desc";

export const LEASES_LIST_LIMIT = 50;
export const LEASES_LIST_MAX_LIMIT = 100;

export const LEASES_DEFAULT_SORT_BY: TPropertyLongStaysListSortBy = "start";
export const LEASES_DEFAULT_SORT_DIR: TPropertyLongStaysListSortDir = "desc";

export const LEASES_SORT_BY_VALUES = [
  "unit",
  "tenant",
  "start",
  "end",
  "rent",
  "status",
] as const satisfies readonly TPropertyLongStaysListSortBy[];

export const LEASES_SORT_DIR_VALUES = [
  "asc",
  "desc",
] as const satisfies readonly TPropertyLongStaysListSortDir[];
