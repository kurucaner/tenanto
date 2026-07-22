import { describe, expect, test } from "bun:test";

import { RentBillingCadence } from "@/packages/shared";

import {
  getActiveLeaseHoldoverNotice,
  getActiveLeaseHoldoverScheduleNotice,
  getEditLeaseFirstPeriodRentPreview,
  getEndLeaseHoldoverHelperText,
  getEndLeaseMoveOutBoundsHelperText,
  getEndLeaseMoveOutRentPreview,
} from "./lease-proration-display";

describe("getEndLeaseMoveOutRentPreview", () => {
  const lease = {
    leaseStartDate: "2024-01-01",
    rentAmount: 1000,
    rentBillingCadence: "monthly" as const,
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

  test("returns prorated final week preview for weekly cadence", () => {
    expect(
      getEndLeaseMoveOutRentPreview({
        lease: {
          leaseStartDate: "2026-01-15",
          rentAmount: 700,
          rentBillingCadence: "weekly",
        },
        moveOutDate: "2026-01-20",
        rentPeriods: [],
      })
    ).toBe("Final week rent: $600 (6/7 days)");
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

describe("getEndLeaseMoveOutBoundsHelperText", () => {
  test("describes the holdover date range when the lease is overdue", () => {
    expect(getEndLeaseMoveOutBoundsHelperText("2026-01-15", "2026-06-30", "2026-07-09")).toBe(
      "Select the actual move-out date between 06/30/2026 and 07/09/2026."
    );
  });

  test("describes the early move-out date range for active leases still within term", () => {
    expect(getEndLeaseMoveOutBoundsHelperText("2026-01-15", "2026-12-31", "2026-07-09")).toBe(
      "Select the move-out date between 01/15/2026 and 07/09/2026."
    );
  });
});

describe("getActiveLeaseHoldoverScheduleNotice", () => {
  test("explains that holdover rent is estimated through today", () => {
    expect(getActiveLeaseHoldoverScheduleNotice()).toContain("estimated through today");
    expect(getActiveLeaseHoldoverScheduleNotice()).toContain("actual move-out date");
  });
});

describe("getEndLeaseHoldoverHelperText", () => {
  test("returns holdover copy when move-out is after lease end", () => {
    expect(getEndLeaseHoldoverHelperText("2024-07-05", "2024-06-30")).toBe(
      "Move-out is after the contract end date. Holdover days are included in the final month's prorated rent."
    );
  });

  test("uses week wording for weekly cadence", () => {
    expect(getEndLeaseHoldoverHelperText("2024-07-05", "2024-06-30", "weekly")).toBe(
      "Move-out is after the contract end date. Holdover days are included in the final week's prorated rent."
    );
  });

  test("returns null when move-out is on or before lease end", () => {
    expect(getEndLeaseHoldoverHelperText("2024-06-30", "2024-06-30")).toBeNull();
    expect(getEndLeaseHoldoverHelperText("2024-06-15", "2024-06-30")).toBeNull();
  });
});

describe("getActiveLeaseHoldoverNotice", () => {
  test("mentions the contract end date", () => {
    expect(getActiveLeaseHoldoverNotice("2026-06-30")).toContain("06/30/2026");
    expect(getActiveLeaseHoldoverNotice("2026-06-30")).toContain("actual move-out date");
  });
});

describe("getEditLeaseFirstPeriodRentPreview", () => {
  test("returns first week rent preview for weekly cadence", () => {
    expect(
      getEditLeaseFirstPeriodRentPreview({
        leaseEndDate: "2026-01-20",
        leaseStartDate: "2026-01-15",
        rentAmount: 700,
        rentBillingCadence: RentBillingCadence.WEEKLY,
      })
    ).toBe("First week rent: $600 (6/7 days)");
  });
});
