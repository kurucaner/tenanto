import { derivePropertyPermissionsFromListItem } from "@/hooks/use-property-permissions";
import { getCommandPalettePropertyActions } from "@/lib/property-launcher-destinations";
import { buildPropertyResumePath } from "@/lib/property-switch-navigation";
import { type IRecentProperty } from "@/lib/recent-properties-storage";
import { type IProperty, type IUser } from "@/packages/shared";

export interface IGlobalCommandPaletteItem {
  id: string;
  label: string;
  path: string;
  value: string;
}

export function buildPropertyPaletteCommandItems(
  property: IProperty,
  currentUser: IUser | null
): IGlobalCommandPaletteItem[] {
  const permissions = derivePropertyPermissionsFromListItem(property, currentUser);

  return getCommandPalettePropertyActions(property.id, permissions).map((action) => ({
    id: `${property.id}-${action.label}`,
    label: `${property.name} → ${action.label}`,
    path: action.path,
    value: `${property.name} ${property.address} ${action.label}`,
  }));
}

export function buildRecentPaletteCommandItems(
  recentEntry: IRecentProperty,
  property: IProperty | undefined,
  currentUser: IUser | null
): IGlobalCommandPaletteItem[] {
  if (property != null) {
    return buildPropertyPaletteCommandItems(property, currentUser);
  }

  return [
    {
      id: `recent-resume-${recentEntry.id}`,
      label: `${recentEntry.name} → Resume`,
      path: buildPropertyResumePath(recentEntry.id, recentEntry.lastPath),
      value: `${recentEntry.name} ${recentEntry.address} resume`,
    },
  ];
}
