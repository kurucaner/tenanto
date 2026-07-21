import { addDaysToIsoDate } from "./lease-date-utils";
import { roundMoney } from "./property-income-calculator";

const MS_PER_DAY = 86_400_000;
const DAYS_IN_WEEK = 7;

function parseIsoDateParts(isoDate: string): { day: number; month: number; year: number } {
  const parts = isoDate.split("-").map(Number);
  return { day: parts[2] ?? 1, month: parts[1] ?? 1, year: parts[0] ?? 0 };
}

function toUtcMs(isoDate: string): number {
  const { day, month, year } = parseIsoDateParts(isoDate);
  return Date.UTC(year, month - 1, day);
}

function maxIsoDate(left: string, right: string): string {
  return left >= right ? left : right;
}

function minIsoDate(left: string, right: string): string {
  return left <= right ? left : right;
}

function daysBetweenInclusive(start: string, end: string): number {
  const startMs = toUtcMs(start);
  const endMs = toUtcMs(end);
  if (endMs < startMs) {
    return 0;
  }
  return Math.floor((endMs - startMs) / MS_PER_DAY) + 1;
}

export interface ILeaseWeekExpectedRent {
  daysInPeriod: number;
  expectedRent: number;
  isProrated: boolean;
  occupiedDays: number;
}

export function getOccupiedDaysInWeek(
  periodStart: string,
  leaseStartDate: string,
  effectiveEndDate: string
): number {
  const periodEnd = addDaysToIsoDate(periodStart, DAYS_IN_WEEK - 1);
  const occupancyStart = maxIsoDate(leaseStartDate, periodStart);
  const occupancyEnd = minIsoDate(effectiveEndDate, periodEnd);
  return daysBetweenInclusive(occupancyStart, occupancyEnd);
}

export function calculateExpectedRentForLeaseWeek(input: {
  effectiveEndDate: string;
  leaseStartDate: string;
  periodStart: string;
  weeklyRent: number;
}): ILeaseWeekExpectedRent {
  const daysInPeriod = DAYS_IN_WEEK;
  const occupiedDays = getOccupiedDaysInWeek(
    input.periodStart,
    input.leaseStartDate,
    input.effectiveEndDate
  );

  if (occupiedDays <= 0) {
    return { daysInPeriod, expectedRent: 0, isProrated: false, occupiedDays: 0 };
  }

  const isProrated = occupiedDays < daysInPeriod;
  const expectedRent = isProrated
    ? roundMoney((input.weeklyRent / daysInPeriod) * occupiedDays)
    : input.weeklyRent;

  return { daysInPeriod, expectedRent, isProrated, occupiedDays };
}

export function isProratedLeaseWeek(
  periodStart: string,
  leaseStartDate: string,
  effectiveEndDate: string
): boolean {
  const occupiedDays = getOccupiedDaysInWeek(periodStart, leaseStartDate, effectiveEndDate);
  return occupiedDays > 0 && occupiedDays < DAYS_IN_WEEK;
}

export function formatProratedWeekDaysLabel(occupiedDays: number, daysInPeriod: number): string {
  return `${occupiedDays}/${daysInPeriod} days`;
}

/** Week-start key for the lease week containing `referenceDate`, aligned to `leaseStartDate`. */
export function resolveLeaseWeekPeriodStartContainingDate(
  leaseStartDate: string,
  referenceDate: string
): string {
  if (referenceDate < leaseStartDate) {
    return leaseStartDate;
  }

  let periodStart = leaseStartDate;
  while (true) {
    const periodEnd = addDaysToIsoDate(periodStart, DAYS_IN_WEEK - 1);
    if (referenceDate <= periodEnd) {
      return periodStart;
    }
    periodStart = addDaysToIsoDate(periodStart, DAYS_IN_WEEK);
  }
}
