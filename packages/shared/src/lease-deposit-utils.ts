import { roundMoney } from "./property-income-calculator";

/**
 * UI / form preset for capturing a contractual security deposit.
 * Resolved to a fixed dollar amount (or null) at save time.
 */
export const LeaseDepositPreset = {
  CUSTOM: "custom",
  NONE: "none",
  ONE_MONTH_RENT: "one_month_rent",
} as const;

export type TLeaseDepositPreset = (typeof LeaseDepositPreset)[keyof typeof LeaseDepositPreset];

export const LEASE_DEPOSIT_PRESETS: readonly TLeaseDepositPreset[] = [
  LeaseDepositPreset.NONE,
  LeaseDepositPreset.ONE_MONTH_RENT,
  LeaseDepositPreset.CUSTOM,
];

export function isLeaseDepositPreset(value: unknown): value is TLeaseDepositPreset {
  return (
    value === LeaseDepositPreset.NONE ||
    value === LeaseDepositPreset.ONE_MONTH_RENT ||
    value === LeaseDepositPreset.CUSTOM
  );
}

/**
 * Validates an optional stored deposit amount.
 * `undefined` means the field was omitted (caller decides leave-unchanged vs default).
 * `null` means no deposit required.
 */
export function validateSecurityDepositAmount(amount: number | null | undefined): string | null {
  if (amount === undefined || amount === null) {
    return null;
  }

  if (!Number.isFinite(amount)) {
    return "securityDepositAmount must be a non-negative number";
  }

  if (amount < 0) {
    return "securityDepositAmount must be a non-negative number";
  }

  return null;
}

export interface IResolveSecurityDepositAmountInput {
  customAmount?: number | null;
  preset: TLeaseDepositPreset;
  /** Current lease rent amount (weekly or monthly cadence — same field). */
  rentAmount: number;
}

/**
 * Resolves a form preset into the contractual snapshot amount to persist.
 * `one_month_rent` uses the provided rent amount as a frozen dollar figure.
 */
export function resolveSecurityDepositAmount(
  input: IResolveSecurityDepositAmountInput
): number | null {
  const { customAmount, preset, rentAmount } = input;

  if (preset === LeaseDepositPreset.NONE) {
    return null;
  }

  if (preset === LeaseDepositPreset.ONE_MONTH_RENT) {
    if (!Number.isFinite(rentAmount) || rentAmount < 0) {
      return null;
    }
    return roundMoney(rentAmount);
  }

  if (customAmount === undefined || customAmount === null) {
    return null;
  }

  if (!Number.isFinite(customAmount) || customAmount < 0) {
    return null;
  }

  return roundMoney(customAmount);
}

/**
 * Resolves whether a form preset should persist as rent-tracking.
 * Only `one_month_rent` tracks rent; none and custom are fixed.
 */
export function resolveSecurityDepositTracksRent(preset: TLeaseDepositPreset): boolean {
  return preset === LeaseDepositPreset.ONE_MONTH_RENT;
}

/**
 * Infers which preset best matches a stored deposit + current rent (for edit forms).
 * When `tracksRent` is known, prefer it over amount≈rent (amount can diverge after rent changes).
 * Exact rent match → `one_month_rent` when `tracksRent` is omitted; otherwise custom when amount is set.
 */
export function inferLeaseDepositPreset(
  securityDepositAmount: number | null | undefined,
  rentAmount: number,
  tracksRent?: boolean
): TLeaseDepositPreset {
  if (securityDepositAmount == null) {
    return LeaseDepositPreset.NONE;
  }

  if (tracksRent === true) {
    return LeaseDepositPreset.ONE_MONTH_RENT;
  }

  if (tracksRent === false) {
    return LeaseDepositPreset.CUSTOM;
  }

  if (
    Number.isFinite(rentAmount) &&
    rentAmount >= 0 &&
    roundMoney(securityDepositAmount) === roundMoney(rentAmount)
  ) {
    return LeaseDepositPreset.ONE_MONTH_RENT;
  }

  return LeaseDepositPreset.CUSTOM;
}
