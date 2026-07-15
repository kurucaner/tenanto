import { type IPropertyShellTab } from "@/config/property-shell-tabs";
import { getPropertyTabSuffix } from "@/lib/property-switch-navigation";

export function buildPropertyShellTabPath(propertyId: string, tab: IPropertyShellTab): string {
  return tab.path ? `/properties/${propertyId}/${tab.path}` : `/properties/${propertyId}`;
}

function isTabActive(suffix: string, tab: IPropertyShellTab): boolean {
  if (tab.path === "") {
    return suffix === "" || suffix === "/";
  }

  const prefix = `/${tab.path}`;
  return suffix === prefix || suffix.startsWith(`${prefix}/`);
}

export function resolveActivePropertyShellTab(
  pathname: string,
  propertyId: string,
  tabs: IPropertyShellTab[]
): IPropertyShellTab {
  const suffix = getPropertyTabSuffix(pathname, propertyId);
  const sortedTabs = [...tabs].sort((left, right) => right.path.length - left.path.length);

  for (const tab of sortedTabs) {
    if (isTabActive(suffix, tab)) {
      return tab;
    }
  }

  return tabs[0] ?? { end: true, label: "Overview", path: "" };
}
