import { addDaysToLocalIsoDate } from "@/lib/reservation-date-utils";

export const DateRangePreset = {
  ALL: "all",
  CURRENT_MONTH: "cm",
  DAY: "1d",
  MONTH: "1m",
  SIX_MONTHS: "6m",
  WEEK: "1w",
  YEAR: "1y",
  YEAR_TO_DATE: "ytd",
} as const;

export type TDateRangePresetId = (typeof DateRangePreset)[keyof typeof DateRangePreset];

export const DATE_RANGE_PRESET_OPTIONS: { id: TDateRangePresetId; label: string }[] = [
  { id: DateRangePreset.CURRENT_MONTH, label: "Current month" },
  { id: DateRangePreset.YEAR_TO_DATE, label: "Year to date" },
  { id: DateRangePreset.DAY, label: "1 day" },
  { id: DateRangePreset.WEEK, label: "1 week" },
  { id: DateRangePreset.MONTH, label: "1 month" },
  { id: DateRangePreset.SIX_MONTHS, label: "6 months" },
  { id: DateRangePreset.YEAR, label: "1 year" },
  { id: DateRangePreset.ALL, label: "All time" },
];

export const BOUNDED_DATE_RANGE_PRESET_OPTIONS = DATE_RANGE_PRESET_OPTIONS.filter(
  (option) => option.id !== DateRangePreset.ALL
);

export function getDateRangeSummary(
  activePreset: TDateRangePresetId | null,
  from: string,
  to: string
): string {
  const presetLabel = DATE_RANGE_PRESET_OPTIONS.find((option) => option.id === activePreset)?.label;
  if (presetLabel) {
    return presetLabel;
  }
  if (from && to) {
    return `${from} – ${to}`;
  }
  return from || to || "Custom";
}

function formatLocalIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function startOfLocalMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function startOfLocalYear(date: Date): string {
  return `${date.getFullYear()}-01-01`;
}

function rollingRangeEndingToday(today: string, dayCount: number): { from: string; to: string } {
  return { from: addDaysToLocalIsoDate(today, -(dayCount - 1)), to: today };
}

export function resolveDateRangePreset(
  id: TDateRangePresetId,
  now: Date = new Date()
): { from: string; to: string } | null {
  const today = formatLocalIsoDate(now);

  switch (id) {
    case DateRangePreset.ALL:
      return null;
    case DateRangePreset.CURRENT_MONTH:
      return { from: startOfLocalMonth(now), to: today };
    case DateRangePreset.YEAR_TO_DATE:
      return { from: startOfLocalYear(now), to: today };
    case DateRangePreset.DAY:
      return { from: today, to: today };
    case DateRangePreset.WEEK:
      return rollingRangeEndingToday(today, 7);
    case DateRangePreset.MONTH:
      return rollingRangeEndingToday(today, 30);
    case DateRangePreset.SIX_MONTHS:
      return rollingRangeEndingToday(today, 180);
    case DateRangePreset.YEAR:
      return rollingRangeEndingToday(today, 365);
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
