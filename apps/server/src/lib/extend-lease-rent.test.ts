import { describe, expect, test } from "bun:test";

import { getLeaseRentForMonth } from "@/packages/shared";

describe("extend lease rent schedule amounts", () => {
  test("preserves original rent before effective month after extension rent change", () => {
    const periods = [
      { effectiveFromMonth: "2026-01", monthlyRent: 1500 },
      { effectiveFromMonth: "2027-01", monthlyRent: 1700 },
    ];

    expect(getLeaseRentForMonth(1700, periods, "2026-11")).toBe(1500);
    expect(getLeaseRentForMonth(1700, periods, "2027-01")).toBe(1700);
    expect(getLeaseRentForMonth(1700, periods, "2027-06")).toBe(1700);
  });
});
