import { formatIsoDateDisplay } from "@/lib/format-iso-date";
import {
  formatLeaseMonthRentPreviewLabel,
  formatLeaseWeekRentPreviewLabel,
} from "@/lib/lease-rent-preview-labels";
import {
  calculateExpectedRentForLeaseMonth,
  calculateExpectedRentForLeaseWeek,
  type IPropertyLongStay,
  type IPropertyLongStayRentPeriod,
  RentBillingCadence,
  resolveLeaseWeekPeriodStartContainingDate,
  transactionDateToMonth,
  type TRentBillingCadence,
} from "@/packages/shared";

export function getEndLeaseMoveOutRentPreview(input: {
  lease: Pick<IPropertyLongStay, "leaseStartDate" | "monthlyRent" | "rentBillingCadence">;
  moveOutDate: string;
  rentPeriods: readonly IPropertyLongStayRentPeriod[];
}): string | null {
  if (!input.moveOutDate) {
    return null;
  }

  if (input.lease.rentBillingCadence === RentBillingCadence.WEEKLY) {
    return getEndLeaseMoveOutWeekRentPreview({
      lease: input.lease,
      moveOutDate: input.moveOutDate,
    });
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

export function getEndLeaseMoveOutWeekRentPreview(input: {
  lease: Pick<IPropertyLongStay, "leaseStartDate" | "monthlyRent">;
  moveOutDate: string;
}): string | null {
  const periodStart = resolveLeaseWeekPeriodStartContainingDate(
    input.lease.leaseStartDate,
    input.moveOutDate
  );
  const rent = calculateExpectedRentForLeaseWeek({
    effectiveEndDate: input.moveOutDate,
    leaseStartDate: input.lease.leaseStartDate,
    periodStart,
    weeklyRent: input.lease.monthlyRent,
  });

  if (rent.occupiedDays <= 0) {
    return null;
  }

  return formatLeaseWeekRentPreviewLabel("Final week rent", rent);
}

export function getEndLeaseMoveOutBoundsHelperText(
  leaseStartDate: string,
  leaseEndDate: string,
  today: string
): string {
  if (today > leaseEndDate) {
    return `Select the actual move-out date between ${formatIsoDateDisplay(leaseEndDate)} and ${formatIsoDateDisplay(today)}.`;
  }

  return `Select the move-out date between ${formatIsoDateDisplay(leaseStartDate)} and ${formatIsoDateDisplay(today)}.`;
}

export function getEndLeaseHoldoverHelperText(
  moveOutDate: string,
  leaseEndDate: string,
  rentBillingCadence: TRentBillingCadence = RentBillingCadence.MONTHLY
): string | null {
  if (!moveOutDate || moveOutDate <= leaseEndDate) {
    return null;
  }

  const periodLabel = rentBillingCadence === RentBillingCadence.WEEKLY ? "week's" : "month's";

  return `Move-out is after the contract end date. Holdover days are included in the final ${periodLabel} prorated rent.`;
}

export function getActiveLeaseHoldoverNotice(leaseEndDate: string): string {
  return `This lease passed its contract end date on ${formatIsoDateDisplay(leaseEndDate)}. Rent accrues through today until you end the lease with the actual move-out date.`;
}

export function getActiveLeaseHoldoverScheduleNotice(): string {
  return "Holdover rent is estimated through today and updates daily until you end the lease with the actual move-out date.";
}
