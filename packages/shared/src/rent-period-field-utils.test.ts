import { describe, expect, test } from "bun:test";

import type {
  IExtendPropertyLongStayBody,
  IPropertyLongStay,
  IPropertyLongStayRentMonth,
  IPropertyLongStayRentPeriod,
} from "./property-long-stay-types";
import {
  getLeaseRentAmount,
  getRentPeriodAmount,
  getRentPeriodEffectiveFrom,
  getRentSchedulePeriodKey,
  resolveCreateLeaseRentAmount,
  resolveExtendNewRentAmount,
  resolveExtendRentEffectivePeriod,
  resolveIncomeLineRentPeriodKey,
  withLeaseRentLegacyShims,
  withRentPeriodLegacyShims,
  withRentScheduleLegacyShims,
} from "./rent-period-field-utils";

describe("rent period field accessors", () => {
  test("prefers primary rent period fields when present", () => {
    const period: IPropertyLongStayRentPeriod = {
      effectiveFromMonth: "2026-01",
      effectiveFromPeriod: "2026-01-15",
      monthlyRent: 1500,
      rentAmount: 700,
    };

    expect(getRentPeriodEffectiveFrom(period)).toBe("2026-01-15");
    expect(getRentPeriodAmount(period)).toBe(700);
  });

  test("falls back to legacy rent period fields", () => {
    const period: IPropertyLongStayRentPeriod = {
      effectiveFromMonth: "2026-01-15",
      monthlyRent: 700,
    };

    expect(getRentPeriodEffectiveFrom(period)).toBe("2026-01-15");
    expect(getRentPeriodAmount(period)).toBe(700);
  });

  test("prefers periodKey on rent schedule rows", () => {
    const item: IPropertyLongStayRentMonth = {
      daysInMonth: 7,
      expectedRent: 700,
      isPaid: false,
      isProrated: false,
      month: "2026-01-01",
      occupiedDays: 7,
      paidRent: 0,
      periodKey: "2026-01-15",
      remainingRent: 700,
    };

    expect(getRentSchedulePeriodKey(item)).toBe("2026-01-15");
  });

  test("resolves create lease rent amount from primary or legacy field names", () => {
    expect(resolveCreateLeaseRentAmount({ rentAmount: 900 })).toBe(900);
    expect(resolveCreateLeaseRentAmount({ monthlyRent: 800 })).toBe(800);
  });

  test("resolves income line rent period key from primary or legacy field names", () => {
    expect(resolveIncomeLineRentPeriodKey({ rentPeriodKey: "2026-02" })).toBe("2026-02");
    expect(resolveIncomeLineRentPeriodKey({ rentPeriodMonth: "2026-01" })).toBe("2026-01");
  });

  test("resolves extend body from legacy or primary field names", () => {
    const legacy: IExtendPropertyLongStayBody = {
      newMonthlyRent: 800,
      rentEffectiveFromMonth: "2026-02-01",
    };
    const primary: IExtendPropertyLongStayBody = {
      newRentAmount: 900,
      rentEffectiveFromPeriod: "2026-03-01",
    };

    expect(resolveExtendNewRentAmount(legacy)).toBe(800);
    expect(resolveExtendRentEffectivePeriod(legacy)).toBe("2026-02-01");
    expect(resolveExtendNewRentAmount(primary)).toBe(900);
    expect(resolveExtendRentEffectivePeriod(primary)).toBe("2026-03-01");
  });
});

describe("rent period legacy shims", () => {
  test("adds parallel legacy fields without dropping primary names", () => {
    const period = withRentPeriodLegacyShims({
      effectiveFromPeriod: "2026-01-15",
      rentAmount: 700,
    });

    expect(period).toEqual({
      effectiveFromMonth: "2026-01-15",
      effectiveFromPeriod: "2026-01-15",
      monthlyRent: 700,
      rentAmount: 700,
    });
  });

  test("adds periodKey and month to rent schedule rows", () => {
    const item = withRentScheduleLegacyShims({
      daysInMonth: 7,
      expectedRent: 700,
      isPaid: false,
      isProrated: false,
      occupiedDays: 7,
      paidRent: 0,
      periodKey: "2026-01-15",
      remainingRent: 700,
    });

    expect(item.periodKey).toBe("2026-01-15");
    expect(item.month).toBe("2026-01-15");
  });

  test("adds rentAmount and monthlyRent to lease records", () => {
    const lease = withLeaseRentLegacyShims({
      actualEndDate: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      guestName: "Guest",
      id: "lease-1",
      leaseEndDate: "2026-06-30",
      leaseStartDate: "2026-01-01",
      propertyId: "property-1",
      rentAmount: 1500,
      rentBillingCadence: "monthly",
      secondaryTenants: [],
      securityDepositAmount: null,
      securityDepositTracksRent: false,
      status: "active",
      tenantEmail: null,
      tenantPhone: null,
      termMonths: 6,
      unitId: "unit-1",
      updatedAt: "2026-01-01T00:00:00.000Z",
    } satisfies IPropertyLongStay);

    expect(getLeaseRentAmount(lease)).toBe(1500);
    expect(lease.rentAmount).toBe(1500);
    expect(lease.monthlyRent).toBe(1500);
  });
});
