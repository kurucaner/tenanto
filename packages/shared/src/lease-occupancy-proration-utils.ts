import { roundMoney } from "./property-income-calculator";

export const MS_PER_DAY = 86_400_000;

export function parseIsoDateParts(isoDate: string): { day: number; month: number; year: number } {
  const parts = isoDate.split("-").map(Number);
  return { day: parts[2] ?? 1, month: parts[1] ?? 1, year: parts[0] ?? 0 };
}

export function toUtcMs(isoDate: string): number {
  const { day, month, year } = parseIsoDateParts(isoDate);
  return Date.UTC(year, month - 1, day);
}

export function maxIsoDate(left: string, right: string): string {
  return left >= right ? left : right;
}

export function minIsoDate(left: string, right: string): string {
  return left <= right ? left : right;
}

export function daysBetweenInclusive(start: string, end: string): number {
  const startMs = toUtcMs(start);
  const endMs = toUtcMs(end);
  if (endMs < startMs) {
    return 0;
  }
  return Math.floor((endMs - startMs) / MS_PER_DAY) + 1;
}

export interface IOccupancyProrationResult {
  daysInPeriod: number;
  expectedRent: number;
  isProrated: boolean;
  occupiedDays: number;
}

export function getOccupiedDaysInBoundedPeriod(
  periodStart: string,
  periodEnd: string,
  leaseStartDate: string,
  effectiveEndDate: string
): number {
  const occupancyStart = maxIsoDate(leaseStartDate, periodStart);
  const occupancyEnd = minIsoDate(effectiveEndDate, periodEnd);
  return daysBetweenInclusive(occupancyStart, occupancyEnd);
}

export function prorateOccupiedPeriod(input: {
  daysInPeriod: number;
  occupiedDays: number;
  recurringRent: number;
}): IOccupancyProrationResult {
  const { daysInPeriod, occupiedDays, recurringRent } = input;

  if (occupiedDays <= 0) {
    return { daysInPeriod, expectedRent: 0, isProrated: false, occupiedDays: 0 };
  }

  const isProrated = occupiedDays < daysInPeriod;
  const expectedRent = isProrated
    ? roundMoney((recurringRent / daysInPeriod) * occupiedDays)
    : recurringRent;

  return { daysInPeriod, expectedRent, isProrated, occupiedDays };
}
