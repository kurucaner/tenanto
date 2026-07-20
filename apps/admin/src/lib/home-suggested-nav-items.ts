import { getNavItemsForRole } from "@/config/admin-nav";
import { UserType } from "@/packages/shared";

const HOME_SUGGESTED_NAV_EXCLUDED_HREFS = new Set(["/home", "/properties"]);
const HOME_SUGGESTED_NAV_MAX = 6;

export function getHomeSuggestedNavItems(userType: UserType) {
  return getNavItemsForRole(userType)
    .filter((item) => !HOME_SUGGESTED_NAV_EXCLUDED_HREFS.has(item.href))
    .slice(0, HOME_SUGGESTED_NAV_MAX);
}
