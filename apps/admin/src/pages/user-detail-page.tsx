import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy } from "lucide-react";
import { memo } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";

import { AdminUserAuditSection } from "@/components/admin-user-audit-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { adminApi, type IAdminUserDetailUser } from "@/lib/api-client";
import { copyUserIdToClipboard } from "@/lib/copy-user-id";
import { adminQueryKeys } from "@/lib/query-keys";
import { UserType } from "@/packages/shared";

const UserDetailForm = memo(
  ({
    stats,
    user,
    userId,
  }: {
    stats: { activePushTokens: number } | undefined;
    user: IAdminUserDetailUser;
    userId: string;
  }) => {
    const queryClient = useQueryClient();

    const resetAccountMutation = useMutation({
      mutationFn: () => adminApi.resetUserAccount(userId),
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "Reset failed");
      },
      onSuccess: (data) => {
        toast.success("Account reset");
        queryClient.setQueryData(adminQueryKeys.user(userId), data);
        queryClient.invalidateQueries({ queryKey: adminQueryKeys.userAudit(userId) });
        queryClient.invalidateQueries({ queryKey: ["activity"] });
        queryClient.invalidateQueries({ queryKey: ["users"] });
      },
    });

    const isAdminAccount = user.userType === UserType.ADMIN;

    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link className="text-muted-foreground text-sm hover:underline" to="/users">
            ← Users
          </Link>
          <Separator className="h-4" orientation="vertical" />
          <h1 className="text-2xl font-semibold tracking-tight">{user.name}</h1>
          {user.isDeleted ? (
            <Badge variant="destructive">Deleted</Badge>
          ) : (
            <Badge variant="secondary">Active</Badge>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Profile</CardTitle>
              <CardDescription>Account fields from the database.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground">ID:</span>
                <span className="min-w-0 break-all font-mono text-xs">{user.id}</span>
                <Button
                  aria-label="Copy user ID"
                  className="shrink-0 cursor-pointer"
                  onClick={() => void copyUserIdToClipboard(user.id)}
                  size="icon-sm"
                  type="button"
                  variant="outline"
                >
                  <Copy />
                </Button>
              </div>
              <p>
                <span className="text-muted-foreground">Email:</span> {user.email}
              </p>
              <p>
                <span className="text-muted-foreground">Name:</span> {user.name}
              </p>
              <p>
                <span className="text-muted-foreground">Password:</span>{" "}
                {user.hasPassword ? "Set" : "None"}
              </p>
              <p>
                <span className="text-muted-foreground">Type:</span> {user.userType}
              </p>
              {user.deletedAt ? (
                <p>
                  <span className="text-muted-foreground">Deleted at:</span>{" "}
                  {new Date(user.deletedAt).toLocaleString()}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Stats</CardTitle>
              <CardDescription>Active push tokens for this account.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                <span className="text-muted-foreground">Active push tokens:</span>{" "}
                {stats?.activePushTokens ?? "—"}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base text-destructive">Danger zone</CardTitle>
            <CardDescription>
              Resets this account. Does not sign the user out or remove push tokens.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {isAdminAccount ? (
              <p className="text-muted-foreground text-sm">
                Admin accounts cannot be reset from here.
              </p>
            ) : (
              <Button
                disabled={resetAccountMutation.isPending}
                onClick={() => {
                  if (!globalThis.confirm("Reset this account? This cannot be undone.")) {
                    return;
                  }
                  resetAccountMutation.mutate();
                }}
                type="button"
                variant="destructive"
              >
                {resetAccountMutation.isPending ? "Resetting…" : "Reset account"}
              </Button>
            )}
          </CardContent>
        </Card>

        <AdminUserAuditSection userId={user.id} />
      </div>
    );
  }
);
UserDetailForm.displayName = "UserDetailForm";

const UserDetailPageInner = memo(() => {
  const { userId } = useParams<{ userId: string }>();

  const detailQuery = useQuery({
    enabled: Boolean(userId),
    queryFn: () => adminApi.getUser(userId!), // NOSONAR
    queryKey: adminQueryKeys.user(userId!), // NOSONAR
  });

  const user = detailQuery.data?.user;
  const stats = detailQuery.data?.stats;

  if (!userId) {
    return <p className="text-muted-foreground text-sm">Invalid user.</p>;
  }

  if (detailQuery.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (detailQuery.isError || !user) {
    return (
      <p className="text-destructive text-sm">
        {detailQuery.error instanceof Error ? detailQuery.error.message : "User not found"}
      </p>
    );
  }

  return (
    <UserDetailForm
      key={`${user.id}-${user.updatedAt}`}
      stats={stats}
      user={user}
      userId={userId}
    />
  );
});
UserDetailPageInner.displayName = "UserDetailPageInner";

export const UserDetailPage = UserDetailPageInner;
