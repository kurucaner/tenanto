import { describe, expect, test } from "bun:test";

import {
  deriveLeaseTermsEditability,
  hasRentPeriodHistory,
  MAX_LEASE_TERM_MONTHS,
  validateEditLeaseTerms,
} from "./lease-terms-edit-utils";
import {
  type ILeaseTermsEditSignals,
  LeaseTermsEditBlockReason,
  PropertyLongStayStatus,
} from "./property-long-stay-types";
import { RentBillingCadence } from "./rent-billing-cadence";

const activeLease = {
  leaseEndDate: "2026-12-31",
  leaseStartDate: "2026-01-01",
  rentAmount: 1500,
  rentBillingCadence: RentBillingCadence.MONTHLY,
  securityDepositAmount: null as number | null,
  status: PropertyLongStayStatus.ACTIVE,
  termMonths: 12,
} as const;

const editableSignals: ILeaseTermsEditSignals = {
  hasIncomeLines: false,
  hasRentPeriodHistory: false,
  hasSucceededPayments: false,
};

describe("deriveLeaseTermsEditability", () => {
  test("returns editable when active lease has no ledger signals", () => {
    expect(deriveLeaseTermsEditability(activeLease, editableSignals)).toEqual({ editable: true });
  });

  test("allows pristine weekly-billed leases when no ledger signals exist", () => {
    expect(
      deriveLeaseTermsEditability(
        {
          ...activeLease,
          rentBillingCadence: RentBillingCadence.WEEKLY,
        },
        editableSignals
      )
    ).toEqual({ editable: true });
  });

  test("blocks weekly leases after rent income is recorded", () => {
    expect(
      deriveLeaseTermsEditability(
        {
          ...activeLease,
          rentBillingCadence: RentBillingCadence.WEEKLY,
        },
        {
          ...editableSignals,
          hasIncomeLines: true,
        }
      )
    ).toEqual({
      editable: false,
      reason: LeaseTermsEditBlockReason.HAS_INCOME_LINES,
    });
  });

  test("blocks ended leases first", () => {
    expect(
      deriveLeaseTermsEditability(
        { rentBillingCadence: RentBillingCadence.MONTHLY, status: PropertyLongStayStatus.ENDED },
        editableSignals
      )
    ).toEqual({
      editable: false,
      reason: LeaseTermsEditBlockReason.LEASE_ENDED,
    });
  });

  test("blocks when income lines exist", () => {
    expect(
      deriveLeaseTermsEditability(activeLease, {
        ...editableSignals,
        hasIncomeLines: true,
      })
    ).toEqual({
      editable: false,
      reason: LeaseTermsEditBlockReason.HAS_INCOME_LINES,
    });
  });

  test("blocks when succeeded payments exist", () => {
    expect(
      deriveLeaseTermsEditability(activeLease, {
        ...editableSignals,
        hasSucceededPayments: true,
      })
    ).toEqual({
      editable: false,
      reason: LeaseTermsEditBlockReason.HAS_SUCCEEDED_PAYMENTS,
    });
  });

  test("blocks when rent period history exists", () => {
    expect(
      deriveLeaseTermsEditability(activeLease, {
        ...editableSignals,
        hasRentPeriodHistory: true,
      })
    ).toEqual({
      editable: false,
      reason: LeaseTermsEditBlockReason.HAS_RENT_PERIOD_HISTORY,
    });
  });
});

describe("hasRentPeriodHistory", () => {
  test("returns false for pristine lease with no periods", () => {
    expect(hasRentPeriodHistory([], "2026-01-15")).toBe(false);
  });

  test("returns false for single period at lease start month", () => {
    expect(
      hasRentPeriodHistory([{ effectiveFromPeriod: "2026-01", rentAmount: 1500 }], "2026-01-15")
    ).toBe(false);
  });

  test("returns false for single weekly period at lease start date", () => {
    expect(
      hasRentPeriodHistory(
        [{ effectiveFromPeriod: "2026-01-15", rentAmount: 700 }],
        "2026-01-15",
        RentBillingCadence.WEEKLY
      )
    ).toBe(false);
  });

  test("returns true when multiple rent periods exist", () => {
    expect(
      hasRentPeriodHistory(
        [
          { effectiveFromPeriod: "2026-01", rentAmount: 1500 },
          { effectiveFromPeriod: "2027-01", rentAmount: 1700 },
        ],
        "2026-01-01"
      )
    ).toBe(true);
  });

  test("returns true when a period starts after lease start month", () => {
    expect(
      hasRentPeriodHistory([{ effectiveFromPeriod: "2026-07", rentAmount: 1500 }], "2026-01-01")
    ).toBe(true);
  });

  test("returns true when a weekly period starts after lease start date", () => {
    expect(
      hasRentPeriodHistory(
        [{ effectiveFromPeriod: "2026-01-22", rentAmount: 700 }],
        "2026-01-15",
        RentBillingCadence.WEEKLY
      )
    ).toBe(true);
  });
});

