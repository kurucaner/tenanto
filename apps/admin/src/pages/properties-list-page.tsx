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
  type IPropertiesListToolbarFilterItem,
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

const PROPERTY_ROW_ESTIMATED_HEIGHT = 44;

const PROPERTIES_EMPTY_MESSAGE = (
  <div className="flex flex-col items-center gap-2 py-8">
    <Building2 className="text-muted-foreground/50 size-8" />
    <span>No properties found.</span>
  </div>
);

function getPropertyKey(property: IProperty): string {
  return property.id;
}

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
    activeFilterItems,
    countLabel,
    favoriteMutation,
    hasNextPage,
    infiniteScrollSentinelRef,
    isFetchingNextPage,
    isPending,
    onClearAllToolbarFilters,
    onRemoveToolbarFilter,
    onSearchInputChange,
    properties,
    searchInput,
  }: {
    activeFilterItems: IPropertiesListToolbarFilterItem[];
    countLabel?: string;
    favoriteMutation: ReturnType<typeof useSetPropertyFavorite>;
    hasNextPage: boolean;
    infiniteScrollSentinelRef: RefObject<HTMLDivElement | null>;
    isFetchingNextPage: boolean;
    isPending: boolean;
    onClearAllToolbarFilters: () => void;
    onRemoveToolbarFilter: (id: TPropertiesListToolbarFilterId) => void;
    onSearchInputChange: (value: string) => void;
    properties: IProperty[];
    searchInput: string;
  }) => {
    const favoritePendingPropertyId = favoriteMutation.isPending
      ? favoriteMutation.variables?.propertyId
      : undefined;

    const handleToggleFavorite = useCallback(
      (property: IProperty) => {
        favoriteMutation.mutate({ favorite: !property.isFavorite, propertyId: property.id });
      },
      [favoriteMutation]
    );

    const renderRow = useCallback(
      (property: IProperty) => (
        <PropertyTableRow
          key={property.id}
          isFavoritePending={favoritePendingPropertyId === property.id}
          onToggleFavorite={handleToggleFavorite}
          property={property}
        />
      ),
      [favoritePendingPropertyId, handleToggleFavorite]
    );

    const toolbar = useMemo(
      () => (
        <PropertiesListToolbar
          activeFilterItems={activeFilterItems}
          countLabel={countLabel}
          onClearAll={onClearAllToolbarFilters}
          onRemoveFilter={onRemoveToolbarFilter}
          onSearchInputChange={onSearchInputChange}
          searchInput={searchInput}
        />
      ),
      [
        activeFilterItems,
        countLabel,
        onClearAllToolbarFilters,
        onRemoveToolbarFilter,
        onSearchInputChange,
        searchInput,
      ]
    );

    return (
      <DataTable
        columns={PROPERTY_COLUMNS}
        emptyMessage={PROPERTIES_EMPTY_MESSAGE}
        getItemKey={getPropertyKey}
        infiniteScroll={{ hasNextPage, isFetchingNextPage }}
        infiniteScrollSentinelRef={infiniteScrollSentinelRef}
        isPending={isPending}
        items={properties}
        renderRow={renderRow}
        toolbar={toolbar}
        virtualization={{ estimateRowHeight: PROPERTY_ROW_ESTIMATED_HEIGHT }}
      />
    );
  }
);
PropertiesListTable.displayName = "PropertiesListTable";

const NewPropertyHeaderActions = memo(function NewPropertyHeaderActions() {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-end gap-4">
        <Button
          className="shrink-0 gap-2"
          onClick={() => setCreateOpen(true)}
          type="button"
        >
          <Plus className="size-4" />
          New Property
        </Button>
      </div>
      <CreatePropertyDialog onOpenChange={setCreateOpen} open={createOpen} />
    </>
  );
});

const PropertiesListPageInner = memo(function PropertiesListPageInner() {
  const { filters, setFilter, setFilters } = useUrlFilterState(PROPERTIES_URL_FILTER_SCHEMA);
  const { q } = filters;
  const { onSearchInputChange: handleSearchInputChange, searchInput } = useLedgerUrlSearch(
    q,
    setFilter
  );

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

  return (
    <AdminPageLayout gap={6}>
      <NewPropertyHeaderActions />

      {error ? (
        <p className="text-destructive text-sm">
          {error instanceof Error ? error.message : "Error loading properties"}
        </p>
      ) : null}

      <Card className="gap-0 py-0">
        <CardContent className="p-0">
          <PropertiesListTable
            activeFilterItems={activeFilterItems}
            countLabel={countLabel}
            favoriteMutation={favoriteMutation}
            hasNextPage={hasNextPage ?? false}
            infiniteScrollSentinelRef={scrollSentinelRef}
            isFetchingNextPage={isFetchingNextPage}
            isPending={isPending}
            onClearAllToolbarFilters={handleClearAllToolbarFilters}
            onRemoveToolbarFilter={handleRemoveToolbarFilter}
            onSearchInputChange={handleSearchInputChange}
            properties={properties}
            searchInput={searchInput}
          />
        </CardContent>
      </Card>
    </AdminPageLayout>
  );
});

export const PropertiesListPage = PropertiesListPageInner;
