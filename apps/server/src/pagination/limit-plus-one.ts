/** Trim `limit + 1` query rows to `limit` items and derive `nextCursor` from the last kept row. */
export function takePageWithNextCursor<T>(
  rows: readonly T[],
  limit: number,
  nextCursorFromLast: (last: T) => string
): { nextCursor: string | null; page: T[] } {
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : [...rows];
  const nextCursor = hasMore && page.length > 0 ? nextCursorFromLast(page.at(-1)!) : null;
  return { nextCursor, page };
}
