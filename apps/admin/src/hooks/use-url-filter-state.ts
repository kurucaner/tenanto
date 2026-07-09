import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import {
  buildFilterSearchPatch,
  type DefinedUrlFilterSchema,
  patchSearchParams,
  readBooleanParam,
  readFiltersFromUrl,
  serializeBooleanParam,
  type UrlFilterValues,
} from "@/lib/url-search-params";

export function useUrlFilterState<T extends Record<string, string>>(
  schema: DefinedUrlFilterSchema<T>
): {
  filters: UrlFilterValues<T>;
  setFilter: <K extends keyof T>(key: K, value: string) => void;
  setFilters: (patch: Partial<UrlFilterValues<T>>) => void;
} {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(
    () => readFiltersFromUrl(searchParams, schema),
    [schema, searchParams]
  ) as UrlFilterValues<T>;

  const setFilters = useCallback(
    (patch: Partial<UrlFilterValues<T>>) => {
      const updates = buildFilterSearchPatch(schema, patch);
      setSearchParams((current) => patchSearchParams(current, updates), { replace: true });
    },
    [schema, setSearchParams]
  );

  const setFilter = useCallback(
    <K extends keyof T>(key: K, value: string) => {
      setFilters({ [key]: value } as Partial<UrlFilterValues<T>>);
    },
    [setFilters]
  );

  return { filters, setFilter, setFilters };
}

export function useUrlFilterBoolean(
  param: string,
  defaultValue: boolean
): [boolean, (value: boolean) => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const value = useMemo(
    () => readBooleanParam(searchParams, param, defaultValue),
    [defaultValue, param, searchParams]
  );

  const setValue = useCallback(
    (next: boolean) => {
      setSearchParams(
        (current) =>
          patchSearchParams(current, {
            [param]: serializeBooleanParam(next, defaultValue),
          }),
        { replace: true }
      );
    },
    [defaultValue, param, setSearchParams]
  );

  return [value, setValue];
}
