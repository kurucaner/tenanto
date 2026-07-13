import { Check, ChevronsUpDown } from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { usePropertiesInfiniteList } from "@/hooks/use-properties-infinite-list";
import { useRecentProperties } from "@/hooks/use-recent-properties";
import { getInfiniteListLoadMoreLabel } from "@/lib/infinite-list-label";
import { buildPropertySwitchPath } from "@/lib/property-switch-navigation";
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

const PropertySwitcherSectionLabel = memo(({ children }: { children: string }) => (
  <p className="text-muted-foreground px-2 pt-2 pb-1 text-xs font-medium">{children}</p>
));
PropertySwitcherSectionLabel.displayName = "PropertySwitcherSectionLabel";

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

  if (showStaticName) {
    return <span className="text-sm font-medium text-foreground">{propertyName}</span>;
  }

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-expanded={open}
          aria-haspopup="dialog"
          className="h-auto max-w-[min(100%,16rem)] gap-1.5 px-0 py-0 text-sm font-medium text-foreground hover:bg-transparent sm:max-w-xs"
          type="button"
          variant="ghost"
        >
          <span className="truncate">{propertyName}</span>
          <ChevronsUpDown aria-hidden className="size-3.5 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(calc(100vw-2rem),20rem)] p-0">
        <div className="border-border border-b p-2">
          <Input
            aria-label="Search properties"
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder="Search properties…"
            ref={searchInputRef}
            value={searchInput}
          />
        </div>
        <div aria-label="Properties" className="max-h-64 overflow-y-auto p-1">
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
              <PropertySwitcherSectionLabel>Recent</PropertySwitcherSectionLabel>
              {recentProperties.map((property) => (
                <PropertySwitcherOption
                  isSelected={property.id === propertyId}
                  key={property.id}
                  onSelect={handleSelect}
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
        </div>
      </PopoverContent>
    </Popover>
  );
});
PropertySwitcher.displayName = "PropertySwitcher";
