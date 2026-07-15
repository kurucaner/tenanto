import { useQuery } from "@tanstack/react-query";
import { memo } from "react";
import { NavLink, Outlet } from "react-router-dom";

import { useTenantLogout } from "@/hooks/use-tenant-logout";
import { tenantPortalApi } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import {
  Button,
  cn,
  DarkPaletteMenu,
  ThemeSwitcher,
  useResolvedDark,
} from "@/packages/app-ui";
import { APP_NAME } from "@/packages/shared";
import { useAuthStore } from "@/stores/auth-store";

const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
  cn(
    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
    isActive
      ? "bg-primary/10 text-primary"
      : "text-muted-foreground hover:bg-muted hover:text-foreground"
  );

export const PortalLayout = memo(function PortalLayout() {
  const user = useAuthStore((s) => s.user);
  const resolvedDark = useResolvedDark();
  const logout = useTenantLogout();

  const pendingQuery = useQuery({
    queryFn: () => tenantPortalApi.listPendingInvites(),
    queryKey: queryKeys.pendingInvites(),
  });

  const pendingCount = pendingQuery.data?.invites.length ?? 0;

  return (
    <div className="app-surface min-h-svh">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-card/70 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-2xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="min-w-0">
            <p className="font-display text-lg font-semibold tracking-tight text-foreground">
              {APP_NAME}
            </p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <nav className="flex items-center gap-1">
              <NavLink className={navLinkClassName} to="/leases">
                Leases
              </NavLink>
              <NavLink className={navLinkClassName} to="/invites/pending">
                Invites{pendingCount > 0 ? ` (${pendingCount})` : ""}
              </NavLink>
            </nav>
            {resolvedDark ? <DarkPaletteMenu /> : null}
            <ThemeSwitcher compact />
            <Button onClick={() => void logout()} type="button" variant="outline">
              Logout
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
});
PortalLayout.displayName = "PortalLayout";
