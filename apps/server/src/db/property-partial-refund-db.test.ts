import { describe, expect, mock, test } from "bun:test";

interface ICapturedQuery {
  sql: string;
  values: unknown[];
}

const capturedQueries: ICapturedQuery[] = [];

const mockPoolQuery = mock((sql: string, values?: unknown[]) => {
  capturedQueries.push({ sql, values: values ?? [] });
  return Promise.resolve({ rowCount: 1, rows: [] });
});

mock.module("./pool", () => ({
  pool: {
    query: mockPoolQuery,
  },
}));

const { propertyReservationsDb } = await import("./property-reservations");
const { propertyIncomeLinesDb } = await import("./property-income-lines");

const stayId = "11111111-1111-4111-8111-111111111111";
const lineId = "22222222-2222-4222-8222-222222222222";
const userId = "33333333-3333-4333-8333-333333333333";

describe("propertyReservationsDb partial refund", () => {
  test("refund defaults refunded_amount to gross_income when amount is omitted", async () => {
    capturedQueries.length = 0;
    mockPoolQuery.mockClear();

    const updated = await propertyReservationsDb.refund(stayId, userId);

    expect(updated).toBe(true);
    expect(capturedQueries[0]?.sql).toContain("refunded_amount = COALESCE($3::numeric, gross_income)");
    expect(capturedQueries[0]?.values).toEqual([stayId, userId, null]);
  });

  test("refund stores explicit partial refunded_amount", async () => {
    capturedQueries.length = 0;
    mockPoolQuery.mockClear();

    await propertyReservationsDb.refund(stayId, userId, 125);

    expect(capturedQueries[0]?.values).toEqual([stayId, userId, 125]);
  });

  test("unrefund clears refunded_amount", async () => {
    capturedQueries.length = 0;
    mockPoolQuery.mockClear();

    await propertyReservationsDb.unrefund(stayId);

    expect(capturedQueries[0]?.sql).toContain("refunded_amount = NULL");
    expect(capturedQueries[0]?.values).toEqual([stayId]);
  });
});

describe("propertyIncomeLinesDb partial refund", () => {
  test("refund defaults refunded_amount to amount when amount is omitted", async () => {
    capturedQueries.length = 0;
    mockPoolQuery.mockClear();

    const updated = await propertyIncomeLinesDb.refund(lineId, userId);

    expect(updated).toBe(true);
    expect(capturedQueries[0]?.sql).toContain("refunded_amount = COALESCE($3::numeric, amount)");
    expect(capturedQueries[0]?.values).toEqual([lineId, userId, null]);
  });

  test("refund stores explicit partial refunded_amount", async () => {
    capturedQueries.length = 0;
    mockPoolQuery.mockClear();

    await propertyIncomeLinesDb.refund(lineId, userId, 50);

    expect(capturedQueries[0]?.values).toEqual([lineId, userId, 50]);
  });

  test("unrefund clears refunded_amount", async () => {
    capturedQueries.length = 0;
    mockPoolQuery.mockClear();

    await propertyIncomeLinesDb.unrefund(lineId);

    expect(capturedQueries[0]?.sql).toContain("refunded_amount = NULL");
    expect(capturedQueries[0]?.values).toEqual([lineId]);
  });
});
