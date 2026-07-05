import { useInfiniteQuery } from "@tanstack/react-query";
import { Copy } from "lucide-react";
import { memo, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { AdminPageLayout } from "@/components/admin-page-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  adminApi,
  type IAdminUsersListQuery,
  type IAdminUsersListResponse,
} from "@/lib/api-client";
import { copyUserIdToClipboard } from "@/lib/copy-user-id";
import { adminQueryKeys } from "@/lib/query-keys";
import type { IUser } from "@/packages/shared";
import { UserType } from "@/packages/shared";

const LIMIT = 25;

const UserTableRow = memo(({ user }: { user: IUser }) => (
  <TableRow>
    <TableCell>
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-xs">{user.id.slice(0, 8)}…</span>
        <Button
          aria-label="Copy user ID"
          className="cursor-pointer"
          onClick={() => void copyUserIdToClipboard(user.id)}
          size="icon-xs"
          type="button"
          variant="outline"
        >
          <Copy />
        </Button>
      </div>
    </TableCell>
    <TableCell>
      <Link className="text-primary underline-offset-4 hover:underline" to={`/users/${user.id}`}>
        {user.email}
      </Link>
    </TableCell>
    <TableCell>{user.name}</TableCell>
    <TableCell>
      <Badge variant={user.userType === UserType.ADMIN ? "default" : "secondary"}>
        {user.userType}
      </Badge>
    </TableCell>
    <TableCell className="text-muted-foreground text-xs">
      {new Date(user.createdAt).toLocaleString()}
    </TableCell>
  </TableRow>
));
UserTableRow.displayName = "UserTableRow";

const UsersListPageInner = memo(() => {
  const [qInput, setQInput] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [userType, setUserType] = useState<"" | UserType>("");
  const [includeDeleted, setIncludeDeleted] = useState(false);

  const listFilters = useMemo<Omit<IAdminUsersListQuery, "cursor">>(
    () => ({
      include_deleted: includeDeleted || undefined,
      limit: LIMIT,
      q: appliedQ || undefined,
      user_type: userType || undefined,
    }),
    [appliedQ, includeDeleted, userType]
  );

  const { data, error, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage, isPending } =
    useInfiniteQuery({
      getNextPageParam: (lastPage: IAdminUsersListResponse) => lastPage.nextCursor ?? undefined,
      initialPageParam: undefined as string | undefined,
      queryFn: ({ pageParam }) =>
        adminApi.listUsers({
          ...listFilters,
          cursor: pageParam,
        }),
      queryKey: adminQueryKeys.usersList(listFilters),
    });

  const users = data?.pages.flatMap((p: IAdminUsersListResponse) => p.users) ?? [];

  let loadMoreButtonLabel: string;
  if (isFetchingNextPage) {
    loadMoreButtonLabel = "Loading…";
  } else if (hasNextPage) {
    loadMoreButtonLabel = "Load more";
  } else {
    loadMoreButtonLabel = "End of list";
  }

  return (
    <AdminPageLayout
      gap={6}
      intro={{
        description: "Search, filter, and open individual accounts.",
        eyebrow: "Directory",
        title: "Users",
      }}
    >
      <Card className="border-border/80 bg-card/80 shadow-sm backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="flex min-w-[200px] flex-1 flex-col gap-2">
              <Label htmlFor="filter-q">Email contains</Label>
              <Input
                id="filter-q"
                onChange={(e) => setQInput(e.target.value)}
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
            <div className="flex flex-col gap-2">
              <Label htmlFor="filter-user-type">User type</Label>
              <select
                className="border-input bg-background h-8 rounded-lg border px-2 text-sm"
                id="filter-user-type"
                onChange={(e) => setUserType((e.target.value as UserType | "") || "")}
                value={userType}
              >
                <option value="">Any</option>
                <option value={UserType.USER}>user</option>
                <option value={UserType.ADMIN}>admin</option>
              </select>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={includeDeleted}
                onCheckedChange={(c) => setIncludeDeleted(c === true)}
              />
              Include deleted
            </label>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <p className="text-destructive text-sm">{error instanceof Error ? error.message : "Error"}</p>
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
                    <TableHead>ID</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell className="text-muted-foreground" colSpan={5}>
                        No users match these filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((u) => <UserTableRow key={u.id} user={u} />)
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
    </AdminPageLayout>
  );
});
UsersListPageInner.displayName = "UsersListPageInner";

export const UsersListPage = UsersListPageInner;
