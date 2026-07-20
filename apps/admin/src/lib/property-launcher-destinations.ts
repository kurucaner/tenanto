import { type IPropertyShellTab, PROPERTY_SHELL_TABS } from "@/config/property-shell-tabs";
import { type IPropertyPermissions } from "@/hooks/use-property-permissions";
import { buildPropertyShellTabPath } from "@/lib/property-shell-tab-navigation";
import { getVisiblePropertyShellTabs } from "@/lib/property-shell-tab-visibility";

export interface IPropertyLauncherDestination extends IPropertyShellTab {
  showInCommandPalette: boolean;
  showOnHome: boolean;
}

const LAUNCHER_DESTINATION_METADATA: Record<
  string,
  Pick<IPropertyLauncherDestination, "showInCommandPalette" | "showOnHome">
> = {
  "": { showInCommandPalette: true, showOnHome: false },
  communications: { showInCommandPalette: true, showOnHome: false },
  expenses: { showInCommandPalette: true, showOnHome: true },
  exports: { showInCommandPalette: true, showOnHome: false },
  income: { showInCommandPalette: true, showOnHome: true },
  leases: { showInCommandPalette: true, showOnHome: true },
  reports: { showInCommandPalette: true, showOnHome: false },
  settings: { showInCommandPalette: true, showOnHome: false },
  units: { showInCommandPalette: true, showOnHome: true },
};

const PROPERTY_LAUNCHER_DESTINATIONS: IPropertyLauncherDestination[] = PROPERTY_SHELL_TABS.map(
  (tab) => ({
    ...tab,
    ...LAUNCHER_DESTINATION_METADATA[tab.path],
  })
);

export function getVisiblePropertyLauncherDestinations(
  permissions: IPropertyPermissions
): IPropertyLauncherDestination[] {
  const visiblePaths = new Set(getVisiblePropertyShellTabs(permissions).map((tab) => tab.path));

  return PROPERTY_LAUNCHER_DESTINATIONS.filter((destination) =>
    visiblePaths.has(destination.path)
  );
}

export function getHomePropertyLauncherShortcutPaths(
  propertyId: string,
  permissions: IPropertyPermissions
): { label: string; path: string }[] {
  return getVisiblePropertyLauncherDestinations(permissions)
    .filter((destination) => destination.showOnHome)
    .map((destination) => ({
      label: destination.label,
      path: buildPropertyShellTabPath(propertyId, destination),
    }));
}

export function getCommandPalettePropertyActions(
  propertyId: string,
  permissions: IPropertyPermissions
): { label: string; path: string }[] {
  return getVisiblePropertyLauncherDestinations(permissions)
    .filter((destination) => destination.showInCommandPalette)
    .map((destination) => ({
      label: destination.label,
      path: buildPropertyShellTabPath(propertyId, destination),
    }));
}
