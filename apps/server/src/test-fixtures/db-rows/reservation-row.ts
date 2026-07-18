import { ReservationStatus } from "@/packages/shared";

import { testDateTime, testIsoDate } from "../dates";
import { TEST_CHANNEL_ID, TEST_PROPERTY_ID, TEST_UNIT_ID } from "../ids";

export type TReservationRowOverrides = Record<string, unknown>;

export function buildReservationRow(overrides: TReservationRowOverrides = {}): Record<string, unknown> {
  return {
    channel_commission: "10.00",
    channel_commission_id: TEST_CHANNEL_ID,
    channel_commission_rate: "0.10000",
    channel_name: "Airbnb",
    check_in: testIsoDate(0),
    check_out: testIsoDate(2),
    cleaning_fee: "0.00",
    created_at: testDateTime(0),
    deleted_at: null,
    exclude_cleaning_from_commission_base: false,
    exclude_resort_tax_from_payout: false,
    gross_income: "100.00",
    guest_name: "Guest A",
    id: "11111111-1111-4111-8111-111111111111",
    is_deleted: false,
    net_income: "90.00",
    nights: 2,
    property_id: TEST_PROPERTY_ID,
    refunded_amount: null,
    refunded_at: null,
    refunded_by: null,
    reservation_number: null,
    room_total: "100.00",
    status: ReservationStatus.STAYED,
    tax_breakdown: [],
    unit_id: TEST_UNIT_ID,
    updated_at: testDateTime(0),
    ...overrides,
  };
}

/** Row shape used by create-many / refund DB tests (Booking.com, zero amounts). */
export function buildRefundableReservationRow(
  id: string,
  refundedAt: Date | null,
  refundedBy: string | null,
  overrides: TReservationRowOverrides = {}
): Record<string, unknown> {
  return buildReservationRow({
    channel_commission: "0.00",
    channel_commission_id: "00000000-0000-4000-8000-000000000021",
    channel_commission_rate: "0.00000",
    channel_name: "Booking.com",
    check_in: "2026-02-07",
    check_out: "2026-02-08",
    created_at: new Date("2026-02-08T12:00:00.000Z"),
    gross_income: "0.00",
    guest_name: "Refund Guest",
    id,
    net_income: "0.00",
    nights: 1,
    property_id: "00000000-0000-4000-8000-000000000001",
    refunded_amount: refundedAt ? "0.00" : null,
    refunded_at: refundedAt,
    refunded_by: refundedBy,
    room_total: "0.00",
    tax_breakdown: "[]",
    unit_id: "00000000-0000-4000-8000-000000000010",
    updated_at: new Date("2026-02-08T12:00:00.000Z"),
    ...overrides,
  });
}
