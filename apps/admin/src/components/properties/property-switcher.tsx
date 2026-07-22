import { Check, X } from "lucide-react";
import { memo, type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { PropertySwitcherTrigger } from "@/components/properties/property-switcher-trigger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { usePropertiesInfiniteList } from "@/hooks/use-properties-infinite-list";
import { useRecentProperties } from "@/hooks/use-recent-properties";
import { getInfiniteListLoadMoreLabel } from "@/lib/infinite-list-label";
import { buildPropertyResumePath, buildPropertySwitchPath } from "@/lib/property-switch-navigation";
import {
  clearRecentProperties,
  type IRecentProperty,
  removeRecentProperty,
} from "@/lib/recent-properties-storage";
import { cn } from "@/lib/utils";
import { type IProperty, LIST_SEARCH_DEBOUNCE_MS } from "@/packages/shared";

type TPropertySwitcherRow = Pick<IProperty, "address" | "id" | "name">;

interface PropertySwitcherOptionProps {
  isSelected: boolean;
  onSelect: (propertyId: string) => void;
  property: TPropertySwitcherRow;
}

const PropertySwitcherOption = memo(
  ({ isSelected, onSelect, property }: PropertySwitcherOptionProps) => (
    <button
      aria-pressed={isSelected}
      className="hover:bg-muted flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => onSelect(property.id)}
      type="button"
    >
      <Check
        aria-hidden
        className={cn("mt-0.5 size-4 shrink-0", isSelected ? "opacity-100" : "opacity-0")}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{property.name}</span>
        <span className="text-muted-foreground block truncate text-xs">{property.address}</span>
      </span>
    </button>
  )
);
PropertySwitcherOption.displayName = "PropertySwitcherOption";

interface PropertySwitcherRecentOptionProps {
  isSelected: boolean;
  onRemove: (propertyId: string) => void;
  onSelect: (recent: IRecentProperty) => void;
  property: IRecentProperty;
}

const PropertySwitcherRecentOption = memo(
  ({ isSelected, onRemove, onSelect, property }: PropertySwitcherRecentOptionProps) => (
    <div className="group hover:bg-muted focus-within:bg-muted flex w-full items-start gap-1 rounded-md pr-1">
      <button
        aria-pressed={isSelected}
        className="flex min-w-0 flex-1 items-start gap-2 rounded-md px-2 py-2 text-left text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => onSelect(property)}
        type="button"
      >
        <Check
          aria-hidden
          className={cn("mt-0.5 size-4 shrink-0", isSelected ? "opacity-100" : "opacity-0")}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{property.name}</span>
          <span className="text-muted-foreground block truncate text-xs">{property.address}</span>
        </span>
      </button>
      <Button
        aria-label={`Remove ${property.name} from recent properties`}
        className="mt-1.5 size-6 shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"
        onClick={(event) => {
          event.stopPropagation();
          onRemove(property.id);
        }}
        size="icon-xs"
        type="button"
        variant="ghost"
      >
        <X className="size-3.5" />
      </Button>
    </div>
  )
);
PropertySwitcherRecentOption.displayName = "PropertySwitcherRecentOption";

const PropertySwitcherSectionLabel = memo(({ children }: { children: string }) => (
  <p className="text-muted-foreground px-2 pt-2 pb-1 text-xs font-medium">{children}</p>
));
PropertySwitcherSectionLabel.displayName = "PropertySwitcherSectionLabel";

interface PropertySwitcherRecentSectionHeaderProps {
  onClearAll: () => void;
}

const PropertySwitcherRecentSectionHeader = memo(
  ({ onClearAll }: PropertySwitcherRecentSectionHeaderProps) => (
    <div className="flex items-center justify-between gap-2 px-2 pt-2 pb-1">
      <p className="text-muted-foreground text-xs font-medium">Recent</p>
      <Button
        aria-label="Clear recent properties"
        className="h-5 px-1.5 text-xs"
        onClick={onClearAll}
        type="button"
        variant="ghost"
      >
        Clear
      </Button>
    </div>
  )
);
PropertySwitcherRecentSectionHeader.displayName = "PropertySwitcherRecentSectionHeader";

function getPropertySwitcherListFlags(input: {
  allPropertiesCount: number;
  isError: boolean;
  isPending: boolean;
  isSearching: boolean;
  propertiesCount: number;
  recentCount: number;
}) {
  const { allPropertiesCount, isError, isPending, isSearching, propertiesCount, recentCount } =
    input;
  const showRecentSection = !isSearching && recentCount > 0;
  const showAllPropertiesSection = !isSearching && (allPropertiesCount > 0 || showRecentSection);
  const showEmptyState =
    !isPending &&
    !isError &&
    (isSearching ? propertiesCount === 0 : recentCount === 0 && allPropertiesCount === 0);

  return { showAllPropertiesSection, showEmptyState, showRecentSection };
}

function usePropertySwitcherSearch(
  open: boolean,
  searchInputRef: RefObject<HTMLInputElement | null>
) {
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedQuery(searchInput.trim());
    }, LIST_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [searchInput]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const id = requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [open, searchInputRef]);

  const resetSearch = () => {
    setSearchInput("");
    setDebouncedQuery("");
  };

  return { debouncedQuery, resetSearch, searchInput, setSearchInput };
}

