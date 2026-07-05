import type { LucideIcon } from "lucide-react";
import { History, Home, LifeBuoy, SlidersHorizontal, Users } from "lucide-react";

export type AdminNavMatch = "exact" | "prefix";

export type AdminNavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  match: AdminNavMatch;
};

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { title: "Home", href: "/home", icon: Home, match: "exact" },
  { title: "Users", href: "/users", icon: Users, match: "prefix" },
  { title: "Support", href: "/support-requests", icon: LifeBuoy, match: "exact" },
  { title: "Activity", href: "/activity", icon: History, match: "exact" },
  { title: "Config", href: "/config", icon: SlidersHorizontal, match: "exact" },
];

export function isAdminNavActive(
  item: Pick<AdminNavItem, "href" | "match">,
  pathname: string
): boolean {
  if (item.match === "prefix") {
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }
  return pathname === item.href;
}
