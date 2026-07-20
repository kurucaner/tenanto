import { memo, useMemo, useRef, useState } from "react";
import { Outlet } from "react-router-dom";

import { AdminDarkPaletteMenu } from "@/components/admin-dark-palette-menu";
import { AdminThemeSwitcher } from "@/components/admin-theme-switcher";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { GlobalCommandPalette } from "@/components/layout/global-command-palette";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { AdminHeaderPropertySwitcher } from "@/components/properties/property-switcher";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import {
  MOBILE_ADMIN_SHELL_HEIGHT_CLASS,
  MOBILE_ADMIN_SHELL_OVERFLOW_CLASS,
} from "@/config/mobile-layout";
import { HomeSearchFocusContext } from "@/contexts/home-search-focus-context";
import { LayoutScrollContext } from "@/contexts/layout-scroll-context";
import { NotificationStreamContext } from "@/contexts/notification-stream-context";
import { useGlobalCommandPalette } from "@/hooks/use-global-command-palette";
import { useNotificationStream } from "@/hooks/use-notification-stream";
import { useResolvedAdminDark } from "@/hooks/use-resolved-admin-dark";
import { cn } from "@/lib/utils";

const AdminLayoutInner = memo(() => {
  const resolvedDark = useResolvedAdminDark();
  const focusHandlerRef = useRef<(() => void) | null>(null);
  const homeSearchFocusValue = useMemo(
    () => ({
      focusSearch: () => {
        focusHandlerRef.current?.();
      },
      registerFocusHandler: (handler: (() => void) | null) => {
        focusHandlerRef.current = handler;
      },
    }),
    []
  );
  const { open: commandPaletteOpen, setOpen: setCommandPaletteOpen } = useGlobalCommandPalette();
  const [suppressToasts, setSuppressToasts] = useState(false);
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);
  const streamStatus = useNotificationStream({ suppressToasts });
  const streamContextValue = useMemo(
    () => ({ setSuppressToasts, status: streamStatus }),
    [streamStatus]
  );

  return (
    <NotificationStreamContext.Provider value={streamContextValue}>
      <SidebarProvider
        className={cn(MOBILE_ADMIN_SHELL_HEIGHT_CLASS, MOBILE_ADMIN_SHELL_OVERFLOW_CLASS)}
      >
        <DashboardSidebar />
        <SidebarInset
          className={cn(
            "admin-app-surface overflow-hidden",
            MOBILE_ADMIN_SHELL_HEIGHT_CLASS,
            // Fixed height on desktop so the content div below is the real
            // scroll container (required for page-level list virtualization).
            "max-md:h-full md:h-svh"
          )}
        >
          <header className="flex h-14 min-w-0 shrink-0 items-center gap-2 border-b border-border/60 bg-background/80 px-4 backdrop-blur-md">
            <SidebarTrigger className="hidden md:inline-flex" />
            <div className="min-w-0 flex-1">
              <AdminHeaderPropertySwitcher />
            </div>
            <div className="ms-auto flex shrink-0 items-center gap-2">
              <NotificationBell />
              {resolvedDark ? <AdminDarkPaletteMenu compact /> : null}
              <AdminThemeSwitcher compact />
            </div>
          </header>
          <div
            className="flex min-h-0 flex-1 flex-col overflow-auto p-6 md:p-8 md:pb-8"
            ref={setScrollElement}
          >
            <LayoutScrollContext.Provider value={scrollElement}>
              <HomeSearchFocusContext.Provider value={homeSearchFocusValue}>
                <Outlet />
              </HomeSearchFocusContext.Provider>
            </LayoutScrollContext.Provider>
          </div>
          <MobileBottomNav />
        </SidebarInset>
        <GlobalCommandPalette onOpenChange={setCommandPaletteOpen} open={commandPaletteOpen} />
      </SidebarProvider>
    </NotificationStreamContext.Provider>
  );
});
AdminLayoutInner.displayName = "AdminLayoutInner";

export const AdminLayout = AdminLayoutInner;
