import type { LucideIcon } from "lucide-react";
import { BarChart3, Building2, History, Home, LifeBuoy, SlidersHorizontal, Users } from "lucide-react";

import { UserType } from "@/packages/shared";

export type AdminNavMatch = "exact" | "prefix";

export type AdminNavItem = {
  href: string;
  icon: LucideIcon;
  match: AdminNavMatch;
  /**
   * Which user types can see this item.
   * `undefined` means visible to all authenticated users.
   */
  roles?: UserType[];
  title: string;
};

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: "/home", icon: Home, match: "exact", title: "Home" },
  { href: "/properties", icon: Building2, match: "prefix", title: "Properties" },
  { href: "/reports", icon: BarChart3, match: "exact", title: "Reports" },
  { href: "/users", icon: Users, match: "prefix", roles: [UserType.ADMIN], title: "Users" },
  {
    href: "/support-requests",
    icon: LifeBuoy,
    match: "prefix",
    title: "Support",
  },
  { href: "/activity", icon: History, match: "exact", roles: [UserType.ADMIN], title: "Activity" },
  {
    href: "/config",
    icon: SlidersHorizontal,
    match: "exact",
    roles: [UserType.ADMIN],
    title: "Config",
  },
];

export function getNavItemsForRole(userType: UserType): AdminNavItem[] {
  return ADMIN_NAV_ITEMS.filter(
    (item) => item.roles === undefined || item.roles.includes(userType)
  );
}

export function isAdminNavActive(
  item: Pick<AdminNavItem, "href" | "match">,
  pathname: string
): boolean {
  if (item.match === "prefix") {
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }
  return pathname === item.href;
}
