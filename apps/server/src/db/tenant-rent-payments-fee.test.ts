import { beforeEach, describe, expect, mock, test } from "bun:test";

import { RentPaymentMethodFamily } from "@/packages/shared";
import { mockAsyncFn, mockResolved, mockSyncVoid } from "@/test-fixtures/mocks";

interface ICapturedQuery {
  sql: string;
  values: unknown[];
}

const capturedQueries: ICapturedQuery[] = [];

const paymentId = "00000000-0000-4000-8000-0000000000p1";

function paymentRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    amount_cents: 150_000,
    charge_cents: 154_380,
    connected_account_id: "acct_1",
    created_at: new Date("2026-07-22T12:00:00.000Z"),
    currency: "usd",
    fee_cents: 4_380,
    id: paymentId,
    idempotency_key: "rent_checkout:lease-1:tenant-1:2026-01:150000",
    lease_id: "lease-1",
    payment_method_family: RentPaymentMethodFamily.CARD,
    property_id: "property-1",
    status: "pending",
    stripe_checkout_session_id: null,
    stripe_payment_intent_id: null,
    tenant_user_id: "tenant-1",
    updated_at: new Date("2026-07-22T12:00:00.000Z"),
    ...overrides,
  };
}

const mockClientQuery = mockAsyncFn((sql: string, values?: unknown[]) => {
  capturedQueries.push({ sql, values: values ?? [] });
  return Promise.resolve({ rows: [] });
});

const mockPoolQuery = mockAsyncFn((sql: string, values?: unknown[]) => {
  capturedQueries.push({ sql, values: values ?? [] });
  return Promise.resolve({ rows: [] });
});

mock.module("./pool", () => ({
  pool: {
    connect: mockResolved({
      query: mockClientQuery,
      release: mockSyncVoid(),
    }),
    query: mockPoolQuery,
  },
}));

const { tenantRentPaymentsDb } = await import("./tenant-rent-payments");

describe("tenantRentPaymentsDb fee / method / charge", () => {
  beforeEach(() => {
    capturedQueries.length = 0;
    mockClientQuery.mockClear();
    mockPoolQuery.mockClear();
  });

  test("createWithAllocations inserts fee_cents, charge_cents, payment_method_family", async () => {
    mockClientQuery.mockImplementation(
      (sql: string, values?: unknown[]): Promise<{ rows: never[] }> => {
        capturedQueries.push({ sql, values: values ?? [] });
        if (sql.includes("INSERT INTO tenant_rent_payments")) {
          return Promise.resolve({ rows: [paymentRow()] as never[] });
        }
        return Promise.resolve({ rows: [] });
      }
    );

    const payment = await tenantRentPaymentsDb.createWithAllocations({
      allocations: [
        {
          allocatedCents: 150_000,
          expectedCentsSnapshot: 150_000,
          periodMonth: "2026-01",
        },
      ],
      amountCents: 150_000,
      chargeCents: 154_380,
      connectedAccountId: "acct_1",
      feeCents: 4_380,
      idempotencyKey: "rent_checkout:lease-1:tenant-1:2026-01:150000",
      leaseId: "lease-1",
      paymentMethodFamily: RentPaymentMethodFamily.CARD,
      propertyId: "property-1",
      tenantUserId: "tenant-1",
    });

    const insert = capturedQueries.find((q) => q.sql.includes("INSERT INTO tenant_rent_payments"));
    expect(insert?.sql).toContain("fee_cents");
    expect(insert?.sql).toContain("charge_cents");
    expect(insert?.sql).toContain("payment_method_family");
    expect(insert?.values).toEqual(
      expect.arrayContaining([150_000, 4_380, 154_380, RentPaymentMethodFamily.CARD])
    );
    expect(payment).toMatchObject({
      amountCents: 150_000,
      chargeCents: 154_380,
      feeCents: 4_380,
      paymentMethodFamily: RentPaymentMethodFamily.CARD,
    });
  });

  test("findById maps fee, charge, and method", async () => {
    mockPoolQuery.mockImplementationOnce(
      (sql: string, values?: unknown[]): Promise<{ rows: never[] }> => {
        capturedQueries.push({ sql, values: values ?? [] });
        return Promise.resolve({ rows: [paymentRow()] as never[] });
      }
    );

    const payment = await tenantRentPaymentsDb.findById(paymentId);
    expect(payment).toMatchObject({
      amountCents: 150_000,
      chargeCents: 154_380,
      feeCents: 4_380,
      id: paymentId,
      paymentMethodFamily: RentPaymentMethodFamily.CARD,
    });
  });

  test("createWithAllocations defaults fee 0 and charge = amount when omitted", async () => {
    mockClientQuery.mockImplementation(
      (sql: string, values?: unknown[]): Promise<{ rows: never[] }> => {
        capturedQueries.push({ sql, values: values ?? [] });
        if (sql.includes("INSERT INTO tenant_rent_payments")) {
          return Promise.resolve({
            rows: [
              paymentRow({
                amount_cents: 200_00,
                charge_cents: 200_00,
                fee_cents: 0,
                payment_method_family: null,
              }),
            ] as never[],
          });
        }
        return Promise.resolve({ rows: [] });
      }
    );

    await tenantRentPaymentsDb.createWithAllocations({
      allocations: [
        {
          allocatedCents: 200_00,
          expectedCentsSnapshot: 200_00,
          periodMonth: "2026-01",
        },
      ],
      amountCents: 200_00,
      connectedAccountId: "acct_1",
      idempotencyKey: "key-legacy",
      leaseId: "lease-1",
      propertyId: "property-1",
      tenantUserId: "tenant-1",
    });

    const insert = capturedQueries.find((q) => q.sql.includes("INSERT INTO tenant_rent_payments"));
    // $6 amount, $7 fee, $8 charge, $9 method
    expect(insert?.values?.[5]).toBe(200_00);
    expect(insert?.values?.[6]).toBe(0);
    expect(insert?.values?.[7]).toBe(200_00);
    expect(insert?.values?.[8]).toBeNull();
  });
});
