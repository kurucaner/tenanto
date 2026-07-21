import { formatMoney } from "@/lib/format-money";
import {
  formatProratedDaysLabel,
  type ILeaseMonthExpectedRent,
  type ILeaseWeekExpectedRent,
} from "@/packages/shared";

export function formatLeaseMonthRentPreviewLabel(
  prefix: string,
  rent: Pick<
    ILeaseMonthExpectedRent,
    "daysInMonth" | "expectedRent" | "isProrated" | "occupiedDays"
  >
): string {
  if (rent.isProrated) {
    return `${prefix}: ${formatMoney(rent.expectedRent)} (${formatProratedDaysLabel(rent.occupiedDays, rent.daysInMonth)})`;
  }

  return `${prefix}: ${formatMoney(rent.expectedRent)}`;
}

export function formatLeaseWeekRentPreviewLabel(
  prefix: string,
  rent: Pick<
    ILeaseWeekExpectedRent,
    "daysInPeriod" | "expectedRent" | "isProrated" | "occupiedDays"
  >
): string {
  if (rent.isProrated) {
    return `${prefix}: ${formatMoney(rent.expectedRent)} (${formatProratedDaysLabel(rent.occupiedDays, rent.daysInPeriod)})`;
  }

  return `${prefix}: ${formatMoney(rent.expectedRent)}`;
}
