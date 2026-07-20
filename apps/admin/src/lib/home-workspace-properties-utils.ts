import { type IRecentProperty } from "@/lib/recent-properties-storage";
import { type IProperty } from "@/packages/shared";

export const HOME_WORKSPACE_PROPERTIES_MAX = 8;
export const HOME_WORKSPACE_PROPERTIES_LIST_LIMIT = HOME_WORKSPACE_PROPERTIES_MAX;

export interface IPartitionedRecentEntries {
  accessibleRecentEntries: IRecentProperty[];
  staleRecentEntries: IRecentProperty[];
}

export function partitionRecentEntriesByAccessibleList(
  recentEntries: IRecentProperty[],
  listItems: IProperty[]
): IPartitionedRecentEntries {
  const accessiblePropertyIds = new Set(listItems.map((property) => property.id));
  const accessibleRecentEntries: IRecentProperty[] = [];
  const staleRecentEntries: IRecentProperty[] = [];
  const seenIds = new Set<string>();

  for (const recentEntry of recentEntries) {
    if (seenIds.has(recentEntry.id)) {
      continue;
    }

    seenIds.add(recentEntry.id);

    if (accessiblePropertyIds.has(recentEntry.id)) {
      accessibleRecentEntries.push(recentEntry);
      continue;
    }

    staleRecentEntries.push(recentEntry);
  }

  return {
    accessibleRecentEntries,
    staleRecentEntries,
  };
}

export function mergeHomeWorkspaceProperties(
  recentEntries: IRecentProperty[],
  listItems: IProperty[]
): IProperty[] {
  const listById = new Map(listItems.map((property) => [property.id, property]));
  const merged: IProperty[] = [];
  const seenIds = new Set<string>();

  for (const recentEntry of recentEntries) {
    if (seenIds.has(recentEntry.id)) {
      continue;
    }

    const property = listById.get(recentEntry.id);
    if (property == null) {
      continue;
    }

    merged.push(property);
    seenIds.add(recentEntry.id);
    if (merged.length >= HOME_WORKSPACE_PROPERTIES_MAX) {
      return merged;
    }
  }

  for (const property of listItems) {
    if (seenIds.has(property.id)) {
      continue;
    }

    merged.push(property);
    seenIds.add(property.id);
    if (merged.length >= HOME_WORKSPACE_PROPERTIES_MAX) {
      break;
    }
  }

  return merged;
}
