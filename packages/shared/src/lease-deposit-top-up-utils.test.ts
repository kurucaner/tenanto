import { describe, expect, test } from "bun:test";

import { canOfferDepositTopUp, validateExtendDepositTopUp } from "./lease-deposit-top-up-utils";

describe("canOfferDepositTopUp", () => {
  test("not eligible when deposit does not track rent", () => {
    expect(
      canOfferDepositTopUp({
        currentExpected: 1500,
        newRentAmount: 1800,
        tracksRent: false,
      })
    ).toEqual({
      eligible: false,
      proposedExpected: 1800,
      topUpDelta: 0,
    });
  });

  test("not eligible when there is no contractual deposit", () => {
    expect(
      canOfferDepositTopUp({
        currentExpected: null,
        newRentAmount: 1800,
        tracksRent: true,
      })
    ).toEqual({
      eligible: false,
      proposedExpected: 1800,
      topUpDelta: 0,
    });
  });

  test("not eligible when new rent is lower or equal", () => {
    expect(
      canOfferDepositTopUp({
        currentExpected: 1500,
        newRentAmount: 1500,
        tracksRent: true,
      }).eligible
    ).toBe(false);
    expect(
      canOfferDepositTopUp({
        currentExpected: 1500,
        newRentAmount: 1400,
        tracksRent: true,
      }).eligible
    ).toBe(false);
  });

  test("eligible when tracks rent and new rent is higher", () => {
    expect(
      canOfferDepositTopUp({
        currentExpected: 1500,
        newRentAmount: 1800.004,
        tracksRent: true,
      })
    ).toEqual({
      eligible: true,
      proposedExpected: 1800,
      topUpDelta: 300,
    });
  });
});

describe("validateExtendDepositTopUp", () => {
  test("allows omit and false", () => {
    expect(
      validateExtendDepositTopUp(
        {},
        { securityDepositAmount: 1500, securityDepositTracksRent: true }
      )
    ).toBeNull();
    expect(
      validateExtendDepositTopUp(
        { topUpSecurityDeposit: false },
        { securityDepositAmount: 1500, securityDepositTracksRent: true }
      )
    ).toBeNull();
  });

  test("rejects true without rent change", () => {
    expect(
      validateExtendDepositTopUp(
        { topUpSecurityDeposit: true },
        { securityDepositAmount: 1500, securityDepositTracksRent: true }
      )
    ).toBe("Deposit top-up requires a rent increase on this extend");
  });
});
