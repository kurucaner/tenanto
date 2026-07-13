export type TPropertiesListToolbarFilterId = "q";

export interface IPropertiesListToolbarFilterItem {
  id: TPropertiesListToolbarFilterId;
  label: string;
}

export function buildPropertiesListToolbarFilterItems(
  q: string
): IPropertiesListToolbarFilterItem[] {
  const trimmed = q.trim();
  if (!trimmed) {
    return [];
  }
  return [{ id: "q", label: `Search: ${trimmed}` }];
}

export function buildPropertiesListToolbarClearOnePatch(
  id: TPropertiesListToolbarFilterId
): Partial<Record<TPropertiesListToolbarFilterId, string>> {
  return { [id]: "" };
}

export function buildPropertiesListToolbarClearAllPatch(): Record<
  TPropertiesListToolbarFilterId,
  string
> {
  return { q: "" };
}

export function formatPropertiesListCountLabel(loadedCount: number, hasNextPage: boolean): string {
  const suffix = hasNextPage ? "+" : "";
  const noun = loadedCount === 1 ? "property" : "properties";
  return `${loadedCount}${suffix} ${noun}`;
}
