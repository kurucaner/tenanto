import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown } from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { propertiesApi } from "@/lib/api-client";
import { buildPropertySwitchPath } from "@/lib/property-switch-navigation";
import { adminQueryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { type IProperty } from "@/packages/shared";

const LIST_LIMIT = 25;
const SEARCH_DEBOUNCE_MS = 300;
const LIST_STALE_TIME_MS = 60_000;

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
    }, SEARCH_DEBOUNCE_MS);
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

  const listFilters = useMemo(
    () => ({
      limit: LIST_LIMIT,
      q: debouncedQuery || undefined,
    }),
    [debouncedQuery]
  );

  const propertiesQuery = useQuery({
    queryFn: () => propertiesApi.list(listFilters),
    queryKey: adminQueryKeys.propertiesList(listFilters),
    staleTime: LIST_STALE_TIME_MS,
  });

  const properties = propertiesQuery.data?.items ?? [];
  const showStaticName = !debouncedQuery && properties.length === 1 && !propertiesQuery.isPending;

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
          {propertiesQuery.isPending ? (
            <div className="space-y-1 p-1">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : null}
          {propertiesQuery.isError ? (
            <p className="text-destructive px-2 py-3 text-sm">
              {propertiesQuery.error instanceof Error
                ? propertiesQuery.error.message
                : "Failed to load properties"}
            </p>
          ) : null}
          {!propertiesQuery.isPending && !propertiesQuery.isError && properties.length === 0 ? (
            <p className="text-muted-foreground px-2 py-3 text-sm">No properties found</p>
          ) : null}
          {!propertiesQuery.isPending && !propertiesQuery.isError
            ? properties.map((property) => (
                <PropertySwitcherOption
                  isSelected={property.id === propertyId}
                  key={property.id}
                  onSelect={handleSelect}
                  property={property}
                />
              ))
            : null}
        </div>
      </PopoverContent>
    </Popover>
  );
});
PropertySwitcher.displayName = "PropertySwitcher";
