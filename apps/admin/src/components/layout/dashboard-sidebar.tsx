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
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { getNavItemsForRole, isAdminNavActive } from "@/config/admin-nav";
import { authApi } from "@/lib/api-client";
import { clearAppSession } from "@/lib/clear-app-session";
import { UserType } from "@/packages/shared";
import { useAuthStore } from "@/stores/auth-store";

const DashboardSidebarInner = memo(() => {
  const { isMobile, setOpenMobile } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const refreshToken = useAuthStore((s) => s.refreshToken);

  const handleNavClick = useCallback(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [isMobile, setOpenMobile]);

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

  return (
    <Sidebar collapsible="icon" variant="inset">
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
                      <Link onClick={handleNavClick} to={item.href}>
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
        <div className="mt-auto">
          <SidebarWhatsChanged />
        </div>
      </SidebarContent>
      <SidebarFooter className="gap-2 p-2">
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
    </Sidebar>
  );
});
DashboardSidebarInner.displayName = "DashboardSidebarInner";

export const DashboardSidebar = DashboardSidebarInner;
