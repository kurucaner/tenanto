import { useCallback, useMemo } from "react";

import {
  matchDateRangePreset,
  resolveDateRangePreset,
  type TDateRangePresetId,
} from "@/lib/date-range-presets";

interface UseUrlDateRangeFilterOptions {
  from: string;
  setFilters: (patch: { from?: string; to?: string }) => void;
  to: string;
}

export function useUrlDateRangeFilter({ from, setFilters, to }: UseUrlDateRangeFilterOptions) {
  const activePreset = useMemo(() => matchDateRangePreset(from, to), [from, to]);

  const onPresetChange = useCallback(
    (presetId: TDateRangePresetId) => {
      const resolved = resolveDateRangePreset(presetId);
      if (resolved === null) {
        setFilters({ from: "", to: "" });
        return;
      }

      setFilters(resolved);
    },
    [setFilters]
  );

  const onFromChange = useCallback(
    (value: string) => {
      setFilters({ from: value });
    },
    [setFilters]
  );

  const onToChange = useCallback(
    (value: string) => {
      setFilters({ to: value });
    },
    [setFilters]
  );

  return {
    activePreset,
    effectiveFrom: from,
    effectiveTo: to,
    onFromChange,
    onPresetChange,
    onToChange,
  };
}
