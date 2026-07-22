import {
  type ILeaseDepositSummary,
  LeaseDepositBalanceStatus,
} from "./lease-deposit-balance-utils";

/**
 * True when collected deposit funds still need settlement (refund and/or withhold)
 * after move-out. Does not apply when nothing was collected or already refunded.
 */
export function needsLeaseDepositCloseOut(summary: ILeaseDepositSummary): boolean {
  if (summary.collected <= 0) {
    return false;
  }
  return summary.status !== LeaseDepositBalanceStatus.REFUNDED;
}

/** Short callout for the End Lease dialog when a deposit is still unsettled. */
export function getEndLeaseDepositCalloutMessage(summary: ILeaseDepositSummary): string | null {
  if (!needsLeaseDepositCloseOut(summary)) {
    return null;
  }

  if (summary.status === LeaseDepositBalanceStatus.PARTIAL) {
    return "A partial security deposit has been collected. After ending the lease, settle what you hold — refund the tenant and/or withhold for damages from Income.";
  }

  return "A security deposit is held on this lease. After ending, settle it from Income — refund the tenant and/or withhold for damages.";
}

export interface ILeaseDepositCloseOutCopy {
  body: string;
  incomeCtaLabel: string;
  title: string;
}

/** Copy for the post-end (or settle) deposit close-out dialog. */
export function getLeaseDepositCloseOutCopy(
  summary: ILeaseDepositSummary
): ILeaseDepositCloseOutCopy {
  const heldNote =
    summary.collected > 0
      ? ` Collected so far: use Income to refund part or all of the deposit, or leave amounts unrefunded if you are withholding for damages.`
      : "";

  return {
    body: `Security deposits are settled on the Income page using the existing refund flow on the Security deposit line.${heldNote} Withholding is recorded by refunding only what you return (or not refunding if you keep the full amount).`,
    incomeCtaLabel: "Open Income",
    title: "Settle security deposit",
  };
}
