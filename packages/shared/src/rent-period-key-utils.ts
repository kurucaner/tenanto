import { formatLeaseMonthLabel, getLeaseWeekPeriodEnd } from "./lease-date-utils";

const PERIOD_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const PERIOD_WEEK_START_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function isMonthlyPeriodKey(periodKey: string): boolean {
  return PERIOD_MONTH_RE.test(periodKey);
}

export function isWeeklyPeriodKey(periodKey: string): boolean {
  return PERIOD_WEEK_START_RE.test(periodKey);
}

export function isValidRentPeriodKey(periodKey: string): boolean {
  return isMonthlyPeriodKey(periodKey) || isWeeklyPeriodKey(periodKey);
}

/** Lexicographic compare — valid for both YYYY-MM and YYYY-MM-DD keys within one cadence. */
export function comparePeriodKeys(left: string, right: string): number {
  return left.localeCompare(right);
}

export function isPeriodKeyOnOrBefore(periodKey: string, asOfKey: string): boolean {
  return comparePeriodKeys(periodKey, asOfKey) <= 0;
}

export function isPeriodKeyAfter(periodKey: string, asOfKey: string): boolean {
  return comparePeriodKeys(periodKey, asOfKey) > 0;
}

export function inferRentScheduleCadence(
  schedulePeriods: readonly string[]
): "monthly" | "weekly" | null {
  const firstPeriod = schedulePeriods[0];
  if (!firstPeriod) {
    return null;
  }

  if (isWeeklyPeriodKey(firstPeriod)) {
    return "weekly";
  }

  if (isMonthlyPeriodKey(firstPeriod)) {
    return "monthly";
  }

  return null;
}

export function resolveAsOfPeriodKey(
  referenceDate: string,
  schedulePeriods: readonly string[]
): string {
  if (inferRentScheduleCadence(schedulePeriods) === "weekly") {
    return referenceDate;
  }

  return referenceDate.slice(0, 7);
}

export function formatRentPeriodLabel(periodKey: string): string {
  if (isWeeklyPeriodKey(periodKey)) {
    const parts = periodKey.split("-").map(Number);
    const year = parts[0] ?? 0;
    const month = parts[1] ?? 1;
    const day = parts[2] ?? 1;
    const formatted = new Date(year, month - 1, day).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    return `Week of ${formatted}`;
  }

  if (isMonthlyPeriodKey(periodKey)) {
    return formatLeaseMonthLabel(periodKey);
  }

  return periodKey;
}

export function findWeeklyPeriodStartContainingDate(
  transactionDate: string,
  schedulePeriods: readonly string[]
): string | null {
  for (const periodStart of schedulePeriods) {
    if (!isWeeklyPeriodKey(periodStart)) {
      continue;
    }

    const periodEnd = getLeaseWeekPeriodEnd(periodStart);
    if (transactionDate >= periodStart && transactionDate <= periodEnd) {
      return periodStart;
    }
  }

  return null;
}

export function resolveRentPeriodKeyForTransactionDate(
  transactionDate: string,
  schedulePeriods: readonly string[]
): string | null {
  if (schedulePeriods.length === 0) {
    return null;
  }

  if (inferRentScheduleCadence(schedulePeriods) === "weekly") {
    return findWeeklyPeriodStartContainingDate(transactionDate, schedulePeriods);
  }

  return transactionDate.slice(0, 7);
}
