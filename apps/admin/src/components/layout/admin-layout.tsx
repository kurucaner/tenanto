import { memo } from "react";
import { Outlet } from "react-router-dom";

import { AdminDarkPaletteMenu } from "@/components/admin-dark-palette-menu";
import { AdminThemeSwitcher } from "@/components/admin-theme-switcher";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useResolvedAdminDark } from "@/hooks/use-resolved-admin-dark";

const AdminLayoutInner = memo(() => {
  const resolvedDark = useResolvedAdminDark();

  return (
  <SidebarProvider>
    <DashboardSidebar />
    <SidebarInset className="admin-app-surface overflow-hidden">
      <header className="flex h-14 min-w-0 shrink-0 items-center gap-2 border-b border-border/60 bg-background/80 px-4 backdrop-blur-md">
        <SidebarTrigger />
        <Separator className="h-6" orientation="vertical" />
        <span className="min-w-0 truncate text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Console
        </span>
        <div className="ms-auto flex shrink-0 items-center gap-2">
          {resolvedDark ? <AdminDarkPaletteMenu compact /> : null}
          <AdminThemeSwitcher compact />
        </div>
      </header>
      <div className="flex flex-1 flex-col overflow-auto p-6 md:p-8">
        <Outlet />
      </div>
    </SidebarInset>
  </SidebarProvider>
  );
});
AdminLayoutInner.displayName = "AdminLayoutInner";

export const AdminLayout = AdminLayoutInner;
