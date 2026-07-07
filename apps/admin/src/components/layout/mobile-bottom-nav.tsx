import { MoreHorizontal } from "lucide-react";
import { memo, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";

import { useSidebar } from "@/components/ui/sidebar";
import {
  type AdminNavItem,
  getMobileBottomNavItems,
  isAdminNavActive,
} from "@/config/admin-nav";
import { MOBILE_BOTTOM_NAV_HEIGHT } from "@/config/mobile-layout";
import { cn } from "@/lib/utils";
import { UserType } from "@/packages/shared";
import { useAuthStore } from "@/stores/auth-store";

type MobileBottomNavItemProps = {
  active: boolean;
  item: AdminNavItem;
};

const MobileBottomNavItem = memo(({ active, item }: MobileBottomNavItemProps) => {
  const Icon = item.icon;

  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
      )}
      to={item.href}
    >
      {active ? (
        <span
          aria-hidden
          className="absolute inset-x-2 top-0 h-0.5 rounded-full bg-foreground"
        />
      ) : null}
      <span
        className={cn(
          "flex size-9 items-center justify-center rounded-lg transition-colors",
          active && "bg-muted/60"
        )}
      >
        <Icon aria-hidden className="size-5 shrink-0" />
      </span>
      <span className="max-w-full truncate text-[0.65rem] font-medium leading-tight">{item.title}</span>
    </Link>
  );
});
MobileBottomNavItem.displayName = "MobileBottomNavItem";

const MobileBottomNavInner = memo(() => {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const { openMobile, setOpenMobile } = useSidebar();

  const { primary, overflow } = useMemo(
    () => getMobileBottomNavItems(user?.userType ?? UserType.USER),
    [user?.userType]
  );

  const moreActive =
    openMobile || overflow.some((item) => isAdminNavActive(item, location.pathname));

  return (
    <nav
      aria-label="Main navigation"
      className="w-full shrink-0 border-t border-border/60 bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div
        className="mx-auto flex max-w-lg items-stretch"
        style={{ minHeight: MOBILE_BOTTOM_NAV_HEIGHT }}
      >
        {primary.map((item) => (
          <MobileBottomNavItem
            active={isAdminNavActive(item, location.pathname)}
            item={item}
            key={item.href}
          />
        ))}
        <button
          aria-expanded={openMobile}
          aria-label="More navigation"
          className={cn(
            "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            moreActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setOpenMobile(true)}
          type="button"
        >
          {moreActive ? (
            <span
              aria-hidden
              className="absolute inset-x-2 top-0 h-0.5 rounded-full bg-foreground"
            />
          ) : null}
          <span
            className={cn(
              "flex size-9 items-center justify-center rounded-lg transition-colors",
              moreActive && "bg-muted/60"
            )}
          >
            <MoreHorizontal aria-hidden className="size-5 shrink-0" />
          </span>
          <span className="max-w-full truncate text-[0.65rem] font-medium leading-tight">More</span>
        </button>
      </div>
    </nav>
  );
});
MobileBottomNavInner.displayName = "MobileBottomNavInner";

export const MobileBottomNav = MobileBottomNavInner;
