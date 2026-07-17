import { useQuery } from "@tanstack/react-query";
import { memo } from "react";
import { toast } from "sonner";

import { useTenantLogout } from "@/hooks/use-tenant-logout";
import { tenantPortalApi } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DarkPaletteMenu,
  ThemeSwitcher,
  useResolvedDark,
} from "@/packages/app-ui";
import { formatPhoneDisplay } from "@/packages/shared";
import { useAuthStore } from "@/stores/auth-store";

export const SettingsPage = memo(function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const resolvedDark = useResolvedDark();
  const logout = useTenantLogout();

  const meQuery = useQuery({
    queryFn: () => tenantPortalApi.getMe(),
    queryKey: queryKeys.me(),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground">Account, appearance, and session.</p>
      </div>

      <Card className="rounded-2xl border-border/80 bg-card/85 shadow-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-lg font-semibold">{user?.name ?? "Profile"}</CardTitle>
          <CardDescription>{user?.email}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {meQuery.isPending ? <p className="text-muted-foreground">Loading profile…</p> : null}
          {meQuery.isError ? (
            <p className="text-destructive">
              {meQuery.error instanceof Error ? meQuery.error.message : "Failed to load profile"}
            </p>
          ) : null}
          {meQuery.data ? (
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Member since</p>
                <p className="text-foreground">
                  {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
                    new Date(meQuery.data.user.createdAt)
                  )}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Phone</p>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-foreground">
                    {meQuery.data.user.phone
                      ? formatPhoneDisplay(meQuery.data.user.phone)
                      : "Not added"}
                  </p>
                  {meQuery.data.user.phone && !meQuery.data.user.phoneVerifiedAt ? (
                    <Button
                      onClick={() => toast.message("Coming soon")}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      Verify
                    </Button>
                  ) : null}
                </div>
                {meQuery.data.user.phone && meQuery.data.user.phoneVerifiedAt ? (
                  <p className="text-xs text-muted-foreground">Verified</p>
                ) : null}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 bg-card/85 shadow-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-lg font-semibold">Appearance</CardTitle>
          <CardDescription>Theme for the resident portal.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          {resolvedDark ? <DarkPaletteMenu /> : null}
          <ThemeSwitcher />
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 bg-card/85 shadow-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-lg font-semibold">Session</CardTitle>
          <CardDescription>Sign out of this device.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => void logout()} type="button" variant="outline">
            Logout
          </Button>
        </CardContent>
      </Card>
    </div>
  );
});
SettingsPage.displayName = "SettingsPage";
