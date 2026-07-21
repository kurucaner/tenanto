import { describe, expect, test } from "bun:test";

import type { ITenantRentSummaryResponse } from "@/packages/shared";

import {
  formatDuePeriodsLabel,
  getLeasesWithDue,
  getPayableLeases,
  hasOnlinePayAvailable,
  resolveRentPayAction,
} from "./rent-summary-utils";

function lease(
  overrides: Partial<ITenantRentSummaryResponse["leases"][number]> &
    Pick<ITenantRentSummaryResponse["leases"][number], "leaseId">
): ITenantRentSummaryResponse["leases"][number] {
  return {
    amountDueCents: 0,
    duePeriodKeys: [],
    paymentsEnabled: true,
    propertyName: "Property",
    unitLabel: "Unit",
    ...overrides,
  };
}

function summary(overrides: Partial<ITenantRentSummaryResponse>): ITenantRentSummaryResponse {
  return {
    currency: "usd",
    hasActiveLease: true,
    hasPastLeases: false,
    leases: [],
    totalAmountDueCents: 0,
    ...overrides,
  };
}

describe("formatDuePeriodsLabel", () => {
  test("formats a single monthly period", () => {
    expect(formatDuePeriodsLabel(["2026-01"])).toBe("January 2026");
  });

  test("formats a single weekly period", () => {
    expect(formatDuePeriodsLabel(["2026-01-15"])).toMatch(/^Week of /);
  });

  test("joins two periods with and", () => {
    expect(formatDuePeriodsLabel(["2026-01-15", "2026-01-22"])).toContain(" and ");
  });

  test("returns null for empty period keys", () => {
    expect(formatDuePeriodsLabel([])).toBeNull();
  });
});

describe("getLeasesWithDue", () => {
  test("returns leases with a positive balance", () => {
    const leases = [
      lease({ amountDueCents: 100_00, leaseId: "lease-1" }),
      lease({ amountDueCents: 0, leaseId: "lease-2" }),
    ];

    expect(getLeasesWithDue(leases)).toEqual([leases[0]]);
  });
});

describe("getPayableLeases", () => {
  test("returns due leases with online pay enabled", () => {
    const leases = [
      lease({ amountDueCents: 100_00, leaseId: "lease-1", paymentsEnabled: true }),
      lease({ amountDueCents: 50_00, leaseId: "lease-2", paymentsEnabled: false }),
    ];

    expect(getPayableLeases(leases)).toEqual([leases[0]]);
  });
});

describe("resolveRentPayAction", () => {
  test("navigates to leases when nothing is due", () => {
    expect(
      resolveRentPayAction(
        summary({
          leases: [lease({ amountDueCents: 0, leaseId: "lease-1" })],
          totalAmountDueCents: 0,
        })
      )
    ).toEqual({ href: "/leases", kind: "navigate" });
  });

  test("starts checkout for a single due lease with payments enabled", () => {
    expect(
      resolveRentPayAction(
        summary({
          leases: [
            lease({
              amountDueCents: 100_00,
              duePeriodKeys: ["2026-01"],
              leaseId: "lease-1",
            }),
            lease({ amountDueCents: 0, leaseId: "lease-2" }),
          ],
          totalAmountDueCents: 100_00,
        })
      )
    ).toEqual({ kind: "checkout", leaseId: "lease-1" });
  });

  test("navigates to lease detail when due but payments disabled", () => {
    expect(
      resolveRentPayAction(
        summary({
          leases: [
            lease({
              amountDueCents: 100_00,
              duePeriodKeys: ["2026-01-15"],
              leaseId: "lease-1",
              paymentsEnabled: false,
            }),
          ],
          totalAmountDueCents: 100_00,
        })
      )
    ).toEqual({ href: "/leases/lease-1", kind: "navigate" });
  });

  test("opens lease picker when multiple leases have due balances", () => {
    const leases = [
      lease({
        amountDueCents: 50_00,
        duePeriodKeys: ["2026-01"],
        leaseId: "lease-1",
      }),
      lease({
        amountDueCents: 50_00,
        duePeriodKeys: ["2026-01-15"],
        leaseId: "lease-2",
      }),
    ];

    expect(
      resolveRentPayAction(
        summary({
          leases,
          totalAmountDueCents: 100_00,
        })
      )
    ).toEqual({ kind: "pick-lease", leases });
  });

  test("starts checkout when only one lease is payable among multiple due leases", () => {
    expect(
      resolveRentPayAction(
        summary({
          leases: [
            lease({
              amountDueCents: 50_00,
              duePeriodKeys: ["2026-01-15"],
              leaseId: "lease-1",
              paymentsEnabled: true,
            }),
            lease({
              amountDueCents: 50_00,
              duePeriodKeys: ["2026-01"],
              leaseId: "lease-2",
              paymentsEnabled: false,
            }),
          ],
          totalAmountDueCents: 100_00,
        })
      )
    ).toEqual({ kind: "checkout", leaseId: "lease-1" });
  });

  test("opens lease picker when multiple leases are due but none are payable", () => {
    const leases = [
      lease({
        amountDueCents: 50_00,
        duePeriodKeys: ["2026-01-15"],
        leaseId: "lease-1",
        paymentsEnabled: false,
      }),
      lease({
        amountDueCents: 50_00,
        duePeriodKeys: ["2026-01"],
        leaseId: "lease-2",
        paymentsEnabled: false,
      }),
    ];

    expect(
      resolveRentPayAction(
        summary({
          leases,
          totalAmountDueCents: 100_00,
        })
      )
    ).toEqual({ kind: "pick-lease", leases });
  });
});

describe("hasOnlinePayAvailable", () => {
  test("true when a due lease has payments enabled", () => {
    expect(
      hasOnlinePayAvailable([
        lease({
          amountDueCents: 10_00,
          duePeriodKeys: ["2026-01-15"],
          leaseId: "lease-1",
          paymentsEnabled: true,
        }),
      ])
    ).toBe(true);
  });

  test("false when due but payments disabled", () => {
    expect(
      hasOnlinePayAvailable([
        lease({
          amountDueCents: 10_00,
          duePeriodKeys: ["2026-01"],
          leaseId: "lease-1",
          paymentsEnabled: false,
        }),
      ])
    ).toBe(false);
  });
});
