import { describe, expect, test } from "bun:test";

import {
  calculateLeaseEndDate,
  enumerateLeaseMonths,
  getEndLeaseMoveOutDateBounds,
  isActiveLeaseInHoldover,
  transactionDateToMonth,
  validateEndLeaseMoveOutDate,
} from "./lease-date-utils";

describe("calculateLeaseEndDate", () => {
  test("adds term months to start date", () => {
    expect(calculateLeaseEndDate("2026-01-15", 12)).toBe("2027-01-15");
  });

  test("handles month overflow", () => {
    expect(calculateLeaseEndDate("2026-10-01", 3)).toBe("2027-01-01");
  });
});

describe("enumerateLeaseMonths", () => {
  test("lists months inclusive of start and end month", () => {
    expect(enumerateLeaseMonths("2026-01-15", "2026-03-15")).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
    ]);
  });

  test("returns single month when start and end are same month", () => {
    expect(enumerateLeaseMonths("2026-05-01", "2026-05-31")).toEqual(["2026-05"]);
  });
});

describe("transactionDateToMonth", () => {
  test("extracts YYYY-MM from date", () => {
    expect(transactionDateToMonth("2026-07-09")).toBe("2026-07");
  });
});

describe("getEndLeaseMoveOutDateBounds", () => {
  test("allows move-out from lease start through today for active leases still within term", () => {
    expect(getEndLeaseMoveOutDateBounds("2026-01-15", "2026-12-31", "2026-07-09")).toEqual({
      defaultDate: "2026-07-09",
      maxDate: "2026-07-09",
      minDate: "2026-01-15",
    });
  });

  test("allows backdating from lease end through today for overdue leases", () => {
    expect(getEndLeaseMoveOutDateBounds("2026-01-15", "2026-05-01", "2026-07-09")).toEqual({
      defaultDate: "2026-07-09",
      maxDate: "2026-07-09",
      minDate: "2026-05-01",
    });
  });
});

describe("validateEndLeaseMoveOutDate", () => {
  const today = "2026-07-09";
  const leaseStartDate = "2026-01-15";
  const leaseEndDate = "2026-12-31";

  test("accepts today and earlier move-out dates for active leases still within term", () => {
    expect(
      validateEndLeaseMoveOutDate("2026-07-09", leaseStartDate, leaseEndDate, today)
    ).toBeNull();
    expect(
      validateEndLeaseMoveOutDate("2026-07-01", leaseStartDate, leaseEndDate, today)
    ).toBeNull();
  });

  test("rejects dates before lease start for active leases still within term", () => {
    expect(
      validateEndLeaseMoveOutDate("2026-01-14", leaseStartDate, leaseEndDate, today)
    ).toBe("Move-out date cannot be before the lease start date");
  });

  test("rejects future move-out dates", () => {
    expect(
      validateEndLeaseMoveOutDate("2026-07-10", leaseStartDate, leaseEndDate, today)
    ).toBe("Move-out date cannot be in the future");
  });

  test("allows holdover move-out dates after lease end but not before lease end", () => {
    expect(validateEndLeaseMoveOutDate("2026-07-05", "2026-01-01", "2026-06-30", today)).toBeNull();
    expect(validateEndLeaseMoveOutDate("2026-06-29", "2026-01-01", "2026-06-30", today)).toBe(
      "Move-out date cannot be before the lease end date"
    );
  });

  test("allows backdated move-out from lease end through today for overdue leases", () => {
    expect(validateEndLeaseMoveOutDate("2026-07-09", "2026-01-01", "2026-05-01", today)).toBeNull();
    expect(validateEndLeaseMoveOutDate("2026-05-15", "2026-01-01", "2026-05-01", today)).toBeNull();
    expect(validateEndLeaseMoveOutDate("2026-04-30", "2026-01-01", "2026-05-01", today)).toBe(
      "Move-out date cannot be before the lease end date"
    );
    expect(validateEndLeaseMoveOutDate("2026-07-10", "2026-01-01", "2026-05-01", today)).toBe(
      "Move-out date cannot be in the future"
    );
  });
});

describe("isActiveLeaseInHoldover", () => {
  test("returns true when an active lease is past its contract end date", () => {
    expect(
      isActiveLeaseInHoldover({ leaseEndDate: "2026-06-30", status: "active" }, "2026-07-09")
    ).toBe(true);
  });

  test("returns false for active leases still within term or ended leases", () => {
    expect(
      isActiveLeaseInHoldover({ leaseEndDate: "2026-12-31", status: "active" }, "2026-07-09")
    ).toBe(false);
    expect(
      isActiveLeaseInHoldover({ leaseEndDate: "2026-06-30", status: "ended" }, "2026-07-09")
    ).toBe(false);
  });
});
