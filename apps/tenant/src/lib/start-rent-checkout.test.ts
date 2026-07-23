import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import { RentPaymentMethodFamily } from "@/packages/shared";

const mockGetLeaseBalance = mock(() =>
  Promise.resolve({
    achPaymentsEnabled: true,
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

const originalStripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

const {
  buildTenantRentPayPagePath,
  startRentCheckoutForAmountDue,
  startRentPayForAmountDue,
  TENANT_RENT_ACH_UNAVAILABLE_MESSAGE,
} = await import("./start-rent-checkout");

describe("startRentCheckoutForAmountDue", () => {
  let assignMock: ReturnType<typeof mock>;
  let originalAssign: typeof globalThis.location.assign | undefined;

  beforeEach(() => {
    import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY = "";
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
    import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY = originalStripeKey;
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

  test("rejects ACH when property is not ACH-ready", async () => {
    mockGetLeaseBalance.mockImplementationOnce(() =>
      Promise.resolve({
        achPaymentsEnabled: false,
        amountDueCents: 150_000,
        currency: "usd",
        leaseId: "lease-1",
        paymentsEnabled: true,
        periods: [],
      })
    );

    await expect(
      startRentCheckoutForAmountDue("lease-1", RentPaymentMethodFamily.US_BANK_ACCOUNT)
    ).rejects.toThrow(TENANT_RENT_ACH_UNAVAILABLE_MESSAGE);
    expect(mockCreateRentCheckout).not.toHaveBeenCalled();
  });
});

describe("startRentPayForAmountDue", () => {
  beforeEach(() => {
    mockGetLeaseBalance.mockClear();
    mockCreateRentCheckout.mockClear();
  });

  afterEach(() => {
    import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY = originalStripeKey;
  });

  test("returns element path when publishable key is configured", async () => {
    import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY = "pk_test_123";

    const result = await startRentPayForAmountDue("lease-1", RentPaymentMethodFamily.CARD);

    expect(result).toEqual({
      kind: "element",
      path: buildTenantRentPayPagePath("lease-1", RentPaymentMethodFamily.CARD),
    });
    expect(mockCreateRentCheckout).not.toHaveBeenCalled();
  });

  test("redirects to Checkout when publishable key is missing", async () => {
    import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY = "";
    const assignMock = mock(() => {});
    Object.defineProperty(globalThis, "location", {
      configurable: true,
      value: { assign: assignMock },
      writable: true,
    });

    const result = await startRentPayForAmountDue("lease-1", RentPaymentMethodFamily.CARD);

    expect(result).toEqual({ kind: "checkout" });
    expect(mockCreateRentCheckout).toHaveBeenCalledTimes(1);
    expect(assignMock).toHaveBeenCalledWith("https://checkout.stripe.test/pay/cs_1");
  });
});
