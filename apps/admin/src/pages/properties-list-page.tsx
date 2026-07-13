import { Building2, Plus } from "lucide-react";
import { memo, type RefObject, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";

import { AdminPageLayout } from "@/components/admin-page-layout";
import { DataTable } from "@/components/data-table/data-table";
import { type DataTableColumn } from "@/components/data-table/data-table-types";
import { LedgerFiltersSection } from "@/components/filters/ledger-filters-section";
import { CreatePropertyDialog } from "@/components/properties/create-property-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TableCell, TableRow } from "@/components/ui/table";
import { useInfiniteScrollTrigger } from "@/hooks/use-infinite-scroll-trigger";
import { useLedgerUrlSearch } from "@/hooks/use-ledger-url-search";
import { usePropertiesInfiniteList } from "@/hooks/use-properties-infinite-list";
import { useUrlFilterState } from "@/hooks/use-url-filter-state";
import { defineUrlFilterSchema } from "@/lib/url-search-params";
import { formatPhoneDisplay, type IProperty } from "@/packages/shared";

const PROPERTIES_URL_FILTER_SCHEMA = defineUrlFilterSchema<{ q: string }>({
  q: { defaultValue: "" },
});

const PROPERTY_COLUMNS: DataTableColumn[] = [
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

const PropertyTableRow = memo(({ property }: { property: IProperty }) => {
  const navigate = useNavigate();

  return (
    <TableRow className="cursor-pointer" onClick={() => navigate(`/properties/${property.id}`)}>
      <TableCell className="font-medium">{property.name}</TableCell>
      <TableCell className="max-w-[260px] truncate text-sm">{property.address}</TableCell>
      <TableCell className="text-sm">{formatPhoneDisplay(property.phoneNumber)}</TableCell>
      <TableCell className="text-center text-sm">{property.memberCount}</TableCell>
      <TableCell className="text-muted-foreground text-xs">
        {new Date(property.createdAt).toLocaleString()}
      </TableCell>
    </TableRow>
  );
});
PropertyTableRow.displayName = "PropertyTableRow";

const PropertiesListTable = memo(
  ({
    hasNextPage,
    infiniteScrollSentinelRef,
    isFetchingNextPage,
    isPending,
    onSearchInputChange,
    properties,
    searchInput,
  }: {
    hasNextPage: boolean;
    infiniteScrollSentinelRef: RefObject<HTMLDivElement | null>;
    isFetchingNextPage: boolean;
    isPending: boolean;
    onSearchInputChange: (value: string) => void;
    properties: IProperty[];
    searchInput: string;
  }) => (
    <DataTable
      columns={PROPERTY_COLUMNS}
      emptyMessage={PROPERTIES_EMPTY_MESSAGE}
      filters={
        <LedgerFiltersSection
          search={{
            id: "properties-list-search",
            onChange: onSearchInputChange,
            placeholder: "Search by name or address…",
            value: searchInput,
          }}
        />
      }
      getItemKey={(property) => property.id}
      infiniteScroll={{ hasNextPage, isFetchingNextPage }}
      infiniteScrollSentinelRef={infiniteScrollSentinelRef}
      isPending={isPending}
      items={properties}
      renderRow={(property) => <PropertyTableRow property={property} />}
    />
  )
);
PropertiesListTable.displayName = "PropertiesListTable";

const PropertiesListPageInner = memo(() => {
  const { filters, setFilter } = useUrlFilterState(PROPERTIES_URL_FILTER_SCHEMA);
  const { q } = filters;
  const { onSearchInputChange: handleSearchInputChange, searchInput } = useLedgerUrlSearch(
    q,
    setFilter
  );
  const [createOpen, setCreateOpen] = useState(false);

  const { error, fetchNextPage, hasNextPage, isFetchingNextPage, isPending, properties } =
    usePropertiesInfiniteList({ q });

  const scrollSentinelRef = useInfiniteScrollTrigger({
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  });

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

      <Card className="border-border/80 bg-card/80 shadow-sm backdrop-blur-sm">
        <CardContent className="space-y-4 p-0">
          <PropertiesListTable
            hasNextPage={hasNextPage ?? false}
            infiniteScrollSentinelRef={scrollSentinelRef}
            isFetchingNextPage={isFetchingNextPage}
            isPending={isPending}
            onSearchInputChange={handleSearchInputChange}
            properties={properties}
            searchInput={searchInput}
          />
        </CardContent>
      </Card>

      <CreatePropertyDialog onOpenChange={setCreateOpen} open={createOpen} />
    </AdminPageLayout>
  );
});
PropertiesListPageInner.displayName = "PropertiesListPageInner";

export const PropertiesListPage = PropertiesListPageInner;
