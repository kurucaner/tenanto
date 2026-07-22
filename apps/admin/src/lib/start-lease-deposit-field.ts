import { z } from "zod";

import {
  isLeaseDepositPreset,
  LeaseDepositPreset,
  LEASE_DEPOSIT_PRESETS,
  resolveSecurityDepositAmount,
  type TLeaseDepositPreset,
} from "@/packages/shared";

import {
  optionalNonNegativeMoneyField,
  parseMoneyInput,
  requiredNonNegativeMoneyField,
} from "./money-field-validation";

export { LeaseDepositPreset, type TLeaseDepositPreset };

/** Same copy for monthly and weekly — “1×” means the current rent amount field. */
export const START_LEASE_DEPOSIT_PRESET_LABELS: Record<TLeaseDepositPreset, string> = {
  [LeaseDepositPreset.CUSTOM]: "Custom amount",
  [LeaseDepositPreset.NONE]: "None",
  [LeaseDepositPreset.ONE_MONTH_RENT]: "1× rent amount",
};

export const leaseDepositPresetSchema = z.enum(
  LEASE_DEPOSIT_PRESETS as unknown as [TLeaseDepositPreset, ...TLeaseDepositPreset[]]
);

export function normalizeStartLeaseDepositPreset(value: unknown): TLeaseDepositPreset {
  return isLeaseDepositPreset(value) ? value : LeaseDepositPreset.NONE;
}

export function refineLeaseDepositFormValues(
  values: {
    securityDepositCustomAmount: string;
    securityDepositPreset: TLeaseDepositPreset;
  },
  ctx: z.RefinementCtx
): void {
  if (values.securityDepositPreset === LeaseDepositPreset.CUSTOM) {
    const customResult = requiredNonNegativeMoneyField("Custom deposit amount").safeParse(
      values.securityDepositCustomAmount
    );
    if (!customResult.success) {
      for (const issue of customResult.error.issues) {
        ctx.addIssue({ ...issue, path: ["securityDepositCustomAmount"] });
      }
    }
    return;
  }

  const optionalCustom = optionalNonNegativeMoneyField(
    "Custom deposit amount must be a non-negative number"
  ).safeParse(values.securityDepositCustomAmount);
  if (!optionalCustom.success) {
    for (const issue of optionalCustom.error.issues) {
      ctx.addIssue({ ...issue, path: ["securityDepositCustomAmount"] });
    }
  }
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
