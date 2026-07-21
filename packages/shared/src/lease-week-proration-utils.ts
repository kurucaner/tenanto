import { addDaysToIsoDate } from "./lease-date-utils";
import {
  getOccupiedDaysInBoundedPeriod,
  prorateOccupiedPeriod,
} from "./lease-occupancy-proration-utils";

const DAYS_IN_WEEK = 7;

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
  return getOccupiedDaysInBoundedPeriod(periodStart, periodEnd, leaseStartDate, effectiveEndDate);
}

export function calculateExpectedRentForLeaseWeek(input: {
  effectiveEndDate: string;
  leaseStartDate: string;
  periodStart: string;
  weeklyRent: number;
}): ILeaseWeekExpectedRent {
  const occupiedDays = getOccupiedDaysInWeek(
    input.periodStart,
    input.leaseStartDate,
    input.effectiveEndDate
  );
  const proration = prorateOccupiedPeriod({
    daysInPeriod: DAYS_IN_WEEK,
    occupiedDays,
    recurringRent: input.weeklyRent,
  });

  return {
    daysInPeriod: proration.daysInPeriod,
    expectedRent: proration.expectedRent,
    isProrated: proration.isProrated,
    occupiedDays: proration.occupiedDays,
  };
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
