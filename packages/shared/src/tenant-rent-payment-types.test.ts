import { describe, expect, test } from "bun:test";

import {
  isTerminalTenantRentPaymentStatus,
  TenantRentPaymentStatus,
} from "./tenant-rent-payment-types";

describe("isTerminalTenantRentPaymentStatus", () => {
  test("treats succeeded/failed/canceled/refunded as terminal", () => {
    expect(isTerminalTenantRentPaymentStatus(TenantRentPaymentStatus.SUCCEEDED)).toBe(true);
    expect(isTerminalTenantRentPaymentStatus(TenantRentPaymentStatus.FAILED)).toBe(true);
    expect(isTerminalTenantRentPaymentStatus(TenantRentPaymentStatus.CANCELED)).toBe(true);
    expect(isTerminalTenantRentPaymentStatus(TenantRentPaymentStatus.REFUNDED)).toBe(true);
  });

  test("keeps pending/processing/requires_action open for polling", () => {
    expect(isTerminalTenantRentPaymentStatus(TenantRentPaymentStatus.PENDING)).toBe(false);
    expect(isTerminalTenantRentPaymentStatus(TenantRentPaymentStatus.PROCESSING)).toBe(false);
    expect(isTerminalTenantRentPaymentStatus(TenantRentPaymentStatus.REQUIRES_ACTION)).toBe(false);
  });
});
