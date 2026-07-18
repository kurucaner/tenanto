import { describe, expect, mock, test } from "bun:test";

import { ReservationStatus } from "@/packages/shared";
import { buildRefundableReservationRow } from "@/test-fixtures/db-rows";
import { mockAsyncFn, mockResolved, mockSyncVoid } from "@/test-fixtures/mocks";

interface ICapturedQuery {
  sql: string;
  values: unknown[];
}

const capturedQueries: ICapturedQuery[] = [];

const mockClientQuery = mockAsyncFn((sql: string, values?: unknown[]) => {
  capturedQueries.push({ sql, values: values ?? [] });

  if (sql === "BEGIN" || sql === "COMMIT") {
    return Promise.resolve({ rows: [] });
  }

  if (sql.includes("INSERT INTO property_reservations")) {
    const refunded = values?.[16] === true;
    return Promise.resolve({
      rows: [
        buildRefundableReservationRow(
          "00000000-0000-4000-8000-000000000099",
          refunded ? new Date("2026-02-08T12:00:00.000Z") : null,
          refunded ? (values?.[17] as string) : null
        ),
      ],
    });
  }

  return Promise.resolve({ rows: [] });
});

const mockClient = {
  query: mockClientQuery,
  release: mockSyncVoid(),
};

mock.module("./pool", () => ({
  pool: {
    connect: mockResolved(mockClient),
  },
}));

const { propertyReservationsDb } = await import("./property-reservations");

const propertyId = "00000000-0000-4000-8000-000000000001";
const unitId = "00000000-0000-4000-8000-000000000010";
const channelId = "00000000-0000-4000-8000-000000000021";
const refundedByUserId = "00000000-0000-4000-8000-0000000000aa";

describe("propertyReservationsDb.createMany refund import", () => {
  test("sets refunded_at and refunded_by on refunded rows in the same insert", async () => {
    capturedQueries.length = 0;
    mockClientQuery.mockClear();

    const reservations = await propertyReservationsDb.createMany(
      propertyId,
      [
        {
          computed: {
            channelCommission: 0,
            channelCommissionRate: 0,
            grossIncome: 0,
            netIncome: 0,
            nights: 1,
            taxBreakdown: [],
          },
          input: {
            channelCommissionId: channelId,
            checkIn: "2026-02-07",
            checkOut: "2026-02-08",
            cleaningFee: 0,
            guestName: "Refund Guest",
            roomTotal: 0,
            status: ReservationStatus.STAYED,
            unitId,
          },
          refunded: true,
        },
      ],
      refundedByUserId
    );

    const insertQuery = capturedQueries.find((entry) =>
      entry.sql.includes("INSERT INTO property_reservations")
    );

    expect(insertQuery).toBeDefined();
    expect(insertQuery?.sql).toContain("RETURNING *");
    expect(insertQuery?.sql).toContain("refunded_at");
    expect(insertQuery?.sql).toContain("refunded_by");
    expect(insertQuery?.sql).toContain("refunded_amount");
    expect(insertQuery?.sql).toContain("CASE WHEN $17::boolean THEN NOW() ELSE NULL END");
    expect(insertQuery?.values[16]).toBe(true);
    expect(insertQuery?.values[17]).toBe(refundedByUserId);

    expect(reservations).toHaveLength(1);
    expect(reservations[0]?.refundedAt).toBe("2026-02-08T12:00:00.000Z");
    expect(reservations[0]?.refundedBy).toBe(refundedByUserId);
    expect(reservations[0]?.refundedAmount).toBe(0);
    expect(reservations[0]?.status).toBe(ReservationStatus.STAYED);
  });

  test("leaves refunded fields null for non-refunded rows", async () => {
    capturedQueries.length = 0;
    mockClientQuery.mockClear();

    const reservations = await propertyReservationsDb.createMany(
      propertyId,
      [
        {
          computed: {
            channelCommission: 18.24,
            channelCommissionRate: 0.15,
            grossIncome: 128.93,
            netIncome: 96.09,
            nights: 1,
            taxBreakdown: [],
          },
          input: {
            channelCommissionId: channelId,
            checkIn: "2026-02-07",
            checkOut: "2026-02-08",
            cleaningFee: 0,
            guestName: "Stayed Guest",
            roomTotal: 121.63,
            status: ReservationStatus.STAYED,
            unitId,
          },
          refunded: false,
        },
      ],
      refundedByUserId
    );

    const insertQuery = capturedQueries.find((entry) =>
      entry.sql.includes("INSERT INTO property_reservations")
    );

    expect(insertQuery?.values[16]).toBe(false);
    expect(reservations[0]?.refundedAt).toBeNull();
    expect(reservations[0]?.refundedBy).toBeNull();
    expect(reservations[0]?.refundedAmount).toBeNull();
  });
});
