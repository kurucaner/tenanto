import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { ITenantRentPayment } from "@/db/tenant-rent-payments";
import { buildRentCheckoutIdempotencyKey, TenantRentPaymentStatus } from "@/packages/shared";

const mockUpdateStatus = mock(() => Promise.resolve(null as ITenantRentPayment | null));
const mockRefundAllLinked = mock(() => Promise.resolve(0));
const mockLoggerInfo = mock(() => undefined);
const mockLoggerWarn = mock(() => undefined);

mock.module("@/db/tenant-rent-payments", () => ({
  tenantRentPaymentsDb: {
    updateStatus: mockUpdateStatus,
  },
}));

mock.module("@/db/property-income-lines", () => ({
  propertyIncomeLinesDb: {
    refundAllLinkedToTenantRentPayment: mockRefundAllLinked,
  },
}));

mock.module("@/services/winston", () => ({
  WinstonLogger: {
    error: mock(() => undefined),
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
  },
}));

const { tenantRentPaymentService } = await import("./tenant-rent-payment-service");

function makePayment(overrides: Partial<ITenantRentPayment> = {}): ITenantRentPayment {
  return {
    amountCents: 200_00,
    connectedAccountId: "acct_1",
    createdAt: "2026-01-01T00:00:00.000Z",
    currency: "usd",
    id: "payment-1",
    idempotencyKey: buildRentCheckoutIdempotencyKey({
      amountCents: 200_00,
      leaseId: "lease-1",
      periodMonths: ["2026-01"],
      tenantUserId: "tenant-1",
    }),
    leaseId: "lease-1",
    propertyId: "property-1",
    status: TenantRentPaymentStatus.SUCCEEDED,
    stripeCheckoutSessionId: "cs_1",
    stripePaymentIntentId: "pi_1",
    tenantUserId: "tenant-1",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("tenantRentPaymentService.markRefunded", () => {
  beforeEach(() => {
    mockUpdateStatus.mockClear();
    mockRefundAllLinked.mockClear();
    mockLoggerInfo.mockClear();
    mockLoggerWarn.mockClear();
  });

  test("no-ops when payment is already refunded", async () => {
    const payment = makePayment({ status: TenantRentPaymentStatus.REFUNDED });

    const result = await tenantRentPaymentService.markRefunded(payment, {
      amountRefundedCents: 200_00,
      chargeAmountCents: 200_00,
    });

    expect(result).toBe(payment);
    expect(mockUpdateStatus).not.toHaveBeenCalled();
    expect(mockRefundAllLinked).not.toHaveBeenCalled();
  });

  test("marks refunded and refunds linked income on full refund", async () => {
    const payment = makePayment();
    const updated = makePayment({ status: TenantRentPaymentStatus.REFUNDED });
    mockUpdateStatus.mockResolvedValueOnce(updated);
    mockRefundAllLinked.mockResolvedValueOnce(1);

    const result = await tenantRentPaymentService.markRefunded(payment, {
      amountRefundedCents: 200_00,
      chargeAmountCents: 200_00,
    });

    expect(mockUpdateStatus).toHaveBeenCalledWith("payment-1", TenantRentPaymentStatus.REFUNDED);
    expect(mockRefundAllLinked).toHaveBeenCalledWith("payment-1");
    expect(result).toEqual(updated);
  });

  test("marks refunded but skips income refund on partial refund", async () => {
    const payment = makePayment();
    const updated = makePayment({ status: TenantRentPaymentStatus.REFUNDED });
    mockUpdateStatus.mockResolvedValueOnce(updated);

    await tenantRentPaymentService.markRefunded(payment, {
      amountRefundedCents: 50_00,
      chargeAmountCents: 200_00,
    });

    expect(mockUpdateStatus).toHaveBeenCalledWith("payment-1", TenantRentPaymentStatus.REFUNDED);
    expect(mockRefundAllLinked).not.toHaveBeenCalled();
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: "tenant_payments.refund_partial_unhandled",
        paymentId: "payment-1",
      })
    );
  });
});
