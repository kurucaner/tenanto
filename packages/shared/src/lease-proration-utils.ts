import { getLeaseRentForMonth } from "./lease-rent-utils";
import { roundMoney } from "./property-income-calculator";
import {
  type IPropertyLongStay,
  type IPropertyLongStayRentPeriod,
  PropertyLongStayStatus,
} from "./property-long-stay-types";

const MS_PER_DAY = 86_400_000;

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

function getMonthStart(month: string): string {
  return `${month}-01`;
}

function getMonthEnd(month: string): string {
  const daysInMonth = getDaysInMonth(month);
  return `${month}-${String(daysInMonth).padStart(2, "0")}`;
}

function daysBetweenInclusive(start: string, end: string): number {
  const startMs = toUtcMs(start);
  const endMs = toUtcMs(end);
  if (endMs < startMs) {
    return 0;
  }
  return Math.floor((endMs - startMs) / MS_PER_DAY) + 1;
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
  const occupancyStart = maxIsoDate(leaseStartDate, getMonthStart(month));
  const occupancyEnd = minIsoDate(effectiveEndDate, getMonthEnd(month));
  return daysBetweenInclusive(occupancyStart, occupancyEnd);
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
  baseMonthlyRent: number;
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

  if (occupiedDays <= 0) {
    return { daysInMonth, expectedRent: 0, isProrated: false, occupiedDays: 0 };
  }

  const monthlyRent = getLeaseRentForMonth(input.baseMonthlyRent, input.rentPeriods, input.month);
  const isProrated = occupiedDays < daysInMonth;
  const expectedRent = isProrated
    ? roundMoney((monthlyRent / daysInMonth) * occupiedDays)
    : monthlyRent;

  return { daysInMonth, expectedRent, isProrated, occupiedDays };
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
