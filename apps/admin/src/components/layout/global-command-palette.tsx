import { memo, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { getNavItemsForRole } from "@/config/admin-nav";
import { usePropertiesInfiniteList } from "@/hooks/use-properties-infinite-list";
import { useRecentProperties } from "@/hooks/use-recent-properties";
import {
  buildPropertyPaletteCommandItems,
  buildRecentPaletteCommandItems,
} from "@/lib/global-command-palette-items";
import { LIST_SEARCH_DEBOUNCE_MS, UserType } from "@/packages/shared";
import { useAuthStore } from "@/stores/auth-store";

interface GlobalCommandPaletteProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
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

export const GlobalCommandPalette = memo(({ onOpenChange, open }: GlobalCommandPaletteProps) => {
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.user);
  const userType = currentUser?.userType ?? UserType.USER;
  const recentEntries = useRecentProperties();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    if (!open) {
      setSearch("");
      setDebouncedSearch("");
    }
  }, [open]);

  useEffect(() => {
    const timeoutId = globalThis.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, LIST_SEARCH_DEBOUNCE_MS);

    return () => globalThis.clearTimeout(timeoutId);
  }, [search]);

  const isSearching = debouncedSearch.length > 0;

  const { isPending, properties } = usePropertiesInfiniteList({
    enabled: open,
    q: isSearching ? debouncedSearch : undefined,
  });

  const propertyById = useMemo(
    () => new Map(properties.map((property) => [property.id, property])),
    [properties]
  );

  const navigationItems = useMemo(
    () =>
      filterNavigationItems(search, userType).map((item) => ({
        id: `nav-${item.href}`,
        label: item.title,
        path: item.href,
        value: item.title,
      })),
    [search, userType]
  );

  const recentItems = useMemo(() => {
    if (isSearching) {
      return [];
    }

    return recentEntries.flatMap((recentEntry) =>
      buildRecentPaletteCommandItems(recentEntry, propertyById.get(recentEntry.id), currentUser)
    );
  }, [currentUser, isSearching, propertyById, recentEntries]);

  const propertyItems = useMemo(() => {
    if (!isSearching) {
      return [];
    }

    return properties.flatMap((property) =>
      buildPropertyPaletteCommandItems(property, currentUser)
    );
  }, [currentUser, isSearching, properties]);

  const handleSelect = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  const hasResults =
    navigationItems.length > 0 || recentItems.length > 0 || propertyItems.length > 0;

  return (
    <CommandDialog onOpenChange={onOpenChange} open={open}>
      <CommandInput
        onValueChange={setSearch}
        placeholder="Search pages, properties, or destinations…"
        value={search}
      />
      <CommandList>
        {!hasResults && !isPending ? <CommandEmpty>No results found.</CommandEmpty> : null}
        {navigationItems.length > 0 ? (
          <CommandGroup heading="Navigation">
            {navigationItems.map((item) => (
              <CommandItem key={item.id} onSelect={() => handleSelect(item.path)} value={item.value}>
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        {recentItems.length > 0 ? (
          <>
            {navigationItems.length > 0 ? <CommandSeparator /> : null}
            <CommandGroup heading="Recent">
              {recentItems.map((item) => (
                <CommandItem
                  key={item.id}
                  onSelect={() => handleSelect(item.path)}
                  value={item.value}
                >
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}
        {propertyItems.length > 0 ? (
          <>
            {navigationItems.length > 0 || recentItems.length > 0 ? <CommandSeparator /> : null}
            <CommandGroup heading="Properties">
              {propertyItems.map((item) => (
                <CommandItem
                  key={item.id}
                  onSelect={() => handleSelect(item.path)}
                  value={item.value}
                >
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}
        {!isSearching ? (
          <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
            Tip: search for a property, then jump to Expenses, Leases, and more.
          </div>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
});
GlobalCommandPalette.displayName = "GlobalCommandPalette";
