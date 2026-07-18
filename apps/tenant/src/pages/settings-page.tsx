import { useQuery } from "@tanstack/react-query";
import { memo } from "react";

import { TenantSmsSettingsSection } from "@/components/settings/tenant-sms-settings-section";
import { getTenantSmsSettingsSectionKey } from "@/components/settings/use-tenant-sms-settings-form";
import { useTenantLogout } from "@/hooks/use-tenant-logout";
import { tenantPortalApi } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { isTenantPhoneAuthEnabled } from "@/lib/tenant-auth-expansion-flags";
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
import { useAuthStore } from "@/stores/auth-store";

export const SettingsPage = memo(function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const resolvedDark = useResolvedDark();
  const logout = useTenantLogout();
  const phoneAuthEnabled = isTenantPhoneAuthEnabled();

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
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Member since</p>
              <p className="text-foreground">
                {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
                  new Date(meQuery.data.user.createdAt)
                )}
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {phoneAuthEnabled && meQuery.data ? (
        <Card className="rounded-2xl border-border/80 bg-card/85 shadow-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-lg font-semibold">SMS alerts</CardTitle>
            <CardDescription>
              Optional transactional texts for verification codes and account notifications.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TenantSmsSettingsSection
              key={getTenantSmsSettingsSectionKey(meQuery.data.user)}
              user={meQuery.data.user}
            />
          </CardContent>
        </Card>
      ) : null}

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
