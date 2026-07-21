import { describe, expect, test } from "bun:test";

import {
  getLeaseRentAmount,
  getRentPeriodAmount,
  getRentPeriodEffectiveFrom,
  getRentSchedulePeriodKey,
  resolveExtendNewRentAmount,
  resolveExtendRentEffectivePeriod,
  withLeaseRentAmountNeutralFields,
  withRentPeriodNeutralFields,
  withRentScheduleNeutralFields,
} from "./rent-period-field-utils";
import type {
  IExtendPropertyLongStayBody,
  IPropertyLongStay,
  IPropertyLongStayRentMonth,
  IPropertyLongStayRentPeriod,
} from "./property-long-stay-types";

describe("rent period field accessors", () => {
  test("prefers neutral rent period fields when present", () => {
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

  test("resolves extend body from legacy or neutral field names", () => {
    const legacy: IExtendPropertyLongStayBody = {
      newMonthlyRent: 800,
      rentEffectiveFromMonth: "2026-02-01",
    };
    const neutral: IExtendPropertyLongStayBody = {
      newRentAmount: 900,
      rentEffectiveFromPeriod: "2026-03-01",
    };

    expect(resolveExtendNewRentAmount(legacy)).toBe(800);
    expect(resolveExtendRentEffectivePeriod(legacy)).toBe("2026-02-01");
    expect(resolveExtendNewRentAmount(neutral)).toBe(900);
    expect(resolveExtendRentEffectivePeriod(neutral)).toBe("2026-03-01");
  });
});

describe("rent period field enrichers", () => {
  test("adds parallel neutral fields without dropping legacy names", () => {
    const period = withRentPeriodNeutralFields({
      effectiveFromMonth: "2026-01-15",
      monthlyRent: 700,
    });

    expect(period).toEqual({
      effectiveFromMonth: "2026-01-15",
      effectiveFromPeriod: "2026-01-15",
      monthlyRent: 700,
      rentAmount: 700,
    });
  });

  test("adds periodKey to rent schedule rows", () => {
    const item = withRentScheduleNeutralFields({
      daysInMonth: 7,
      expectedRent: 700,
      isPaid: false,
      isProrated: false,
      month: "2026-01-15",
      occupiedDays: 7,
      paidRent: 0,
      remainingRent: 700,
    });

    expect(item.periodKey).toBe("2026-01-15");
    expect(item.month).toBe("2026-01-15");
  });

  test("adds rentAmount to lease records", () => {
    const lease = withLeaseRentAmountNeutralFields({
      actualEndDate: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      guestName: "Guest",
      id: "lease-1",
      leaseEndDate: "2026-06-30",
      leaseStartDate: "2026-01-01",
      monthlyRent: 1500,
      propertyId: "property-1",
      rentBillingCadence: "monthly",
      secondaryTenants: [],
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
