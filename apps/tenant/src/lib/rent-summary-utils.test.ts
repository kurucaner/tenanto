import { describe, expect, test } from "bun:test";

import type { ITenantRentSummaryResponse } from "@/packages/shared";

import {
  getLeasesWithDue,
  getPayableLeases,
  hasOnlinePayAvailable,
  resolveRentPayAction,
} from "./rent-summary-utils";

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

describe("getLeasesWithDue", () => {
  test("returns leases with a positive balance", () => {
    const leases = [
      {
        amountDueCents: 100_00,
        leaseId: "lease-1",
        paymentsEnabled: true,
        propertyName: "A",
        unitLabel: "1",
      },
      {
        amountDueCents: 0,
        leaseId: "lease-2",
        paymentsEnabled: true,
        propertyName: "B",
        unitLabel: "2",
      },
    ];

    expect(getLeasesWithDue(leases)).toEqual([leases[0]]);
  });
});

describe("getPayableLeases", () => {
  test("returns due leases with online pay enabled", () => {
    const leases = [
      {
        amountDueCents: 100_00,
        leaseId: "lease-1",
        paymentsEnabled: true,
        propertyName: "A",
        unitLabel: "1",
      },
      {
        amountDueCents: 50_00,
        leaseId: "lease-2",
        paymentsEnabled: false,
        propertyName: "B",
        unitLabel: "2",
      },
    ];

    expect(getPayableLeases(leases)).toEqual([leases[0]]);
  });
});

describe("resolveRentPayAction", () => {
  test("navigates to leases when nothing is due", () => {
    expect(
      resolveRentPayAction(
        summary({
          leases: [
            {
              amountDueCents: 0,
              leaseId: "lease-1",
              paymentsEnabled: true,
              propertyName: "A",
              unitLabel: "1",
            },
          ],
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
            {
              amountDueCents: 100_00,
              leaseId: "lease-1",
              paymentsEnabled: true,
              propertyName: "A",
              unitLabel: "1",
            },
            {
              amountDueCents: 0,
              leaseId: "lease-2",
              paymentsEnabled: true,
              propertyName: "B",
              unitLabel: "2",
            },
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
            {
              amountDueCents: 100_00,
              leaseId: "lease-1",
              paymentsEnabled: false,
              propertyName: "A",
              unitLabel: "1",
            },
          ],
          totalAmountDueCents: 100_00,
        })
      )
    ).toEqual({ href: "/leases/lease-1", kind: "navigate" });
  });

  test("opens lease picker when multiple leases have due balances", () => {
    const leases = [
      {
        amountDueCents: 50_00,
        leaseId: "lease-1",
        paymentsEnabled: true,
        propertyName: "A",
        unitLabel: "1",
      },
      {
        amountDueCents: 50_00,
        leaseId: "lease-2",
        paymentsEnabled: true,
        propertyName: "B",
        unitLabel: "2",
      },
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
            {
              amountDueCents: 50_00,
              leaseId: "lease-1",
              paymentsEnabled: true,
              propertyName: "A",
              unitLabel: "1",
            },
            {
              amountDueCents: 50_00,
              leaseId: "lease-2",
              paymentsEnabled: false,
              propertyName: "B",
              unitLabel: "2",
            },
          ],
          totalAmountDueCents: 100_00,
        })
      )
    ).toEqual({ kind: "checkout", leaseId: "lease-1" });
  });

  test("opens lease picker when multiple leases are due but none are payable", () => {
    const leases = [
      {
        amountDueCents: 50_00,
        leaseId: "lease-1",
        paymentsEnabled: false,
        propertyName: "A",
        unitLabel: "1",
      },
      {
        amountDueCents: 50_00,
        leaseId: "lease-2",
        paymentsEnabled: false,
        propertyName: "B",
        unitLabel: "2",
      },
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
        {
          amountDueCents: 10_00,
          leaseId: "lease-1",
          paymentsEnabled: true,
          propertyName: "A",
          unitLabel: "1",
        },
      ])
    ).toBe(true);
  });

  test("false when due but payments disabled", () => {
    expect(
      hasOnlinePayAvailable([
        {
          amountDueCents: 10_00,
          leaseId: "lease-1",
          paymentsEnabled: false,
          propertyName: "A",
          unitLabel: "1",
        },
      ])
    ).toBe(false);
  });
});
