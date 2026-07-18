import { describe, expect, test } from "bun:test";

import {
  DEFAULT_PROPERTY_CHANNEL_COMMISSIONS,
  type IPropertyChannelCommission,
  type IPropertyTaxRate,
  ReservationStatus,
  UnitRentalType,
} from "@/packages/shared";
import { makeUnit } from "@/test-fixtures/domain";

import { validateIncomeImportCommitRows } from "./income-csv-import-commit";

const propertyId = "00000000-0000-4000-8000-000000000001";

const units = [
  makeUnit({
    id: "00000000-0000-4000-8000-000000000010",
    layout: "studio",
    propertyId,
    rentalType: UnitRentalType.SHORT_TERM,
    unitNumber: "210",
  }),
];

const channels: IPropertyChannelCommission[] = DEFAULT_PROPERTY_CHANNEL_COMMISSIONS.map(
  (channel, index) => ({
    excludeCleaningFromCommissionBase: channel.excludeCleaningFromCommissionBase ?? false,
    excludeResortTaxFromPayout: channel.excludeResortTaxFromPayout ?? false,
    id: `00000000-0000-4000-8000-0000000000${index + 20}`,
    name: channel.name,
    propertyId,
    rate: channel.rate,
    sortOrder: index,
  })
);

const taxRates: IPropertyTaxRate[] = [
  {
    id: "00000000-0000-4000-8000-000000000030",
    name: "Sales tax",
    propertyId,
    rate: 0.06,
    sortOrder: 1,
  },
];

const bookingChannelId = channels.find((channel) => channel.name === "Booking.com")?.id ?? "";

function buildCommitRow(overrides: Record<string, unknown> = {}) {
  return {
    channelCommissionId: bookingChannelId,
    checkIn: "2026-02-07",
    checkOut: "2026-02-08",
    cleaningFee: 0,
    guestName: "Alexandar Kopilovic",
    nights: 1,
    refunded: false,
    roomTotal: 121.63,
    rowIndex: 2,
    sourceFileName: "hotel-tax-calculator.csv",
    status: ReservationStatus.STAYED,
    unitId: units[0]?.id,
    ...overrides,
  };
}

describe("validateIncomeImportCommitRows", () => {
  test("accepts valid stayed and refund rows", () => {
    const result = validateIncomeImportCommitRows(
      [
        buildCommitRow(),
        buildCommitRow({
          guestName: "Refund Guest",
          refunded: true,
          roomTotal: 0,
          rowIndex: 3,
          status: ReservationStatus.STAYED,
        }),
        buildCommitRow({
          guestName: "Canceled Guest",
          refunded: false,
          rowIndex: 4,
          status: ReservationStatus.CANCELED,
        }),
      ],
      { channels, taxRates, units },
      propertyId,
      2000
    );

    expect("error" in result).toBe(false);
    if ("error" in result) {
      return;
    }

    expect(result.rows).toHaveLength(3);
    expect(result.rows[0]?.input.status).toBe(ReservationStatus.STAYED);
    expect(result.rows[1]?.refunded).toBe(true);
    expect(result.rows[1]?.input.status).toBe(ReservationStatus.STAYED);
    expect(result.rows[2]?.input.status).toBe(ReservationStatus.CANCELED);
    expect(result.rows[0]?.computed.netIncome).toBeGreaterThan(0);
  });

  test("rejects refunded rows with canceled status at commit time", () => {
    const result = validateIncomeImportCommitRows(
      [
        buildCommitRow({
          refunded: true,
          status: ReservationStatus.CANCELED,
        }),
      ],
      { channels, taxRates, units },
      propertyId,
      2000
    );

    expect(result).toEqual({
      error: expect.stringContaining("Refunded stays cannot be canceled or no-show"),
    });
  });

  test("accepts zero-amount refunded stayed rows", () => {
    const result = validateIncomeImportCommitRows(
      [
        buildCommitRow({
          guestName: "Zero Refund Guest",
          refunded: true,
          roomTotal: 0,
          status: ReservationStatus.STAYED,
        }),
      ],
      { channels, taxRates, units },
      propertyId,
      2000
    );

    expect("error" in result).toBe(false);
    if ("error" in result) {
      return;
    }

    expect(result.rows[0]?.refunded).toBe(true);
    expect(result.rows[0]?.input.status).toBe(ReservationStatus.STAYED);
    expect(result.rows[0]?.input.roomTotal).toBe(0);
    expect(result.rows[0]?.computed.netIncome).toBe(0);
  });

  test("rejects rows with unknown unit for property", () => {
    const result = validateIncomeImportCommitRows(
      [
        buildCommitRow({
          unitId: "00000000-0000-4000-8000-000000000099",
        }),
      ],
      { channels, taxRates, units },
      propertyId,
      2000
    );

    expect(result).toEqual({
      error: "Row 1: unit not found for this property",
    });
  });
});
