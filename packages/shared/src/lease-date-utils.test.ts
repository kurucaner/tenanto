import { describe, expect, test } from "bun:test";

import {
  calculateLeaseEndDate,
  enumerateLeaseMonths,
  transactionDateToMonth,
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
