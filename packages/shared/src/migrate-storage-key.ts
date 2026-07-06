export function migrateLocalStorageKey(from: string, to: string): void {
  if (from === to) return;
  try {
    const value = localStorage.getItem(from);
    if (value === null || localStorage.getItem(to) !== null) return;
    localStorage.setItem(to, value);
    localStorage.removeItem(from);
  } catch {
    /* private mode etc. */
  }
}
