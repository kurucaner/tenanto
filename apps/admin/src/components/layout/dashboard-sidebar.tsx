import { LogOut } from "lucide-react";
import { memo, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { SidebarWhatsChanged } from "@/components/layout/sidebar-whats-changed";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getNavItemsForRole, isAdminNavActive } from "@/config/admin-nav";
import { authApi } from "@/lib/api-client";
import { clearAppSession } from "@/lib/clear-app-session";
import { APP_NAME, UserType } from "@/packages/shared";
import { useAuthStore } from "@/stores/auth-store";



const DashboardSidebarInner = memo(() => {
  const { isMobile, state } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const refreshToken = useAuthStore((s) => s.refreshToken);

  const handleLogout = useCallback(async () => {
    if (refreshToken) {
      try {
        await authApi.logout(refreshToken);
      } catch {
        // Still clear local session if revoke fails
      }
    }
    clearAppSession();
    navigate("/login", { replace: true });
  }, [refreshToken, navigate]);

  const brandCollapsedTooltip = !isMobile && state === "collapsed";

  const brandLink = (
    <Link
      aria-label={`${APP_NAME} — home`}
      className="group flex min-w-0 w-full flex-col gap-0.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:py-1"
      to="/home"
    >
      <span className="font-display text-lg font-semibold tracking-tight text-sidebar-foreground transition-colors group-hover:text-sidebar-primary group-data-[collapsible=icon]:sr-only">
        {APP_NAME}
      </span>
      <img
        alt=""
        aria-hidden
        className="hidden size-8 shrink-0 rounded-md object-cover transition-opacity group-hover:opacity-90 group-data-[collapsible=icon]:block"
        height={32}
        src="/brand-icon.png"
        width={32}
      />
    </Link>
  );

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader className="min-w-0 overflow-hidden border-b border-sidebar-border/60 px-3 py-[14px]">
        {brandCollapsedTooltip ? (
          <Tooltip>
            <TooltipTrigger asChild>{brandLink}</TooltipTrigger>
            <TooltipContent align="center" side="right">
              {APP_NAME} · Home
            </TooltipContent>
          </Tooltip>
        ) : (
          brandLink
        )}
      </SidebarHeader>
      <SidebarContent className="gap-0 px-2 pt-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[0.65rem] uppercase tracking-widest text-muted-foreground/90">
            Workspace
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {getNavItemsForRole(user?.userType ?? UserType.USER).map((item) => {
                const Icon = item.icon;
                const active = isAdminNavActive(item, location.pathname);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <Link to={item.href}>
                        <Icon className="size-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarWhatsChanged />
      <SidebarSeparator className="mx-2" />
      <SidebarFooter className="gap-2 p-2">
        <div className="flex min-w-0 flex-col gap-1 rounded-lg border border-sidebar-border/70 px-2.5 py-2 group-data-[collapsible=icon]:hidden">
          <span className="truncate text-xs font-medium text-sidebar-foreground">
            {user?.email ?? "—"}
          </span>
          <span className="text-[0.65rem] tracking-wider text-muted-foreground">
            Version {import.meta.env.VITE_APP_VERSION}
          </span>
        </div>
        <Button
          className="w-full gap-2 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0"
          onClick={handleLogout}
          size="sm"
          type="button"
          variant="outline"
        >
          <LogOut className="size-4 shrink-0" />
          <span className="group-data-[collapsible=icon]:sr-only">Log out</span>
        </Button>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
});
DashboardSidebarInner.displayName = "DashboardSidebarInner";

export const DashboardSidebar = DashboardSidebarInner;
