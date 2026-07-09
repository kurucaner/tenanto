import { Building2, Plus, Search } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { AdminPageLayout } from "@/components/admin-page-layout";
import { CreatePropertyDialog } from "@/components/properties/create-property-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePropertiesInfiniteList } from "@/hooks/use-properties-infinite-list";
import { useUrlFilterState } from "@/hooks/use-url-filter-state";
import { getInfiniteListLoadMoreLabel } from "@/lib/infinite-list-label";
import { PROPERTIES_SEARCH_DEBOUNCE_MS } from "@/lib/properties-list-constants";
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
  const [searchInput, setSearchInput] = useState(q);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    setSearchInput(q);
  }, [q]);

  useEffect(() => {
    const id = setTimeout(() => {
      const trimmed = searchInput.trim();
      if (trimmed !== q) {
        setFilter("q", trimmed);
      }
    }, PROPERTIES_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [q, searchInput, setFilter]);

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

  const handleSearchInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
  }, []);

  return (
    <AdminPageLayout gap={6}>
      <div className="flex items-center justify-end gap-4">
        <Button className="shrink-0 gap-2" onClick={handleNewPropertyClick} type="button">
          <Plus className="size-4" />
          New Property
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          onChange={handleSearchInputChange}
          placeholder="Search by name or address…"
          value={searchInput}
        />
      </div>

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
