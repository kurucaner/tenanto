import { useQuery } from "@tanstack/react-query";
import { Bell, Settings } from "lucide-react";
import { memo } from "react";
import { Link, Outlet } from "react-router-dom";

import { tenantPortalApi } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { Button } from "@/packages/app-ui";
import { APP_NAME } from "@/packages/shared";

export const PortalLayout = memo(function PortalLayout() {
  const pendingQuery = useQuery({
    queryFn: () => tenantPortalApi.listPendingInvites(),
    queryKey: queryKeys.pendingInvites(),
  });

  const pendingCount = pendingQuery.data?.invites.length ?? 0;

  return (
    <div className="app-surface min-h-svh">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-card/70 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-4 px-6 py-4">
          <Link className="min-w-0" to="/home">
            <p className="font-display text-lg font-semibold tracking-tight text-foreground">
              {APP_NAME}
            </p>
          </Link>
          <div className="flex shrink-0 items-center gap-1">
            <Button asChild size="icon" type="button" variant="ghost">
              <Link
                aria-label={
                  pendingCount > 0
                    ? `Pending invites, ${pendingCount} unread`
                    : "Pending invites"
                }
                className="relative"
                to="/invites/pending"
              >
                <Bell className="size-4" />
                {pendingCount > 0 ? (
                  <span
                    aria-hidden
                    className="absolute -end-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground"
                  >
                    {pendingCount > 9 ? "9+" : pendingCount}
                  </span>
                ) : null}
              </Link>
            </Button>
            <Button asChild size="icon" type="button" variant="ghost">
              <Link aria-label="Settings" to="/settings">
                <Settings className="size-4" />
              </Link>
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
