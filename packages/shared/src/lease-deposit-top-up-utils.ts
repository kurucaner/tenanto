import { roundMoney } from "./property-income-calculator";
import type { IExtendPropertyLongStayBody, IPropertyLongStay } from "./property-long-stay-types";
import { resolveExtendNewRentAmount } from "./rent-period-field-utils";

export interface ICanOfferDepositTopUpInput {
  /** Current contractual expected deposit (`securityDepositAmount`). */
  currentExpected: number | null;
  /** Rent amount after the extend rent change. */
  newRentAmount: number;
  /** Persisted 1× rent intent (`securityDepositTracksRent`). */
  tracksRent: boolean;
}

export interface IDepositTopUpOffer {
  eligible: boolean;
  proposedExpected: number;
  topUpDelta: number;
}

/**
 * Whether Extend may offer a deposit top-up when rent increases.
 * Eligible only for rent-linked deposits when new rent exceeds current expected.
 */
export function canOfferDepositTopUp(input: ICanOfferDepositTopUpInput): IDepositTopUpOffer {
  const proposedExpected = roundMoney(input.newRentAmount);

  if (
    !input.tracksRent ||
    input.currentExpected == null ||
    !Number.isFinite(input.newRentAmount) ||
    input.newRentAmount < 0
  ) {
    return {
      eligible: false,
      proposedExpected,
      topUpDelta: 0,
    };
  }

  const currentExpected = roundMoney(input.currentExpected);
  const topUpDelta = roundMoney(proposedExpected - currentExpected);

  if (topUpDelta <= 0) {
    return {
      eligible: false,
      proposedExpected,
      topUpDelta: 0,
    };
  }

  return {
    eligible: true,
    proposedExpected,
    topUpDelta,
  };
}

/**
 * Rejects `topUpSecurityDeposit: true` when the lease/rent change is ineligible.
 * Omit/false always pass.
 */
export function validateExtendDepositTopUp(
  body: Pick<
    IExtendPropertyLongStayBody,
    "newMonthlyRent" | "newRentAmount" | "topUpSecurityDeposit"
  >,
  lease: Pick<IPropertyLongStay, "securityDepositAmount" | "securityDepositTracksRent">
): string | null {
  if (body.topUpSecurityDeposit !== true) {
    return null;
  }

  const newRentAmount = resolveExtendNewRentAmount(body);
  if (newRentAmount === undefined) {
    return "Deposit top-up requires a rent increase on this extend";
  }

  if (!lease.securityDepositTracksRent || lease.securityDepositAmount == null) {
    return "Deposit top-up is only available when the security deposit tracks rent";
  }

  const offer = canOfferDepositTopUp({
    currentExpected: lease.securityDepositAmount,
    newRentAmount,
    tracksRent: lease.securityDepositTracksRent,
  });

  if (!offer.eligible) {
    return "Deposit top-up requires the new rent to be higher than the current deposit";
  }

  return null;
}
