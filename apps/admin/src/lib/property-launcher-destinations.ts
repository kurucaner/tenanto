import { type IPropertyShellTab, PROPERTY_SHELL_TABS } from "@/config/property-shell-tabs";
import { type IPropertyPermissions } from "@/hooks/use-property-permissions";
import { buildPropertyShellTabPath } from "@/lib/property-shell-tab-navigation";
import { getVisiblePropertyShellTabs } from "@/lib/property-shell-tab-visibility";

interface IPropertyLauncherDestinationMetadata {
  searchTerms: string[];
  showInCommandPalette: boolean;
  showOnHome: boolean;
}

export interface IPropertyLauncherDestination extends IPropertyShellTab {
  searchTerms: string[];
  showInCommandPalette: boolean;
  showOnHome: boolean;
}

const LAUNCHER_DESTINATION_METADATA: Record<string, IPropertyLauncherDestinationMetadata> = {
  "": {
    searchTerms: ["home", "overview"],
    showInCommandPalette: true,
    showOnHome: false,
  },
  communications: {
    searchTerms: ["comm", "communication", "communications"],
    showInCommandPalette: true,
    showOnHome: false,
  },
  expenses: {
    searchTerms: ["expense", "expenses"],
    showInCommandPalette: true,
    showOnHome: true,
  },
  exports: {
    searchTerms: ["export", "exports"],
    showInCommandPalette: true,
    showOnHome: false,
  },
  income: {
    searchTerms: ["income", "revenue"],
    showInCommandPalette: true,
    showOnHome: true,
  },
  leases: {
    searchTerms: ["lease", "leases"],
    showInCommandPalette: true,
    showOnHome: true,
  },
  reports: {
    searchTerms: ["report", "reports"],
    showInCommandPalette: true,
    showOnHome: false,
  },
  settings: {
    searchTerms: ["setting", "settings"],
    showInCommandPalette: true,
    showOnHome: false,
  },
  units: {
    searchTerms: ["unit", "units"],
    showInCommandPalette: true,
    showOnHome: true,
  },
};

function buildDefaultSearchTerms(tab: IPropertyShellTab, extraTerms: string[]): string[] {
  const defaults = [
    tab.label.toLowerCase(),
    tab.path.toLowerCase(),
    ...extraTerms.map((term) => term.toLowerCase()),
  ].filter((term) => term !== "");

  return [...new Set(defaults)];
}

const PROPERTY_LAUNCHER_DESTINATIONS: IPropertyLauncherDestination[] = PROPERTY_SHELL_TABS.map(
  (tab) => {
    const metadata = LAUNCHER_DESTINATION_METADATA[tab.path];

    return {
      ...tab,
      searchTerms: buildDefaultSearchTerms(tab, metadata.searchTerms),
      showInCommandPalette: metadata.showInCommandPalette,
      showOnHome: metadata.showOnHome,
    };
  }
);

export function getPropertyShellTabSearchTerms(
  destination: Pick<IPropertyLauncherDestination, "label" | "path" | "searchTerms">
): string[] {
  return destination.searchTerms;
}

export function getSearchablePropertyShellTabs(): IPropertyLauncherDestination[] {
  return PROPERTY_LAUNCHER_DESTINATIONS.filter((destination) => destination.showInCommandPalette);
}

export function getVisiblePropertyLauncherDestinations(
  permissions: IPropertyPermissions
): IPropertyLauncherDestination[] {
  const visiblePaths = new Set(getVisiblePropertyShellTabs(permissions).map((tab) => tab.path));

  return PROPERTY_LAUNCHER_DESTINATIONS.filter((destination) => visiblePaths.has(destination.path));
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
