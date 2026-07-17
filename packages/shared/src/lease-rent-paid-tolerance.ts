/** Dollars — lease rent month is fully paid when remaining is at or below this. */
export const LEASE_RENT_PAID_TOLERANCE_DOLLARS = 0.01;

/** Integer cents equivalent of {@link LEASE_RENT_PAID_TOLERANCE_DOLLARS}. */
export const LEASE_RENT_PAID_TOLERANCE_CENTS = Math.round(LEASE_RENT_PAID_TOLERANCE_DOLLARS * 100);

function isFullyPaidWithinTolerance(expected: number, paid: number, tolerance: number): boolean {
  if (expected <= 0) {
    return paid <= tolerance;
  }
  return expected - paid <= tolerance;
}

export function isLeaseRentMonthFullyPaid(
  expectedRent: number,
  paidRent: number,
  tolerance = LEASE_RENT_PAID_TOLERANCE_DOLLARS
): boolean {
  return isFullyPaidWithinTolerance(expectedRent, paidRent, tolerance);
}

export function isLeaseRentPeriodFullyPaidCents(
  expectedCents: number,
  paidCents: number,
  toleranceCents = LEASE_RENT_PAID_TOLERANCE_CENTS
): boolean {
  if (!Number.isInteger(expectedCents) || !Number.isInteger(paidCents)) {
    return false;
  }
  if (expectedCents < 0 || paidCents < 0) {
    return false;
  }
  return isFullyPaidWithinTolerance(expectedCents, paidCents, toleranceCents);
}
