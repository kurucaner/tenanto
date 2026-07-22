import { describe, expect, test } from "bun:test";

import { addMonthsToIsoDate } from "./lease-date-utils";
import {
  deriveTermMonthsFromDates,
  isCustomLeaseEndDate,
  resolveExtendLeaseEndDate,
  resolveLeaseEndDate,
  validateLeaseTermInput,
} from "./lease-term-input-utils";
import { PropertyLongStayStatus } from "./property-long-stay-types";

describe("resolveLeaseEndDate", () => {
  test("uses term months when no custom end is provided", () => {
    expect(
      resolveLeaseEndDate({
        leaseStartDate: "2026-07-01",
        termMonths: 12,
      })
    ).toEqual({
      leaseEndDate: "2027-06-30",
      termMonths: 12,
    });
  });

  test("uses custom end and derives term months from schedule months", () => {
    expect(
      resolveLeaseEndDate({
        leaseEndDate: "2027-06-30",
        leaseStartDate: "2026-07-01",
      })
    ).toEqual({
      leaseEndDate: "2027-06-30",
      termMonths: 12,
    });
  });
});

describe("validateLeaseTermInput", () => {
  test("accepts term months mode", () => {
    expect(
      validateLeaseTermInput({
        leaseStartDate: "2026-07-01",
        termMonths: 12,
      })
    ).toBeNull();
  });

  test("accepts custom end mode", () => {
    expect(
      validateLeaseTermInput({
        leaseEndDate: "2027-06-30",
        leaseStartDate: "2026-07-01",
      })
    ).toBeNull();
  });

  test("rejects end before start", () => {
    expect(
      validateLeaseTermInput({
        leaseEndDate: "2026-06-30",
        leaseStartDate: "2026-07-01",
      })
    ).toBe("Lease end date cannot be before the lease start date");
  });
});

describe("addMonthsToIsoDate", () => {
  test("adds months from the current contract end", () => {
    expect(addMonthsToIsoDate("2027-06-30", 6)).toBe("2027-12-30");
  });
});

describe("deriveTermMonthsFromDates", () => {
  test("counts schedule months between start and custom end", () => {
    expect(deriveTermMonthsFromDates("2026-07-01", "2027-06-30")).toBe(12);
  });
});

describe("isCustomLeaseEndDate", () => {
  test("detects when stored end differs from computed term-months end", () => {
    expect(isCustomLeaseEndDate("2026-07-01", 12, "2027-06-30")).toBe(false);
    expect(isCustomLeaseEndDate("2026-07-01", 12, "2027-07-01")).toBe(true);
  });
});

describe("resolveExtendLeaseEndDate", () => {
  const lease = {
    leaseEndDate: "2027-06-30",
    leaseStartDate: "2026-07-01",
    status: PropertyLongStayStatus.ACTIVE,
    termMonths: 12,
  };

  test("extends by additional months from day after current end", () => {
    expect(resolveExtendLeaseEndDate(lease, { additionalTermMonths: 6 })).toEqual({
      newLeaseEndDate: "2027-12-31",
      newTermMonths: 18,
    });
  });

  test("extends twelve months from a month-end contract end", () => {
    expect(resolveExtendLeaseEndDate(lease, { additionalTermMonths: 12 })).toEqual({
      newLeaseEndDate: "2028-06-30",
      newTermMonths: 24,
    });
  });

  test("extends to a custom new end date", () => {
    expect(resolveExtendLeaseEndDate(lease, { newLeaseEndDate: "2028-01-15" })).toEqual({
      newLeaseEndDate: "2028-01-15",
      newTermMonths: deriveTermMonthsFromDates("2026-07-01", "2028-01-15"),
    });
  });
});
