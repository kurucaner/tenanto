import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import {
  DateRangePreset,
  matchDateRangePreset,
  resolveDateRangePreset,
  type TDateRangePresetId,
} from "@/lib/date-range-presets";
import {
  buildDateRangeUrlUpdates,
  type DefinedUrlFilterSchema,
  patchSearchParams,
} from "@/lib/url-search-params";

interface UseUrlDateRangeFilterOptions<T extends { from: string; to: string }> {
  allTime: boolean;
  allTimeDefault?: boolean;
  allTimeParam?: string;
  dateFilterSchema: DefinedUrlFilterSchema<T>;
  from: string;
  to: string;
}

export function useUrlDateRangeFilter<T extends { from: string; to: string }>({
  allTime,
  allTimeDefault = false,
  allTimeParam = "allTime",
  dateFilterSchema,
  from,
  to,
}: UseUrlDateRangeFilterOptions<T>) {
  const [, setSearchParams] = useSearchParams();

  const applyDateRangePatch = useCallback(
    (patch: { allTime?: boolean; from?: string; to?: string }) => {
      setSearchParams(
        (current) =>
          patchSearchParams(
            current,
            buildDateRangeUrlUpdates(dateFilterSchema, patch, { allTimeDefault, allTimeParam })
          ),
        { replace: true }
      );
    },
    [allTimeDefault, allTimeParam, dateFilterSchema, setSearchParams]
  );

  const activePreset = useMemo(
    () => (allTime ? DateRangePreset.ALL : matchDateRangePreset(from, to)),
    [allTime, from, to]
  );

  const displayFrom = allTime ? "" : from;
  const displayTo = allTime ? "" : to;
  const effectiveFrom = allTime ? "" : from;
  const effectiveTo = allTime ? "" : to;

  const onPresetChange = useCallback(
    (presetId: TDateRangePresetId) => {
      if (presetId === DateRangePreset.ALL) {
        applyDateRangePatch({ allTime: true });
        return;
      }

      const resolved = resolveDateRangePreset(presetId);
      if (resolved === null) {
        return;
      }

      applyDateRangePatch({ allTime: false, ...resolved });
    },
    [applyDateRangePatch]
  );

  const onFromChange = useCallback(
    (value: string) => {
      if (!value && !to) {
        applyDateRangePatch({ allTime: true });
        return;
      }

      applyDateRangePatch({ allTime: false, from: value });
    },
    [applyDateRangePatch, to]
  );

  const onToChange = useCallback(
    (value: string) => {
      if (!from && !value) {
        applyDateRangePatch({ allTime: true });
        return;
      }

      applyDateRangePatch({ allTime: false, to: value });
    },
    [applyDateRangePatch, from]
  );

  return {
    activePreset,
    displayFrom,
    displayTo,
    effectiveFrom,
    effectiveTo,
    onFromChange,
    onPresetChange,
    onToChange,
  };
}
