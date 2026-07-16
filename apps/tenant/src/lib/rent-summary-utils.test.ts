import { describe, expect, test } from "bun:test";

import { hasOnlinePayAvailable, resolveRentPayAction } from "./rent-summary-utils";

describe("resolveRentPayAction", () => {
  test("navigates to leases when nothing is due", () => {
    expect(
      resolveRentPayAction({
        currency: "usd",
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
    ).toEqual({ href: "/leases", kind: "navigate" });
  });

  test("starts checkout for a single due lease with payments enabled", () => {
    expect(
      resolveRentPayAction({
        currency: "usd",
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
    ).toEqual({ kind: "checkout", leaseId: "lease-1" });
  });

  test("navigates to lease detail when due but payments disabled", () => {
    expect(
      resolveRentPayAction({
        currency: "usd",
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
    ).toEqual({ href: "/leases/lease-1", kind: "navigate" });
  });

  test("navigates to leases list when multiple leases have due", () => {
    expect(
      resolveRentPayAction({
        currency: "usd",
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
            paymentsEnabled: true,
            propertyName: "B",
            unitLabel: "2",
          },
        ],
        totalAmountDueCents: 100_00,
      })
    ).toEqual({ href: "/leases", kind: "navigate" });
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
