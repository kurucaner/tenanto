import { useCallback, useMemo } from "react";

import { useUrlFilterState } from "@/hooks/use-url-filter-state";
import { defineUrlTabSchema, resolveUrlTab } from "@/lib/url-tab-state";

export function useUrlTabState<const T extends readonly string[]>(
  tabs: T,
  defaultTab: T[number],
  options?: { param?: string }
): {
  activeTab: T[number];
  setActiveTab: (tab: T[number]) => void;
} {
  const tabConfig = useMemo(
    () => defineUrlTabSchema(tabs, { defaultTab, param: options?.param }),
    [defaultTab, options?.param, tabs]
  );

  const { filters, setFilter } = useUrlFilterState(tabConfig.schema);

  const activeTab = useMemo(
    () => resolveUrlTab(filters.tab, tabs, defaultTab),
    [defaultTab, filters.tab, tabs]
  );

  const setActiveTab = useCallback(
    (tab: T[number]) => {
      setFilter("tab", tab);
    },
    [setFilter]
  );

  return { activeTab, setActiveTab };
}
