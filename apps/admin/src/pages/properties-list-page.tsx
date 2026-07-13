import { Building2, Plus } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { AdminPageLayout } from "@/components/admin-page-layout";
import { SearchFilterField } from "@/components/filters/search-filter-field";
import { CreatePropertyDialog } from "@/components/properties/create-property-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDebouncedUrlFilter } from "@/hooks/use-debounced-url-filter";
import { usePropertiesInfiniteList } from "@/hooks/use-properties-infinite-list";
import { useUrlFilterState } from "@/hooks/use-url-filter-state";
import { getInfiniteListLoadMoreLabel } from "@/lib/infinite-list-label";
import { defineUrlFilterSchema } from "@/lib/url-search-params";
import { formatPhoneDisplay, type IProperty } from "@/packages/shared";

const PROPERTIES_URL_FILTER_SCHEMA = defineUrlFilterSchema<{ q: string }>({
  q: { defaultValue: "" },
});

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

const PropertiesListPageInner = memo(() => {
  const { filters, setFilter } = useUrlFilterState(PROPERTIES_URL_FILTER_SCHEMA);
  const { q } = filters;
  const { inputValue: searchInput, onInputChange: handleSearchInputChange } = useDebouncedUrlFilter(
    {
      committedValue: q,
      onCommit: (value) => setFilter("q", value),
    }
  );
  const [createOpen, setCreateOpen] = useState(false);

  const {
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isPending,
    properties,
  } = usePropertiesInfiniteList({ q });

  const loadMoreButtonLabel = useMemo(
    () => getInfiniteListLoadMoreLabel({ hasNextPage: hasNextPage ?? false, isFetchingNextPage }),
    [hasNextPage, isFetchingNextPage]
  );

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

      <SearchFilterField
        id="properties-list-search"
        onChange={handleSearchInputChange}
        placeholder="Search by name or address…"
        value={searchInput}
      />

      {error ? (
        <p className="text-destructive text-sm">
          {error instanceof Error ? error.message : "Error loading properties"}
        </p>
      ) : null}

      <Card className="border-border/80 bg-card/80 shadow-sm backdrop-blur-sm">
        <CardContent className="p-0 pt-2">
          {isPending ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="text-center">Members</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {properties.length === 0 ? (
                    <TableRow>
                      <TableCell className="text-muted-foreground" colSpan={5}>
                        <div className="flex flex-col items-center gap-2 py-8">
                          <Building2 className="text-muted-foreground/50 size-8" />
                          <span>No properties found.</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    properties.map((p) => <PropertyTableRow key={p.id} property={p} />)
                  )}
                </TableBody>
              </Table>
              <div className="flex justify-center border-t p-4">
                <Button
                  disabled={!hasNextPage || isFetchingNextPage || isFetching}
                  onClick={() => fetchNextPage()}
                  type="button"
                  variant="outline"
                >
                  {loadMoreButtonLabel}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <CreatePropertyDialog onOpenChange={setCreateOpen} open={createOpen} />
    </AdminPageLayout>
  );
});
PropertiesListPageInner.displayName = "PropertiesListPageInner";

export const PropertiesListPage = PropertiesListPageInner;
