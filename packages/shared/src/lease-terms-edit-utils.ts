import { transactionDateToMonth } from "./lease-date-utils";
import {
  resolveLeaseEndDate,
  validateLeaseTermInput,
} from "./lease-term-input-utils";
import {
  type IEditPropertyLongStayTermsBody,
  type ILeaseTermsEditability,
  type ILeaseTermsEditSignals,
  type IPropertyLongStay,
  type IPropertyLongStayRentPeriod,
  LeaseTermsEditBlockReason,
  PropertyLongStayStatus,
  type TLeaseTermsEditBlockReason,
} from "./property-long-stay-types";

/** Matches create-lease route bounds in `property-long-stay-routes.ts`. */
export const MAX_LEASE_TERM_MONTHS = 60;

const LEASE_TERMS_EDIT_BLOCK_MESSAGES: Record<TLeaseTermsEditBlockReason, string> = {
  [LeaseTermsEditBlockReason.HAS_INCOME_LINES]:
    "Lease terms cannot be edited after rent income has been recorded",
  [LeaseTermsEditBlockReason.HAS_RENT_PERIOD_HISTORY]:
    "Lease terms cannot be edited after the lease has been extended",
  [LeaseTermsEditBlockReason.HAS_SUCCEEDED_PAYMENTS]:
    "Lease terms cannot be edited after an online rent payment has succeeded",
  [LeaseTermsEditBlockReason.LEASE_ENDED]: "Only active leases can have terms edited",
};

export function getLeaseTermsEditBlockMessage(reason: TLeaseTermsEditBlockReason): string {
  return LEASE_TERMS_EDIT_BLOCK_MESSAGES[reason];
}

export function hasRentPeriodHistory(
  periods: readonly IPropertyLongStayRentPeriod[],
  leaseStartDate: string
): boolean {
  if (periods.length > 1) {
    return true;
  }

  const startMonth = transactionDateToMonth(leaseStartDate);
  return periods.some((period) => period.effectiveFromMonth !== startMonth);
}

export function deriveLeaseTermsEditability(
  lease: Pick<IPropertyLongStay, "status">,
  signals: ILeaseTermsEditSignals
): ILeaseTermsEditability {
  if (lease.status !== PropertyLongStayStatus.ACTIVE) {
    return {
      editable: false,
      reason: LeaseTermsEditBlockReason.LEASE_ENDED,
    };
  }

  if (signals.hasIncomeLines) {
    return {
      editable: false,
      reason: LeaseTermsEditBlockReason.HAS_INCOME_LINES,
    };
  }

  if (signals.hasSucceededPayments) {
    return {
      editable: false,
      reason: LeaseTermsEditBlockReason.HAS_SUCCEEDED_PAYMENTS,
    };
  }

  if (signals.hasRentPeriodHistory) {
    return {
      editable: false,
      reason: LeaseTermsEditBlockReason.HAS_RENT_PERIOD_HISTORY,
    };
  }

  return { editable: true };
}

export function validateEditLeaseTerms(
  body: IEditPropertyLongStayTermsBody,
  lease: Pick<
    IPropertyLongStay,
    "leaseEndDate" | "leaseStartDate" | "monthlyRent" | "status" | "termMonths"
  >,
  _today: string
): string | null {
  if (lease.status !== PropertyLongStayStatus.ACTIVE) {
    return "Only active leases can have terms edited";
  }

  const termError = validateLeaseTermInput(body);
  if (termError) {
    return termError;
  }

  if (!Number.isFinite(body.monthlyRent) || body.monthlyRent < 0) {
    return "monthlyRent must be a non-negative number";
  }

  let resolved;
  try {
    resolved = resolveLeaseEndDate(body);
  } catch (error) {
    return error instanceof Error ? error.message : "Invalid lease term input";
  }

  if (
    body.leaseStartDate === lease.leaseStartDate &&
    resolved.leaseEndDate === lease.leaseEndDate &&
    body.monthlyRent === lease.monthlyRent
  ) {
    return "At least one lease term field must change";
  }

  return null;
}
