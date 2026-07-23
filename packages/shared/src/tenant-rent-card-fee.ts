/**
 * Platform convenience fee when tenants pay rent by card (not ACH).
 * Locked v1 formula: 2.9% + $0.30, rounded to cents.
 */

export const RENT_CARD_CONVENIENCE_FEE_RATE = 0.029;
export const RENT_CARD_CONVENIENCE_FEE_FIXED_CENTS = 30;

/**
 * Card convenience fee in cents for a rent charge of `rentCents`.
 * Returns 0 when rent is not a positive integer (no fee on $0 / invalid input).
 */
export function computeRentCardConvenienceFeeCents(rentCents: number): number {
  if (!Number.isInteger(rentCents) || rentCents <= 0) {
    return 0;
  }
  return (
    Math.round(rentCents * RENT_CARD_CONVENIENCE_FEE_RATE) + RENT_CARD_CONVENIENCE_FEE_FIXED_CENTS
  );
}
