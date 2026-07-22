import { formatMoney } from "@/lib/format-money";
import {
  type ILeaseDepositSummary,
  inferLeaseDepositPreset,
  LeaseDepositBalanceStatus,
  LeaseDepositPreset,
  type TLeaseDepositBalanceStatus,
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

export function formatLeaseDepositBalanceStatusLabel(status: TLeaseDepositBalanceStatus): string {
  switch (status) {
    case LeaseDepositBalanceStatus.DUE:
      return "Due";
    case LeaseDepositBalanceStatus.PARTIAL:
      return "Partial";
    case LeaseDepositBalanceStatus.HELD:
      return "Held";
    case LeaseDepositBalanceStatus.REFUNDED:
      return "Refunded";
    case LeaseDepositBalanceStatus.NONE:
      return "None";
  }
}

/**
 * Record deposit CTA: hide when no contractual amount or already fully collected
 * (`outstanding === 0` with an expected amount).
 */
export function canShowRecordLeaseDepositCta(summary: ILeaseDepositSummary): boolean {
  return summary.expected != null && summary.expected > 0 && summary.outstanding > 0;
}

export function getLeaseDepositBalanceRows(summary: ILeaseDepositSummary): {
  collectedLabel: string;
  expectedLabel: string;
  outstandingLabel: string;
} {
  return {
    collectedLabel: formatMoney(summary.collected),
    expectedLabel: formatLeaseSecurityDepositDisplay(summary.expected),
    outstandingLabel: formatMoney(summary.outstanding),
  };
}
