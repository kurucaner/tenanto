const DEFAULT_STYLE = "grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3";

export function getLedgerFiltersGridClass(filterCount: number): string {
  if (filterCount >= 6) {
    return `${DEFAULT_STYLE} 2xl:grid-cols-6`;
  }
  if (filterCount >= 5) {
    return `${DEFAULT_STYLE} 2xl:grid-cols-5`;
  }
  if (filterCount >= 4) {
    return `${DEFAULT_STYLE} xl:grid-cols-4`;
  }
  if (filterCount >= 3) {
    return DEFAULT_STYLE;
  }
  return "grid min-w-0 gap-3 sm:grid-cols-2";
}
