import { Building2, Plus } from "lucide-react";
import { memo, type RefObject, useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { AdminPageLayout } from "@/components/admin-page-layout";
import { DataTable } from "@/components/data-table/data-table";
import { type DataTableColumn } from "@/components/data-table/data-table-types";
import { CreatePropertyDialog } from "@/components/properties/create-property-dialog";
import { PropertiesListToolbar } from "@/components/properties/properties-list-toolbar";
import { PropertyFavoriteButton } from "@/components/properties/property-favorite-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TableCell, TableRow } from "@/components/ui/table";
import { useInfiniteScrollTrigger } from "@/hooks/use-infinite-scroll-trigger";
import { useLedgerUrlSearch } from "@/hooks/use-ledger-url-search";
import { usePropertiesInfiniteList } from "@/hooks/use-properties-infinite-list";
import { useSetPropertyFavorite } from "@/hooks/use-set-property-favorite";
import { useUrlFilterState } from "@/hooks/use-url-filter-state";
import {
  buildPropertiesListToolbarClearAllPatch,
  buildPropertiesListToolbarClearOnePatch,
  buildPropertiesListToolbarFilterItems,
  formatPropertiesListCountLabel,
  type TPropertiesListToolbarFilterId,
} from "@/lib/properties-list-toolbar-filters";
import { defineUrlFilterSchema } from "@/lib/url-search-params";
import { formatPhoneDisplay, type IProperty } from "@/packages/shared";

const PROPERTIES_URL_FILTER_SCHEMA = defineUrlFilterSchema<{ q: string }>({
  q: { defaultValue: "" },
});

const PROPERTY_COLUMNS: DataTableColumn[] = [
  { id: "favorite", label: "Favorite" },
  { id: "name", label: "Name" },
  { id: "address", label: "Address" },
  { id: "phone", label: "Phone" },
  { id: "members", label: "Members" },
  { id: "created", label: "Created" },
];

const PROPERTIES_EMPTY_MESSAGE = (
  <div className="flex flex-col items-center gap-2 py-8">
    <Building2 className="text-muted-foreground/50 size-8" />
    <span>No properties found.</span>
  </div>
);

const PropertyTableRow = memo(
  ({
    isFavoritePending,
    onToggleFavorite,
    property,
  }: {
    isFavoritePending: boolean;
    onToggleFavorite: (property: IProperty) => void;
    property: IProperty;
  }) => {
    const navigate = useNavigate();

    return (
      <TableRow className="cursor-pointer" onClick={() => navigate(`/properties/${property.id}`)}>
        <TableCell className="w-12">
          <PropertyFavoriteButton
            disabled={isFavoritePending}
            isFavorite={property.isFavorite}
            onToggle={() => onToggleFavorite(property)}
          />
        </TableCell>
        <TableCell className="font-medium">{property.name}</TableCell>
        <TableCell className="max-w-[260px] truncate text-sm">{property.address}</TableCell>
        <TableCell className="text-sm">{formatPhoneDisplay(property.phoneNumber)}</TableCell>
        <TableCell className="text-center text-sm">{property.memberCount}</TableCell>
        <TableCell className="text-muted-foreground text-xs">
          {new Date(property.createdAt).toLocaleString()}
        </TableCell>
      </TableRow>
    );
  }
);
PropertyTableRow.displayName = "PropertyTableRow";

const PropertiesListTable = memo(
  ({
    favoriteMutation,
    hasNextPage,
    infiniteScrollSentinelRef,
    isFetchingNextPage,
    isPending,
    properties,
    toolbar,
  }: {
    favoriteMutation: ReturnType<typeof useSetPropertyFavorite>;
    hasNextPage: boolean;
    infiniteScrollSentinelRef: RefObject<HTMLDivElement | null>;
    isFetchingNextPage: boolean;
    isPending: boolean;
    properties: IProperty[];
    toolbar: React.ReactNode;
  }) => (
    <DataTable
      columns={PROPERTY_COLUMNS}
      emptyMessage={PROPERTIES_EMPTY_MESSAGE}
      getItemKey={(property) => property.id}
      infiniteScroll={{ hasNextPage, isFetchingNextPage }}
      infiniteScrollSentinelRef={infiniteScrollSentinelRef}
      isPending={isPending}
      items={properties}
      renderRow={(property) => (
        <PropertyTableRow
          isFavoritePending={
            favoriteMutation.isPending && favoriteMutation.variables?.propertyId === property.id
          }
          onToggleFavorite={(item) =>
            favoriteMutation.mutate({ favorite: !item.isFavorite, propertyId: item.id })
          }
          property={property}
        />
      )}
      toolbar={toolbar}
    />
  )
);
PropertiesListTable.displayName = "PropertiesListTable";

const PropertiesListPageInner = memo(() => {
  const { filters, setFilter, setFilters } = useUrlFilterState(PROPERTIES_URL_FILTER_SCHEMA);
  const { q } = filters;
  const { onSearchInputChange: handleSearchInputChange, searchInput } = useLedgerUrlSearch(
    q,
    setFilter
  );
  const [createOpen, setCreateOpen] = useState(false);

  const {
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPending,
    listFilters,
    properties,
  } = usePropertiesInfiniteList({ q });

  const favoriteMutation = useSetPropertyFavorite(listFilters);

  const scrollSentinelRef = useInfiniteScrollTrigger({
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  });

  const activeFilterItems = useMemo(() => buildPropertiesListToolbarFilterItems(q), [q]);

  const countLabel = useMemo(
    () =>
      properties.length > 0
        ? formatPropertiesListCountLabel(properties.length, Boolean(hasNextPage))
        : undefined,
    [hasNextPage, properties.length]
  );

  const handleRemoveToolbarFilter = useCallback(
    (id: TPropertiesListToolbarFilterId) => {
      if (id === "q") {
        handleSearchInputChange("");
      }
      setFilters(buildPropertiesListToolbarClearOnePatch(id));
    },
    [handleSearchInputChange, setFilters]
  );

  const handleClearAllToolbarFilters = useCallback(() => {
    handleSearchInputChange("");
    setFilters(buildPropertiesListToolbarClearAllPatch());
  }, [handleSearchInputChange, setFilters]);

  const handleNewPropertyClick = useCallback(() => {
    setCreateOpen(true);
  }, []);

  return (
    <AdminPageLayout gap={6}>
      <div className="flex items-center justify-end gap-4">
        <Button className="shrink-0 gap-2" onClick={handleNewPropertyClick} type="button">
          <Plus className="size-4" />
          New Property
        </Button>
      </div>

      {error ? (
        <p className="text-destructive text-sm">
          {error instanceof Error ? error.message : "Error loading properties"}
        </p>
      ) : null}

      <Card className="gap-0 py-0">
        <CardContent className="p-0">
          <PropertiesListTable
            favoriteMutation={favoriteMutation}
            hasNextPage={hasNextPage ?? false}
            infiniteScrollSentinelRef={scrollSentinelRef}
            isFetchingNextPage={isFetchingNextPage}
            isPending={isPending}
            properties={properties}
            toolbar={
              <PropertiesListToolbar
                activeFilterItems={activeFilterItems}
                countLabel={countLabel}
                onClearAll={handleClearAllToolbarFilters}
                onRemoveFilter={handleRemoveToolbarFilter}
                onSearchInputChange={handleSearchInputChange}
                searchInput={searchInput}
              />
            }
          />
        </CardContent>
      </Card>

      <CreatePropertyDialog onOpenChange={setCreateOpen} open={createOpen} />
    </AdminPageLayout>
  );
});
PropertiesListPageInner.displayName = "PropertiesListPageInner";

export const PropertiesListPage = PropertiesListPageInner;
