import { describe, expect, test } from "bun:test";

import {
  getCurrentLeaseRent,
  getExtensionRentEffectiveMonthOptions,
  getFirstExtensionMonth,
  getLeaseRentForMonth,
  getLeaseRentForPeriod,
  validateExtendLease,
} from "./lease-rent-utils";
import { PropertyLongStayStatus } from "./property-long-stay-types";
import { RentBillingCadence } from "./rent-billing-cadence";

const activeLease = {
  leaseEndDate: "2026-12-31",
  leaseStartDate: "2026-01-01",
  rentBillingCadence: RentBillingCadence.MONTHLY,
  status: PropertyLongStayStatus.ACTIVE,
  termMonths: 12,
} as const;

const activeWeeklyLease = {
  leaseEndDate: "2026-01-07",
  leaseStartDate: "2026-01-01",
  rentBillingCadence: RentBillingCadence.WEEKLY,
  status: PropertyLongStayStatus.ACTIVE,
  termMonths: 1,
} as const;

describe("getFirstExtensionMonth", () => {
  test("returns month after lease end month", () => {
    expect(getFirstExtensionMonth("2026-12-31")).toBe("2027-01");
    expect(getFirstExtensionMonth("2026-06-15")).toBe("2026-07");
  });
});

describe("getLeaseRentForMonth", () => {
  test("returns base rent when no periods exist", () => {
    expect(getLeaseRentForMonth(1500, [], "2026-05")).toBe(1500);
  });

  test("applies latest period at or before the month", () => {
    const periods = [
      { effectiveFromMonth: "2026-01", monthlyRent: 1500 },
      { effectiveFromMonth: "2027-01", monthlyRent: 1700 },
    ];
    expect(getLeaseRentForMonth(1500, periods, "2026-12")).toBe(1500);
    expect(getLeaseRentForMonth(1500, periods, "2027-01")).toBe(1700);
    expect(getLeaseRentForMonth(1500, periods, "2027-06")).toBe(1700);
  });
});

describe("getLeaseRentForPeriod", () => {
  test("applies latest weekly period at or before the week start", () => {
    const periods = [
      { effectiveFromMonth: "2026-01-15", monthlyRent: 700 },
      { effectiveFromMonth: "2026-01-29", monthlyRent: 800 },
    ];
    expect(getLeaseRentForPeriod(700, periods, "2026-01-15")).toBe(700);
    expect(getLeaseRentForPeriod(700, periods, "2026-01-22")).toBe(700);
    expect(getLeaseRentForPeriod(700, periods, "2026-01-29")).toBe(800);
    expect(getLeaseRentForPeriod(700, periods, "2026-02-05")).toBe(800);
  });
});

describe("getCurrentLeaseRent", () => {
  test("uses today's month for lookup", () => {
    const periods = [{ effectiveFromMonth: "2027-01", monthlyRent: 1700 }];
    expect(getCurrentLeaseRent(1500, periods, "2026-07-09")).toBe(1500);
    expect(getCurrentLeaseRent(1500, periods, "2027-02-15")).toBe(1700);
  });

  test("uses containing week start for weekly leases", () => {
    const periods = [
      { effectiveFromMonth: "2026-01-15", monthlyRent: 700 },
      { effectiveFromMonth: "2026-01-29", monthlyRent: 800 },
    ];
    expect(
      getCurrentLeaseRent(700, periods, "2026-01-20", {
        leaseStartDate: "2026-01-15",
        rentBillingCadence: RentBillingCadence.WEEKLY,
      })
    ).toBe(700);
    expect(
      getCurrentLeaseRent(700, periods, "2026-01-30", {
        leaseStartDate: "2026-01-15",
        rentBillingCadence: RentBillingCadence.WEEKLY,
      })
    ).toBe(800);
  });
});

describe("getExtensionRentEffectiveMonthOptions", () => {
  test("lists months in the extension window from the current contract end", () => {
    expect(getExtensionRentEffectiveMonthOptions("2026-12-31", "2027-06-30")).toEqual([
      "2027-01",
      "2027-02",
      "2027-03",
      "2027-04",
      "2027-05",
      "2027-06",
    ]);
  });

  test("lists months when extending a custom-ended lease by months", () => {
    expect(getExtensionRentEffectiveMonthOptions("2027-06-30", "2027-12-30")).toEqual([
      "2027-07",
      "2027-08",
      "2027-09",
      "2027-10",
      "2027-11",
      "2027-12",
    ]);
    expect(getExtensionRentEffectiveMonthOptions("2027-06-30", "2027-12-31")).toEqual([
      "2027-07",
      "2027-08",
      "2027-09",
      "2027-10",
      "2027-11",
      "2027-12",
    ]);
  });
});

