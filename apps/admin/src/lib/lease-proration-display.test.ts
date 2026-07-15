import { describe, expect, test } from "bun:test";

import {
  getActiveLeaseHoldoverNotice,
  getEndLeaseHoldoverHelperText,
  getEndLeaseMoveOutBoundsHelperText,
  getEndLeaseMoveOutRentPreview,
  getStartLeaseFirstMonthRentPreview,
} from "./lease-proration-display";

describe("getEndLeaseMoveOutRentPreview", () => {
  const lease = {
    leaseStartDate: "2024-01-01",
    monthlyRent: 1000,
  };

  test("returns prorated final month preview for holdover move-out", () => {
    expect(
      getEndLeaseMoveOutRentPreview({
        lease,
        moveOutDate: "2024-07-05",
        rentPeriods: [],
      })
    ).toBe("Final month rent: $161.29 (5/31 days)");
  });

  test("returns null when move-out date is empty", () => {
    expect(
      getEndLeaseMoveOutRentPreview({
        lease,
        moveOutDate: "",
        rentPeriods: [],
      })
    ).toBeNull();
  });
});

describe("getStartLeaseFirstMonthRentPreview", () => {
  test("returns prorated first month preview for mid-month starts", () => {
    expect(
      getStartLeaseFirstMonthRentPreview({
        leaseStartDate: "2024-06-16",
        monthlyRent: 1000,
        termMonths: 12,
      })
    ).toBe("First month rent: $500.00 (15/30 days)");
  });

  test("returns null when the first month is not prorated", () => {
    expect(
      getStartLeaseFirstMonthRentPreview({
        leaseStartDate: "2024-06-01",
        monthlyRent: 1000,
        termMonths: 12,
      })
    ).toBeNull();
  });
});

describe("getEndLeaseMoveOutBoundsHelperText", () => {
  test("describes the holdover date range when the lease is overdue", () => {
    expect(getEndLeaseMoveOutBoundsHelperText("2026-01-15", "2026-06-30", "2026-07-09")).toBe(
      "Select the actual move-out date between 6/30/2026 and 7/9/2026."
    );
  });

  test("describes the early move-out date range for active leases still within term", () => {
    expect(getEndLeaseMoveOutBoundsHelperText("2026-01-15", "2026-12-31", "2026-07-09")).toBe(
      "Select the move-out date between 1/15/2026 and 7/9/2026."
    );
  });
});

describe("getEndLeaseHoldoverHelperText", () => {
  test("returns holdover copy when move-out is after lease end", () => {
    expect(getEndLeaseHoldoverHelperText("2024-07-05", "2024-06-30")).toBe(
      "Move-out is after the contract end date. Holdover days are included in the final month's prorated rent."
    );
  });

  test("returns null when move-out is on or before lease end", () => {
    expect(getEndLeaseHoldoverHelperText("2024-06-30", "2024-06-30")).toBeNull();
    expect(getEndLeaseHoldoverHelperText("2024-06-15", "2024-06-30")).toBeNull();
  });
});

describe("getActiveLeaseHoldoverNotice", () => {
  test("mentions the contract end date", () => {
    expect(getActiveLeaseHoldoverNotice("2026-06-30")).toContain("6/30/2026");
    expect(getActiveLeaseHoldoverNotice("2026-06-30")).toContain("Rent accrues through today");
  });
});
