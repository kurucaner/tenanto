export const START_LEASE_RENT_BILLING_CADENCES = ["monthly", "weekly"] as const;

export type TStartLeaseRentBillingCadence = (typeof START_LEASE_RENT_BILLING_CADENCES)[number];

/** UI-only gate until weekly rent schedule is implemented server-side. */
export const WEEKLY_RENT_BILLING_ENABLED = false;

export const START_LEASE_RENT_BILLING_LABELS: Record<TStartLeaseRentBillingCadence, string> = {
  monthly: "Monthly",
  weekly: "Weekly",
};

export function getStartLeaseRentAmountLabel(
  cadence: TStartLeaseRentBillingCadence
): string {
  return cadence === "weekly" ? "Weekly rent" : "Monthly rent";
}

export function getStartLeaseRentBillingHelperText(
  cadence: TStartLeaseRentBillingCadence
): string {
  if (cadence === "weekly") {
    return "Rent is due every week on the same weekday as the lease start.";
  }

  return "Rent is due once per calendar month.";
}

export function normalizeStartLeaseRentBillingCadence(
  value: unknown
): TStartLeaseRentBillingCadence {
  if (value === "weekly" && WEEKLY_RENT_BILLING_ENABLED) {
    return "weekly";
  }

  return "monthly";
}
