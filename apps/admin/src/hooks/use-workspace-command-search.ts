import { useEffect, useMemo, useState } from "react";

import { getNavItemsForRole } from "@/config/admin-nav";
import { usePropertiesInfiniteList } from "@/hooks/use-properties-infinite-list";
import { useRecentProperties } from "@/hooks/use-recent-properties";
import {
  buildPropertyPaletteCommandItems,
  buildRecentPaletteCommandItems,
  type IGlobalCommandPaletteItem,
} from "@/lib/global-command-palette-items";
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
  return getNavItemsForRole(userType)
    .filter((item) => item.href !== "/home")
    .slice(0, 6)
    .map((item) => ({
      description: `Go to ${item.title}`,
      id: `tip-${item.href}`,
      keyword: item.title.toLowerCase().replace(/\s+/g, ""),
      path: item.href,
    }));
}

export function useWorkspaceCommandSearch({ enabled }: { enabled: boolean }) {
  const currentUser = useAuthStore((state) => state.user);
  const userType = currentUser?.userType ?? UserType.USER;
  const recentEntries = useRecentProperties();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timeoutId = globalThis.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, LIST_SEARCH_DEBOUNCE_MS);

    return () => globalThis.clearTimeout(timeoutId);
  }, [search]);

  const isSearching = debouncedSearch.length > 0;

  const { isPending, properties } = usePropertiesInfiniteList({
    enabled,
    q: isSearching ? debouncedSearch : undefined,
  });

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
    if (!isSearching) {
      return [];
    }

    return properties.flatMap((property) =>
      buildPropertyPaletteCommandItems(property, currentUser)
    );
  }, [currentUser, isSearching, properties]);

  const searchTips = useMemo(() => buildWorkspaceSearchTips(userType), [userType]);

  const hasResults =
    navigationItems.length > 0 || recentItems.length > 0 || propertyItems.length > 0;

  const resetSearch = () => {
    setSearch("");
    setDebouncedSearch("");
  };

  return {
    hasResults,
    isPending,
    isSearching,
    navigationItems,
    propertyItems,
    recentItems,
    resetSearch,
    search,
    searchTips,
    setSearch,
  };
}
