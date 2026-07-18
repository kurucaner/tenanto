const PAGINATION_ANCHOR_DATE = "2026-07-09";
const PAGINATION_ANCHOR_TIME = "2026-07-09T10:00:00.000Z";

/** ISO date offset from the pagination test anchor (2026-07-09). */
export function testIsoDate(dayOffset = 0): string {
  const date = new Date(`${PAGINATION_ANCHOR_DATE}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + dayOffset);
  return date.toISOString().slice(0, 10);
}

/** UTC Date offset from the pagination test anchor (2026-07-09T10:00:00Z). */
export function testDateTime(dayOffset = 0): Date {
  const date = new Date(PAGINATION_ANCHOR_TIME);
  date.setUTCDate(date.getUTCDate() + dayOffset);
  return date;
}
