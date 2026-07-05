import { useInfiniteQuery } from "@tanstack/react-query";
import { Building2, Plus } from "lucide-react";
import { memo, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { AdminPageLayout } from "@/components/admin-page-layout";
import { CreatePropertyDialog } from "@/components/properties/create-property-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type IAdminPropertiesListQuery, propertiesApi } from "@/lib/api-client";
import { adminQueryKeys } from "@/lib/query-keys";
import type { IAdminPropertiesListResponse, IProperty } from "@/packages/shared";

const LIMIT = 25;

const PropertyTableRow = memo(({ property }: { property: IProperty }) => (
  <TableRow>
    <TableCell>
      <Link
        className="text-primary font-medium underline-offset-4 hover:underline"
        to={`/properties/${property.id}`}
      >
        {property.name}
      </Link>
    </TableCell>
    <TableCell className="max-w-[260px] truncate text-sm">{property.address}</TableCell>
    <TableCell className="text-sm">{property.phoneNumber ?? "—"}</TableCell>
    <TableCell className="text-center text-sm">{property.memberCount}</TableCell>
    <TableCell className="text-muted-foreground text-xs">
      {new Date(property.createdAt).toLocaleString()}
    </TableCell>
    <TableCell>
      <Button asChild size="sm" variant="outline">
        <Link to={`/properties/${property.id}`}>View</Link>
      </Button>
    </TableCell>
  </TableRow>
));
PropertyTableRow.displayName = "PropertyTableRow";

const PropertiesListPageInner = memo(() => {
  const [qInput, setQInput] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const listFilters = useMemo<Omit<IAdminPropertiesListQuery, "cursor">>(
    () => ({
      limit: LIMIT,
      q: appliedQ || undefined,
    }),
    [appliedQ]
  );

  const { data, error, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage, isPending } =
    useInfiniteQuery({
      getNextPageParam: (lastPage: IAdminPropertiesListResponse) =>
        lastPage.nextCursor ?? undefined,
      initialPageParam: undefined as string | undefined,
      queryFn: ({ pageParam }) =>
        propertiesApi.list({ ...listFilters, cursor: pageParam }),
      queryKey: adminQueryKeys.propertiesList(listFilters),
    });

  const properties = data?.pages.flatMap((p: IAdminPropertiesListResponse) => p.items) ?? [];

  let loadMoreButtonLabel: string;
  if (isFetchingNextPage) {
    loadMoreButtonLabel = "Loading…";
  } else if (hasNextPage) {
    loadMoreButtonLabel = "Load more";
  } else {
    loadMoreButtonLabel = "End of list";
  }

  return (
    <AdminPageLayout gap={6}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Card className="border-border/80 bg-card/80 flex-1 shadow-sm backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex min-w-[200px] flex-1 flex-col gap-2">
                <Label htmlFor="filter-q">Name or address contains</Label>
                <Input
                  id="filter-q"
                  onChange={(e) => setQInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setAppliedQ(qInput.trim());
                  }}
                  placeholder="search…"
                  value={qInput}
                />
              </div>
              <Button
                onClick={() => setAppliedQ(qInput.trim())}
                type="button"
                variant="secondary"
              >
                Apply search
              </Button>
            </div>
          </CardContent>
        </Card>
        <div className="flex shrink-0 self-start sm:self-auto">
          <Button className="gap-2" onClick={() => setCreateOpen(true)} type="button">
            <Plus className="size-4" />
            New Property
          </Button>
        </div>
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
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {properties.length === 0 ? (
                    <TableRow>
                      <TableCell className="text-muted-foreground" colSpan={6}>
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
