export const RentBillingCadence = {
  MONTHLY: "monthly",
  WEEKLY: "weekly",
} as const;

export type TRentBillingCadence = (typeof RentBillingCadence)[keyof typeof RentBillingCadence];

export const RENT_BILLING_CADENCE_VALUES = [
  RentBillingCadence.MONTHLY,
  RentBillingCadence.WEEKLY,
] as const;

export function parseRentBillingCadence(raw: unknown): TRentBillingCadence | null {
  if (raw === undefined || raw === null) {
    return RentBillingCadence.MONTHLY;
  }

  if (raw === RentBillingCadence.MONTHLY || raw === RentBillingCadence.WEEKLY) {
    return raw;
  }

  return null;
}

export function isWeeklyRentBillingCadence(cadence: TRentBillingCadence): boolean {
  return cadence === RentBillingCadence.WEEKLY;
}
