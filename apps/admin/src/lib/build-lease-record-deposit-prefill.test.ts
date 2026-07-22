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

  test("prefills outstanding when deposit summary has remaining balance", () => {
    const prefill = buildLeaseRecordDepositPrefill(lease, { outstanding: 1000 });

    expect(prefill).toEqual({
      amount: "1000",
      guestName: "Tenant",
      isSecurityDeposit: true,
      longStayId: "lease-1",
      transactionDate: getTodayLocalIsoDate(),
      unitId: "unit-1",
    });
    expect(prefill.rentPeriodKey).toBeUndefined();
  });

  test("falls back to expected deposit when summary is omitted", () => {
    const prefill = buildLeaseRecordDepositPrefill(lease);

    expect(prefill.amount).toBe("1500");
    expect(prefill.isSecurityDeposit).toBe(true);
  });

  test("falls back to expected when outstanding is zero", () => {
    const prefill = buildLeaseRecordDepositPrefill(lease, { outstanding: 0 });

    expect(prefill.amount).toBe("1500");
  });

  test("uses empty amount when deposit is null and no outstanding", () => {
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
