import {
  getOccupiedDaysInBoundedPeriod,
  prorateOccupiedPeriod,
} from "./lease-occupancy-proration-utils";
import { getLeaseRentForMonth } from "./lease-rent-utils";
import {
  type IPropertyLongStay,
  type IPropertyLongStayRentPeriod,
  PropertyLongStayStatus,
} from "./property-long-stay-types";

function getMonthStart(month: string): string {
  return `${month}-01`;
}

function getMonthEnd(month: string): string {
  const daysInMonth = getDaysInMonth(month);
  return `${month}-${String(daysInMonth).padStart(2, "0")}`;
}

export function getDaysInMonth(month: string): number {
  const parts = month.split("-").map(Number);
  const year = parts[0] ?? 0;
  const monthNum = parts[1] ?? 1;
  return new Date(year, monthNum, 0).getDate();
}

export function getOccupiedDaysInMonth(
  month: string,
  leaseStartDate: string,
  effectiveEndDate: string
): number {
  return getOccupiedDaysInBoundedPeriod(
    getMonthStart(month),
    getMonthEnd(month),
    leaseStartDate,
    effectiveEndDate
  );
}

export function getLeaseScheduleEffectiveEndDate(
  lease: Pick<IPropertyLongStay, "actualEndDate" | "leaseEndDate" | "status">,
  today: string
): string {
  if (lease.status === PropertyLongStayStatus.ENDED) {
    return lease.actualEndDate ?? lease.leaseEndDate;
  }

  if (today > lease.leaseEndDate) {
    return today;
  }

  return lease.leaseEndDate;
}

export interface ILeaseMonthExpectedRent {
  daysInMonth: number;
  expectedRent: number;
  isProrated: boolean;
  occupiedDays: number;
}

export function calculateExpectedRentForLeaseMonth(input: {
  baseRentAmount: number;
  effectiveEndDate: string;
  leaseStartDate: string;
  month: string;
  rentPeriods: readonly IPropertyLongStayRentPeriod[];
}): ILeaseMonthExpectedRent {
  const daysInMonth = getDaysInMonth(input.month);
  const occupiedDays = getOccupiedDaysInMonth(
    input.month,
    input.leaseStartDate,
    input.effectiveEndDate
  );
  const rentAmount = getLeaseRentForMonth(input.baseRentAmount, input.rentPeriods, input.month);
  const proration = prorateOccupiedPeriod({
    daysInPeriod: daysInMonth,
    occupiedDays,
    recurringRent: rentAmount,
  });

  return {
    daysInMonth: proration.daysInPeriod,
    expectedRent: proration.expectedRent,
    isProrated: proration.isProrated,
    occupiedDays: proration.occupiedDays,
  };
}

export function isProratedLeaseMonth(
  month: string,
  leaseStartDate: string,
  effectiveEndDate: string
): boolean {
  const daysInMonth = getDaysInMonth(month);
  const occupiedDays = getOccupiedDaysInMonth(month, leaseStartDate, effectiveEndDate);
  return occupiedDays > 0 && occupiedDays < daysInMonth;
}

export function formatProratedDaysLabel(occupiedDays: number, daysInMonth: number): string {
  return `${occupiedDays}/${daysInMonth} days`;
}
