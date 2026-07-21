import { Check, X } from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
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

interface PropertySwitcherProps {
  propertyId: string;
  propertyName: string;
}

export const PropertySwitcher = memo(({ propertyId, propertyName }: PropertySwitcherProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const recentProperties = useRecentProperties();

  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedQuery(searchInput.trim());
    }, LIST_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [searchInput]);

  useEffect(() => {
    if (!open) {
      setSearchInput("");
      setDebouncedQuery("");
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
      return () => cancelAnimationFrame(id);
    }
    return undefined;
  }, [open]);

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

  const showStaticName = !isSearching && properties.length === 1 && !isPending;
  const showRecentSection = !isSearching && recentProperties.length > 0;
  const showAllPropertiesSection = !isSearching && (allProperties.length > 0 || showRecentSection);
  const showEmptyState =
    !isPending &&
    !isError &&
    (isSearching
      ? properties.length === 0
      : recentProperties.length === 0 && allProperties.length === 0);

  const handleSelect = (nextPropertyId: string) => {
    setOpen(false);

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
    setOpen(false);
    navigate(buildPropertyResumePath(recent.id, recent.lastPath));
  };

  const handleRemoveRecent = (removedPropertyId: string) => {
    removeRecentProperty(removedPropertyId);
  };

  const handleClearRecent = () => {
    clearRecentProperties();
  };

  if (showStaticName) {
    return <span className="text-sm font-medium text-foreground">{propertyName}</span>;
  }

  return (
    <PropertySwitcherTrigger
      label={propertyName}
      onOpenChange={setOpen}
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
      {isPending ? (
        <div className="space-y-1 p-1">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : null}
      {isError ? (
        <p className="text-destructive px-2 py-3 text-sm">
          {error instanceof Error ? error.message : "Failed to load properties"}
        </p>
      ) : null}
      {showEmptyState ? (
        <p className="text-muted-foreground px-2 py-3 text-sm">No properties found</p>
      ) : null}
      {showRecentSection ? (
        <>
          <PropertySwitcherRecentSectionHeader onClearAll={handleClearRecent} />
          {recentProperties.map((property) => (
            <PropertySwitcherRecentOption
              isSelected={property.id === propertyId}
              key={property.id}
              onRemove={handleRemoveRecent}
              onSelect={handleSelectRecent}
              property={property}
            />
          ))}
        </>
      ) : null}
      {!isPending && !isError && isSearching
        ? properties.map((property) => (
            <PropertySwitcherOption
              isSelected={property.id === propertyId}
              key={property.id}
              onSelect={handleSelect}
              property={property}
            />
          ))
        : null}
      {!isPending && !isError && showAllPropertiesSection ? (
        <>
          {showRecentSection ? (
            <PropertySwitcherSectionLabel>All properties</PropertySwitcherSectionLabel>
          ) : null}
          {allProperties.map((property) => (
            <PropertySwitcherOption
              isSelected={property.id === propertyId}
              key={property.id}
              onSelect={handleSelect}
              property={property}
            />
          ))}
        </>
      ) : null}
      {!isPending && !isError && properties.length > 0 ? (
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
    </PropertySwitcherTrigger>
  );
});
PropertySwitcher.displayName = "PropertySwitcher";
