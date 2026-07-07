import { memo, useMemo, useState } from "react";
import { Outlet } from "react-router-dom";

import { AdminDarkPaletteMenu } from "@/components/admin-dark-palette-menu";
import { AdminThemeSwitcher } from "@/components/admin-theme-switcher";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { NotificationBell } from "@/components/notifications/notification-bell";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { MOBILE_BOTTOM_NAV_CONTENT_PADDING_CLASS } from "@/config/mobile-layout";
import { NotificationStreamContext } from "@/contexts/notification-stream-context";
import { useNotificationStream } from "@/hooks/use-notification-stream";
import { useResolvedAdminDark } from "@/hooks/use-resolved-admin-dark";
import { cn } from "@/lib/utils";

const AdminLayoutInner = memo(() => {
  const resolvedDark = useResolvedAdminDark();
  const [suppressToasts, setSuppressToasts] = useState(false);
  const streamStatus = useNotificationStream({ suppressToasts });
  const streamContextValue = useMemo(
    () => ({ setSuppressToasts, status: streamStatus }),
    [streamStatus]
  );

  return (
    <NotificationStreamContext.Provider value={streamContextValue}>
      <SidebarProvider>
        <DashboardSidebar />
        <SidebarInset className="admin-app-surface overflow-hidden">
          <header className="flex h-14 min-w-0 shrink-0 items-center gap-2 border-b border-border/60 bg-background/80 px-4 backdrop-blur-md">
            <SidebarTrigger className="hidden md:inline-flex" />
            <div className="ms-auto flex shrink-0 items-center gap-2">
              <NotificationBell />
              {resolvedDark ? <AdminDarkPaletteMenu compact /> : null}
              <AdminThemeSwitcher compact />
            </div>
          </header>
          <div
            className={cn(
              "flex flex-1 flex-col overflow-auto p-6 md:p-8 md:pb-8",
              MOBILE_BOTTOM_NAV_CONTENT_PADDING_CLASS
            )}
          >
            <Outlet />
          </div>
          <MobileBottomNav />
        </SidebarInset>
      </SidebarProvider>
    </NotificationStreamContext.Provider>
  );
});
AdminLayoutInner.displayName = "AdminLayoutInner";

export const AdminLayout = AdminLayoutInner;