interface PropertySwitcherMenuProps {
  allProperties: TPropertySwitcherRow[];
  error: Error | null;
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isError: boolean;
  isFetchingNextPage: boolean;
  isPending: boolean;
  isSearching: boolean;
  loadMoreButtonLabel: string;
  onClearRecent: () => void;
  onRemoveRecent: (propertyId: string) => void;
  onSelect: (propertyId: string) => void;
  onSelectRecent: (recent: IRecentProperty) => void;
  properties: TPropertySwitcherRow[];
  propertyId: string;
  recentProperties: IRecentProperty[];
  showAllPropertiesSection: boolean;
  showEmptyState: boolean;
  showRecentSection: boolean;
}

const PropertySwitcherMenu = memo(
  ({
    allProperties,
    error,
    fetchNextPage,
    hasNextPage,
    isError,
    isFetchingNextPage,
    isPending,
    isSearching,
    loadMoreButtonLabel,
    onClearRecent,
    onRemoveRecent,
    onSelect,
    onSelectRecent,
    properties,
    propertyId,
    recentProperties,
    showAllPropertiesSection,
    showEmptyState,
    showRecentSection,
  }: PropertySwitcherMenuProps) => {
    const errorMessage = error instanceof Error ? error.message : "Failed to load properties";
    const canShowResults = !isPending && !isError;
    const showSearchResults = canShowResults && isSearching;
    const showBrowseResults = canShowResults && showAllPropertiesSection;
    const showLoadMore = canShowResults && properties.length > 0;

    return (
      <>
        {isPending ? (
          <div className="space-y-1 p-1">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : null}
        {isError ? <p className="text-destructive px-2 py-3 text-sm">{errorMessage}</p> : null}
        {showEmptyState ? (
          <p className="text-muted-foreground px-2 py-3 text-sm">No properties found</p>
        ) : null}
        {showRecentSection ? (
          <>
            <PropertySwitcherRecentSectionHeader onClearAll={onClearRecent} />
            {recentProperties.map((property) => (
              <PropertySwitcherRecentOption
                isSelected={property.id === propertyId}
                key={property.id}
                onRemove={onRemoveRecent}
                onSelect={onSelectRecent}
                property={property}
              />
            ))}
          </>
        ) : null}
        {showSearchResults
          ? properties.map((property) => (
              <PropertySwitcherOption
                isSelected={property.id === propertyId}
                key={property.id}
                onSelect={onSelect}
                property={property}
              />
            ))
          : null}
        {showBrowseResults ? (
          <>
            {showRecentSection ? (
              <PropertySwitcherSectionLabel>All properties</PropertySwitcherSectionLabel>
            ) : null}
            {allProperties.map((property) => (
              <PropertySwitcherOption
                isSelected={property.id === propertyId}
                key={property.id}
                onSelect={onSelect}
                property={property}
              />
            ))}
          </>
        ) : null}
        {showLoadMore ? (
          <div className="border-border border-t p-1">
            <Button
              className="w-full"
              disabled={!hasNextPage || isFetchingNextPage}
              onClick={() => fetchNextPage()}
              size="sm"
              type="button"
              variant="ghost"
            >
              {loadMoreButtonLabel}
            </Button>
          </div>
        ) : null}
      </>
    );
  }
);
PropertySwitcherMenu.displayName = "PropertySwitcherMenu";

interface PropertySwitcherProps {
  propertyId: string;
  propertyName: string;
}

export const PropertySwitcher = memo(({ propertyId, propertyName }: PropertySwitcherProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const { debouncedQuery, resetSearch, searchInput, setSearchInput } = usePropertySwitcherSearch(
    open,
    searchInputRef
  );
  const recentProperties = useRecentProperties();

  const { error, fetchNextPage, hasNextPage, isError, isFetchingNextPage, isPending, properties } =
    usePropertiesInfiniteList({ q: debouncedQuery });

  const isSearching = debouncedQuery.length > 0;

  const recentIds = useMemo(
    () => new Set(recentProperties.map((property) => property.id)),
    [recentProperties]
  );

  const allProperties = useMemo(
    () => (isSearching ? properties : properties.filter((property) => !recentIds.has(property.id))),
    [isSearching, properties, recentIds]
  );

  const loadMoreButtonLabel = useMemo(
    () => getInfiniteListLoadMoreLabel({ hasNextPage: hasNextPage ?? false, isFetchingNextPage }),
    [hasNextPage, isFetchingNextPage]
  );

  const { showAllPropertiesSection, showEmptyState, showRecentSection } =
    getPropertySwitcherListFlags({
      allPropertiesCount: allProperties.length,
      isError,
      isPending,
      isSearching,
      propertiesCount: properties.length,
      recentCount: recentProperties.length,
    });

  const showStaticName = !isSearching && properties.length === 1 && !isPending;

  const closeSwitcher = () => {
    setOpen(false);
    resetSearch();
  };

  const handleSelect = (nextPropertyId: string) => {
    closeSwitcher();
    if (nextPropertyId === propertyId) {
      return;
    }
    navigate(
      buildPropertySwitchPath({
        nextPropertyId,
        pathname: location.pathname,
        propertyId,
        search: location.search,
      })
    );
  };

  const handleSelectRecent = (recent: IRecentProperty) => {
    closeSwitcher();
    navigate(buildPropertyResumePath(recent.id, recent.lastPath));
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      resetSearch();
    }
  };

  if (showStaticName) {
    return <span className="text-sm font-medium text-foreground">{propertyName}</span>;
  }

  return (
    <PropertySwitcherTrigger
      label={propertyName}
      onOpenChange={handleOpenChange}
      open={open}
      searchField={
        <Input
          aria-label="Search properties"
          onChange={(event) => setSearchInput(event.target.value)}
          onKeyDown={(event) => event.stopPropagation()}
          placeholder="Search properties…"
          ref={searchInputRef}
          value={searchInput}
        />
      }
    >
      <PropertySwitcherMenu
        allProperties={allProperties}
        error={error instanceof Error ? error : null}
        fetchNextPage={fetchNextPage}
        hasNextPage={hasNextPage ?? false}
        isError={isError}
        isFetchingNextPage={isFetchingNextPage}
        isPending={isPending}
        isSearching={isSearching}
        loadMoreButtonLabel={loadMoreButtonLabel}
        onClearRecent={clearRecentProperties}
        onRemoveRecent={removeRecentProperty}
        onSelect={handleSelect}
        onSelectRecent={handleSelectRecent}
        properties={properties}
        propertyId={propertyId}
        recentProperties={recentProperties}
        showAllPropertiesSection={showAllPropertiesSection}
        showEmptyState={showEmptyState}
        showRecentSection={showRecentSection}
      />
    </PropertySwitcherTrigger>
  );
});
PropertySwitcher.displayName = "PropertySwitcher";
