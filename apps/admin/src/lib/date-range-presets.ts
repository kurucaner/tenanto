export const DateRangePreset = {
  ALL: "all",
  DAY: "1d",
  MONTH: "1m",
  SIX_MONTHS: "6m",
  WEEK: "1w",
  YEAR: "1y",
} as const;

export type TDateRangePresetId = (typeof DateRangePreset)[keyof typeof DateRangePreset];

export const DATE_RANGE_PRESET_OPTIONS: { id: TDateRangePresetId; label: string }[] = [
  { id: DateRangePreset.DAY, label: "1 day" },
  { id: DateRangePreset.WEEK, label: "1 week" },
  { id: DateRangePreset.MONTH, label: "1 month" },
  { id: DateRangePreset.SIX_MONTHS, label: "6 months" },
  { id: DateRangePreset.YEAR, label: "1 year" },
  { id: DateRangePreset.ALL, label: "All time" },
];

export function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function endOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

function addUtcMonths(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function resolveDateRangePreset(
  id: TDateRangePresetId,
  now: Date = new Date()
): { from: string; to: string } | null {
  const today = formatUtcDate(now);

  switch (id) {
    case DateRangePreset.ALL:
      return null;
    case DateRangePreset.DAY:
      return { from: today, to: today };
    case DateRangePreset.WEEK:
      return { from: formatUtcDate(addUtcDays(now, -6)), to: today };
    case DateRangePreset.MONTH:
      return {
        from: formatUtcDate(startOfUtcMonth(now)),
        to: formatUtcDate(endOfUtcMonth(now)),
      };
    case DateRangePreset.SIX_MONTHS:
      return {
        from: formatUtcDate(startOfUtcMonth(addUtcMonths(now, -5))),
        to: formatUtcDate(endOfUtcMonth(now)),
      };
    case DateRangePreset.YEAR:
      return {
        from: formatUtcDate(startOfUtcMonth(addUtcMonths(now, -11))),
        to: formatUtcDate(endOfUtcMonth(now)),
      };
  }
}

function rangesEqual(
  left: { from: string; to: string } | null,
  right: { from: string; to: string } | null
): boolean {
  if (left === null && right === null) {
    return true;
  }

  if (left === null || right === null) {
    return false;
  }

  return left.from === right.from && left.to === right.to;
}

export function matchDateRangePreset(
  from: string,
  to: string,
  now: Date = new Date()
): TDateRangePresetId | null {
  const normalizedFrom = from.trim();
  const normalizedTo = to.trim();

  if (normalizedFrom === "" && normalizedTo === "") {
    return DateRangePreset.ALL;
  }

  for (const { id } of DATE_RANGE_PRESET_OPTIONS) {
    if (id === DateRangePreset.ALL) {
      continue;
    }

    const resolved = resolveDateRangePreset(id, now);
    if (rangesEqual(resolved, { from: normalizedFrom, to: normalizedTo })) {
      return id;
    }
  }

  return null;
}
