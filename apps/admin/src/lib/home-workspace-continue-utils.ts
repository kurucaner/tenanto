import { PROPERTY_SHELL_TABS } from "@/config/property-shell-tabs";
import { resolveActivePropertyShellTab } from "@/lib/property-shell-tab-navigation";
import { buildPropertyResumePath } from "@/lib/property-switch-navigation";
import { type IRecentProperty } from "@/lib/recent-properties-storage";

export function resolveRecentPropertyTabLabel(recentEntry: IRecentProperty): string {
  const resumePathname = buildPropertyResumePath(recentEntry.id, recentEntry.lastPath);

  return resolveActivePropertyShellTab(resumePathname, recentEntry.id, PROPERTY_SHELL_TABS).label;
}
