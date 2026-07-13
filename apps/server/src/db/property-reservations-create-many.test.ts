import { describe, expect, mock, test } from "bun:test";

import { ReservationStatus } from "@/packages/shared";

interface ICapturedQuery {
  sql: string;
  values: unknown[];
}

const capturedQueries: ICapturedQuery[] = [];

function buildReservationRow(id: string, refundedAt: Date | null, refundedBy: string | null) {
  return {
    channel_commission: "0.00",
    channel_commission_id: "00000000-0000-4000-8000-000000000021",
    channel_commission_rate: "0.00000",
    channel_name: "Booking.com",
    check_in: "2026-02-07",
    check_out: "2026-02-08",
    cleaning_fee: "0.00",
    created_at: new Date("2026-02-08T12:00:00.000Z"),
    deleted_at: null,
    exclude_cleaning_from_commission_base: false,
    exclude_resort_tax_from_payout: false,
    gross_income: "0.00",
    guest_name: "Refund Guest",
    id,
    is_deleted: false,
    net_income: "0.00",
    nights: 1,
    property_id: "00000000-0000-4000-8000-000000000001",
    refunded_amount: refundedAt ? "0.00" : null,
    refunded_at: refundedAt,
    refunded_by: refundedBy,
    reservation_number: null,
    room_total: "0.00",
    status: ReservationStatus.STAYED,
    tax_breakdown: "[]",
    unit_id: "00000000-0000-4000-8000-000000000010",
    updated_at: new Date("2026-02-08T12:00:00.000Z"),
  };
}

const mockClientQuery = mock((sql: string, values?: unknown[]) => {
  capturedQueries.push({ sql, values: values ?? [] });

  if (sql === "BEGIN" || sql === "COMMIT") {
    return Promise.resolve({ rows: [] });
  }

  if (sql.includes("INSERT INTO property_reservations")) {
    const refunded = values?.[16] === true;
    return Promise.resolve({
      rows: [
        buildReservationRow(
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
  release: mock(() => {}),
};

mock.module("./pool", () => ({
  pool: {
    connect: mock(() => Promise.resolve(mockClient)),
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
