import {
  parseRentBillingCadence,
  RENT_BILLING_CADENCE_VALUES,
  RentBillingCadence,
  type TRentBillingCadence,
} from "@/packages/shared";

export const START_LEASE_RENT_BILLING_CADENCES = RENT_BILLING_CADENCE_VALUES;

export type TStartLeaseRentBillingCadence = TRentBillingCadence;

export const WEEKLY_RENT_BILLING_ENABLED = true;

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
  const parsed = parseRentBillingCadence(value);
  if (parsed === RentBillingCadence.WEEKLY && !WEEKLY_RENT_BILLING_ENABLED) {
    return RentBillingCadence.MONTHLY;
  }

  return parsed ?? RentBillingCadence.MONTHLY;
}
