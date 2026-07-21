import { useEffect, useMemo, useState } from "react";

import { getNavItemsForRole } from "@/config/admin-nav";
import { usePropertiesInfiniteList } from "@/hooks/use-properties-infinite-list";
import { useRecentProperties } from "@/hooks/use-recent-properties";
import {
  buildPropertyPaletteCommandItems,
  buildPropertyTabsPaletteCommandItems,
  buildRecentPaletteCommandItems,
  type IGlobalCommandPaletteItem,
} from "@/lib/global-command-palette-items";
import {
  getPropertyShellTabSearchTerms,
  getSearchablePropertyShellTabs,
} from "@/lib/property-launcher-destinations";
import { parseWorkspaceSearchQuery } from "@/lib/workspace-search-query";
import { LIST_SEARCH_DEBOUNCE_MS, UserType } from "@/packages/shared";
import { useAuthStore } from "@/stores/auth-store";

export interface IWorkspaceCommandSearchTip {
  description: string;
  id: string;
  keyword: string;
  path: string;
}

function filterNavigationItems(search: string, userType: UserType) {
  const normalizedSearch = search.trim().toLowerCase();

  return getNavItemsForRole(userType).filter((item) => {
    if (normalizedSearch === "") {
      return true;
    }

    return item.title.toLowerCase().includes(normalizedSearch);
  });
}

export function buildWorkspaceSearchTips(userType: UserType): IWorkspaceCommandSearchTip[] {
  const tabTips = getSearchablePropertyShellTabs().map((tab) => {
    const searchTerms = getPropertyShellTabSearchTerms(tab);

    return {
      description: `Open ${tab.label} on any property`,
      id: `tip-tab-${tab.path === "" ? "overview" : tab.path}`,
      keyword: searchTerms[0] ?? tab.label.toLowerCase(),
      path: "/properties",
    };
  });

  const navTips = getNavItemsForRole(userType)
    .filter((item) => item.href !== "/home")
    .slice(0, 6)
    .map((item) => ({
      description: `Go to ${item.title}`,
      id: `tip-${item.href}`,
      keyword: item.title.toLowerCase().replace(/\s+/g, ""),
      path: item.href,
    }));

  return [...tabTips, ...navTips];
}

function buildPropertiesGroupHeading(matchedTabLabels: string[]): string | undefined {
  if (matchedTabLabels.length === 0) {
    return undefined;
  }

  if (matchedTabLabels.length === 1) {
    return `Properties → ${matchedTabLabels[0]}`;
  }

  return `Properties → ${matchedTabLabels.join(", ")}`;
}

export function useWorkspaceCommandSearch({ enabled }: { enabled: boolean }) {
  const currentUser = useAuthStore((state) => state.user);
  const userType = currentUser?.userType ?? UserType.USER;
  const recentEntries = useRecentProperties();
  const [search, setSearch] = useState("");
  const [debouncedPropertyQuery, setDebouncedPropertyQuery] = useState("");

  const parsedQuery = useMemo(() => parseWorkspaceSearchQuery(search), [search]);
  const isSearching = search.trim().length > 0;

  useEffect(() => {
    const timeoutId = globalThis.setTimeout(() => {
      setDebouncedPropertyQuery(parsedQuery.propertyQuery);
    }, LIST_SEARCH_DEBOUNCE_MS);

    return () => globalThis.clearTimeout(timeoutId);
  }, [parsedQuery.propertyQuery]);

  const isPropertyQueryReady =
    parsedQuery.mode === "tabOnly" ||
    (parsedQuery.propertyQuery !== "" && debouncedPropertyQuery === parsedQuery.propertyQuery) ||
    (parsedQuery.propertyQuery === "" && debouncedPropertyQuery === "");

  const propertiesQueryEnabled = enabled && isSearching && isPropertyQueryReady;

  const {
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isPending,
    properties,
  } = usePropertiesInfiniteList({
    enabled: propertiesQueryEnabled,
    q: parsedQuery.mode === "tabOnly" ? undefined : debouncedPropertyQuery || undefined,
  });

  useEffect(() => {
    if (
      !propertiesQueryEnabled ||
      parsedQuery.mode !== "tabOnly" ||
      !hasNextPage ||
      isFetchingNextPage
    ) {
      return;
    }

    fetchNextPage().catch(() => undefined);
  }, [
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    parsedQuery.mode,
    propertiesQueryEnabled,
  ]);

  const propertyById = useMemo(
    () => new Map(properties.map((property) => [property.id, property])),
    [properties]
  );

  const navigationItems: IGlobalCommandPaletteItem[] = useMemo(
    () =>
      filterNavigationItems(search, userType).map((item) => ({
        id: `nav-${item.href}`,
        label: item.title,
        path: item.href,
        value: item.title,
      })),
    [search, userType]
  );

  const recentItems: IGlobalCommandPaletteItem[] = useMemo(() => {
    if (isSearching) {
      return [];
    }

    return recentEntries.flatMap((recentEntry) =>
      buildRecentPaletteCommandItems(recentEntry, propertyById.get(recentEntry.id), currentUser)
    );
  }, [currentUser, isSearching, propertyById, recentEntries]);

  const propertyItems: IGlobalCommandPaletteItem[] = useMemo(() => {
    if (!isSearching || !propertiesQueryEnabled) {
      return [];
    }

    if (parsedQuery.matchedTabs.length > 0) {
      return properties.flatMap((property) =>
        buildPropertyTabsPaletteCommandItems(property, parsedQuery.matchedTabs, currentUser)
      );
    }

    return properties.flatMap((property) =>
      buildPropertyPaletteCommandItems(property, currentUser)
    );
  }, [currentUser, isSearching, parsedQuery.matchedTabs, properties, propertiesQueryEnabled]);

  const propertiesGroupHeading = useMemo(
    () => buildPropertiesGroupHeading(parsedQuery.matchedTabs.map((tab) => tab.label)),
    [parsedQuery.matchedTabs]
  );

  const searchTips = useMemo(() => buildWorkspaceSearchTips(userType), [userType]);

  const hasResults =
    navigationItems.length > 0 || recentItems.length > 0 || propertyItems.length > 0;

  const resetSearch = () => {
    setSearch("");
    setDebouncedPropertyQuery("");
  };

  return {
    hasResults,
    isFetching,
    isPending,
    isSearching,
    navigationItems,
    propertiesGroupHeading,
    propertyItems,
    recentItems,
    resetSearch,
    search,
    searchTips,
    setSearch,
  };
}
