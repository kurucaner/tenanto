import { formatMoney } from "@/lib/format-money";
import {
  inferLeaseDepositPreset,
  LeaseDepositPreset,
  type TLeaseDepositPreset,
} from "@/packages/shared";

/** Label for Terms / Overview: “None” or a formatted money amount. */
export function formatLeaseSecurityDepositDisplay(
  securityDepositAmount: number | null | undefined
): string {
  if (securityDepositAmount == null) {
    return "None";
  }
  return formatMoney(securityDepositAmount);
}

export function getLeaseDepositFormDefaults(input: {
  rentAmount: number;
  securityDepositAmount: number | null | undefined;
}): {
  securityDepositCustomAmount: string;
  securityDepositPreset: TLeaseDepositPreset;
} {
  const preset = inferLeaseDepositPreset(input.securityDepositAmount, input.rentAmount);
  return {
    securityDepositCustomAmount:
      preset === LeaseDepositPreset.CUSTOM && input.securityDepositAmount != null
        ? String(input.securityDepositAmount)
        : "",
    securityDepositPreset: preset,
  };
}
