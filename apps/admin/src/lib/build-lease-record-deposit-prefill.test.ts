import { describe, expect, test } from "bun:test";

import { getTodayLocalIsoDate } from "@/lib/reservation-date-utils";

import {
  buildLeaseRecordDepositPrefill,
  canRecordLeaseSecurityDeposit,
} from "./build-lease-record-deposit-prefill";

describe("buildLeaseRecordDepositPrefill", () => {
  const lease = {
    guestName: "Tenant",
    id: "lease-1",
    securityDepositAmount: 1500,
    unitId: "unit-1",
  };

  test("prefills amount, lease link, and deposit intent without rent period", () => {
    const prefill = buildLeaseRecordDepositPrefill(lease);

    expect(prefill).toEqual({
      amount: "1500",
      guestName: "Tenant",
      isSecurityDeposit: true,
      longStayId: "lease-1",
      transactionDate: getTodayLocalIsoDate(),
      unitId: "unit-1",
    });
    expect(prefill.rentPeriodKey).toBeUndefined();
  });

  test("uses empty amount when deposit is null", () => {
    const prefill = buildLeaseRecordDepositPrefill({
      ...lease,
      securityDepositAmount: null,
    });

    expect(prefill.amount).toBe("");
    expect(prefill.isSecurityDeposit).toBe(true);
  });
});

describe("canRecordLeaseSecurityDeposit", () => {
  test("true when expected deposit is positive", () => {
    expect(canRecordLeaseSecurityDeposit({ securityDepositAmount: 1500 })).toBe(true);
  });

  test("false when deposit is null, zero, or negative", () => {
    expect(canRecordLeaseSecurityDeposit({ securityDepositAmount: null })).toBe(false);
    expect(canRecordLeaseSecurityDeposit({ securityDepositAmount: 0 })).toBe(false);
    expect(canRecordLeaseSecurityDeposit({ securityDepositAmount: -1 })).toBe(false);
  });
});
