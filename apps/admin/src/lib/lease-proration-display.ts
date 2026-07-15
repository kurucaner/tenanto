import { formatIsoDateDisplay } from "@/lib/format-iso-date";
import { formatMoney } from "@/lib/format-money";
import {
  calculateExpectedRentForLeaseMonth,
  calculateLeaseEndDate,
  formatProratedDaysLabel,
  type ILeaseMonthExpectedRent,
  type IPropertyLongStay,
  type IPropertyLongStayRentPeriod,
  transactionDateToMonth,
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

export function getEndLeaseMoveOutRentPreview(input: {
  lease: Pick<IPropertyLongStay, "leaseStartDate" | "monthlyRent">;
  moveOutDate: string;
  rentPeriods: readonly IPropertyLongStayRentPeriod[];
}): string | null {
  if (!input.moveOutDate) {
    return null;
  }

  const month = transactionDateToMonth(input.moveOutDate);
  const rent = calculateExpectedRentForLeaseMonth({
    baseMonthlyRent: input.lease.monthlyRent,
    effectiveEndDate: input.moveOutDate,
    leaseStartDate: input.lease.leaseStartDate,
    month,
    rentPeriods: input.rentPeriods,
  });

  if (rent.occupiedDays <= 0) {
    return null;
  }

  return formatLeaseMonthRentPreviewLabel("Final month rent", rent);
}

export function getStartLeaseFirstMonthRentPreview(input: {
  leaseStartDate: string;
  monthlyRent: number;
  termMonths: number;
}): string | null {
  if (!input.leaseStartDate || input.monthlyRent <= 0 || input.termMonths < 1) {
    return null;
  }

  const leaseEndDate = calculateLeaseEndDate(input.leaseStartDate, input.termMonths);
  const month = transactionDateToMonth(input.leaseStartDate);
  const rent = calculateExpectedRentForLeaseMonth({
    baseMonthlyRent: input.monthlyRent,
    effectiveEndDate: leaseEndDate,
    leaseStartDate: input.leaseStartDate,
    month,
    rentPeriods: [],
  });

  if (!rent.isProrated) {
    return null;
  }

  return formatLeaseMonthRentPreviewLabel("First month rent", rent);
}

export function getEndLeaseMoveOutBoundsHelperText(leaseEndDate: string, today: string): string {
  if (today > leaseEndDate) {
    return `Select the actual move-out date between ${formatIsoDateDisplay(leaseEndDate)} and ${formatIsoDateDisplay(today)}.`;
  }

  return "Move-out is recorded as today.";
}

export function getEndLeaseHoldoverHelperText(
  moveOutDate: string,
  leaseEndDate: string
): string | null {
  if (!moveOutDate || moveOutDate <= leaseEndDate) {
    return null;
  }

  return "Move-out is after the contract end date. Holdover days are included in the final month's prorated rent.";
}

export function getActiveLeaseHoldoverNotice(leaseEndDate: string): string {
  return `This lease passed its contract end date on ${formatIsoDateDisplay(leaseEndDate)}. Rent accrues through today until you record the actual move-out date.`;
}