describe("validateExtendLease", () => {
  test("accepts valid extension without rent change", () => {
    expect(validateExtendLease({ additionalTermMonths: 6 }, activeLease, "2026-07-09")).toBeNull();
  });

  test("accepts valid extension with rent change", () => {
    expect(
      validateExtendLease(
        {
          additionalTermMonths: 6,
          newMonthlyRent: 1800,
          rentEffectiveFromMonth: "2027-01",
        },
        activeLease,
        "2026-07-09"
      )
    ).toBeNull();
  });

  test("rejects inactive lease", () => {
    expect(
      validateExtendLease(
        { additionalTermMonths: 6 },
        { ...activeLease, status: PropertyLongStayStatus.ENDED },
        "2026-07-09"
      )
    ).toBe("Only active leases can be extended");
  });

  test("rejects partial rent change fields", () => {
    expect(
      validateExtendLease(
        { additionalTermMonths: 6, newMonthlyRent: 1800 },
        activeLease,
        "2026-07-09"
      )
    ).toBe("New monthly rent and effective month must both be provided when changing rent");
  });

  test("rejects effective month before extension period", () => {
    expect(
      validateExtendLease(
        {
          additionalTermMonths: 6,
          newMonthlyRent: 1800,
          rentEffectiveFromMonth: "2026-12",
        },
        activeLease,
        "2026-07-09"
      )
    ).toBe("Rent effective month cannot be before the extension period");
  });

  test("rejects term exceeding total cap", () => {
    expect(validateExtendLease({ additionalTermMonths: 61 }, activeLease, "2026-07-09")).toBe(
      "Additional term must be between 1 and 60 months"
    );
  });

  test("accepts custom new end date", () => {
    expect(
      validateExtendLease({ newLeaseEndDate: "2027-06-15" }, activeLease, "2026-07-09")
    ).toBeNull();
  });

  test("rejects custom new end date that is not after current end", () => {
    expect(validateExtendLease({ newLeaseEndDate: "2026-12-31" }, activeLease, "2026-07-09")).toBe(
      "New lease end date must be after the current contract end date"
    );
  });

  test("rejects providing both extension modes", () => {
    expect(
      validateExtendLease(
        { additionalTermMonths: 6, newLeaseEndDate: "2027-06-15" },
        activeLease,
        "2026-07-09"
      )
    ).toBe("Provide additionalTermMonths or newLeaseEndDate, but not both");
  });

  test("accepts weekly extension by additional weeks", () => {
    expect(
      validateExtendLease({ additionalWeeks: 4 }, activeWeeklyLease, "2026-01-05")
    ).toBeNull();
  });

  test("rejects weekly extension with rent change", () => {
    expect(
      validateExtendLease(
        {
          additionalWeeks: 4,
          newMonthlyRent: 500,
          rentEffectiveFromMonth: "2026-01",
        },
        activeWeeklyLease,
        "2026-01-05"
      )
    ).toBe("Rent amount cannot be changed when extending a weekly-billed lease");
  });

  test("rejects weekly extension by months", () => {
    expect(
      validateExtendLease({ additionalTermMonths: 4 }, activeWeeklyLease, "2026-01-05")
    ).toBe("Weekly leases must be extended by additionalWeeks or newLeaseEndDate");
  });

  test("rejects monthly extension by weeks", () => {
    expect(validateExtendLease({ additionalWeeks: 4 }, activeLease, "2026-07-09")).toBe(
      "Monthly leases must be extended by additionalTermMonths or newLeaseEndDate"
    );
  });

  test("rejects weekly custom end date that is not whole weeks", () => {
    expect(
      validateExtendLease({ newLeaseEndDate: "2026-01-10" }, activeWeeklyLease, "2026-01-05")
    ).toBe("Weekly lease extensions must add whole weeks");
  });

  test("accepts weekly custom end date aligned to whole weeks", () => {
    expect(
      validateExtendLease({ newLeaseEndDate: "2026-01-14" }, activeWeeklyLease, "2026-01-05")
    ).toBeNull();
  });
});
