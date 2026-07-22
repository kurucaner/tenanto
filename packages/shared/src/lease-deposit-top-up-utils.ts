import { roundMoney } from "./property-income-calculator";

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
