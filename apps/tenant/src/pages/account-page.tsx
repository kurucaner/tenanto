import { useQuery } from "@tanstack/react-query";
import { memo } from "react";
import { Link } from "react-router-dom";

import { tenantAuthApi, tenantPortalApi } from "@/lib/api-client";
import { clearAppSession } from "@/lib/clear-app-session";
import { queryKeys } from "@/lib/query-keys";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/packages/app-ui";
import { useAuthStore } from "@/stores/auth-store";

export const AccountPage = memo(function AccountPage() {
  const user = useAuthStore((s) => s.user);
  const refreshToken = useAuthStore((s) => s.refreshToken);

  const meQuery = useQuery({
    queryFn: () => tenantPortalApi.getMe(),
    queryKey: queryKeys.me(),
  });

  const handleLogout = async () => {
    if (refreshToken) {
      try {
        await tenantAuthApi.logout({ refreshToken });
      } catch {
        // Clear local session even if server logout fails.
      }
    }
    clearAppSession();
  };

  return (
    <div className="app-surface flex min-h-svh flex-col items-center justify-center gap-6 p-6">
      <Card className="w-full max-w-md rounded-2xl border-border/80 bg-card/85 shadow-sm backdrop-blur-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="font-display text-2xl font-semibold tracking-tight">
            Account
          </CardTitle>
          <CardDescription>
            Protected route — session and <code className="text-xs">GET /tenant/me</code> check.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {user ? (
            <div className="space-y-1">
              <p className="font-medium text-foreground">{user.name}</p>
              <p className="text-muted-foreground">{user.email}</p>
            </div>
          ) : null}

          {meQuery.isPending ? (
            <p className="text-muted-foreground">Loading profile…</p>
          ) : null}
          {meQuery.isError ? (
            <p className="text-destructive">
              {meQuery.error instanceof Error ? meQuery.error.message : "Failed to load profile"}
            </p>
          ) : null}
          {meQuery.data ? (
            <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
              {JSON.stringify(meQuery.data, null, 2)}
            </pre>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => void meQuery.refetch()}>
              Refresh /tenant/me
            </Button>
            <Button type="button" variant="destructive" onClick={() => void handleLogout()}>
              Logout
            </Button>
            <Button asChild type="button" variant="ghost">
              <Link to="/">Home</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});
AccountPage.displayName = "AccountPage";
