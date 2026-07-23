import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import { RentPaymentMethodFamily } from "@/packages/shared";

const mockGetLeaseBalance = mock(() =>
  Promise.resolve({
    amountDueCents: 150_000,
    currency: "usd",
    leaseId: "lease-1",
    paymentsEnabled: true,
    periods: [],
  })
);
const mockCreateRentCheckout = mock(() =>
  Promise.resolve({
    checkoutUrl: "https://checkout.stripe.test/pay/cs_1",
    paymentId: "payment-1",
  })
);

mock.module("@/lib/api-client", () => ({
  tenantPortalApi: {
    createRentCheckout: mockCreateRentCheckout,
    getLeaseBalance: mockGetLeaseBalance,
  },
}));

const { startRentCheckoutForAmountDue } = await import("./start-rent-checkout");

describe("startRentCheckoutForAmountDue", () => {
  let assignMock: ReturnType<typeof mock>;
  let originalAssign: typeof globalThis.location.assign | undefined;

  beforeEach(() => {
    mockGetLeaseBalance.mockClear();
    mockCreateRentCheckout.mockClear();
    assignMock = mock(() => {});
    originalAssign = globalThis.location?.assign;
    Object.defineProperty(globalThis, "location", {
      configurable: true,
      value: { assign: assignMock },
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "location", {
      configurable: true,
      value: { assign: originalAssign ?? (() => {}) },
      writable: true,
    });
  });

  test("passes paymentMethodFamily to createRentCheckout", async () => {
    await startRentCheckoutForAmountDue("lease-1", RentPaymentMethodFamily.CARD);

    expect(mockCreateRentCheckout).toHaveBeenCalledWith("lease-1", {
      paymentMethodFamily: RentPaymentMethodFamily.CARD,
    });
    expect(assignMock).toHaveBeenCalledWith("https://checkout.stripe.test/pay/cs_1");
  });

  test("defaults to ACH when method omitted", async () => {
    await startRentCheckoutForAmountDue("lease-1");

    expect(mockCreateRentCheckout).toHaveBeenCalledWith("lease-1", {
      paymentMethodFamily: RentPaymentMethodFamily.US_BANK_ACCOUNT,
    });
  });
});
