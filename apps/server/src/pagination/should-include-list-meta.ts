export function shouldIncludeListMeta(cursor?: string): boolean {
  return cursor == null || cursor === "";
}
