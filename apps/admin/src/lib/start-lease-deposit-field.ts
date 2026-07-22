import {
  isLeaseDepositPreset,
  LeaseDepositPreset,
  resolveSecurityDepositAmount,
  type TLeaseDepositPreset,
} from "@/packages/shared";

import { parseMoneyInput } from "./money-field-validation";

export { LeaseDepositPreset, type TLeaseDepositPreset };

/** Same copy for monthly and weekly — “1×” means the current rent amount field. */
export const START_LEASE_DEPOSIT_PRESET_LABELS: Record<TLeaseDepositPreset, string> = {
  [LeaseDepositPreset.CUSTOM]: "Custom amount",
  [LeaseDepositPreset.NONE]: "None",
  [LeaseDepositPreset.ONE_MONTH_RENT]: "1× rent amount",
};

export function normalizeStartLeaseDepositPreset(value: unknown): TLeaseDepositPreset {
  return isLeaseDepositPreset(value) ? value : LeaseDepositPreset.NONE;
}

export function resolveStartLeaseSecurityDepositAmount(input: {
  securityDepositCustomAmount: string;
  securityDepositPreset: TLeaseDepositPreset;
  rentAmount: string;
}): number | null {
  return resolveSecurityDepositAmount({
    customAmount: parseMoneyInput(input.securityDepositCustomAmount),
    preset: input.securityDepositPreset,
    rentAmount: Number(input.rentAmount),
  });
}
