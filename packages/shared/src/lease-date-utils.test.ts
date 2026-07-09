import { describe, expect, test } from "bun:test";

import {
  calculateLeaseEndDate,
  enumerateLeaseMonths,
  getEndLeaseMoveOutDateBounds,
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
  test("uses today through lease end when lease is not overdue", () => {
    expect(getEndLeaseMoveOutDateBounds("2026-12-31", "2026-07-09")).toEqual({
      defaultDate: "2026-07-09",
      maxDate: "2026-12-31",
      minDate: "2026-07-09",
    });
  });

  test("allows only today when lease end date is in the past", () => {
    expect(getEndLeaseMoveOutDateBounds("2026-05-01", "2026-07-09")).toEqual({
      defaultDate: "2026-07-09",
      maxDate: "2026-07-09",
      minDate: "2026-07-09",
    });
  });
});

describe("validateEndLeaseMoveOutDate", () => {
  const today = "2026-07-09";
  const leaseEndDate = "2026-12-31";

  test("accepts today and future dates up to lease end", () => {
    expect(validateEndLeaseMoveOutDate("2026-07-09", leaseEndDate, today)).toBeNull();
    expect(validateEndLeaseMoveOutDate("2026-10-01", leaseEndDate, today)).toBeNull();
    expect(validateEndLeaseMoveOutDate("2026-12-31", leaseEndDate, today)).toBeNull();
  });

  test("rejects dates before today", () => {
    expect(validateEndLeaseMoveOutDate("2026-07-08", leaseEndDate, today)).toBe(
      "Move-out date cannot be in the past"
    );
  });

  test("rejects dates after lease end", () => {
    expect(validateEndLeaseMoveOutDate("2027-01-01", leaseEndDate, today)).toBe(
      "Move-out date cannot be after lease end date"
    );
  });

  test("allows only today for overdue leases", () => {
    expect(validateEndLeaseMoveOutDate("2026-07-09", "2026-05-01", today)).toBeNull();
    expect(validateEndLeaseMoveOutDate("2026-05-01", "2026-05-01", today)).toBe(
      "Move-out date cannot be in the past"
    );
    expect(validateEndLeaseMoveOutDate("2026-07-10", "2026-05-01", today)).toBe(
      "Move-out date cannot be after lease end date"
    );
  });
});
