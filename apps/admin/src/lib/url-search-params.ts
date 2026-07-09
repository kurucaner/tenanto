import type { ISortState, TSortDirection } from "@/lib/table-sort";

export function readParam(
  searchParams: URLSearchParams,
  key: string,
  defaultValue: string
): string {
  const raw = searchParams.get(key);
  if (raw === null || raw === "") return defaultValue;
  return raw;
}

export function readBooleanParam(
  searchParams: URLSearchParams,
  key: string,
  defaultValue: boolean
): boolean {
  const raw = searchParams.get(key);
  if (raw === null || raw === "") return defaultValue;
  return raw === "true";
}

export function serializeParam(value: string, defaultValue: string): string | null {
  if (value === defaultValue || value === "") return null;
  return value;
}

export function serializeBooleanParam(value: boolean, defaultValue: boolean): string | null {
  if (value === defaultValue) return null;
  return value ? "true" : "false";
}

export function patchSearchParams(
  current: URLSearchParams,
  updates: Record<string, string | null | undefined>
): URLSearchParams {
  const next = new URLSearchParams(current);
  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === undefined || value === "") {
      next.delete(key);
    } else {
      next.set(key, value);
    }
  }
  return next;
}

export function parseSortParam(
  columnRaw: string | null,
  dirRaw: string | null,
  defaultColumn: string,
  defaultDir: TSortDirection
): ISortState {
  const direction: TSortDirection = dirRaw === "asc" || dirRaw === "desc" ? dirRaw : defaultDir;
  return {
    columnId: columnRaw?.trim() ? columnRaw : defaultColumn,
    direction,
  };
}

export function serializeSortParam(
  sortState: ISortState,
  defaultColumn: string,
  defaultDir: TSortDirection
): { column: string | null; direction: string | null } {
  return {
    column: serializeParam(sortState.columnId, defaultColumn),
    direction: serializeParam(sortState.direction, defaultDir),
  };
}

export function getSortParamKeys(prefix?: string): { column: string; direction: string } {
  if (!prefix) {
    return { column: "sort", direction: "dir" };
  }
  return { column: `${prefix}Sort`, direction: `${prefix}Dir` };
}

export type UrlFilterDef = {
  defaultValue: string;
  param?: string;
};

export type UrlFilterSchema<T extends Record<string, string>> = {
  [K in keyof T]: UrlFilterDef;
};

/** URL param values are always strings; widen literal defaults for callers. */
export type UrlFilterValues<T extends Record<string, string>> = {
  [K in keyof T]: string;
};

declare const urlFilterSchemaBrand: unique symbol;

export type DefinedUrlFilterSchema<T extends Record<string, string>> = UrlFilterSchema<T> & {
  readonly [urlFilterSchemaBrand]: T;
};

export function defineUrlFilterSchema<T extends Record<string, string>>(
  schema: UrlFilterSchema<T>
): DefinedUrlFilterSchema<T> {
  return schema as DefinedUrlFilterSchema<T>;
}

export function readFiltersFromUrl<T extends Record<string, string>>(
  searchParams: URLSearchParams,
  schema: DefinedUrlFilterSchema<T>
): UrlFilterValues<T> {
  const result = {} as UrlFilterValues<T>;
  for (const key of Object.keys(schema) as (keyof T & string)[]) {
    const def = schema[key]!;
    const param = def.param ?? String(key);
    result[key] = readParam(searchParams, param, def.defaultValue);
  }
  return result;
}

export function buildFilterSearchPatch<T extends Record<string, string>>(
  schema: DefinedUrlFilterSchema<T>,
  patch: Partial<UrlFilterValues<T>>
): Record<string, string | null> {
  const updates: Record<string, string | null> = {};
  for (const key of Object.keys(patch) as (keyof T & string)[]) {
    const value = patch[key];
    if (value === undefined) continue;
    const def = schema[key]!;
    const param = def.param ?? String(key);
    updates[param] = serializeParam(value, def.defaultValue);
  }
  return updates;
}
