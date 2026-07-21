import {
  formatLeaseMonthRentPreviewLabel,
  formatLeaseWeekRentPreviewLabel,
} from "@/lib/lease-rent-preview-labels";
import {
  calculateExpectedRentForLeaseMonth,
  calculateExpectedRentForLeaseWeek,
  parseRentBillingCadence,
  RentBillingCadence,
  transactionDateToMonth,
  type TRentBillingCadence,
} from "@/packages/shared";

export type TStartLeaseRentBillingCadence = TRentBillingCadence;

export const START_LEASE_RENT_BILLING_LABELS: Record<TStartLeaseRentBillingCadence, string> = {
  [RentBillingCadence.MONTHLY]: "Monthly",
  [RentBillingCadence.WEEKLY]: "Weekly",
};

export function getStartLeaseRentAmountLabel(cadence: TStartLeaseRentBillingCadence): string {
  return cadence === RentBillingCadence.WEEKLY ? "Weekly rent" : "Monthly rent";
}

export function getStartLeaseRentBillingHelperText(cadence: TStartLeaseRentBillingCadence): string {
  if (cadence === RentBillingCadence.WEEKLY) {
    return "Rent is due every week on the same weekday as the lease start.";
  }

  return "Rent is due once per calendar month.";
}

export function normalizeStartLeaseRentBillingCadence(
  value: unknown
): TStartLeaseRentBillingCadence {
  return parseRentBillingCadence(value) ?? RentBillingCadence.MONTHLY;
}

function getStartLeaseFirstMonthRentPreview(input: {
  leaseEndDate: string;
  leaseStartDate: string;
  rentAmount: number;
}): string | null {
  if (!input.leaseStartDate || input.rentAmount <= 0 || !input.leaseEndDate) {
    return null;
  }

  const month = transactionDateToMonth(input.leaseStartDate);
  const rent = calculateExpectedRentForLeaseMonth({
    baseRentAmount: input.rentAmount,
    effectiveEndDate: input.leaseEndDate,
    leaseStartDate: input.leaseStartDate,
    month,
    rentPeriods: [],
  });

  if (!rent.isProrated) {
    return null;
  }

  return formatLeaseMonthRentPreviewLabel("First month rent", rent);
}

function getStartLeaseFirstWeekRentPreview(input: {
  leaseEndDate: string;
  leaseStartDate: string;
  weeklyRent: number;
}): string | null {
  if (!input.leaseStartDate || input.weeklyRent <= 0 || !input.leaseEndDate) {
    return null;
  }

  const rent = calculateExpectedRentForLeaseWeek({
    effectiveEndDate: input.leaseEndDate,
    leaseStartDate: input.leaseStartDate,
    periodStart: input.leaseStartDate,
    weeklyRent: input.weeklyRent,
  });

  if (!rent.isProrated) {
    return null;
  }

  return formatLeaseWeekRentPreviewLabel("First week rent", rent);
}

export function getStartLeaseFirstPeriodRentPreview(input: {
  leaseEndDate: string;
  leaseStartDate: string;
  rentAmount: number;
  rentBillingCadence: TStartLeaseRentBillingCadence;
}): string | null {
  if (input.rentBillingCadence === RentBillingCadence.WEEKLY) {
    return getStartLeaseFirstWeekRentPreview({
      leaseEndDate: input.leaseEndDate,
      leaseStartDate: input.leaseStartDate,
      weeklyRent: input.rentAmount,
    });
  }

  return getStartLeaseFirstMonthRentPreview({
    leaseEndDate: input.leaseEndDate,
    leaseStartDate: input.leaseStartDate,
    rentAmount: input.rentAmount,
  });
}
