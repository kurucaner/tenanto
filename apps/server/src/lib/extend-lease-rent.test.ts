import { describe, expect, test } from "bun:test";

import { getLeaseRentForMonth } from "@/packages/shared";

describe("extend lease rent schedule amounts", () => {
  test("preserves original rent before effective month after extension rent change", () => {
    const periods = [
      { effectiveFromPeriod: "2026-01", rentAmount: 1500 },
      { effectiveFromPeriod: "2027-01", rentAmount: 1700 },
    ];

    expect(getLeaseRentForMonth(1700, periods, "2026-11")).toBe(1500);
    expect(getLeaseRentForMonth(1700, periods, "2027-01")).toBe(1700);
    expect(getLeaseRentForMonth(1700, periods, "2027-06")).toBe(1700);
  });
});