describe("validateEditLeaseTerms", () => {
  test("accepts valid changes", () => {
    expect(
      validateEditLeaseTerms(
        {
          leaseStartDate: "2026-02-01",
          rentAmount: 1600,
          termMonths: 12,
        },
        activeLease,
        "2026-07-09"
      )
    ).toBeNull();
  });

  test("accepts custom end date changes", () => {
    expect(
      validateEditLeaseTerms(
        {
          leaseEndDate: "2026-12-30",
          leaseStartDate: "2026-01-01",
          rentAmount: 1600,
        },
        activeLease,
        "2026-07-09"
      )
    ).toBeNull();
  });

  test("rejects invalid start date", () => {
    expect(
      validateEditLeaseTerms(
        {
          leaseStartDate: "2026-13-01",
          rentAmount: 1600,
          termMonths: 12,
        },
        activeLease,
        "2026-07-09"
      )
    ).toBe("leaseStartDate must be a YYYY-MM-DD date");
  });

  test("rejects term outside bounds", () => {
    expect(
      validateEditLeaseTerms(
        {
          leaseStartDate: "2026-01-01",
          rentAmount: 1600,
          termMonths: MAX_LEASE_TERM_MONTHS + 1,
        },
        activeLease,
        "2026-07-09"
      )
    ).toBe(`termMonths must be a whole number between 1 and ${MAX_LEASE_TERM_MONTHS}`);
  });

  test("rejects negative weekly rent", () => {
    expect(
      validateEditLeaseTerms(
        {
          leaseStartDate: "2026-02-01",
          rentAmount: -1,
          termMonths: 12,
        },
        {
          ...activeLease,
          rentBillingCadence: RentBillingCadence.WEEKLY,
        },
        "2026-07-09"
      )
    ).toBe("weekly rent must be a non-negative number");
  });

  test("rejects negative rent", () => {
    expect(
      validateEditLeaseTerms(
        {
          leaseStartDate: "2026-02-01",
          rentAmount: -1,
          termMonths: 12,
        },
        activeLease,
        "2026-07-09"
      )
    ).toBe("rentAmount must be a non-negative number");
  });

  test("rejects no-op updates", () => {
    expect(
      validateEditLeaseTerms(
        {
          leaseStartDate: activeLease.leaseStartDate,
          rentAmount: activeLease.rentAmount,
          termMonths: activeLease.termMonths,
        },
        activeLease,
        "2026-07-09"
      )
    ).toBe("At least one lease term field must change");
  });

  test("rejects no-op when deposit is omitted and other fields match", () => {
    expect(
      validateEditLeaseTerms(
        {
          leaseStartDate: activeLease.leaseStartDate,
          rentAmount: activeLease.rentAmount,
          securityDepositAmount: undefined,
          termMonths: activeLease.termMonths,
        },
        { ...activeLease, securityDepositAmount: 1500 },
        "2026-07-09"
      )
    ).toBe("At least one lease term field must change");
  });

  test("rejects no-op when deposit matches existing amount", () => {
    expect(
      validateEditLeaseTerms(
        {
          leaseStartDate: activeLease.leaseStartDate,
          rentAmount: activeLease.rentAmount,
          securityDepositAmount: 1500,
          termMonths: activeLease.termMonths,
        },
        { ...activeLease, securityDepositAmount: 1500 },
        "2026-07-09"
      )
    ).toBe("At least one lease term field must change");
  });

  test("accepts deposit-only changes", () => {
    expect(
      validateEditLeaseTerms(
        {
          leaseStartDate: activeLease.leaseStartDate,
          rentAmount: activeLease.rentAmount,
          securityDepositAmount: 1500,
          termMonths: activeLease.termMonths,
        },
        activeLease,
        "2026-07-09"
      )
    ).toBeNull();
  });

  test("accepts clearing deposit when previously set", () => {
    expect(
      validateEditLeaseTerms(
        {
          leaseStartDate: activeLease.leaseStartDate,
          rentAmount: activeLease.rentAmount,
          securityDepositAmount: null,
          termMonths: activeLease.termMonths,
        },
        { ...activeLease, securityDepositAmount: 1500 },
        "2026-07-09"
      )
    ).toBeNull();
  });

  test("rejects negative deposit amounts", () => {
    expect(
      validateEditLeaseTerms(
        {
          leaseStartDate: activeLease.leaseStartDate,
          rentAmount: activeLease.rentAmount,
          securityDepositAmount: -1,
          termMonths: activeLease.termMonths,
        },
        activeLease,
        "2026-07-09"
      )
    ).toBe("securityDepositAmount must be a non-negative number");
  });

  test("rejects ended lease updates", () => {
    expect(
      validateEditLeaseTerms(
        {
          leaseStartDate: "2026-02-01",
          rentAmount: 1600,
          termMonths: 12,
        },
        { ...activeLease, status: PropertyLongStayStatus.ENDED },
        "2026-07-09"
      )
    ).toBe("Only active leases can have terms edited");
  });
});
