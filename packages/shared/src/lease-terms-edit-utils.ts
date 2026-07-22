import { validateSecurityDepositAmount } from "./lease-deposit-utils";
import { resolveLeaseEndDate, validateLeaseTermInput } from "./lease-term-input-utils";
import { roundMoney } from "./property-income-calculator";
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
import {
  isWeeklyRentBillingCadence,
  RentBillingCadence,
  type TRentBillingCadence,
} from "./rent-billing-cadence";
import {
  getLeaseRentAmount,
  getRentPeriodEffectiveFrom,
  resolveTermsEditRentAmount,
} from "./rent-period-field-utils";
import { getPristineRentPeriodKey } from "./rent-period-key-utils";

/** Matches create-lease route bounds in `property-long-stay-routes.ts`. */
export const MAX_LEASE_TERM_MONTHS = 60;
export const MAX_LEASE_TERM_WEEKS = 260;

const LEASE_TERMS_EDIT_BLOCK_MESSAGES: Record<TLeaseTermsEditBlockReason, string> = {
  [LeaseTermsEditBlockReason.HAS_INCOME_LINES]:
    "Lease terms cannot be edited after rent income has been recorded",
  [LeaseTermsEditBlockReason.HAS_RENT_PERIOD_HISTORY]:
    "Lease terms cannot be edited after the lease has been extended",
  [LeaseTermsEditBlockReason.HAS_SUCCEEDED_PAYMENTS]:
    "Lease terms cannot be edited after an online rent payment has succeeded",
  [LeaseTermsEditBlockReason.LEASE_ENDED]: "Only active leases can have terms edited",
  [LeaseTermsEditBlockReason.WEEKLY_CADENCE]:
    "Lease terms cannot be edited for weekly-billed leases",
};

export function getLeaseTermsEditBlockMessage(reason: TLeaseTermsEditBlockReason): string {
  return LEASE_TERMS_EDIT_BLOCK_MESSAGES[reason];
}

export function hasRentPeriodHistory(
  periods: readonly IPropertyLongStayRentPeriod[],
  leaseStartDate: string,
  cadence: TRentBillingCadence = RentBillingCadence.MONTHLY
): boolean {
  if (periods.length > 1) {
    return true;
  }

  const pristineKey = getPristineRentPeriodKey(leaseStartDate, cadence);
  return periods.some((period) => getRentPeriodEffectiveFrom(period) !== pristineKey);
}

export function deriveLeaseTermsEditability(
  lease: Pick<IPropertyLongStay, "rentBillingCadence" | "status">,
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

function isSecurityDepositUnchanged(
  bodyAmount: number | null | undefined,
  existingAmount: number | null
): boolean {
  if (bodyAmount === undefined) {
    return true;
  }
  if (bodyAmount === null && existingAmount === null) {
    return true;
  }
  if (bodyAmount === null || existingAmount === null) {
    return false;
  }
  return roundMoney(bodyAmount) === roundMoney(existingAmount);
}

export function validateEditLeaseTerms(
  body: IEditPropertyLongStayTermsBody,
  lease: Pick<
    IPropertyLongStay,
    | "leaseEndDate"
    | "leaseStartDate"
    | "rentAmount"
    | "rentBillingCadence"
    | "securityDepositAmount"
    | "status"
    | "termMonths"
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

  const depositError = validateSecurityDepositAmount(body.securityDepositAmount);
  if (depositError) {
    return depositError;
  }

  const editedRentAmount = resolveTermsEditRentAmount(body);

  if (!Number.isFinite(editedRentAmount) || editedRentAmount < 0) {
    return isWeeklyRentBillingCadence(lease.rentBillingCadence)
      ? "weekly rent must be a non-negative number"
      : "rentAmount must be a non-negative number";
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
    editedRentAmount === getLeaseRentAmount(lease) &&
    isSecurityDepositUnchanged(body.securityDepositAmount, lease.securityDepositAmount)
  ) {
    return "At least one lease term field must change";
  }

  return null;
}
