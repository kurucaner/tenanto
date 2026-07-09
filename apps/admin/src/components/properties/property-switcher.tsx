import { Check, ChevronsUpDown } from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { usePropertiesInfiniteList } from "@/hooks/use-properties-infinite-list";
import { getInfiniteListLoadMoreLabel } from "@/lib/infinite-list-label";
import { PROPERTIES_SEARCH_DEBOUNCE_MS } from "@/lib/properties-list-constants";
import { buildPropertySwitchPath } from "@/lib/property-switch-navigation";
import { cn } from "@/lib/utils";
import { type IProperty } from "@/packages/shared";

interface PropertySwitcherOptionProps {
  isSelected: boolean;
  onSelect: (propertyId: string) => void;
  property: IProperty;
}

const PropertySwitcherOption = memo(
  ({ isSelected, onSelect, property }: PropertySwitcherOptionProps) => (
    <button
      aria-selected={isSelected}
      className="hover:bg-muted flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => onSelect(property.id)}
      role="option"
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

  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedQuery(searchInput.trim());
    }, PROPERTIES_SEARCH_DEBOUNCE_MS);
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

  const {
    error,
    fetchNextPage,
    hasNextPage,
    isError,
    isFetchingNextPage,
    isPending,
    properties,
  } = usePropertiesInfiniteList({ q: debouncedQuery });

  const loadMoreButtonLabel = useMemo(
    () => getInfiniteListLoadMoreLabel({ hasNextPage: hasNextPage ?? false, isFetchingNextPage }),
    [hasNextPage, isFetchingNextPage]
  );

  const showStaticName = !debouncedQuery && properties.length === 1 && !isPending;

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
          aria-haspopup="listbox"
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
        <div aria-label="Properties" className="max-h-64 overflow-y-auto p-1" role="listbox">
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
          {!isPending && !isError && properties.length === 0 ? (
            <p className="text-muted-foreground px-2 py-3 text-sm">No properties found</p>
          ) : null}
          {!isPending && !isError
            ? properties.map((property) => (
                <PropertySwitcherOption
                  isSelected={property.id === propertyId}
                  key={property.id}
                  onSelect={handleSelect}
                  property={property}
                />
              ))
            : null}
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
